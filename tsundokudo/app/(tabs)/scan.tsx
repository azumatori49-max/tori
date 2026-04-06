/**
 * ScanScreen – バーコードスキャン & 手動追加
 *
 * - expo-camera の CameraView でバーコード (EAN-13/EAN-8) をスキャン
 * - Google Books API で ISBN → 書籍情報を取得
 * - プレビュー確認後、Zustand bookStore に追加
 * - 手動入力モードも用意
 */
import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import type { BarcodeScanningResult } from 'expo-camera';
import { Image } from 'expo-image';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useBookStore } from '@/store/bookStore';
import { fetchBookByISBN, type GoogleBookInfo } from '@/lib/googleBooks';
import { STATUS_COLOR, STATUS_LABEL } from '@/constants/colors';
import type { ReadingStatus } from '@/types/database';

const STATUSES: ReadingStatus[] = ['unread', 'reading', 'completed', 'paused'];

type Mode = 'scan' | 'manual' | 'preview';

export default function ScanScreen() {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const { createBook, currentUserId } = useBookStore();

  const [mode, setMode] = useState<Mode>('scan');
  const [loading, setLoading] = useState(false);
  const [scannedISBN, setScannedISBN] = useState<string | null>(null);
  const [bookInfo, setBookInfo] = useState<GoogleBookInfo | null>(null);

  // 手動入力フィールド
  const [manualTitle, setManualTitle] = useState('');
  const [manualAuthor, setManualAuthor] = useState('');
  const [manualPages, setManualPages] = useState('');
  const [manualISBN, setManualISBN] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<ReadingStatus>('unread');

  // スキャン連続防止
  const lastScannedRef = useRef<string | null>(null);
  const scanCooldownRef = useRef(false);

  // ─── バーコードスキャン ────────────────────────────────
  const handleBarcode = useCallback(
    async (result: BarcodeScanningResult) => {
      const code = result.data;

      // 重複・クールダウン防止
      if (scanCooldownRef.current || code === lastScannedRef.current) return;
      scanCooldownRef.current = true;
      lastScannedRef.current = code;
      setTimeout(() => {
        scanCooldownRef.current = false;
      }, 2000);

      setScannedISBN(code);
      setLoading(true);

      try {
        const info = await fetchBookByISBN(code);
        if (info) {
          setBookInfo(info);
          setMode('preview');
        } else {
          Alert.alert(
            '書籍が見つかりません',
            `ISBN: ${code}\n手動で入力しますか？`,
            [
              { text: 'キャンセル', style: 'cancel', onPress: () => resetScan() },
              {
                text: '手動入力',
                onPress: () => {
                  setManualISBN(code);
                  setMode('manual');
                },
              },
            ],
          );
        }
      } catch {
        Alert.alert('エラー', '書籍情報の取得に失敗しました');
        resetScan();
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const resetScan = useCallback(() => {
    setScannedISBN(null);
    setBookInfo(null);
    lastScannedRef.current = null;
    setMode('scan');
    setManualTitle('');
    setManualAuthor('');
    setManualPages('');
    setManualISBN('');
    setSelectedStatus('unread');
  }, []);

  // ─── 本を追加（プレビューから） ──────────────────────
  const handleAddFromPreview = useCallback(async () => {
    if (!bookInfo || !currentUserId) return;
    setLoading(true);
    try {
      await createBook({
        user_id: currentUserId,
        title: bookInfo.title,
        author: bookInfo.author,
        publisher: bookInfo.publisher,
        published_at: bookInfo.publishedDate,
        total_pages: bookInfo.pageCount,
        cover_url: bookInfo.coverUrl,
        isbn: bookInfo.isbn13 ?? bookInfo.isbn10 ?? scannedISBN,
        reading_status: selectedStatus,
      });
      Alert.alert('追加完了', `「${bookInfo.title}」を本棚に追加しました`);
      resetScan();
    } catch {
      Alert.alert('エラー', '本の追加に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [bookInfo, currentUserId, createBook, scannedISBN, selectedStatus, resetScan]);

  // ─── 本を追加（手動入力から） ──────────────────────────
  const handleAddManual = useCallback(async () => {
    if (!manualTitle.trim()) {
      Alert.alert('エラー', 'タイトルを入力してください');
      return;
    }
    if (!currentUserId) {
      Alert.alert('エラー', 'ログインしてください');
      return;
    }
    setLoading(true);
    try {
      const pages = parseInt(manualPages, 10);
      await createBook({
        user_id: currentUserId,
        title: manualTitle.trim(),
        author: manualAuthor.trim() || null,
        total_pages: isNaN(pages) ? null : pages,
        isbn: manualISBN.trim() || null,
        reading_status: selectedStatus,
      });
      Alert.alert('追加完了', `「${manualTitle.trim()}」を本棚に追加しました`);
      resetScan();
    } catch {
      Alert.alert('エラー', '本の追加に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [manualTitle, manualAuthor, manualPages, manualISBN, selectedStatus, currentUserId, createBook, resetScan]);

  // ─── ISBN 手動検索 ──────────────────────────────────────
  const handleISBNSearch = useCallback(async () => {
    const isbn = manualISBN.trim();
    if (!isbn) return;
    setLoading(true);
    try {
      const info = await fetchBookByISBN(isbn);
      if (info) {
        setBookInfo(info);
        setScannedISBN(isbn);
        setMode('preview');
      } else {
        Alert.alert('見つかりません', 'この ISBN の書籍が見つかりませんでした');
      }
    } catch {
      Alert.alert('エラー', '検索に失敗しました');
    } finally {
      setLoading(false);
    }
  }, [manualISBN]);

  // ─── カメラ権限がない場合 ────────────────────────────
  if (!permission) {
    return <View style={styles.screen} />;
  }

  // ─── スキャンモード ──────────────────────────────────
  if (mode === 'scan') {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        {/* ヘッダー */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>本を追加</Text>
          <Pressable onPress={() => setMode('manual')} hitSlop={8}>
            <Text style={styles.headerAction}>手動入力</Text>
          </Pressable>
        </View>

        {permission.granted ? (
          <View style={styles.cameraContainer}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{
                barcodeTypes: ['ean13', 'ean8'],
              }}
              onBarcodeScanned={loading ? undefined : handleBarcode}
            />
            {/* スキャンガイドオーバーレイ */}
            <View style={styles.scanOverlay}>
              <View style={styles.scanGuide}>
                <View style={[styles.scanCorner, styles.scanCornerTL]} />
                <View style={[styles.scanCorner, styles.scanCornerTR]} />
                <View style={[styles.scanCorner, styles.scanCornerBL]} />
                <View style={[styles.scanCorner, styles.scanCornerBR]} />
              </View>
              <Text style={styles.scanHint}>
                バーコードをフレーム内に合わせてください
              </Text>
            </View>
            {loading && (
              <View style={styles.loadingOverlay}>
                <ActivityIndicator size="large" color="#D97706" />
                <Text style={styles.loadingText}>検索中...</Text>
              </View>
            )}
          </View>
        ) : (
          <View style={styles.permissionContainer}>
            <Text style={styles.permissionEmoji}>📸</Text>
            <Text style={styles.permissionText}>
              バーコードスキャンにはカメラへのアクセスが必要です
            </Text>
            <Pressable onPress={requestPermission} style={styles.permissionBtn}>
              <Text style={styles.permissionBtnText}>カメラを許可する</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  }

  // ─── プレビューモード ────────────────────────────────
  if (mode === 'preview' && bookInfo) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable onPress={resetScan} hitSlop={8}>
            <Text style={styles.headerAction}>← 戻る</Text>
          </Pressable>
          <Text style={styles.headerTitle}>確認</Text>
          <View style={{ width: 50 }} />
        </View>

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.previewContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* 表紙 + 情報 */}
          <View style={styles.previewHero}>
            {bookInfo.coverUrl ? (
              <Image
                source={{ uri: bookInfo.coverUrl }}
                style={styles.previewCover}
                contentFit="cover"
                transition={200}
              />
            ) : (
              <View style={[styles.previewCover, styles.coverPlaceholder]}>
                <Text style={styles.coverPlaceholderText}>📚</Text>
              </View>
            )}
            <View style={styles.previewMeta}>
              <Text style={styles.previewTitle} numberOfLines={3}>
                {bookInfo.title}
              </Text>
              {bookInfo.author && (
                <Text style={styles.previewAuthor} numberOfLines={1}>
                  {bookInfo.author}
                </Text>
              )}
              {bookInfo.publisher && (
                <Text style={styles.previewPublisher}>{bookInfo.publisher}</Text>
              )}
              {bookInfo.pageCount && (
                <Text style={styles.previewPages}>{bookInfo.pageCount}ページ</Text>
              )}
              {scannedISBN && (
                <Text style={styles.previewISBN}>ISBN: {scannedISBN}</Text>
              )}
            </View>
          </View>

          {/* ステータス選択 */}
          <View style={styles.previewSection}>
            <Text style={styles.previewSectionLabel}>ステータス</Text>
            <View style={styles.statusRow}>
              {STATUSES.map((s) => {
                const active = s === selectedStatus;
                const color = STATUS_COLOR[s] ?? '#64748B';
                return (
                  <Pressable
                    key={s}
                    onPress={() => setSelectedStatus(s)}
                    style={[
                      styles.statusChip,
                      active && { backgroundColor: color, borderColor: color },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        active && styles.statusChipTextActive,
                      ]}
                    >
                      {STATUS_LABEL[s] ?? s}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 追加ボタン */}
          <Pressable
            onPress={handleAddFromPreview}
            style={[styles.addBtn, loading && styles.addBtnDisabled]}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.addBtnText}>本棚に追加</Text>
            )}
          </Pressable>
        </ScrollView>
      </View>
    );
  }

  // ─── 手動入力モード ──────────────────────────────────
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Pressable onPress={resetScan} hitSlop={8}>
          <Text style={styles.headerAction}>← スキャン</Text>
        </Pressable>
        <Text style={styles.headerTitle}>手動入力</Text>
        <View style={{ width: 70 }} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.manualContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* ISBN 検索 */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ISBN（任意）</Text>
            <View style={styles.isbnRow}>
              <TextInput
                style={[styles.input, styles.isbnInput]}
                value={manualISBN}
                onChangeText={setManualISBN}
                placeholder="978..."
                placeholderTextColor="#555"
                keyboardType="number-pad"
                maxLength={17}
              />
              <Pressable
                onPress={handleISBNSearch}
                style={styles.isbnSearchBtn}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <Text style={styles.isbnSearchBtnText}>検索</Text>
                )}
              </Pressable>
            </View>
          </View>

          {/* タイトル */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>
              タイトル <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              value={manualTitle}
              onChangeText={setManualTitle}
              placeholder="本のタイトル"
              placeholderTextColor="#555"
            />
          </View>

          {/* 著者 */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>著者</Text>
            <TextInput
              style={styles.input}
              value={manualAuthor}
              onChangeText={setManualAuthor}
              placeholder="著者名"
              placeholderTextColor="#555"
            />
          </View>

          {/* ページ数 */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ページ数</Text>
            <TextInput
              style={styles.input}
              value={manualPages}
              onChangeText={setManualPages}
              placeholder="0"
              placeholderTextColor="#555"
              keyboardType="number-pad"
              maxLength={5}
            />
          </View>

          {/* ステータス */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ステータス</Text>
            <View style={styles.statusRow}>
              {STATUSES.map((s) => {
                const active = s === selectedStatus;
                const color = STATUS_COLOR[s] ?? '#64748B';
                return (
                  <Pressable
                    key={s}
                    onPress={() => setSelectedStatus(s)}
                    style={[
                      styles.statusChip,
                      active && { backgroundColor: color, borderColor: color },
                    ]}
                  >
                    <Text
                      style={[
                        styles.statusChipText,
                        active && styles.statusChipTextActive,
                      ]}
                    >
                      {STATUS_LABEL[s] ?? s}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* 追加ボタン */}
          <Pressable
            onPress={handleAddManual}
            style={[styles.addBtn, loading && styles.addBtnDisabled]}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.addBtnText}>本棚に追加</Text>
            )}
          </Pressable>

          <View style={{ height: insets.bottom + 40 }} />
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ─── スタイル ─────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0F0700',
  },
  flex: {
    flex: 1,
  },

  // ─ ヘッダー
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#1A0900',
    borderBottomWidth: 1,
    borderBottomColor: '#3A2010',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F5DEB3',
  },
  headerAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D97706',
  },

  // ─ カメラ
  cameraContainer: {
    flex: 1,
    position: 'relative',
  },
  camera: {
    flex: 1,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanGuide: {
    width: 260,
    height: 160,
    position: 'relative',
  },
  scanCorner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#D97706',
  },
  scanCornerTL: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
    borderTopLeftRadius: 8,
  },
  scanCornerTR: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
    borderTopRightRadius: 8,
  },
  scanCornerBL: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
    borderBottomLeftRadius: 8,
  },
  scanCornerBR: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
    borderBottomRightRadius: 8,
  },
  scanHint: {
    marginTop: 24,
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    fontWeight: '600',
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: '#F5DEB3',
    fontSize: 14,
    fontWeight: '600',
  },

  // ─ カメラ権限
  permissionContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
    gap: 16,
  },
  permissionEmoji: {
    fontSize: 56,
  },
  permissionText: {
    fontSize: 14,
    color: '#7A6055',
    textAlign: 'center',
    lineHeight: 22,
  },
  permissionBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 24,
    backgroundColor: '#D97706',
  },
  permissionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  // ─ プレビュー
  previewContent: {
    padding: 16,
    gap: 20,
  },
  previewHero: {
    flexDirection: 'row',
    gap: 14,
  },
  previewCover: {
    width: 120,
    height: 176,
    borderRadius: 8,
    backgroundColor: '#1A0900',
  },
  coverPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#3A2010',
  },
  coverPlaceholderText: {
    fontSize: 40,
  },
  previewMeta: {
    flex: 1,
    gap: 4,
    justifyContent: 'center',
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#F5DEB3',
    lineHeight: 24,
  },
  previewAuthor: {
    fontSize: 14,
    color: '#C4A882',
    fontWeight: '600',
  },
  previewPublisher: {
    fontSize: 12,
    color: '#7A6055',
  },
  previewPages: {
    fontSize: 11,
    color: '#7A6055',
    marginTop: 4,
  },
  previewISBN: {
    fontSize: 10,
    color: '#5A4035',
    fontVariant: ['tabular-nums'],
  },
  previewSection: {
    gap: 8,
  },
  previewSectionLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7A6055',
    letterSpacing: 0.5,
  },

  // ─ ステータスチップ
  statusRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  statusChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#3A2010',
    backgroundColor: 'transparent',
  },
  statusChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#7A6055',
  },
  statusChipTextActive: {
    color: '#FFFFFF',
  },

  // ─ 追加ボタン
  addBtn: {
    height: 50,
    borderRadius: 14,
    backgroundColor: '#D97706',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
  },
  addBtnDisabled: {
    opacity: 0.5,
  },
  addBtnText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
  },

  // ─ 手動入力
  manualContent: {
    padding: 16,
    gap: 16,
  },
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#7A6055',
    letterSpacing: 0.5,
  },
  required: {
    color: '#EF4444',
  },
  input: {
    height: 44,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#3A2010',
    backgroundColor: '#1A0900',
    color: '#F5DEB3',
    fontSize: 15,
    paddingHorizontal: 12,
  },
  isbnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  isbnInput: {
    flex: 1,
  },
  isbnSearchBtn: {
    width: 64,
    height: 44,
    borderRadius: 8,
    backgroundColor: '#D97706',
    justifyContent: 'center',
    alignItems: 'center',
  },
  isbnSearchBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
