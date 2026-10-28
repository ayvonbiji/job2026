import type { ISODate, MonthKey } from './types'

// Dates are handled as local calendar days to avoid time-zone drift.

export function isValidISO(s: string | undefined | null): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false
  const d = parseISO(s)
  return toISO(d) === s
}

export function parseISO(s: ISODate): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function toISO(d: Date): ISODate {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function todayISO(): ISODate {
  return toISO(new Date())
}

export function addDays(s: ISODate, n: number): ISODate {
  const d = parseISO(s)
  d.setDate(d.getDate() + n)
  return toISO(d)
}

function daysInMonth(y: number, m0: number): number {
  return new Date(y, m0 + 1, 0).getDate()
}

/** Calendar-month addition. 31 Jan + 1 month = 28/29 Feb (clamped to month end). */
export function addMonths(s: ISODate, n: number): ISODate {
  const [y, m, d] = s.split('-').map(Number)
  const total = y * 12 + (m - 1) + n
  const ny = Math.floor(total / 12)
  const nm0 = total - ny * 12
  const nd = Math.min(d, daysInMonth(ny, nm0))
  return toISO(new Date(ny, nm0, nd))
}

/** Whole days from a to b (b - a). */
export function diffDays(a: ISODate, b: ISODate): number {
  const ms = parseISO(b).getTime() - parseISO(a).getTime()
  return Math.round(ms / 86400000)
}

export function daysUntil(target: ISODate, today: ISODate = todayISO()): number {
  return diffDays(today, target)
}

export function monthKey(s: ISODate): MonthKey {
  return s.slice(0, 7)
}

export function addMonthKey(k: MonthKey, n: number): MonthKey {
  return monthKey(addMonths(`${k}-01`, n))
}

/** Inclusive list of month keys from a to b. */
export function monthRange(a: MonthKey, b: MonthKey): MonthKey[] {
  const out: MonthKey[] = []
  let k = a
  let guard = 0
  while (k <= b && guard < 600) {
    out.push(k)
    k = addMonthKey(k, 1)
    guard++
  }
  return out
}

export function monthsBetweenKeys(a: MonthKey, b: MonthKey): number {
  const [ay, am] = a.split('-').map(Number)
  const [by, bm] = b.split('-').map(Number)
  return (by - ay) * 12 + (bm - am)
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function fmtDate(s: ISODate | undefined | null, withDay = false): string {
  if (!isValidISO(s)) return '—'
  const d = parseISO(s)
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`
  return withDay ? `${DAYS[d.getDay()]}, ${base}` : base
}

export function fmtMonth(k: MonthKey): string {
  const [y, m] = k.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}

export function fmtMonthShort(k: MonthKey): string {
  const [y, m] = k.split('-').map(Number)
  return `${MONTHS[m - 1]} '${String(y).slice(2)}`
}

export const DAY_NAMES = DAYS
export const MONTH_NAMES = MONTHS

export function dayOfWeek(s: ISODate): number {
  return parseISO(s).getDay()
}

/** A day-of-month clamped into the given month. */
export function dayInMonth(k: MonthKey, day: number): ISODate {
  const [y, m] = k.split('-').map(Number)
  const d = Math.min(Math.max(1, day), daysInMonth(y, m - 1))
  return `${k}-${String(d).padStart(2, '0')}`
}

export function endOfMonth(k: MonthKey): ISODate {
  const [y, m] = k.split('-').map(Number)
  return `${k}-${String(daysInMonth(y, m - 1)).padStart(2, '0')}`
}

export function relativeDays(n: number): string {
  if (n === 0) return 'Today'
  if (n === 1) return 'Tomorrow'
  if (n === -1) return 'Yesterday'
  if (n > 0) return `In ${n} days`
  return `${-n} days ago`
}
