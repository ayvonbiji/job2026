import type { ISODate, LeaveEntry, LeavePolicy } from '../types'
import { addDays, dayOfWeek, fmtDate, isValidISO, todayISO } from '../dates'
import { periodEnd } from './job'

export interface LeaveDay {
  date: ISODate
  amount: number // 1 or 0.5
}

export function isWorkingDay(date: ISODate, policy: Pick<LeavePolicy, 'weekendDays' | 'holidays'>): boolean {
  if (policy.weekendDays.includes(dayOfWeek(date))) return false
  return !policy.holidays.some((h) => h.date === date)
}

/** Working days covered by a leave entry, excluding weekends and company holidays. Half days count as 0.5. */
export function leaveDays(entry: Pick<LeaveEntry, 'startDate' | 'endDate' | 'startHalf' | 'endHalf'>, policy: Pick<LeavePolicy, 'weekendDays' | 'holidays'>): LeaveDay[] {
  if (!isValidISO(entry.startDate)) return []
  const end = isValidISO(entry.endDate) && entry.endDate >= entry.startDate ? entry.endDate : entry.startDate
  const out: LeaveDay[] = []
  let d = entry.startDate
  let guard = 0
  while (d <= end && guard++ < 400) {
    if (isWorkingDay(d, policy)) {
      let amount = 1
      if (d === entry.startDate && entry.startHalf) amount = 0.5
      else if (d === end && end !== entry.startDate && entry.endHalf) amount = 0.5
      out.push({ date: d, amount })
    }
    d = addDays(d, 1)
  }
  return out
}

export function countLeaveDays(entry: LeaveEntry, policy: LeavePolicy): number {
  return leaveDays(entry, policy).reduce((s, x) => s + x.amount, 0)
}

export function leaveYearFor(date: ISODate, startMonth: number): { start: ISODate; end: ISODate } {
  const [y, m] = date.split('-').map(Number)
  const year = m >= startMonth ? y : y - 1
  const start = `${year}-${String(startMonth).padStart(2, '0')}-01`
  return { start, end: periodEnd(start, 12) }
}

const ACTIVE: LeaveEntry['status'][] = ['Planned', 'Pending', 'Approved', 'Taken']

export interface LeaveYearSummary {
  start: ISODate
  end: ISODate
  entitlement: number
  carryoverCounted: number
  carryoverUnconfirmed: number
  used: number
  approvedUpcoming: number
  pending: number
  planned: number
  available: number // entitlement + confirmed carryover − used
  afterApproved: number // available − approved upcoming
  projected: number // afterApproved − pending − planned
  sickUsed: number
  sickRemaining: number
  unpaid: number
  other: number
}

function sumInRange(entries: LeaveEntry[], policy: LeavePolicy, from: ISODate, to: ISODate, pick: (e: LeaveEntry, d: ISODate) => boolean): number {
  let total = 0
  for (const e of entries) {
    for (const day of leaveDays(e, policy)) {
      if (day.date >= from && day.date <= to && pick(e, day.date)) total += day.amount
    }
  }
  return total
}

export function summariseLeaveYear(entries: LeaveEntry[], policy: LeavePolicy, today = todayISO()): LeaveYearSummary {
  const { start, end } = leaveYearFor(today, policy.leaveYearStartMonth)
  const annual = entries.filter((e) => e.type === 'Annual')
  const usedTracked = sumInRange(annual, policy, start, end, (e, d) => e.status === 'Taken' || (e.status === 'Approved' && d <= today))
  const approvedUpcoming = sumInRange(annual, policy, start, end, (e, d) => e.status === 'Approved' && d > today)
  const pending = sumInRange(annual, policy, start, end, (e) => e.status === 'Pending')
  const planned = sumInRange(annual, policy, start, end, (e) => e.status === 'Planned')
  const used = policy.usedBeforeTracking + usedTracked
  const carryoverCounted = policy.carryoverConfirmedByHr ? policy.carryover : 0
  const available = policy.annualEntitlement + carryoverCounted - used
  const afterApproved = available - approvedUpcoming
  const projected = afterApproved - pending - planned
  const sickUsed = sumInRange(entries.filter((e) => e.type === 'Sick'), policy, start, end, (e) => e.status === 'Taken' || e.status === 'Approved')
  const unpaid = sumInRange(entries.filter((e) => e.type === 'Unpaid'), policy, start, end, (e) => e.status === 'Taken' || e.status === 'Approved')
  const other = sumInRange(entries.filter((e) => e.type === 'Other'), policy, start, end, (e) => e.status === 'Taken' || e.status === 'Approved')
  return {
    start,
    end,
    entitlement: policy.annualEntitlement,
    carryoverCounted,
    carryoverUnconfirmed: policy.carryoverConfirmedByHr ? 0 : policy.carryover,
    used,
    approvedUpcoming,
    pending,
    planned,
    available,
    afterApproved,
    projected,
    sickUsed,
    sickRemaining: policy.sickEntitlement - sickUsed,
    unpaid,
    other,
  }
}

