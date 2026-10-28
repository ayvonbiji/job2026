const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 })
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 })
const num = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 })

/** ₹1,25,000 (Indian digit grouping). */
export function money(n: number, exact = false): string {
  if (!Number.isFinite(n)) return '₹0'
  return exact ? inr2.format(n) : inr.format(Math.round(n))
}

/** Short form for chart axes: ₹1.2L, ₹45K. */
export function moneyShort(n: number): string {
  const a = Math.abs(n)
  const sign = n < 0 ? '−' : ''
  if (a >= 1e7) return `${sign}₹${num.format(a / 1e7)}Cr`
  if (a >= 1e5) return `${sign}₹${num.format(a / 1e5)}L`
  if (a >= 1e3) return `${sign}₹${num.format(a / 1e3)}K`
  return `${sign}₹${Math.round(a)}`
}

export function days(n: number): string {
  const v = num.format(n)
  return `${v} ${Math.abs(n) === 1 ? 'day' : 'days'}`
}

export function pct(n: number): string {
  if (!Number.isFinite(n)) return '0%'
  return `${Math.round(n)}%`
}

export function uid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return Math.random().toString(36).slice(2) + Date.now().toString(36)
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/** Parse a user-typed amount like "1,25,000.50". Returns NaN if invalid. */
export function parseAmount(s: string): number {
  const clean = s.replace(/[₹,\s]/g, '')
  if (clean === '') return NaN
  if (!/^-?\d+(\.\d{0,2})?$/.test(clean)) return NaN
  return Number(clean)
}
