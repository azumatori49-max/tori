import { create } from 'zustand';

import { supabase } from '@/lib/supabase';
import {
  CACHE_KEYS,
  getCached,
  isCacheValid,
  removeCached,
  setCached,
  storage,
} from '@/lib/mmkv';
import type { Book, BookInsert, BookUpdate } from '@/types/database';

// ---------------------------------------------------------------------------
// オフラインキューの型
// ---------------------------------------------------------------------------

type OfflineOperationType = 'create' | 'update' | 'delete';

interface OfflineOperation {
  id: string;
  type: OfflineOperationType;
  payload: BookInsert | (BookUpdate & { id: string }) | { id: string };
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Storeの状態と操作の型
// ---------------------------------------------------------------------------

interface BookState {
  /** ローカルキャッシュ上のbook一覧 */
  books: Book[];
  /** 処理中フラグ */
  loading: boolean;
  /** エラーメッセージ */
  error: string | null;
  /** オフラインキュー */
  offlineQueue: OfflineOperation[];

  // CRUD
  fetchBooks: (userId: string, forceRefresh?: boolean) => Promise<void>;
  getBookById: (id: string) => Book | undefined;
  createBook: (data: BookInsert) => Promise<Book | null>;
  updateBook: (id: string, data: BookUpdate) => Promise<Book | null>;
  deleteBook: (id: string) => Promise<boolean>;