export interface WeddingLeavePlan {
  lastWorkingDay: ISODate
  exitInCurrentYear: boolean
  currentYearLeft: number // projected balance this leave year
  nextYearStart: ISODate
  nextYearAvailable: number // HR-confirmed entitlement before exit − leave already booked in that period
  nextYearBooked: number
  totalBeforeExit: number
  weddingLeaveBooked: number
  workingDaysToExit: number
  mayLapse: number // days at risk of being lost at the end of this leave year
  notes: string[]
}

export function planWeddingLeave(entries: LeaveEntry[], policy: LeavePolicy, lastWorkingDay: ISODate, today = todayISO()): WeddingLeavePlan {
  const cur = summariseLeaveYear(entries, policy, today)
  const notes: string[] = []
  const exit = isValidISO(lastWorkingDay) ? lastWorkingDay : ''
  const exitInCurrentYear = !exit || exit <= cur.end
  const nextYearStart = addDays(cur.end, 1)
  let nextYearBooked = 0
  let nextYearAvailable = 0
  if (exit && !exitInCurrentYear) {
    nextYearBooked = sumInRange(
      entries.filter((e) => e.type === 'Annual'),
      policy,
      nextYearStart,
      exit,
      (e) => ACTIVE.includes(e.status),
    )
    nextYearAvailable = policy.nextYearEntitlementBeforeExit - nextYearBooked
    if (policy.nextYearEntitlementBeforeExit === 0) {
      notes.push('Enter the leave HR confirms you will get in the next leave year up to your last working day. Many companies pro-rate it when you resign.')
    }
  }
  const weddingLeaveBooked = sumInRange(
    entries.filter((e) => e.forWedding),
    policy,
    '0000-01-01',
    '9999-12-31',
    (e) => ACTIVE.includes(e.status),
  )
  let workingDaysToExit = 0
  if (exit && exit >= today) {
    workingDaysToExit = leaveDays({ startDate: today, endDate: exit, startHalf: false, endHalf: false }, policy).length
  }
  const confirmedCarry = policy.nextYearCarryoverConfirmed ? policy.nextYearCarryover : 0
  const mayLapse = !exitInCurrentYear ? Math.max(0, cur.projected - confirmedCarry) : 0
  if (mayLapse > 0) {
    notes.push(`${mayLapse} day(s) of this year's leave may be lost after ${fmtDate(cur.end)} unless you use them or HR confirms they carry over.`)
  }
  if (policy.exitLeavePolicy === 'Not confirmed') {
    notes.push('HR has not confirmed what happens to unused leave when you leave. Do not plan on it being paid out.')
  }
  const totalBeforeExit = (exitInCurrentYear ? cur.projected : Math.max(0, cur.projected) + nextYearAvailable)
  return {
    lastWorkingDay: exit,
    exitInCurrentYear,
    currentYearLeft: cur.projected,
    nextYearStart,
    nextYearAvailable,
    nextYearBooked,
    totalBeforeExit,
    weddingLeaveBooked,
    workingDaysToExit,
    mayLapse,
    notes,
  }
}

/** Latest date to submit a leave request, based on the policy's notice requirement. */
export function requestDeadline(entry: LeaveEntry, policy: LeavePolicy): ISODate {
  return addDays(entry.startDate, -Math.max(0, policy.requestNoticeDays))
}
