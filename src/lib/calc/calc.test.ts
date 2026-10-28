import { describe, expect, it } from 'vitest'
import { addMonths, monthRange } from '../dates'
import { calcJob, latestResignationDate, periodEnd } from './job'
import { countLeaveDays, leaveYearFor, planWeddingLeave, summariseLeaveYear } from './leave'
import { accountBalances, calcWedding, monthSummary, weddingContribution } from './finance'
import { calcSavings } from './savings'
import { buildReminders, toICS } from './reminders'
import { createDefaultData } from '../defaults'
import type { AppData, LeaveEntry } from '../types'
import { normalizeData } from '../store'

const TODAY = '2026-10-28'

describe('calendar months', () => {
  it('adds months and clamps to month end', () => {
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28')
    expect(addMonths('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonths('2027-08-01', -3)).toBe('2027-05-01')
    expect(addMonths('2026-11-15', 3)).toBe('2027-02-15')
  })
  it('lists month ranges', () => {
    expect(monthRange('2026-11', '2027-02')).toEqual(['2026-11', '2026-12', '2027-01', '2027-02'])
  })
})

describe('notice period', () => {
  it('3 months ending 31 July 2027 means resigning by 1 May 2027', () => {
    expect(latestResignationDate('2027-07-31', 3, 'dayBefore')).toBe('2027-05-01')
    expect(periodEnd('2027-05-01', 3, 'dayBefore')).toBe('2027-07-31')
  })
  it('same-date counting', () => {
    expect(latestResignationDate('2027-07-31', 3, 'sameDate')).toBe('2027-04-30')
    expect(periodEnd('2027-04-30', 3, 'sameDate')).toBe('2027-07-30')
  })
  it('result never overshoots the target', () => {
    for (const target of ['2027-02-28', '2027-03-31', '2027-04-30', '2027-07-31']) {
      for (const c of ['dayBefore', 'sameDate'] as const) {
        const r = latestResignationDate(target, 3, c)
        expect(periodEnd(r, 3, c) <= target).toBe(true)
      }
    }
  })
  it('training and probation are separate milestones', () => {
    const d = createDefaultData()
    d.job.joiningDate = '2026-11-02'
    d.job.probationStartMode = 'afterTraining'
    const j = calcJob(d.job, d.profile.weddingDate, [], [0, 6], TODAY)
    expect(j.trainingEnd).toBe('2027-02-01')
    expect(j.probationStart).toBe('2027-02-02')
    expect(j.probationEnd).toBe('2027-05-01')
    expect(j.resignationDate).toBe('2027-05-01')
    expect(j.lastWorkingDay).toBe('2027-07-31')
    // resigning on the day probation ends triggers a probation warning
    expect(j.notices.some((n) => n.text.includes('probation confirmation'))).toBe(true)
  })
  it('warns when the planned resignation is too late', () => {
    const d = createDefaultData()
    d.job.plannedResignationDate = '2027-05-15'
    const j = calcJob(d.job, d.profile.weddingDate, [], [0, 6], TODAY)
    expect(j.lastWorkingDay).toBe('2027-08-14')
    expect(j.notices.filter((n) => n.level === 'danger').length).toBeGreaterThan(0)
  })
  it('flags a resignation date on a weekend', () => {
    const d = createDefaultData() // 1 May 2027 is a Saturday
    const j = calcJob(d.job, d.profile.weddingDate, [], [0, 6], TODAY)
    expect(j.notices.some((n) => n.text.includes('Saturday'))).toBe(true)
  })
})

function leave(p: Partial<LeaveEntry>): LeaveEntry {
  return { id: Math.random().toString(), type: 'Annual', status: 'Approved', startDate: '', endDate: '', startHalf: false, endHalf: false, forWedding: false, notes: '', ...p }
}

describe('leave', () => {
  const d = createDefaultData()
  d.leavePolicy.annualEntitlement = 18
  d.leavePolicy.holidays = [{ id: 'h', date: '2026-12-25', name: 'Christmas' }]

  it('skips weekends and holidays and counts half days', () => {
    // Mon 21 Dec – Fri 25 Dec (25th holiday) = 4 days
    expect(countLeaveDays(leave({ startDate: '2026-12-21', endDate: '2026-12-25' }), d.leavePolicy)).toBe(4)
    // Fri 23 Oct – Mon 26 Oct = 2 working days
    expect(countLeaveDays(leave({ startDate: '2026-10-23', endDate: '2026-10-26' }), d.leavePolicy)).toBe(2)
    expect(countLeaveDays(leave({ startDate: '2026-10-23', endDate: '2026-10-23', startHalf: true }), d.leavePolicy)).toBe(0.5)
    expect(countLeaveDays(leave({ startDate: '2026-10-22', endDate: '2026-10-23', startHalf: true, endHalf: true }), d.leavePolicy)).toBe(1)
  })

  it('does not deduct pending leave from the confirmed balance', () => {
    const entries = [
      leave({ status: 'Taken', startDate: '2026-03-02', endDate: '2026-03-04' }), // 3 used
      leave({ status: 'Approved', startDate: '2026-11-02', endDate: '2026-11-03' }), // 2 approved upcoming
      leave({ status: 'Pending', startDate: '2026-12-07', endDate: '2026-12-07' }), // 1 pending
      leave({ status: 'Rejected', startDate: '2026-12-08', endDate: '2026-12-08' }),
    ]
    const s = summariseLeaveYear(entries, { ...d.leavePolicy, carryover: 5, carryoverConfirmedByHr: false }, TODAY)
    expect(s.used).toBe(3)
    expect(s.available).toBe(15) // unconfirmed carryover not added
    expect(s.carryoverUnconfirmed).toBe(5)
    expect(s.afterApproved).toBe(13)
    expect(s.projected).toBe(12)
    const s2 = summariseLeaveYear(entries, { ...d.leavePolicy, carryover: 5, carryoverConfirmedByHr: true }, TODAY)
    expect(s2.available).toBe(20)
  })

  it('leave year with April start', () => {
    expect(leaveYearFor('2026-10-28', 4)).toEqual({ start: '2026-04-01', end: '2027-03-31' })
    expect(leaveYearFor('2027-02-01', 4)).toEqual({ start: '2026-04-01', end: '2027-03-31' })
  })

  it('wedding leave plan spans the next leave year and warns about lapse', () => {
    const p = planWeddingLeave([], { ...d.leavePolicy, nextYearEntitlementBeforeExit: 10 }, '2027-07-31', TODAY)
    expect(p.exitInCurrentYear).toBe(false)
    expect(p.nextYearStart).toBe('2027-01-01')
    expect(p.totalBeforeExit).toBe(28)
    expect(p.mayLapse).toBe(18)
  })
})

function financeData(): AppData {
  const d = createDefaultData()
  d.accounts[0].openingBalance = 10000
  d.accounts[1].openingBalance = 50000
  d.wedding.personalTotal = 300000
  d.wedding.categories[0].planned = 40000
  const tx = (p: Partial<AppData['transactions'][number]>) => ({ id: Math.random().toString(), date: '2026-10-01', type: 'expense' as const, amount: 0, category: '', accountId: 'acc-main', toAccountId: '', weddingCategoryId: '', notes: '', ...p })
  d.transactions = [
    tx({ type: 'income', category: 'Salary', amount: 60000 }),
    tx({ category: 'Food and groceries', amount: 8000, date: '2026-10-05' }),
    tx({ type: 'transfer', amount: 20000, toAccountId: 'acc-wedding', date: '2026-10-06' }),
    tx({ category: 'Wedding expenses', amount: 15000, weddingCategoryId: 'wc-1', accountId: 'acc-wedding', date: '2026-10-10' }),
    tx({ category: 'Wedding expenses', amount: 5000, weddingCategoryId: 'wc-1', date: '2026-10-12' }),
    tx({ category: 'Rent and bills', amount: 9000, date: '2026-11-03' }), // scheduled
    tx({ type: 'transfer', amount: 5000, toAccountId: 'acc-emergency', date: '2026-10-07' }),
  ]
  return d
}

describe('finance and wedding', () => {
  it('excludes transfers from income and expenses; wedding expense counted once', () => {
    const d = financeData()
    const s = monthSummary(d, '2026-10', TODAY)
    expect(s.income).toBe(60000)
    expect(s.expenses).toBe(8000 + 15000 + 5000)
    expect(s.savings).toBe(60000 - 28000)
  })
  it('balances, excluding scheduled transactions', () => {
    const b = accountBalances(financeData(), TODAY)
    expect(b.find((x) => x.id === 'acc-main')!.balance).toBe(10000 + 60000 - 8000 - 20000 - 5000 - 5000)
    expect(b.find((x) => x.id === 'acc-wedding')!.balance).toBe(50000 + 20000 - 15000)
    expect(b.find((x) => x.id === 'acc-emergency')!.balance).toBe(5000)
  })
  it('wedding totals', () => {
    const w = calcWedding(financeData(), TODAY)
    expect(w.paid).toBe(20000)
    expect(w.saved).toBe(55000)
    expect(w.funded).toBe(75000)
    expect(w.remainingToSave).toBe(225000)
    expect(w.categories[0].status).toBe('Partially Paid')
    expect(w.categories[0].remaining).toBe(20000)
  })
  it('monthly wedding contribution = transfers in + wedding bills from other accounts', () => {
    expect(weddingContribution(financeData(), '2026-10', TODAY)).toBe(20000 + 5000)
  })
  it('savings plan: recommended and projection', () => {
    const d = financeData()
    d.savings.monthlyAmount = 20000
    const s = calcSavings(d, '2027-07-31', TODAY)
    expect(s.endMonth).toBe('2027-07')
    expect(s.monthsLeft).toBe(10)
    expect(s.recommendedMonthly).toBe(22500)
    // already contributed 25,000 this month (> plan), so 9 more months at 20,000
    expect(s.projected).toBe(75000 + 9 * 20000)
    expect(s.onTrack).toBe(false)
    expect(s.gap).toBe(255000 - 300000)
  })
})

describe('reminders and backup', () => {
  it('builds reminders and ICS', () => {
    const d = financeData()
    d.job.joiningDate = '2026-11-02'
    d.job.salaryMonthly = 50000
    const job = calcJob(d.job, d.profile.weddingDate, [], [0, 6], TODAY)
    const r = buildReminders(d, job, TODAY)
    expect(r.some((x) => x.title === 'Resignation deadline' && x.date === '2027-05-01')).toBe(true)
    expect(r.some((x) => x.key === 'money:salary:2026-11')).toBe(true)
    const ics = toICS(r.slice(0, 2))
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('DTSTART;VALUE=DATE:')
  })
  it('normalises backups and rejects junk', () => {
    const d = financeData()
    const round = normalizeData(JSON.parse(JSON.stringify(d)))
    expect(round.transactions.length).toBe(d.transactions.length)
    expect(() => normalizeData({ hello: 1 })).toThrow()
    const partial = normalizeData({ version: 1, job: { salaryMonthly: 'abc' } })
    expect(partial.job.salaryMonthly).toBe(0)
    expect(partial.wedding.categories.length).toBe(12)
  })
})
