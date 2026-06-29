/**
 * 写真添付セクション
 * - 撮影 / ライブラリ選択で写真を追加
 * - 各写真に分類（店舗外観・作業前・作業後・その他）とメモを付与
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { Input } from '@/components/ui';
import { confirmAsync } from '@/lib/dialog';
import { C } from '@/constants/colors';
import { CAMERA_SUPPORTED, capturePhoto, selectPhoto } from '@/lib/photos';
import type { PhotoCategory, ReportPhoto } from '@/types/report';

const CATEGORIES: PhotoCategory[] = ['店舗外観', '作業前', '作業後', 'その他'];

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function PhotoSection({
  photos,
  onChange,
  max,
  defaultCategory = '店舗外観',
}: {
  photos: ReportPhoto[];
  onChange: (next: ReportPhoto[]) => void;
  /** 最大枚数（未指定なら無制限） */
  max?: number;
  defaultCategory?: PhotoCategory;
}) {
  const reachedMax = max != null && photos.length >= max;

  async function add(kind: 'camera' | 'library') {
    if (reachedMax) return;
    const uri = kind === 'camera' ? await capturePhoto() : await selectPhoto();
    if (!uri) return;
    onChange([...photos, { id: uuid(), uri, category: defaultCategory, caption: '' }]);
  }

  function patch(id: string, p: Partial<ReportPhoto>) {
    onChange(photos.map((ph) => (ph.id === id ? { ...ph, ...p } : ph)));
  }

  async function remove(id: string) {
    const ok = await confirmAsync('写真を削除', 'この写真を削除しますか？', '削除');
    if (ok) onChange(photos.filter((ph) => ph.id !== id));
  }

  return (
    <View>
      {photos.map((ph) => (
        <View key={ph.id} style={styles.photoCard}>
          <View style={styles.photoTop}>
            <Image source={{ uri: ph.uri }} style={styles.thumb} contentFit="cover" />
            <View style={styles.photoMeta}>
              <View style={styles.catWrap}>
                {CATEGORIES.map((cat) => {
                  const active = cat === ph.category;
                  return (
                    <Pressable
                      key={cat}
                      onPress={() => patch(ph.id, { category: cat })}
                      style={[styles.cat, active && styles.catActive]}
                    >
                      <Text style={[styles.catText, active && styles.catTextActive]}>{cat}</Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable onPress={() => void remove(ph.id)} hitSlop={8}>
                <Text style={styles.removeBtn}>削除</Text>
              </Pressable>
            </View>
          </View>
          <Input
            value={ph.caption}
            onChangeText={(v) => patch(ph.id, { caption: v })}
            placeholder="メモ（例: 入口看板 点灯確認）"
            style={styles.caption}
          />
        </View>
      ))}

      {reachedMax ? (
        <Text style={styles.maxNote}>写真は最大{max}枚までです</Text>
      ) : (
        <View style={styles.addRow}>
          {CAMERA_SUPPORTED && (
            <Pressable style={styles.addBtn} onPress={() => void add('camera')}>
              <Text style={styles.addBtnText}>撮影</Text>
            </Pressable>
          )}
          <Pressable style={styles.addBtn} onPress={() => void add('library')}>
            <Text style={styles.addBtnText}>
              写真を選択{max != null ? `（${photos.length}/${max}）` : ''}
            </Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  photoCard: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 12,
    padding: 10,
    marginBottom: 10,
    backgroundColor: '#FBFDFD',
  },
  photoTop: { flexDirection: 'row' },
  thumb: { width: 88, height: 88, borderRadius: 8, backgroundColor: C.border },
  photoMeta: { flex: 1, marginLeft: 10, justifyContent: 'space-between' },
  catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  cat: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#FFF',
  },
  catActive: { backgroundColor: C.primaryLight, borderColor: C.primary },
  catText: { fontSize: 12, color: C.textSub },
  catTextActive: { color: C.primaryDark, fontWeight: '700' },
  removeBtn: { color: C.danger, fontSize: 13, textAlign: 'right', marginTop: 6 },
  caption: { marginTop: 8, paddingVertical: 8 },
  addRow: { flexDirection: 'row', gap: 10 },
  addBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: C.primary,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
  },
  addBtnText: { color: C.primaryDark, fontSize: 14, fontWeight: '700' },
  maxNote: { color: C.textFaint, fontSize: 12, textAlign: 'center', paddingVertical: 8 },
});
