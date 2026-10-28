import type { AppData, ISODate, MonthKey } from '../types'
import { addMonthKey, isValidISO, monthKey, monthRange, monthsBetweenKeys, todayISO } from '../dates'
import { accountBalances, calcWedding, expectedIncomeFor, weddingContribution } from './finance'

export interface SavingsRow {
  month: MonthKey
  target: number
  actual: number | null // null for future months
  cumulativeTarget: number
  cumulativeActual: number | null
  expectedIncome: number
  spareMoney: number // expected income − regular expenses
  status: 'Met' | 'Missed' | 'In progress' | 'Upcoming'
}

export interface SavingsCalc {
  target: number
  funded: number
  remaining: number
  endMonth: MonthKey
  monthsLeft: number // including the current month
  futureWeddingIncome: number
  recommendedMonthly: number
  plannedMonthly: number
  thisMonthActual: number
  projected: number
  gap: number // projected − target (negative = shortfall)
  onTrack: boolean
  avgSpareMoney: number
  revisedMonthly: number // only meaningful when behind
  revisedExceedsSpare: boolean
  emergencyBalance: number
  emergencyBelowReserve: boolean
  monthsWithoutSalary: MonthKey[]
  rows: SavingsRow[]
}

export function calcSavings(data: AppData, lastWorkingDay: ISODate, today = todayISO()): SavingsCalc {
  const wc = calcWedding(data, today)
  const s = data.savings
  const cur = monthKey(today)
  const weddingMonth = monthKey(data.profile.weddingDate)
  const endMonth = addMonthKey(weddingMonth, -1) // save up to the month before the wedding
  const monthsLeft = Math.max(0, monthsBetweenKeys(cur, endMonth) + 1)
  const remaining = wc.remainingToSave
  const futureWeddingIncome = data.expectedIncome.filter((e) => e.month >= cur && e.month <= endMonth).reduce((a, e) => a + Math.max(0, e.forWedding), 0)
  const needFromSalary = Math.max(0, remaining - futureWeddingIncome)
  const recommendedMonthly = monthsLeft > 0 ? Math.ceil(needFromSalary / monthsLeft) : needFromSalary
  const plannedMonthly = s.monthlyAmount
  const thisMonthActual = weddingContribution(data, cur, today)

  // Projection using the amount you plan to save each month.
  const restOfThisMonth = monthsLeft > 0 ? Math.max(0, plannedMonthly - thisMonthActual) : 0
  const projected = wc.funded + restOfThisMonth + plannedMonthly * Math.max(0, monthsLeft - 1) + futureWeddingIncome
  const gap = projected - wc.target
  const onTrack = wc.target > 0 && gap >= 0

  const startMonth = /^\d{4}-\d{2}$/.test(s.planStartMonth) && s.planStartMonth <= endMonth ? s.planStartMonth : cur
  const monthlyTarget = plannedMonthly > 0 ? plannedMonthly : recommendedMonthly
  const rows: SavingsRow[] = []
  let cumT = 0
  let cumA = 0
  const spares: number[] = []
  const monthsWithoutSalary: MonthKey[] = []
  for (const m of monthRange(startMonth, endMonth)) {
    const inc = expectedIncomeFor(data, m, lastWorkingDay)
    const expectedIncome = inc.salary + inc.other
    const spareMoney = expectedIncome - s.regularMonthlyExpenses
    if (m >= cur) {
      spares.push(spareMoney)
      if (data.job.salaryMonthly > 0 && inc.salary === 0 && isValidISO(lastWorkingDay) && m > monthKey(lastWorkingDay)) monthsWithoutSalary.push(m)
    }
    cumT += monthlyTarget
    let actual: number | null = null
    let status: SavingsRow['status'] = 'Upcoming'
    if (m <= cur) {
      actual = weddingContribution(data, m, today)
      cumA += actual
      status = m === cur ? (actual >= monthlyTarget ? 'Met' : 'In progress') : actual >= monthlyTarget ? 'Met' : 'Missed'
    }
    rows.push({ month: m, target: monthlyTarget, actual, cumulativeTarget: cumT, cumulativeActual: m <= cur ? cumA : null, expectedIncome, spareMoney, status })
  }

  const avgSpareMoney = spares.length ? spares.reduce((a, b) => a + b, 0) / spares.length : 0
  const revisedMonthly = recommendedMonthly
  const revisedExceedsSpare = revisedMonthly > avgSpareMoney

  const emergencyBalance = accountBalances(data, today)
    .filter((b) => b.purpose === 'emergency')
    .reduce((a, b) => a + b.balance, 0)
  const emergencyBelowReserve = s.minimumEmergencyReserve > 0 && emergencyBalance < s.minimumEmergencyReserve

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
    onTrack,
    avgSpareMoney,
    revisedMonthly,
    revisedExceedsSpare,
    emergencyBalance,
    emergencyBelowReserve,
    monthsWithoutSalary,
    rows,
  }
}
