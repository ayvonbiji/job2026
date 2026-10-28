import type { AppData, ISODate, MonthKey, Transaction, WeddingCategory } from '../types'
import { addMonthKey, isValidISO, monthKey, monthRange, monthsBetweenKeys, todayISO } from '../dates'

export const isPosted = (t: Transaction, today: ISODate) => t.date <= today

export interface AccountBalance {
  id: string
  name: string
  purpose: string
  balance: number
}

export function accountBalances(data: AppData, today = todayISO()): AccountBalance[] {
  const map = new Map(data.accounts.map((a) => [a.id, a.openingBalance]))
  for (const t of data.transactions) {
    if (!isPosted(t, today)) continue
    if (t.type === 'income' && map.has(t.accountId)) map.set(t.accountId, map.get(t.accountId)! + t.amount)
    if (t.type === 'expense' && map.has(t.accountId)) map.set(t.accountId, map.get(t.accountId)! - t.amount)
    if (t.type === 'transfer') {
      if (map.has(t.accountId)) map.set(t.accountId, map.get(t.accountId)! - t.amount)
      if (map.has(t.toAccountId)) map.set(t.toAccountId, map.get(t.toAccountId)! + t.amount)
    }
  }
  return data.accounts.map((a) => ({ id: a.id, name: a.name, purpose: a.purpose, balance: map.get(a.id) ?? 0 }))
}

export interface MonthSummary {
  month: MonthKey
  income: number
  expenses: number
  savings: number
  byCategory: Record<string, number>
}

/** Income and expenses for a month. Transfers between your own accounts are not counted. */
export function monthSummary(data: AppData, month: MonthKey, today = todayISO()): MonthSummary {
  let income = 0
  let expenses = 0
  const byCategory: Record<string, number> = {}
  for (const t of data.transactions) {
    if (monthKey(t.date) !== month || !isPosted(t, today)) continue
    if (t.type === 'income') income += t.amount
    if (t.type === 'expense') {
      expenses += t.amount
      byCategory[t.category || 'Other expenses'] = (byCategory[t.category || 'Other expenses'] ?? 0) + t.amount
    }
  }
  return { month, income, expenses, savings: income - expenses, byCategory }
}

export function monthsWithData(data: AppData, today = todayISO()): MonthKey[] {
  const cur = monthKey(today)
  const posted = data.transactions.filter((t) => isPosted(t, today)).map((t) => monthKey(t.date))
  const first = posted.length ? posted.reduce((a, b) => (a < b ? a : b)) : cur
  const start = monthsBetweenKeys(first, cur) > 23 ? addMonthKey(cur, -23) : first
  return monthRange(start, cur)
}

export function expectedIncomeFor(data: AppData, month: MonthKey, lastWorkingDay: ISODate): { salary: number; other: number; items: { label: string; amount: number }[] } {
  const items: { label: string; amount: number }[] = []
  let salary = 0
  const j = data.job
  const startOk = !isValidISO(j.joiningDate) || monthKey(j.joiningDate) <= month
  const endOk = !isValidISO(lastWorkingDay) || month <= monthKey(lastWorkingDay)
  if (j.salaryMonthly > 0 && startOk && endOk) {
    salary = j.salaryMonthly
    items.push({ label: 'Salary', amount: salary })
  }
  let other = 0
  for (const e of data.expectedIncome) {
    if (e.month === month) {
      other += e.amount
      items.push({ label: e.label || 'Other income', amount: e.amount })
    }
  }
  return { salary, other, items }
}

export interface WeddingCategoryCalc extends WeddingCategory {
  paid: number
  scheduled: number
  remaining: number
  status: 'Not Paid' | 'Partially Paid' | 'Paid'
  overdue: boolean
}

export interface WeddingCalc {
  target: number // personal total, or sum of categories if not set
  categoriesTotal: number
  categories: WeddingCategoryCalc[]
  paid: number
  remainingBudget: number
  saved: number // money currently sitting in wedding accounts
  funded: number // saved + paid
  remainingToSave: number
  progress: number // %
  unlinkedWeddingSpend: number // "Wedding expenses" transactions with no budget category
}

export function weddingPaidByCategory(data: AppData, today = todayISO()) {
  const paid = new Map<string, number>()
  const scheduled = new Map<string, number>()
  for (const t of data.transactions) {
    if (t.type !== 'expense' || !t.weddingCategoryId) continue
    const m = isPosted(t, today) ? paid : scheduled
    m.set(t.weddingCategoryId, (m.get(t.weddingCategoryId) ?? 0) + t.amount)
  }
  return { paid, scheduled }
}

export function calcWedding(data: AppData, today = todayISO()): WeddingCalc {
  const { paid, scheduled } = weddingPaidByCategory(data, today)
  const categories: WeddingCategoryCalc[] = data.wedding.categories.map((c) => {
    const p = paid.get(c.id) ?? 0
    const remaining = Math.max(0, c.planned - p)
    const status: WeddingCategoryCalc['status'] = p <= 0 ? 'Not Paid' : c.planned > 0 && p >= c.planned ? 'Paid' : 'Partially Paid'
    return {
      ...c,
      paid: p,
      scheduled: scheduled.get(c.id) ?? 0,
      remaining,
      status,
      overdue: !!c.dueDate && c.dueDate < today && remaining > 0,
    }
  })
  const categoriesTotal = categories.reduce((s, c) => s + c.planned, 0)
  const target = data.wedding.personalTotal > 0 ? data.wedding.personalTotal : categoriesTotal
  const totalPaid = categories.reduce((s, c) => s + c.paid, 0)
  const balances = accountBalances(data, today)
  const saved = balances.filter((b) => b.purpose === 'wedding').reduce((s, b) => s + b.balance, 0)
  const funded = saved + totalPaid
  const remainingToSave = Math.max(0, target - funded)
  const unlinkedWeddingSpend = data.transactions
    .filter((t) => t.type === 'expense' && t.category === 'Wedding expenses' && !t.weddingCategoryId && isPosted(t, today))
    .reduce((s, t) => s + t.amount, 0)
  return {
    target,
    categoriesTotal,
    categories,
    paid: totalPaid,
    remainingBudget: Math.max(0, target - totalPaid),
    saved,
    funded,
    remainingToSave,
    progress: target > 0 ? Math.min(100, (funded / target) * 100) : 0,
    unlinkedWeddingSpend,
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
  return total
}

export function upcomingExpenses(data: AppData, wc: WeddingCalc, today = todayISO()) {
  const scheduledOther = data.transactions
    .filter((t) => t.type === 'expense' && !isPosted(t, today) && !t.weddingCategoryId)
    .reduce((s, t) => s + t.amount, 0)
  const weddingRemaining = wc.categories.reduce((s, c) => s + c.remaining, 0)
  return { scheduledOther, weddingRemaining, total: scheduledOther + weddingRemaining }
}
