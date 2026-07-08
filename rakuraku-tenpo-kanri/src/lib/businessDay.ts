import { BRAND } from '@/branding'

/**
 * 業務日ロジック
 * 深夜営業の店舗が0時をまたいで報告しても「前日分」として扱えるよう、
 * 朝9時（BRAND.businessDayCutoverHour）を業務日の切り替え時刻とする。
 * 例: 7/8 深夜1時の報告 → 業務日は 7/7
 */

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 現在時刻から業務日（YYYY-MM-DD）を求める */
export function currentBusinessDate(now: Date = new Date()): string {
  const shifted = new Date(now.getTime() - BRAND.businessDayCutoverHour * 3600_000)
  return toDateKey(shifted)
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(key: string, days: number): string {
  const d = parseDateKey(key)
  d.setDate(d.getDate() + days)
  return toDateKey(d)
}

/** ISO週番号ベースの週キー（YYYY-Www）。週は月曜始まり */
export function toWeekKey(date: Date): string {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${pad(weekNo)}`
}

/** 現在の業務週キー */
export function currentBusinessWeek(now: Date = new Date()): string {
  return toWeekKey(parseDateKey(currentBusinessDate(now)))
}

export function weekKeyOfDate(dateKey: string): string {
  return toWeekKey(parseDateKey(dateKey))
}

/** 週キーをずらす（weeks 週分） */
export function addWeeks(weekKey: string, weeks: number): string {
  const monday = mondayOfWeek(weekKey)
  monday.setDate(monday.getDate() + weeks * 7)
  return toWeekKey(monday)
}

/** 週キーの月曜日の Date を返す */
export function mondayOfWeek(weekKey: string): Date {
  const [y, w] = weekKey.split('-W').map(Number)
  const jan4 = new Date(y, 0, 4)
  const jan4Day = jan4.getDay() || 7
  const week1Monday = new Date(y, 0, 4 - (jan4Day - 1))
  const monday = new Date(week1Monday)
  monday.setDate(week1Monday.getDate() + (w - 1) * 7)
  return monday
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

export function formatDateKey(key: string): string {
  const d = parseDateKey(key)
  return `${d.getMonth() + 1}/${d.getDate()}(${WEEKDAYS[d.getDay()]})`
}

export function formatDateKeyLong(key: string): string {
  const d = parseDateKey(key)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日(${WEEKDAYS[d.getDay()]})`
}

export function formatWeekKey(weekKey: string): string {
  const monday = mondayOfWeek(weekKey)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return `${monday.getMonth() + 1}/${monday.getDate()}〜${sunday.getMonth() + 1}/${sunday.getDate()}の週`
}

export function formatTime(ts: number): string {
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** 選択可能な業務日リスト（今日から days 日分さかのぼる） */
export function recentBusinessDates(days: number): string[] {
  const today = currentBusinessDate()
  return Array.from({ length: days }, (_, i) => addDays(today, -i))
}

export function recentBusinessWeeks(weeks: number): string[] {
  const thisWeek = currentBusinessWeek()
  return Array.from({ length: weeks }, (_, i) => addWeeks(thisWeek, -i))
}
