/**
 * Google Books API – ISBN から書籍情報を取得
 *
 * 無料の Books API を使用（API キー不要、レート制限あり）
 */

export type GoogleBookInfo = {
  title: string;
  author: string | null;
  publisher: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  coverUrl: string | null;
  isbn13: string | null;
  isbn10: string | null;
  description: string | null;
};

type VolumeInfo = {
  title?: string;
  authors?: string[];
  publisher?: string;
  publishedDate?: string;
  pageCount?: number;
  imageLinks?: { thumbnail?: string; smallThumbnail?: string };
  industryIdentifiers?: { type: string; identifier: string }[];
  description?: string;
};

type GoogleBooksResponse = {
  totalItems: number;
  items?: { volumeInfo: VolumeInfo }[];
};

/**
 * ISBN で Google Books API を検索して書籍情報を返す。
 * 見つからなければ null。
 */
export async function fetchBookByISBN(isbn: string): Promise<GoogleBookInfo | null> {
  const cleaned = isbn.replace(/[-\s]/g, '');
  const url = `https://www.googleapis.com/books/v1/volumes?q=isbn:${cleaned}&maxResults=1`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = (await res.json()) as GoogleBooksResponse;
  if (!data.items || data.items.length === 0) return null;

  const vol = data.items[0]?.volumeInfo;
  if (!vol) return null;

  const identifiers = vol.industryIdentifiers ?? [];
  const isbn13 = identifiers.find((i) => i.type === 'ISBN_13')?.identifier ?? null;
  const isbn10 = identifiers.find((i) => i.type === 'ISBN_10')?.identifier ?? null;

  // HTTPS に統一（Google Books は http の場合がある）
  let coverUrl = vol.imageLinks?.thumbnail ?? vol.imageLinks?.smallThumbnail ?? null;
  if (coverUrl?.startsWith('http:')) {
    coverUrl = coverUrl.replace('http:', 'https:');
  }

  return {
    title: vol.title ?? 'タイトル不明',
    author: vol.authors?.join(', ') ?? null,
    publisher: vol.publisher ?? null,
    publishedDate: vol.publishedDate ?? null,
    pageCount: vol.pageCount ?? null,
    coverUrl,
    isbn13,
    isbn10,
    description: vol.description ?? null,
  };
}
