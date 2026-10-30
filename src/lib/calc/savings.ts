import type { AppData, ISODate, MonthKey } from '../types'
import { addMonthKey, monthKey, monthRange, monthsBetweenKeys, todayISO } from '../dates'
import { accountBalances, calcWedding, expectedIncomeFor, monthSummary, weddingContribution } from './finance'

export interface SavingsRow {
  month: MonthKey
  target: number
  actual: number | null
  cumulativeTarget: number
  cumulativeActual: number | null
  expectedIncome: number
  spareMoney: number
  status: 'Met' | 'Missed' | 'In progress' | 'Upcoming'
}

export interface SavingsCalc {
  target: number
  funded: number
  remaining: number
  endMonth: MonthKey
  monthsLeft: number
  futureWeddingIncome: number
  recommendedMonthly: number
  plannedMonthly: number
  thisMonthActual: number
  projected: number
  gap: number
  onTrack: boolean
  behind: boolean // actual cumulative savings below cumulative target
  expensesUsed: number // monthly expenses used for affordability
  expensesSource: 'entered' | 'recorded' | 'none'
  avgSpareMoney: number
  affordable: boolean
  emergencyBalance: number
  emergencyBelowReserve: boolean
  monthsWithoutSalary: MonthKey[]
  rows: SavingsRow[]
}

/** Average non-wedding spending over the last 3 months that have records (wedding payments are planned separately). */
function recordedMonthlyExpenses(data: AppData, today: ISODate): number {
  const cur = monthKey(today)
  const vals: number[] = []
  for (let i = 1; i <= 6 && vals.length < 3; i++) {
    const m = addMonthKey(cur, -i)
    const s = monthSummary(data, m, today)
    const wedding = data.transactions.filter((t) => t.type === 'expense' && t.weddingCategoryId && monthKey(t.date) === m).reduce((a, t) => a + t.amount, 0)
    if (s.expenses > 0) vals.push(s.expenses - wedding)
  }
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
}

export function calcSavings(data: AppData, lastDay: ISODate, today = todayISO()): SavingsCalc {
  const wc = calcWedding(data, today)
  const s = data.savings
  const cur = monthKey(today)
  const wd = data.profile.weddingDate
  const weddingMonth = monthKey(wd)
  const endMonth = s.contributionDay <= Number(wd.slice(8)) ? weddingMonth : addMonthKey(weddingMonth, -1)
  const monthsLeft = Math.max(0, monthsBetweenKeys(cur, endMonth) + 1)
  const remaining = wc.remainingToSave
  const futureWeddingIncome = data.expectedIncome.filter((e) => e.month >= cur && e.month <= endMonth).reduce((a, e) => a + Math.max(0, e.forWedding), 0)
  const need = Math.max(0, remaining - futureWeddingIncome)
  const recommendedMonthly = monthsLeft > 0 ? Math.ceil(need / monthsLeft) : need
  const plannedMonthly = s.monthlyAmount
  const thisMonthActual = weddingContribution(data, cur, today)
  const restOfThisMonth = monthsLeft > 0 ? Math.max(0, plannedMonthly - thisMonthActual) : 0
  const projected = wc.funded + restOfThisMonth + plannedMonthly * Math.max(0, monthsLeft - 1) + futureWeddingIncome
  const gap = projected - wc.target

  const recorded = recordedMonthlyExpenses(data, today)
  const expensesUsed = s.regularMonthlyExpenses > 0 ? s.regularMonthlyExpenses : recorded
  const expensesSource: SavingsCalc['expensesSource'] = s.regularMonthlyExpenses > 0 ? 'entered' : recorded > 0 ? 'recorded' : 'none'

  const startMonth = /^\d{4}-\d{2}$/.test(s.planStartMonth) && s.planStartMonth <= endMonth ? s.planStartMonth : cur
  const monthlyTarget = plannedMonthly > 0 ? plannedMonthly : recommendedMonthly
  const rows: SavingsRow[] = []
  const spares: number[] = []
  const monthsWithoutSalary: MonthKey[] = []
  let cumT = 0
  let cumA = 0
  const lastPay = lastDay ? addMonthKey(monthKey(lastDay), 1) : ''
  for (const m of monthRange(startMonth, endMonth)) {
    const inc = expectedIncomeFor(data, m, lastDay)
    const expectedIncome = inc.salary + inc.other
    const spareMoney = expectedIncome - expensesUsed - s.otherCommitments
    if (m >= cur) {
      spares.push(spareMoney)
      if (inc.salary === 0 && lastPay && m > lastPay) monthsWithoutSalary.push(m)
    }
    cumT += monthlyTarget
    let actual: number | null = null
    let status: SavingsRow['status'] = 'Upcoming'
    if (m <= cur) {
      actual = weddingContribution(data, m, today)
      cumA += actual
      status = actual >= monthlyTarget ? 'Met' : m === cur ? 'In progress' : 'Missed'
    }
    rows.push({ month: m, target: monthlyTarget, actual, cumulativeTarget: cumT, cumulativeActual: m <= cur ? cumA : null, expectedIncome, spareMoney, status })
  }
  const pastRows = rows.filter((r) => r.month < cur)
  const behind = pastRows.length > 0 && pastRows[pastRows.length - 1].cumulativeActual! < pastRows[pastRows.length - 1].cumulativeTarget

  const avgSpareMoney = spares.length ? spares.reduce((a, b) => a + b, 0) / spares.length : 0
  const emergencyBalance = accountBalances(data, today).filter((b) => b.purpose === 'emergency').reduce((a, b) => a + b.balance, 0)
  return {
    target: wc.target,
    funded: wc.funded,
    remaining,
    endMonth,
    monthsLeft,
    futureWeddingIncome,
    recommendedMonthly,
    plannedMonthly,
    thisMonthActual,
    projected,
    gap,
    onTrack: wc.target > 0 && gap >= 0,
    behind,
    expensesUsed,
    expensesSource,
    avgSpareMoney,
    affordable: recommendedMonthly <= avgSpareMoney,
    emergencyBalance,
    emergencyBelowReserve: s.minimumEmergencyReserve > 0 && emergencyBalance < s.minimumEmergencyReserve,
    monthsWithoutSalary,
    rows,
  }
}