  // オフラインキュー
  flushOfflineQueue: () => Promise<void>;
  clearError: () => void;
}

// ---------------------------------------------------------------------------
// ヘルパー: オフラインキューをMMKVに永続化
// ---------------------------------------------------------------------------

function loadQueue(): OfflineOperation[] {
  return getCached<OfflineOperation[]>(CACHE_KEYS.OFFLINE_QUEUE) ?? [];
}

function saveQueue(queue: OfflineOperation[]): void {
  setCached(CACHE_KEYS.OFFLINE_QUEUE, queue);
}

function isOnline(): boolean {
  // React Native のNetInfoを使わず、Supabaseへの到達性で判断する簡易実装
  // 実運用では @react-native-community/netinfo を推奨
  return true;
}

// ---------------------------------------------------------------------------
// Zustand Store
// ---------------------------------------------------------------------------

export const useBookStore = create<BookState>((set, get) => ({
  books: [],
  loading: false,
  error: null,
  offlineQueue: loadQueue(),

  // -----------------------------------------------------------------------
  // fetchBooks: キャッシュが有効ならキャッシュを返し、無効ならSupabaseから取得
  // -----------------------------------------------------------------------
  fetchBooks: async (userId: string, forceRefresh = false) => {
    if (!forceRefresh && isCacheValid(CACHE_KEYS.BOOKS_LAST_FETCHED)) {
      const cached = getCached<Book[]>(CACHE_KEYS.BOOKS);
      if (cached) {
        set({ books: cached });
        return;
      }
    }

    set({ loading: true, error: null });
    try {
      const { data, error } = await supabase
        .from('books')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw new Error(error.message);

      const books = (data as Book[]) ?? [];
      set({ books });
      setCached(CACHE_KEYS.BOOKS, books);
      storage.set(CACHE_KEYS.BOOKS_LAST_FETCHED, Date.now());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'fetchBooks failed';
      set({ error: message });
    } finally {
      set({ loading: false });
    }
  },

  // -----------------------------------------------------------------------
  // getBookById: ローカルキャッシュから1件取得
  // -----------------------------------------------------------------------
  getBookById: (id: string) => {
    return get().books.find((b) => b.id === id);
  },

  // -----------------------------------------------------------------------
  // createBook
  // -----------------------------------------------------------------------
  createBook: async (data: BookInsert) => {
    set({ loading: true, error: null });

    const optimisticId = `optimistic-${Date.now()}`;
    const optimisticBook: Book = {
      id: optimisticId,
      user_id: data.user_id,
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
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // オプティミスティック更新
    set((state) => ({ books: [optimisticBook, ...state.books] }));

    if (!isOnline()) {
      // オフラインキューに積む
      const op: OfflineOperation = {
        id: optimisticId,
        type: 'create',
        payload: data,
        timestamp: Date.now(),
      };
      const queue = [...get().offlineQueue, op];
      set({ offlineQueue: queue, loading: false });
      saveQueue(queue);
      return optimisticBook;
    }

    try {
      const { data: created, error } = await supabase.from('books').insert(data).select().single();

      if (error) throw new Error(error.message);

      const newBook = created as Book;
      // オプティミスティックIDを本物のIDに置換
      set((state) => ({
        books: state.books.map((b) => (b.id === optimisticId ? newBook : b)),
      }));
      // キャッシュ更新
      const updatedBooks = get().books;
      setCached(CACHE_KEYS.BOOKS, updatedBooks);
      return newBook;
    } catch (err) {
      // ロールバック
      set((state) => ({
        books: state.books.filter((b) => b.id !== optimisticId),
        error: err instanceof Error ? err.message : 'createBook failed',
      }));
      return null;
    } finally {
      set({ loading: false });
    }
  },

  // -----------------------------------------------------------------------
  // updateBook
  // -----------------------------------------------------------------------
  updateBook: async (id: string, data: BookUpdate) => {
    set({ loading: true, error: null });

    const prev = get().books.find((b) => b.id === id);
    if (!prev) {
      set({ loading: false, error: 'Book not found' });
      return null;
    }

    const updated: Book = {
      ...prev,
      ...data,
      updated_at: new Date().toISOString(),
    };

    // オプティミスティック更新
    set((state) => ({ books: state.books.map((b) => (b.id === id ? updated : b)) }));

    if (!isOnline()) {
      const op: OfflineOperation = {
        id,
        type: 'update',
        payload: { ...data, id },
        timestamp: Date.now(),
      };
      const queue = [...get().offlineQueue, op];
      set({ offlineQueue: queue, loading: false });
      saveQueue(queue);
      return updated;
    }

    try {
      const { data: result, error } = await supabase
        .from('books')
        .update({ ...data, updated_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw new Error(error.message);

      const serverBook = result as Book;
      set((state) => ({
        books: state.books.map((b) => (b.id === id ? serverBook : b)),
      }));
      setCached(CACHE_KEYS.BOOKS, get().books);
      return serverBook;
    } catch (err) {
      // ロールバック
      set((state) => ({
        books: state.books.map((b) => (b.id === id ? prev : b)),
        error: err instanceof Error ? err.message : 'updateBook failed',
      }));
      return null;
    } finally {
      set({ loading: false });
    }
  },

  // -----------------------------------------------------------------------
  // deleteBook
  // -----------------------------------------------------------------------
  deleteBook: async (id: string) => {
    set({ loading: true, error: null });

    const prev = get().books;
    // オプティミスティック削除
    set((state) => ({ books: state.books.filter((b) => b.id !== id) }));

    if (!isOnline()) {
      const op: OfflineOperation = {
        id,
        type: 'delete',
        payload: { id },
        timestamp: Date.now(),
      };
      const queue = [...get().offlineQueue, op];
      set({ offlineQueue: queue, loading: false });
      saveQueue(queue);
      return true;
    }

    try {
      const { error } = await supabase.from('books').delete().eq('id', id);

      if (error) throw new Error(error.message);

      setCached(CACHE_KEYS.BOOKS, get().books);
      return true;
    } catch (err) {
      // ロールバック
      set({
        books: prev,
        error: err instanceof Error ? err.message : 'deleteBook failed',
      });
      return false;
    } finally {
      set({ loading: false });
    }
  },

  // -----------------------------------------------------------------------
  // flushOfflineQueue: オンライン復帰時にキューを順次処理
  // -----------------------------------------------------------------------
  flushOfflineQueue: async () => {
    const queue = get().offlineQueue;
    if (queue.length === 0) return;

    const remaining: OfflineOperation[] = [];

    for (const op of queue) {
      try {
        if (op.type === 'create') {
          await supabase.from('books').insert(op.payload as BookInsert);
        } else if (op.type === 'update') {
          const { id, ...updateData } = op.payload as BookUpdate & { id: string };
          await supabase.from('books').update(updateData).eq('id', id);
        } else if (op.type === 'delete') {
          const { id } = op.payload as { id: string };
          await supabase.from('books').delete().eq('id', id);
        }
      } catch {
        // 失敗したオペレーションはキューに残す
        remaining.push(op);
      }
    }

    set({ offlineQueue: remaining });
    saveQueue(remaining);

    // キュー処理後にキャッシュを無効化して再取得を促す
    removeCached(CACHE_KEYS.BOOKS_LAST_FETCHED);
  },

  // -----------------------------------------------------------------------
  // clearError
  // -----------------------------------------------------------------------
  clearError: () => set({ error: null }),
}));
