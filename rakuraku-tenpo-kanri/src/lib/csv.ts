/** 提出状況のCSVエクスポート（Excelで開けるようBOM付きUTF-8） */
export function downloadCsv(filename: string, rows: string[][]): void {
  const escape = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)
  const body = rows.map((r) => r.map(escape).join(',')).join('\r\n')
  const blob = new Blob(['﻿' + body], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
