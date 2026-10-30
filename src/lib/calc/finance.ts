import type { AppData, ISODate, MonthKey, RecurringItem, SalaryRecord, Transaction, WeddingCategory } from '../types'
import { addDays, addMonthKey, dayInMonth, isValidISO, monthKey, monthRange, monthsBetweenKeys, todayISO } from '../dates'

export const isPosted = (t: Pick<Transaction, 'date'>, today: ISODate) => t.date <= today
const salaryReceived = (s: SalaryRecord, today: ISODate) => s.actualAmount !== null && isValidISO(s.actualDate) && s.actualDate <= today

// ---------- Salary ----------

export type SalaryStatus = 'Received' | 'Received (less than expected)' | 'Expected' | 'Overdue'
export interface SalaryRow {
  payMonth: MonthKey
  expectedDate: ISODate
  expectedAmount: number
  record: SalaryRecord | null
  status: SalaryStatus
}

/** Months in which salary is paid: the month after joining through the month after the last working day. */
export function salaryPayMonths(data: AppData, lastDay: ISODate): MonthKey[] {
  const e = data.employment
  if (!isValidISO(e.joiningDate)) return []
  const first = addMonthKey(monthKey(e.joiningDate), 1)
  const last = isValidISO(lastDay) ? addMonthKey(monthKey(lastDay), 1) : addMonthKey(first, 11)
  return monthRange(first, last)
}

export function salarySchedule(data: AppData, lastDay: ISODate, today = todayISO()): SalaryRow[] {
  const e = data.employment
  const months = new Set(salaryPayMonths(data, lastDay))
  for (const r of data.salaryRecords) months.add(r.payMonth)
  return [...months].sort().map((m) => {
    const record = data.salaryRecords.find((r) => r.payMonth === m) ?? null
    const expectedDate = record?.expectedDate || dayInMonth(m, e.salaryDueDay)
    const expectedAmount = record ? record.expectedAmount : e.takeHomeMonthly
    let status: SalaryStatus = today > expectedDate ? 'Overdue' : 'Expected'
    if (record && record.actualAmount !== null && isValidISO(record.actualDate)) {
      status = record.actualAmount + 0.5 < expectedAmount ? 'Received (less than expected)' : 'Received'
    }
    return { payMonth: m, expectedDate, expectedAmount, record, status }
  })
}

// ---------- Balances & monthly summary ----------

export interface AccountBalance {
  id: string
  name: string
  purpose: string
  balance: number
}

export function accountBalances(data: AppData, today = todayISO()): AccountBalance[] {
  const map = new Map(data.accounts.map((a) => [a.id, a.openingBalance]))
  const add = (id: string, n: number) => map.has(id) && map.set(id, map.get(id)! + n)
  for (const t of data.transactions) {
    if (!isPosted(t, today)) continue
    if (t.type === 'income') add(t.accountId, t.amount)
    if (t.type === 'expense') add(t.accountId, -t.amount)
    if (t.type === 'transfer') {
      add(t.accountId, -t.amount)
      add(t.toAccountId, t.amount)
    }
  }
  for (const s of data.salaryRecords) if (salaryReceived(s, today)) add(s.accountId, s.actualAmount!)
  return data.accounts.map((a) => ({ id: a.id, name: a.name, purpose: a.purpose, balance: Math.round((map.get(a.id) ?? 0) * 100) / 100 }))
}

export interface MonthSummary {
  month: MonthKey
  salary: number
  otherIncome: number
  income: number
  expenses: number
  savings: number // income − expenses
  movedToSavings: number // transfers into wedding/emergency accounts (not an expense)
  byCategory: Record<string, number>
}

