import type { BalancedLeave, ISODate, LeaveEntry, LeavePolicy, LeaveType } from '../types'
import { addDays, dayOfWeek, fmtDate, isValidISO, monthKey, monthsBetweenKeys, todayISO } from '../dates'

export interface LeaveDay {
  date: ISODate
  amount: number
}

type CountPolicy = Pick<LeavePolicy, 'weekendDays' | 'holidays' | 'dayCountRule'>

export function isWorkingDay(date: ISODate, policy: Pick<LeavePolicy, 'weekendDays' | 'holidays'>): boolean {
  if (policy.weekendDays.includes(dayOfWeek(date))) return false
  return !policy.holidays.some((h) => h.date === date)
}

/**
 * Days covered by a leave entry, using the configured counting rule.
 * 'calendar' counts every day (default — no weekend rule is assumed);
 * 'working' skips configured weekend days and company holidays.
 */
export function leaveDays(entry: Pick<LeaveEntry, 'startDate' | 'endDate' | 'startHalf' | 'endHalf'>, policy: CountPolicy): LeaveDay[] {
  if (!isValidISO(entry.startDate)) return []
  const end = isValidISO(entry.endDate) && entry.endDate >= entry.startDate ? entry.endDate : entry.startDate
  const out: LeaveDay[] = []
  let d = entry.startDate
  let guard = 0
  while (d <= end && guard++ < 400) {
    if (policy.dayCountRule === 'calendar' || isWorkingDay(d, policy)) {
      let amount = 1
      if (d === entry.startDate && entry.startHalf) amount = 0.5
      else if (d === end && end !== entry.startDate && entry.endHalf) amount = 0.5
      out.push({ date: d, amount })
    }
    d = addDays(d, 1)
  }
  return out
}

export function calculatedDays(entry: LeaveEntry, policy: CountPolicy): number {
  return leaveDays(entry, policy).reduce((s, x) => s + x.amount, 0)
}

/** Days recorded for the entry: your manual figure if entered, otherwise the calculated figure. */
export function countLeaveDays(entry: LeaveEntry, policy: CountPolicy): number {
  return entry.days !== null && Number.isFinite(entry.days) ? entry.days : calculatedDays(entry, policy)
}

/** Day-by-day allocation used for date ranges. A manual figure is counted on the start date. */
function allocation(entry: LeaveEntry, policy: CountPolicy): LeaveDay[] {
  if (entry.days !== null && Number.isFinite(entry.days)) return [{ date: entry.startDate, amount: entry.days }]
  return leaveDays(entry, policy)
}

export function leaveYearFor(date: ISODate, startMonth: number): { start: ISODate; end: ISODate } {
  const [y, m] = date.split('-').map(Number)
  const year = m >= startMonth ? y : y - 1
  const start = `${year}-${String(startMonth).padStart(2, '0')}-01`
  return { start, end: addDays(`${year + 1}-${String(startMonth).padStart(2, '0')}-01`, -1) }
}

function sumIn(entries: LeaveEntry[], policy: CountPolicy, from: ISODate, to: ISODate, pick: (e: LeaveEntry, d: ISODate) => boolean): number {
  let total = 0
  for (const e of entries) for (const day of allocation(e, policy)) if (day.date >= from && day.date <= to && pick(e, day.date)) total += day.amount
  return total
}

export interface TypeSummary {
  type: LeaveType
  annual: number
  accruedToDate: number // entitlement counted now (after the accrual rule)
  carryoverCounted: number
  carryoverUnconfirmed: number
  used: number
  approvedUpcoming: number
  pending: number
  planned: number
  available: number
  afterApproved: number
  projected: number
}

export interface LeaveSummary {
  start: ISODate
  end: ISODate
  byType: Record<BalancedLeave, TypeSummary>
  loa: { taken: number; upcoming: number; pending: number }
  notes: string[]
}

const isUsed = (e: LeaveEntry, d: ISODate, today: ISODate) => e.status === 'Taken' || (e.status === 'Approved' && d <= today)

