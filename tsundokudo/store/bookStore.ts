import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import {
  cacheKey,
  getCached,
  isCacheValid,
  removeCached,
  setCached,
  touchLastFetched,
} from '@/lib/mmkv';
import type { Book, BookFilters, BookInsert, BookUpdate } from '@/types/database';

// ============================================================
// オフラインキューの型
// ============================================================

type QueueOpType = 'create' | 'update' | 'delete';

interface QueueOpCreate {
  opId: string;
  type: 'create';
  optimisticId: string;
  payload: BookInsert;
  timestamp: number;
}
interface QueueOpUpdate {
  opId: string;
  type: 'update';
  bookId: string;
  payload: BookUpdate;
  timestamp: number;
}
interface QueueOpDelete {
  opId: string;
  type: 'delete';
  bookId: string;
  timestamp: number;
}

type OfflineOperation = QueueOpCreate | QueueOpUpdate | QueueOpDelete;

// ============================================================
// Store の型定義
// ============================================================

interface BookState {
  /** ローカルキャッシュ上のbook一覧 */
  books: Book[];
  /** 処理中フラグ */
  loading: boolean;
  /** エラーメッセージ */
  error: string | null;
  /** オフラインキュー（MMKV永続化済み） */
  offlineQueue: OfflineOperation[];
  /** 認証ユーザーID（キャッシュキーに使用） */
  currentUserId: string | null;

  // ------------------------------------------------------------------
  // CRUD
  // ------------------------------------------------------------------
  /** books一覧を取得（キャッシュ有効時はキャッシュを返す） */
  fetchBooks: (userId: string, forceRefresh?: boolean) => Promise<void>;
  /** IDで1件取得（ローカルキャッシュから同期的に返す） */
  getBookById: (id: string) => Book | undefined;
  /** フィルタリングされたbook一覧を返す（ローカルキャッシュから） */
  filterBooks: (filters: BookFilters) => Book[];
  /** 新規登録 */
  createBook: (data: BookInsert) => Promise<Book | null>;
  /** 更新 */
  updateBook: (id: string, data: BookUpdate) => Promise<Book | null>;
  /** 削除 */
  deleteBook: (id: string) => Promise<boolean>;

  // ------------------------------------------------------------------
  // オフラインキュー
  // ------------------------------------------------------------------
  /** オンライン復帰時にキューを順次処理する */
  flushOfflineQueue: () => Promise<void>;

  // ------------------------------------------------------------------
  // ユーティリティ
  // ------------------------------------------------------------------
  clearError: () => void;
  /** キャッシュとstateをリセット（ログアウト時に呼ぶ） */
  reset: () => void;
}

// ============================================================
// ユーティリティ関数
// ============================================================

/** ブラウザ/RNの crypto.randomUUID で UUID v4 を生成 */
function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // フォールバック（旧環境）
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function loadQueue(userId: string): OfflineOperation[] {
  return getCached<OfflineOperation[]>(cacheKey.offlineQueue(userId)) ?? [];
}

function saveQueue(userId: string, queue: OfflineOperation[]): void {
  setCached(cacheKey.offlineQueue(userId), queue);
}

/**
 * 同一 bookId への重複 update をマージし、後続の操作に応じてキューを圧縮する。
 *
 * 圧縮ルール:
 * - create → update(同optimisticId): create の payload にマージ
 * - create → delete(同optimisticId): 両方を除去（まだ未送信なので何もしない）
 * - update → update(同bookId):       後のupdateにマージ（古いものを除去）
 * - update → delete(同bookId):       updateを除去（削除が優先）
 */
function mergeIntoQueue(
  queue: OfflineOperation[],
  newOp: OfflineOperation,
): OfflineOperation[] {
  if (newOp.type === 'create') {
    return [...queue, newOp];
  }

  if (newOp.type === 'update') {
    const createIdx = queue.findIndex(
      (op) => op.type === 'create' && op.optimisticId === newOp.bookId,
    );
    if (createIdx !== -1) {
      // まだ未送信の create があるので payload にマージして create を更新
      const createOp = queue[createIdx] as QueueOpCreate;
      const merged: QueueOpCreate = {
        ...createOp,
        payload: { ...createOp.payload, ...newOp.payload },
        timestamp: newOp.timestamp,
      };
      return [...queue.slice(0, createIdx), merged, ...queue.slice(createIdx + 1)];
    }

    // 既存 update(同bookId) があれば後のものにマージして古いを除去
    const existingUpdateIdx = queue.findLastIndex(
      (op) => op.type === 'update' && op.bookId === newOp.bookId,
    );
    if (existingUpdateIdx !== -1) {
      const existingOp = queue[existingUpdateIdx] as QueueOpUpdate;
      const merged: QueueOpUpdate = {
        ...existingOp,
        payload: { ...existingOp.payload, ...newOp.payload },
        timestamp: newOp.timestamp,
      };
      return [
        ...queue.filter((_, i) => i !== existingUpdateIdx),
        merged,
      ];
    }

    return [...queue, newOp];
  }

  if (newOp.type === 'delete') {
    const createIdx = queue.findIndex(
      (op) => op.type === 'create' && op.optimisticId === newOp.bookId,
    );
    if (createIdx !== -1) {
      // 未送信の create があるので create + それ以降の update を全部除去
      return queue.filter(
        (op) =>
          !(op.type === 'create' && op.optimisticId === newOp.bookId) &&
          !(op.type === 'update' && op.bookId === newOp.bookId),
      );
    }

    // 既存の update(同bookId) をすべて除去して delete を追加
    return [
      ...queue.filter((op) => !(op.type === 'update' && op.bookId === newOp.bookId)),
      newOp,
    ];
  }

  return [...queue, newOp];
}