export function monthSummary(data: AppData, month: MonthKey, today = todayISO()): MonthSummary {
  let otherIncome = 0
  let expenses = 0
  let movedToSavings = 0
  const byCategory: Record<string, number> = {}
  const savingsAcc = new Set(data.accounts.filter((a) => a.purpose !== 'general').map((a) => a.id))
  for (const t of data.transactions) {
    if (monthKey(t.date) !== month || !isPosted(t, today)) continue
    if (t.type === 'income') otherIncome += t.amount
    if (t.type === 'expense') {
      expenses += t.amount
      const c = t.category || 'Other expenses'
      byCategory[c] = (byCategory[c] ?? 0) + t.amount
    }
    if (t.type === 'transfer' && savingsAcc.has(t.toAccountId) && !savingsAcc.has(t.accountId)) movedToSavings += t.amount
  }
  let salary = 0
  for (const s of data.salaryRecords) if (salaryReceived(s, today) && monthKey(s.actualDate) === month) salary += s.actualAmount!
  const income = salary + otherIncome
  return { month, salary, otherIncome, income, expenses, savings: income - expenses, movedToSavings, byCategory }
}

export function monthsWithData(data: AppData, today = todayISO()): MonthKey[] {
  const cur = monthKey(today)
  const dates = [
    ...data.transactions.filter((t) => isPosted(t, today)).map((t) => t.date),
    ...data.salaryRecords.filter((s) => salaryReceived(s, today)).map((s) => s.actualDate),
  ].map(monthKey)
  const first = dates.length ? dates.reduce((a, b) => (a < b ? a : b)) : cur
  const start = monthsBetweenKeys(first, cur) > 23 ? addMonthKey(cur, -23) : first
  return monthRange(start, cur)
}

export function expectedIncomeFor(data: AppData, month: MonthKey, lastDay: ISODate): { salary: number; other: number; forWedding: number } {
  const salary = salaryPayMonths(data, lastDay).includes(month) ? (data.salaryRecords.find((r) => r.payMonth === month)?.expectedAmount ?? data.employment.takeHomeMonthly) : 0
  let other = 0
  let forWedding = 0
  for (const e of data.expectedIncome) if (e.month === month) {
    other += e.amount
    forWedding += e.forWedding
  }
  return { salary, other, forWedding }
}

// ---------- Recurring ----------

export interface Occurrence {
  item: RecurringItem
  month: MonthKey
  date: ISODate
  posted: Transaction | null
}

export function recurringOccurrences(data: AppData, fromMonth: MonthKey, toMonth: MonthKey): Occurrence[] {
  const out: Occurrence[] = []
  for (const r of data.recurring) {
    if (!r.active || !/^\d{4}-\d{2}$/.test(r.startMonth)) continue
    const a = r.startMonth > fromMonth ? r.startMonth : fromMonth
    const b = r.endMonth && r.endMonth < toMonth ? r.endMonth : toMonth
    for (const m of monthRange(a, b)) {
      const posted = data.transactions.find((t) => t.recurringId === r.id && t.occurrence === m) ?? null
      out.push({ item: r, month: m, date: dayInMonth(m, r.dayOfMonth), posted })
    }
  }
  return out.sort((x, y) => (x.date < y.date ? -1 : 1))
}

// ---------- Wedding ----------

export interface WeddingCategoryCalc extends WeddingCategory {
  paid: number
  scheduled: number
  remaining: number
  status: 'Not Paid' | 'Partially Paid' | 'Paid'
  overdue: boolean
}

export interface WeddingCalc {
  target: number
  categoriesTotal: number
  categories: WeddingCategoryCalc[]
  paid: number
  unpaidCommitments: number
  remainingBudget: number
  saved: number // wedding savings available (balance of wedding accounts)
  funded: number // saved + paid
  remainingToSave: number
  budgetCompletion: number // paid ÷ budget
  progress: number // (saved + paid) ÷ budget
  unlinkedWeddingSpend: number
}

