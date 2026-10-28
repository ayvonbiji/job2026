function cell(v: unknown): string {
  const s = v === null || v === undefined ? '' : String(v)
  // Protect against spreadsheet formula injection.
  const safe = /^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s) ? `'${s}` : s
  return /[",\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export function toCSV(headers: string[], rows: unknown[][]): string {
  return [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadCSV(filename: string, headers: string[], rows: unknown[][]) {
  // BOM so Excel opens ₹ and other characters correctly.
  downloadFile(filename, '﻿' + toCSV(headers, rows), 'text/csv;charset=utf-8')
}