export function summariseLeave(entries: LeaveEntry[], policy: LeavePolicy, joiningDate: ISODate, today = todayISO()): LeaveSummary {
  const { start, end } = leaveYearFor(today, policy.leaveYearStartMonth)
  const notes: string[] = []
  const byType = {} as Record<BalancedLeave, TypeSummary>
  for (const type of ['CL', 'SL', 'Comp'] as BalancedLeave[]) {
    const ent = policy.entitlements[type]
    const list = entries.filter((e) => e.type === type)
    let accruedToDate = ent.annualDays
    if (type !== 'Comp' && policy.accrual === 'Monthly') {
      const from = isValidISO(joiningDate) && joiningDate > start ? monthKey(joiningDate) : monthKey(start)
      const months = Math.max(0, Math.min(12, monthsBetweenKeys(from, monthKey(today)) + 1))
      accruedToDate = Math.round(((ent.annualDays * months) / 12) * 2) / 2
    }
    const usedTracked = sumIn(list, policy, start, end, (e, d) => isUsed(e, d, today))
    const used = ent.usedBeforeTracking + usedTracked
    const approvedUpcoming = sumIn(list, policy, start, end, (e, d) => e.status === 'Approved' && d > today)
    const pending = sumIn(list, policy, start, end, (e) => e.status === 'Pending')
    const planned = sumIn(list, policy, start, end, (e) => e.status === 'Planned')
    const carryoverCounted = ent.carryoverConfirmed ? ent.carryover : 0
    const available = accruedToDate + carryoverCounted - used
    byType[type] = {
      type,
      annual: ent.annualDays,
      accruedToDate,
      carryoverCounted,
      carryoverUnconfirmed: ent.carryoverConfirmed ? 0 : ent.carryover,
      used,
      approvedUpcoming,
      pending,
      planned,
      available,
      afterApproved: available - approvedUpcoming,
      projected: available - approvedUpcoming - pending - planned,
    }
  }
  const loaList = entries.filter((e) => e.type === 'LOA')
  const loa = {
    taken: sumIn(loaList, policy, start, end, (e, d) => isUsed(e, d, today)),
    upcoming: sumIn(loaList, policy, start, end, (e, d) => e.status === 'Approved' && d > today),
    pending: sumIn(loaList, policy, start, end, (e) => e.status === 'Pending' || e.status === 'Planned'),
  }
  if (policy.accrual === 'Not confirmed') notes.push('HR has not confirmed how leave is credited (all at once or monthly). Balances show your full entitlement until you record the rule.')
  return { start, end, byType, loa, notes }
}

export interface WeddingLeavePlan {
  lastWorkingDay: ISODate
  exitInCurrentYear: boolean
  currentYearCL: number
  nextYearStart: ISODate
  nextYearCLBooked: number
  nextYearCL: number
  totalCLBeforeExit: number
  weddingLeaveBooked: number
  mayLapse: number
  notes: string[]
}

export function planWeddingLeave(entries: LeaveEntry[], policy: LeavePolicy, joiningDate: ISODate, lastWorkingDay: ISODate, today = todayISO()): WeddingLeavePlan {
  const cur = summariseLeave(entries, policy, joiningDate, today)
  const notes: string[] = []
  const exit = isValidISO(lastWorkingDay) ? lastWorkingDay : ''
  const exitInCurrentYear = !exit || exit <= cur.end
  const nextYearStart = addDays(cur.end, 1)
  const active = (e: LeaveEntry) => ['Planned', 'Pending', 'Approved', 'Taken'].includes(e.status)
  let nextYearCLBooked = 0
  let nextYearCL = 0
  if (exit && !exitInCurrentYear) {
    nextYearCLBooked = sumIn(entries.filter((e) => e.type === 'CL'), policy, nextYearStart, exit, active)
    nextYearCL = policy.nextYearCLBeforeExit - nextYearCLBooked
    if (policy.nextYearCLBeforeExit === 0) notes.push(`Ask HR how much CL you will have from ${fmtDate(nextYearStart)} until your last working day, then enter it below.`)
  }
  const currentYearCL = cur.byType.CL.projected
  const mayLapse = !exitInCurrentYear && policy.carryForward !== 'Allowed' ? Math.max(0, currentYearCL) : 0
  if (mayLapse > 0) notes.push(`Carry-forward is ${policy.carryForward === 'Not allowed' ? 'not allowed' : 'not confirmed'}, so plan to use your remaining ${mayLapse} CL day(s) of this leave year by ${fmtDate(cur.end)}.`)
  if (policy.exitLeavePolicy === 'Not confirmed') notes.push('HR has not confirmed what happens to unused leave when you leave. Do not plan on it being paid out.')
  const weddingLeaveBooked = entries.filter((e) => e.forWedding && active(e)).reduce((s, e) => s + countLeaveDays(e, policy), 0)
  return {
    lastWorkingDay: exit,
    exitInCurrentYear,
    currentYearCL,
    nextYearStart,
    nextYearCLBooked,
    nextYearCL,
    totalCLBeforeExit: exitInCurrentYear ? currentYearCL : Math.max(0, currentYearCL) + nextYearCL,
    weddingLeaveBooked,
    mayLapse,
    notes,
  }
}

/** Date to request leave by: the HR notice rule if recorded, otherwise a 14-day planning reminder. */
export function requestDeadline(entry: LeaveEntry, policy: LeavePolicy): { date: ISODate; fromPolicy: boolean } {
  const n = policy.requestNoticeDays > 0 ? policy.requestNoticeDays : 14
  return { date: addDays(entry.startDate, -n), fromPolicy: policy.requestNoticeDays > 0 }
}