export function calcWedding(data: AppData, today = todayISO()): WeddingCalc {
  const paidMap = new Map<string, number>()
  const schedMap = new Map<string, number>()
  for (const t of data.transactions) {
    if (t.type !== 'expense' || !t.weddingCategoryId) continue
    const m = isPosted(t, today) ? paidMap : schedMap
    m.set(t.weddingCategoryId, (m.get(t.weddingCategoryId) ?? 0) + t.amount)
  }
  const categories: WeddingCategoryCalc[] = data.wedding.categories.map((c) => {
    const p = paidMap.get(c.id) ?? 0
    const remaining = Math.max(0, c.planned - p)
    return {
      ...c,
      paid: p,
      scheduled: schedMap.get(c.id) ?? 0,
      remaining,
      status: p <= 0 ? 'Not Paid' : c.planned > 0 && p >= c.planned ? 'Paid' : 'Partially Paid',
      overdue: !!c.dueDate && c.dueDate < today && remaining > 0,
    }
  })
  const categoriesTotal = categories.reduce((s, c) => s + c.planned, 0)
  const target = data.wedding.personalTotal > 0 ? data.wedding.personalTotal : categoriesTotal
  const paid = categories.reduce((s, c) => s + c.paid, 0)
  const saved = accountBalances(data, today).filter((b) => b.purpose === 'wedding').reduce((s, b) => s + b.balance, 0)
  const funded = saved + paid
  return {
    target,
    categoriesTotal,
    categories,
    paid,
    unpaidCommitments: categories.reduce((s, c) => s + c.remaining, 0),
    remainingBudget: Math.max(0, target - paid),
    saved,
    funded,
    remainingToSave: Math.max(0, target - funded),
    budgetCompletion: target > 0 ? Math.min(100, (paid / target) * 100) : 0,
    progress: target > 0 ? Math.min(100, Math.max(0, (funded / target) * 100)) : 0,
    unlinkedWeddingSpend: data.transactions
      .filter((t) => t.type === 'expense' && t.category === 'Wedding expenses' && !t.weddingCategoryId && isPosted(t, today))
      .reduce((s, t) => s + t.amount, 0),
  }
}

/** Money added towards the wedding in a month: net money into wedding accounts + wedding bills paid from other accounts. */
export function weddingContribution(data: AppData, month: MonthKey, today = todayISO()): number {
  const wedding = new Set(data.accounts.filter((a) => a.purpose === 'wedding').map((a) => a.id))
  let total = 0
  for (const t of data.transactions) {
    if (monthKey(t.date) !== month || !isPosted(t, today)) continue
    if (t.type === 'income' && wedding.has(t.accountId)) total += t.amount
    if (t.type === 'transfer') {
      const fromW = wedding.has(t.accountId)
      const toW = wedding.has(t.toAccountId)
      if (toW && !fromW) total += t.amount
      if (fromW && !toW) total -= t.amount
    }
    if (t.type === 'expense' && t.weddingCategoryId && !wedding.has(t.accountId)) total += t.amount
  }
  for (const s of data.salaryRecords) if (salaryReceived(s, today) && monthKey(s.actualDate) === month && wedding.has(s.accountId)) total += s.actualAmount!
  return total
}

// ---------- Upcoming payments ----------

export interface UpcomingPayment {
  date: ISODate
  label: string
  amount: number
  kind: 'wedding' | 'recurring' | 'scheduled'
  route: string
}

export function upcomingPayments(data: AppData, wc: WeddingCalc, today = todayISO(), days = 45): UpcomingPayment[] {
  const until = addDays(today, days)
  const out: UpcomingPayment[] = []
  for (const c of wc.categories) if (c.remaining > 0 && c.dueDate && c.dueDate <= until) out.push({ date: c.dueDate, label: `Wedding: ${c.name}`, amount: c.remaining, kind: 'wedding', route: '/wedding' })
  for (const o of recurringOccurrences(data, monthKey(addDays(today, -31)), monthKey(until))) {
    if (!o.posted && o.date <= until && o.date >= addDays(today, -31)) out.push({ date: o.date, label: o.item.description, amount: o.item.amount, kind: 'recurring', route: '/calendar' })
  }
  for (const t of data.transactions) if (t.type === 'expense' && t.date > today && t.date <= until) out.push({ date: t.date, label: t.description || t.category, amount: t.amount, kind: 'scheduled', route: '/money' })
  return out.sort((a, b) => (a.date < b.date ? -1 : 1))
}

/** Total of all unpaid commitments: wedding balances + scheduled expenses (any date). */
export function totalUpcoming(data: AppData, wc: WeddingCalc, today = todayISO()) {
  const scheduled = data.transactions.filter((t) => t.type === 'expense' && t.date > today && !t.weddingCategoryId).reduce((s, t) => s + t.amount, 0)
  return { wedding: wc.unpaidCommitments, scheduled, total: wc.unpaidCommitments + scheduled }
}