// ============================================================
// Zustand Store
// ============================================================

const INITIAL_STATE = {
  books: [] as Book[],
  loading: false,
  error: null as string | null,
  offlineQueue: [] as OfflineOperation[],
  currentUserId: null as string | null,
};

export const useBookStore = create<BookState>((set, get) => ({
  ...INITIAL_STATE,

  // ----------------------------------------------------------------
  // fetchBooks
  // ----------------------------------------------------------------
  fetchBooks: async (userId: string, forceRefresh = false) => {
    set({ currentUserId: userId });

    if (!forceRefresh && isCacheValid(cacheKey.booksLastFetched(userId))) {
      const cached = getCached<Book[]>(cacheKey.books(userId));
      if (cached) {
        set({ books: cached, offlineQueue: loadQueue(userId) });
        return;
      }
    }

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      const books = (data as Book[]) ?? [];
      set({ books });
      setCached(cacheKey.books(userId), books);
      touchLastFetched(cacheKey.booksLastFetched(userId));
    } catch (err) {
      set({ error: err instanceof Error ? err.message : 'fetchBooks failed' });
    } finally {
      set({ loading: false });
    }
  },

  // ----------------------------------------------------------------
  // getBookById
  // ----------------------------------------------------------------
  getBookById: (id: string) => get().books.find((b) => b.id === id),

  // ----------------------------------------------------------------
  // filterBooks
  // ----------------------------------------------------------------
  filterBooks: ({ status, tags, query }: BookFilters) => {
    let result = get().books;

    if (status) {
      result = result.filter((b) => b.reading_status === status);
    }
    if (tags && tags.length > 0) {
      result = result.filter((b) => tags.every((t) => b.tags.includes(t)));
    }
    if (query) {
      const q = query.toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.author?.toLowerCase().includes(q) ?? false),
      );
    }
    return result;
  },

  // ----------------------------------------------------------------
  // createBook
  // ----------------------------------------------------------------
  createBook: async (data: BookInsert) => {
    const userId = get().currentUserId ?? data.user_id;
    set({ loading: true, error: null });

    const optimisticId = uuid();
    const now = new Date().toISOString();
    const optimisticBook: Book = {
      id: optimisticId,
      user_id: userId,
      isbn: data.isbn ?? null,
      title: data.title,
      author: data.author ?? null,
      publisher: data.publisher ?? null,
      published_at: data.published_at ?? null,
      cover_url: data.cover_url ?? null,
      total_pages: data.total_pages ?? null,
      current_page: data.current_page ?? null,
      reading_status: data.reading_status ?? 'unread',
      rating: data.rating ?? null,
      memo: data.memo ?? null,
      tags: data.tags ?? [],
      created_at: now,
      updated_at: now,
    };

    // オプティミスティック追加
    set((s) => ({ books: [optimisticBook, ...s.books] }));

    // ネットワーク確認
    const online = await checkOnline();
    if (!online) {
      const op: QueueOpCreate = {
        opId: uuid(),
        type: 'create',
        optimisticId,
        payload: data,
        timestamp: Date.now(),
      };
      const newQueue = mergeIntoQueue(get().offlineQueue, op);
      set({ offlineQueue: newQueue, loading: false });
      saveQueue(userId, newQueue);
      return optimisticBook;
    }

    try {
      const { data: created, error } = await supabase
        .from('books')
        .insert(data)
        .select()
        .single();

      if (error) throw new Error(error.message);

      const newBook = created as Book;
      // optimisticIdを本物のIDに差し替え
      set((s) => ({
        books: s.books.map((b) => (b.id === optimisticId ? newBook : b)),
      }));
      flushBooksCache(userId, get().books);
      return newBook;
    } catch (err) {
      // ロールバック
      set((s) => ({
        books: s.books.filter((b) => b.id !== optimisticId),
        error: err instanceof Error ? err.message : 'createBook failed',
      }));
      return null;
    } finally {
      set({ loading: false });
    }
  },

  // ----------------------------------------------------------------
  // updateBook
  // ----------------------------------------------------------------
  updateBook: async (id: string, data: BookUpdate) => {
    const userId = get().currentUserId;
    const prev = get().books.find((b) => b.id === id);
    if (!prev) {
      set({ error: 'Book not found' });
      return null;
    }

    set({ loading: true, error: null });

    const optimistic: Book = { ...prev, ...data, updated_at: new Date().toISOString() };
    set((s) => ({ books: s.books.map((b) => (b.id === id ? optimistic : b)) }));

    const online = await checkOnline();
    if (!online) {
      const op: QueueOpUpdate = {
        opId: uuid(),
        type: 'update',
        bookId: id,
        payload: data,
        timestamp: Date.now(),
      };
      const newQueue = mergeIntoQueue(get().offlineQueue, op);
      set({ offlineQueue: newQueue, loading: false });
      if (userId) saveQueue(userId, newQueue);
      return optimistic;
    }

    try {
      const { data: result, error } = await supabase
        .from('books')
        .update(data)
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);

      const serverBook = result as Book;
      set((s) => ({ books: s.books.map((b) => (b.id === id ? serverBook : b)) }));
      if (userId) flushBooksCache(userId, get().books);
      return serverBook;
    } catch (err) {
      // ロールバック
      set((s) => ({
        books: s.books.map((b) => (b.id === id ? prev : b)),
        error: err instanceof Error ? err.message : 'updateBook failed',
      }));
      return null;
    } finally {
      set({ loading: false });
    }
  },

  // ----------------------------------------------------------------
  // deleteBook
  // ----------------------------------------------------------------
  deleteBook: async (id: string) => {
    const userId = get().currentUserId;
    const snapshot = get().books;
    set({ loading: true, error: null });

    // オプティミスティック削除
    set((s) => ({ books: s.books.filter((b) => b.id !== id) }));

    const online = await checkOnline();
    if (!online) {
      const op: QueueOpDelete = {
        opId: uuid(),
        type: 'delete',
        bookId: id,
        timestamp: Date.now(),
      };
      const newQueue = mergeIntoQueue(get().offlineQueue, op);
      set({ offlineQueue: newQueue, loading: false });
      if (userId) saveQueue(userId, newQueue);
      return true;
    }

    try {
      const { error } = await supabase.from('books').delete().eq('id', id);
      if (error) throw new Error(error.message);

      if (userId) flushBooksCache(userId, get().books);
      return true;
    } catch (err) {
      // ロールバック
      set({
        books: snapshot,
        error: err instanceof Error ? err.message : 'deleteBook failed',
      });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  // ----------------------------------------------------------------
  // flushOfflineQueue
  // ----------------------------------------------------------------
  flushOfflineQueue: async () => {
    const userId = get().currentUserId;
    const queue = get().offlineQueue;
    if (queue.length === 0) return;

    const remaining: OfflineOperation[] = [];

    for (const op of queue) {
      try {
        if (op.type === 'create') {
          await supabase.from('books').insert(op.payload);
        } else if (op.type === 'update') {
          await supabase.from('books').update(op.payload).eq('id', op.bookId);
        } else if (op.type === 'delete') {
          await supabase.from('books').delete().eq('id', op.bookId);
        }
      } catch {
        remaining.push(op);
      }
    }

    set({ offlineQueue: remaining });
    if (userId) {
      saveQueue(userId, remaining);
      // キャッシュを無効化して次回fetchで最新を取得
      removeCached(cacheKey.booksLastFetched(userId));
    }
  },

  // ----------------------------------------------------------------
  // clearError / reset
  // ----------------------------------------------------------------
  clearError: () => set({ error: null }),

  reset: () => {
    const userId = get().currentUserId;
    if (userId) {
      removeCached(cacheKey.books(userId));
      removeCached(cacheKey.booksLastFetched(userId));
      removeCached(cacheKey.offlineQueue(userId));
    }
    set(INITIAL_STATE);
  },
}));

// ============================================================
// モジュールプライベートヘルパー
// ============================================================

/** キャッシュにbooksリストを書き戻す */
function flushBooksCache(userId: string, books: Book[]): void {
  setCached(cacheKey.books(userId), books);
  touchLastFetched(cacheKey.booksLastFetched(userId));
}

/**
 * ネットワーク疎通確認。
 * 実運用では @react-native-community/netinfo の NetInfo.fetch() に置き換えること。
 *
 * @example
 * import NetInfo from '@react-native-community/netinfo';
 * const state = await NetInfo.fetch();
 * return state.isConnected ?? false;
 */
async function checkOnline(): Promise<boolean> {
  try {
    const { error } = await supabase.from('books').select('id').limit(0);
    return error === null;
  } catch {
    return false;
  }
}
