import { useMemo, useState } from 'react';

import { useBookStore } from '@/store/bookStore';
import type { Book, ReadingStatus } from '@/types/database';
import { BOOKS_PER_ROW } from '@/constants/sizes';
import { useDebounce } from './useDebounce';

export type SortKey = 'newest' | 'oldest' | 'title' | 'author' | 'rating';
export type StatusFilter = ReadingStatus | 'all';

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'newest', label: '追加順（新しい）' },
  { key: 'oldest', label: '追加順（古い）' },
  { key: 'title', label: 'タイトル順' },
  { key: 'author', label: '著者順' },
  { key: 'rating', label: '評価順' },
];

function applySort(books: Book[], key: SortKey): Book[] {
  const list = [...books];
  switch (key) {
    case 'newest':
      return list.sort((a, b) => b.created_at.localeCompare(a.created_at));
    case 'oldest':
      return list.sort((a, b) => a.created_at.localeCompare(b.created_at));
    case 'title':
      return list.sort((a, b) => a.title.localeCompare(b.title, 'ja'));
    case 'author':
      return list.sort((a, b) =>
        (a.author ?? '\uFFFF').localeCompare(b.author ?? '\uFFFF', 'ja'),
      );
    case 'rating':
      return list.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  }
}

export function useShelfBooks() {
  const { books, loading, error } = useBookStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('newest');

  const debouncedQuery = useDebounce(searchQuery, 250);

  /** フィルタ + ソート済み一覧 */
  const filteredBooks = useMemo(() => {
    let result = books;

    // ステータスフィルタ
    if (statusFilter !== 'all') {
      result = result.filter((b) => b.reading_status === statusFilter);
    }

    // 検索クエリ
    if (debouncedQuery.trim()) {
      const q = debouncedQuery.trim().toLowerCase();
      result = result.filter(
        (b) =>
          b.title.toLowerCase().includes(q) ||
          (b.author?.toLowerCase().includes(q) ?? false),
      );
    }

    return applySort(result, sortKey);
  }, [books, statusFilter, debouncedQuery, sortKey]);

  /** 棚ビュー用: BOOKS_PER_ROW 冊ごとにグループ化 */
  const shelfRows = useMemo<Book[][]>(() => {
    const rows: Book[][] = [];
    for (let i = 0; i < filteredBooks.length; i += BOOKS_PER_ROW) {
      rows.push(filteredBooks.slice(i, i + BOOKS_PER_ROW));
    }
    return rows;
  }, [filteredBooks]);

  return {
    filteredBooks,
    shelfRows,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    sortKey,
    setSortKey,
  };
}
