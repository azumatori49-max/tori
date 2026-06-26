/**
 * 衛生管理アプリ 共通UIプリミティブ
 */
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { TextInputProps, ViewStyle } from 'react-native';

import { C } from '@/constants/colors';
import { FONT_FAMILY } from '@/constants/fonts';

export function Card({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <View style={styles.sectionTitleWrap}>
      <View style={styles.sectionBar} />
      <Text style={styles.sectionTitle}>{children}</Text>
    </View>
  );
}

export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function Input(props: TextInputProps) {
  return (
    <TextInput
      placeholderTextColor={C.textFaint}
      {...props}
      style={[styles.input, props.multiline && styles.inputMultiline, props.style]}
    />
  );
}

export function CheckBox({
  checked,
  onToggle,
  label,
  size = 24,
}: {
  checked: boolean;
  onToggle: () => void;
  label?: string;
  size?: number;
}) {
  return (
    <Pressable
      onPress={onToggle}
      style={styles.checkRow}
      hitSlop={8}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
    >
      <View
        style={[
          styles.checkBox,
          { width: size, height: size, borderRadius: size * 0.25 },
          checked && styles.checkBoxOn,
        ]}
      >
        {checked && <Text style={[styles.checkMark, { fontSize: size * 0.7 }]}>✓</Text>}
      </View>
      {label != null && <Text style={styles.checkLabel}>{label}</Text>}
    </Pressable>
  );
}

/** 横並びの選択チップ群（単一選択） */
export function ChipSelect({
  options,
  value,
  onChange,
  allowEmpty = true,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  allowEmpty?: boolean;
}) {
  return (
    <View style={styles.chipWrap}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <Pressable
            key={opt}
            onPress={() => onChange(active && allowEmpty ? '' : opt)}
            style={[styles.chip, active && styles.chipActive]}
          >
            <Text style={[styles.chipText, active && styles.chipTextActive]}>{opt}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** タップでモーダルを開く単一選択プルダウン */
export function Dropdown({
  options,
  value,
  onChange,
  placeholder = '選択してください',
  colorMap,
}: {
  options: string[];
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  colorMap?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const accent = value && colorMap ? colorMap[value] : undefined;

  return (
    <>
      <Pressable
        style={styles.dropdown}
        onPress={() => setOpen(true)}
        accessibilityRole="button"
      >
        {accent && <View style={[styles.dot, { backgroundColor: accent }]} />}
        <Text style={[styles.dropdownText, !value && styles.dropdownPlaceholder]}>
          {value || placeholder}
        </Text>
        <Text style={styles.dropdownCaret}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setOpen(false)}>
          <View style={styles.sheet}>
            {options.map((opt) => {
              const active = opt === value;
              const c = colorMap?.[opt];
              return (
                <Pressable
                  key={opt}
                  style={[styles.sheetItem, active && styles.sheetItemActive]}
                  onPress={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                >
                  {c && <View style={[styles.dot, { backgroundColor: c }]} />}
                  <Text style={[styles.sheetItemText, active && styles.sheetItemTextActive]}>
                    {opt}
                  </Text>
                  {active && <Text style={styles.sheetCheck}>✓</Text>}
                </Pressable>
              );
            })}
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  style?: ViewStyle;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.btn,
        variant === 'primary' && styles.btnPrimary,
        variant === 'ghost' && styles.btnGhost,
        variant === 'danger' && styles.btnDanger,
        pressed && { opacity: 0.8 },
        style,
      ]}
    >
      <Text
        style={[
          styles.btnText,
          variant === 'ghost' && styles.btnTextGhost,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.card,
    borderRadius: 14,
    padding: 14,
    marginHorizontal: 12,
    marginVertical: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  sectionTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 2,
    marginHorizontal: 16,
  },
  sectionBar: {
    width: 4,
    height: 18,
    borderRadius: 2,
    backgroundColor: C.primary,
    marginRight: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: C.text, fontFamily: FONT_FAMILY },
  field: { marginBottom: 12 },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: C.textSub,
    marginBottom: 6,
    fontFamily: FONT_FAMILY,
  },
  input: {
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: C.text,
    backgroundColor: '#FBFDFD',
    fontFamily: FONT_FAMILY,
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  checkRow: { flexDirection: 'row', alignItems: 'center' },
  checkBox: {
    borderWidth: 2,
    borderColor: C.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  checkBoxOn: { backgroundColor: C.accent, borderColor: C.accent },
  checkMark: { color: '#FFF', fontWeight: '900', lineHeight: 18 },
  checkLabel: { marginLeft: 8, fontSize: 15, color: C.text, flexShrink: 1, fontFamily: FONT_FAMILY },
  chipWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.border,
    backgroundColor: '#FFF',
  },
  chipActive: { backgroundColor: C.primaryLight, borderColor: C.primary },
  chipText: { fontSize: 13, color: C.textSub, fontFamily: FONT_FAMILY },
  chipTextActive: { color: C.primaryDark, fontWeight: '700' },
  btn: {
    paddingVertical: 13,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnPrimary: { backgroundColor: C.primary },
  btnGhost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: C.border },
  btnDanger: { backgroundColor: C.danger },
  btnText: { color: '#FFF', fontSize: 15, fontWeight: '700', fontFamily: FONT_FAMILY },
  btnTextGhost: { color: C.textSub },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: C.border,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    backgroundColor: '#FBFDFD',
  },
  dropdownText: { flex: 1, fontSize: 15, color: C.text, fontFamily: FONT_FAMILY },
  dropdownPlaceholder: { color: C.textFaint },
  dropdownCaret: { fontSize: 12, color: C.textSub, marginLeft: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.35)',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  sheet: {
    backgroundColor: '#FFF',
    borderRadius: 14,
    paddingVertical: 6,
    overflow: 'hidden',
  },
  sheetItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  sheetItemActive: { backgroundColor: C.primaryLight },
  sheetItemText: { flex: 1, fontSize: 16, color: C.text, fontFamily: FONT_FAMILY },
  sheetItemTextActive: { color: C.primaryDark, fontWeight: '700' },
  sheetCheck: { color: C.primary, fontSize: 16, fontWeight: '800' },
});
