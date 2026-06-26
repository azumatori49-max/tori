/**
 * 作業日のカレンダー選択
 * - 表示はタップ式。モーダルで月カレンダーから日付を選ぶ
 * - 値は ISO 文字列 "YYYY-MM-DD" で保持
 */
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { C } from '@/constants/colors';

const WEEK = ['日', '月', '火', '水', '木', '金', '土'];

function pad(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

function toISO(y: number, m: number, d: number): string {
  return `${y}-${pad(m + 1)}-${pad(d)}`;
}

/** "YYYY-MM-DD" をパース（不正値は today を返す） */
function parseISO(value: string): { y: number; m: number; d: number } | null {
  const match = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]) - 1, d: Number(match[3]) };
}

/** 表示用 "M月D日（曜）" */
function displayLabel(value: string): string {
  const p = parseISO(value);
  if (!p) return '';
  const dt = new Date(p.y, p.m, p.d);
  return `${p.m + 1}月${p.d}日（${WEEK[dt.getDay()]}）`;
}

export function DatePicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const today = new Date();
  const initial = parseISO(value) ?? { y: today.getFullYear(), m: today.getMonth(), d: today.getDate() };
  const [viewY, setViewY] = useState(initial.y);
  const [viewM, setViewM] = useState(initial.m);

  function openPicker() {
    const p = parseISO(value);
    if (p) {
      setViewY(p.y);
      setViewM(p.m);
    }
    setOpen(true);
  }

  function shiftMonth(delta: number) {
    let m = viewM + delta;
    let y = viewY;
    if (m < 0) {
      m = 11;
      y -= 1;
    } else if (m > 11) {
      m = 0;
      y += 1;
    }
    setViewM(m);
    setViewY(y);
  }

  function select(d: number) {
    onChange(toISO(viewY, viewM, d));
    setOpen(false);
  }

  function selectToday() {
    const t = new Date();
    onChange(toISO(t.getFullYear(), t.getMonth(), t.getDate()));
    setOpen(false);
  }

  // カレンダーのセル配列（前後の空白を含む）
  const firstWeekday = new Date(viewY, viewM, 1).getDay();
  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selected = parseISO(value);
  const label = displayLabel(value);

  return (
    <>
      <Pressable style={styles.field} onPress={openPicker} accessibilityRole="button">
        <Text style={styles.calIcon}>📅</Text>
        <Text style={[styles.fieldText, !label && styles.placeholder]}>
          {label || '日付を選択'}
        </Text>
        <Text style={styles.caret}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            <View style={styles.header}>
              <Pressable onPress={() => shiftMonth(-1)} hitSlop={10} style={styles.navBtn}>
                <Text style={styles.navText}>‹</Text>
              </Pressable>
              <Text style={styles.monthTitle}>
                {viewY}年 {viewM + 1}月
              </Text>
              <Pressable onPress={() => shiftMonth(1)} hitSlop={10} style={styles.navBtn}>
                <Text style={styles.navText}>›</Text>
              </Pressable>
            </View>

            <View style={styles.weekRow}>
              {WEEK.map((w, i) => (
                <Text
                  key={w}
                  style={[
                    styles.weekday,
                    i === 0 && { color: C.danger },
                    i === 6 && { color: C.primary },
                  ]}
                >
                  {w}
                </Text>
              ))}
            </View>

            <View style={styles.grid}>
              {cells.map((d, i) => {
                if (d == null) return <View key={`e${i}`} style={styles.cell} />;
                const isSel =
                  selected && selected.y === viewY && selected.m === viewM && selected.d === d;
                return (
                  <Pressable key={d} style={styles.cell} onPress={() => select(d)}>
                    <View style={[styles.dayWrap, isSel && styles.daySelected]}>
                      <Text style={[styles.dayText, isSel && styles.dayTextSelected]}>{d}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>

            <Pressable style={styles.todayBtn} onPress={selectToday}>
              <Text style={styles.todayText}>今日にする</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#FBFDFD',
  },
  calIcon: { fontSize: 15, marginRight: 8 },
  fieldText: { flex: 1, fontSize: 15, color: C.text },
  placeholder: { color: C.textFaint },
  caret: { fontSize: 12, color: C.textSub },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  sheet: { backgroundColor: '#FFF', borderRadius: 16, padding: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  navBtn: { paddingHorizontal: 14, paddingVertical: 4 },
  navText: { fontSize: 24, color: C.primary, fontWeight: '700' },
  monthTitle: { fontSize: 17, fontWeight: '800', color: C.text },
  weekRow: { flexDirection: 'row' },
  weekday: { flex: 1, textAlign: 'center', fontSize: 12, color: C.textSub, paddingVertical: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: { width: `${100 / 7}%`, alignItems: 'center', paddingVertical: 3 },
  dayWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelected: { backgroundColor: C.primary },
  dayText: { fontSize: 15, color: C.text },
  dayTextSelected: { color: '#FFF', fontWeight: '800' },
  todayBtn: {
    marginTop: 10,
    paddingVertical: 11,
    borderRadius: 10,
    backgroundColor: C.primaryLight,
    alignItems: 'center',
  },
  todayText: { color: C.primaryDark, fontWeight: '700', fontSize: 14 },
});
