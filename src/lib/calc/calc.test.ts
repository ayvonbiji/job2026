import { describe, expect, it } from 'vitest'
import { addMonths, monthRange } from '../dates'
import { calcEmployment, lastDayFromSubmission, resignationScenario, submissionDeadline } from './employment'
import { countLeaveDays, leaveYearFor, planWeddingLeave, summariseLeave } from './leave'
import { accountBalances, calcWedding, monthSummary, recurringOccurrences, salarySchedule, weddingContribution } from './finance'
import { calcSavings } from './savings'
import { buildReminders, toICS } from './reminders'
import { createDefaultData } from '../defaults'
import type { AppData, LeaveEntry, Transaction } from '../types'
import { normalizeData } from '../store'
import { diffRows, fromRows, groupRows, toRows } from '../cloud/rows'

const TODAY = '2026-10-30'
const D = () => createDefaultData()
const emp = (d: AppData, today = TODAY) => calcEmployment(d.employment, d.resignation, d.milestones, d.profile.weddingDate, d.leavePolicy.holidays, d.leavePolicy.weekendDays, today)

describe('dates', () => {
  it('calendar months clamp to month end', () => {
    expect(addMonths('2027-01-31', 1)).toBe('2027-02-28')
    expect(monthRange('2026-11', '2027-01')).toEqual(['2026-11', '2026-12', '2027-01'])
  })
})

describe('employment (Soffit agreement defaults)', () => {
  const d = D()
  const e = emp(d)
  it('prepopulated details', () => {
    expect(d.employment.company).toBe('Soffit Infrastructure Services Pvt. Ltd.')
    expect(d.employment.takeHomeMonthly).toBe(13137.93)
    expect(d.employment.salaryDueDay).toBe(5)
  })
  it('milestone dates', () => {
    expect(e.day30).toBe('2026-12-02')
    expect(e.day60).toBe('2027-01-01')
    expect(e.probationEnd).toBe('2027-01-31')
    expect(e.oneYear).toBe('2027-11-02')
  })
  it('31 July 2027 is Scenario A: 3 months, submit by 30 April 2027, HR approval needed', () => {
    const p = e.plan!
    expect(p.scenario).toBe('A')
    expect(p.beforeMinTenure).toBe(true)
    expect(p.noticeMonths).toBe(3)
    expect(p.deadline).toBe('2027-04-30')
    expect(p.noticeStart).toBe('2027-05-01')
    expect(p.approvalRequired).toBe(true)
    expect(p.clauses.map((c) => c.ref)).toEqual(['Clause 10.2.1', 'Clause 10.2.2', 'Clause 10.2.3'])
    expect(e.plannedLastDay).toBe('2027-07-31')
  })
  it('after the one-year anniversary is Scenario B: 2 months, Clause 10.3', () => {
    const p = resignationScenario(d.employment, '2027-12-31', '2028-06-01', [], [0], TODAY)!
    expect(p.scenario).toBe('B')
    expect(p.noticeMonths).toBe(2)
    expect(p.deadline).toBe('2027-10-31')
    expect(p.approvalRequired).toBe(false)
    expect(p.clauses[0].ref).toBe('Clause 10.3')
    expect(p.notices.some((n) => n.text.includes('Clause 10.2 or Clause 10.3'))).toBe(true)
  })
  it('notice maths is consistent for both counting methods', () => {
    for (const last of ['2027-07-31', '2027-06-30', '2027-03-15', '2027-02-28']) {
      for (const c of ['calendar', 'inclusive'] as const) {
        const dl = submissionDeadline(last, 3, c)
        expect(lastDayFromSubmission(dl, 3, c) <= last).toBe(true)
      }
    }
    expect(submissionDeadline('2027-07-31', 3, 'inclusive')).toBe('2027-05-01')
    expect(lastDayFromSubmission('2027-04-30', 3, 'calendar')).toBe('2027-07-31')
  })
  it('a planned submission after the deadline is flagged', () => {
    const d2 = D()
    d2.resignation.plannedSubmissionDate = '2027-05-10'
    const e2 = emp(d2)
    expect(e2.plannedLastDay).toBe('2027-08-10')
    expect(e2.notices.some((n) => n.level === 'danger' && n.text.includes('Submit by 30 Apr 2027'))).toBe(true)
  })
  it('employment progress', () => {
    const e2 = emp(d, '2027-01-31')
    expect(e2.daysEmployed).toBe(90)
    expect(e2.employmentTotalDays).toBe(271)
  })
})

function leave(p: Partial<LeaveEntry>): LeaveEntry {
  return { id: Math.random().toString(), type: 'CL', status: 'Approved', startDate: '', endDate: '', startHalf: false, endHalf: false, days: null, reason: '', notes: '', forWedding: false, ...p }
}

describe('leave (CL and SL separate, no assumed rules)', () => {
  const d = D()
  it('counts calendar days by default and working days only when configured', () => {
    const l = leave({ startDate: '2026-12-24', endDate: '2026-12-28' }) // Thu–Mon
    expect(countLeaveDays(l, d.leavePolicy)).toBe(5)
    const p = { ...d.leavePolicy, dayCountRule: 'working' as const, weekendDays: [0], holidays: [{ id: 'h', date: '2026-12-25', name: 'Christmas' }] }
    expect(countLeaveDays(l, p)).toBe(3)
    expect(countLeaveDays(leave({ startDate: '2026-12-24', endDate: '2026-12-24', startHalf: true }), d.leavePolicy)).toBe(0.5)
    expect(countLeaveDays(leave({ startDate: '2026-12-24', endDate: '2026-12-28', days: 2 }), d.leavePolicy)).toBe(2)
  })
  it('keeps CL and SL balances apart; pending is not deducted', () => {
    const entries = [
      leave({ type: 'CL', status: 'Taken', startDate: '2026-12-01', endDate: '2026-12-02' }),
      leave({ type: 'CL', status: 'Pending', startDate: '2026-12-20', endDate: '2026-12-20' }),
      leave({ type: 'SL', status: 'Taken', startDate: '2026-12-05', endDate: '2026-12-05' }),
      leave({ type: 'LOA', status: 'Taken', startDate: '2026-12-10', endDate: '2026-12-11' }),
    ]
    const s = summariseLeave(entries, d.leavePolicy, d.employment.joiningDate, '2026-12-31')
    expect(s.byType.CL.available).toBe(10)
    expect(s.byType.CL.pending).toBe(1)
    expect(s.byType.CL.projected).toBe(9)
    expect(s.byType.SL.available).toBe(11)
    expect(s.loa.taken).toBe(2)
  })
  it('monthly accrual only when HR rule recorded', () => {
    const p = { ...d.leavePolicy, accrual: 'Monthly' as const }
    const s = summariseLeave([], p, '2026-11-02', '2026-12-15')
    expect(s.byType.CL.accruedToDate).toBe(2) // Nov + Dec
  })
  it('leave years', () => {
    expect(leaveYearFor('2026-10-30', 1)).toEqual({ start: '2026-01-01', end: '2026-12-31' })
    expect(leaveYearFor('2027-02-01', 4)).toEqual({ start: '2026-04-01', end: '2027-03-31' })
  })
  it('wedding leave planner spans into 2027', () => {
    const p = planWeddingLeave([], { ...d.leavePolicy, nextYearCLBeforeExit: 7 }, d.employment.joiningDate, '2027-07-31', TODAY)
    expect(p.exitInCurrentYear).toBe(false)
    expect(p.totalCLBeforeExit).toBe(12 + 7)
    expect(p.mayLapse).toBe(12)
  })
})

function tx(p: Partial<Transaction>): Transaction {
  return { id: Math.random().toString(36).slice(2), date: '2026-12-01', type: 'expense', amount: 0, category: 'Food', description: '', paymentMethod: 'UPI', accountId: 'acc-main', toAccountId: '', weddingCategoryId: '', recurringId: '', occurrence: '', notes: '', ...p }
}

function financeData(): AppData {
  const d = D()
  d.accounts[0].openingBalance = 5000
  d.accounts[1].openingBalance = 20000
  d.wedding.personalTotal = 150000
  d.wedding.categories[0].planned = 30000
  d.salaryRecords = [{ id: 's1', payMonth: '2026-12', expectedDate: '2026-12-05', expectedAmount: 13137.93, actualDate: '2026-12-04', actualAmount: 13137.93, accountId: 'acc-main', notes: '' }]
  d.transactions = [
    tx({ category: 'Food', amount: 3000, date: '2026-12-08' }),
    tx({ category: 'Accommodation / Rent', amount: 4000, date: '2026-12-06' }),
    tx({ type: 'transfer', category: '', amount: 3000, toAccountId: 'acc-wedding', date: '2026-12-06' }),
    tx({ category: 'Wedding expenses', amount: 5000, weddingCategoryId: 'wc2-1', accountId: 'acc-wedding', date: '2026-12-10' }),
    tx({ category: 'Wedding expenses', amount: 1000, weddingCategoryId: 'wc2-1', date: '2026-12-12' }),
    tx({ category: 'Food', amount: 700, date: '2027-01-02' }), // future
  ]
  return d
}

describe('money', () => {
  const T = '2026-12-31'
  it('salary schedule: paid by the 5th of the next month', () => {
    const d = financeData()
    const rows = salarySchedule(d, '2027-07-31', T)
    expect(rows[0].payMonth).toBe('2026-12')
    expect(rows[0].status).toBe('Received')
    expect(rows[rows.length - 1].payMonth).toBe('2027-08')
    expect(rows[1].expectedDate).toBe('2027-01-05')
    expect(salarySchedule(D(), '2027-07-31', '2026-12-06')[0].status).toBe('Overdue')
  })
  it('monthly summary excludes savings transfers and counts wedding payments once', () => {
    const s = monthSummary(financeData(), '2026-12', T)
    expect(s.salary).toBeCloseTo(13137.93)
    expect(s.expenses).toBe(3000 + 4000 + 5000 + 1000)
    expect(s.savings).toBeCloseTo(13137.93 - 13000)
    expect(s.movedToSavings).toBe(3000)
  })
  it('balances include received salary, exclude future items', () => {
    const b = accountBalances(financeData(), T)
    expect(b.find((x) => x.id === 'acc-main')!.balance).toBeCloseTo(5000 + 13137.93 - 3000 - 4000 - 3000 - 1000)
    expect(b.find((x) => x.id === 'acc-wedding')!.balance).toBe(20000 + 3000 - 5000)
  })
  it('wedding metrics', () => {
    const w = calcWedding(financeData(), T)
    expect(w.paid).toBe(6000)
    expect(w.unpaidCommitments).toBe(24000)
    expect(w.saved).toBe(18000)
    expect(w.remainingToSave).toBe(150000 - 24000)
    expect(w.categories[0].status).toBe('Partially Paid')
    expect(Math.round(w.budgetCompletion)).toBe(4)
    expect(weddingContribution(financeData(), '2026-12', T)).toBe(3000 + 1000)
  })
  it('recurring occurrences and posting', () => {
    const d = financeData()
    d.recurring = [{ id: 'r1', description: 'Rent', type: 'expense', category: 'Accommodation / Rent', amount: 4000, accountId: 'acc-main', toAccountId: '', paymentMethod: 'UPI', dayOfMonth: 6, startMonth: '2026-12', endMonth: '2027-02', active: true }]
    d.transactions.push(tx({ recurringId: 'r1', occurrence: '2026-12', amount: 4000, date: '2026-12-06' }))
    const occ = recurringOccurrences(d, '2026-11', '2027-06')
    expect(occ.map((o) => o.month)).toEqual(['2026-12', '2027-01', '2027-02'])
    expect(occ[0].posted).not.toBeNull()
    expect(occ[1].date).toBe('2027-01-06')
  })
})

describe('savings planner', () => {
  it('recommends a monthly amount and checks affordability against income − expenses', () => {
    const d = financeData()
    d.savings.monthlyAmount = 3000
    d.savings.regularMonthlyExpenses = 9000
    d.savings.otherCommitments = 500
    const s = calcSavings(d, '2027-07-31', '2026-12-31')
    expect(s.endMonth).toBe('2027-08') // contribution day 6 is before the 23rd
    expect(s.monthsLeft).toBe(9)
    expect(s.recommendedMonthly).toBe(Math.ceil((150000 - 24000) / 9))
    expect(s.affordable).toBe(false)
    expect(s.onTrack).toBe(false)
    expect(Math.round(s.rows.find((r) => r.month === '2027-02')!.spareMoney)).toBe(Math.round(13137.93 - 9500))
  })
  it('uses recorded expenses when none are entered', () => {
    const s = calcSavings(financeData(), '2027-07-31', '2027-01-15')
    expect(s.expensesSource).toBe('recorded')
    expect(s.expensesUsed).toBe(7000) // wedding payments excluded
  })
})

describe('reminders', () => {
  it('includes contract milestones, salary and wedding day', () => {
    const d = financeData()
    const r = buildReminders(d, emp(d), TODAY)
    const keys = r.map((x) => x.key)
    expect(r.find((x) => x.key === 'ms:resignationSubmission')!.date).toBe('2027-04-30')
    expect(r.find((x) => x.key === 'ms:probation')!.date).toBe('2027-01-31')
    expect(keys).toContain('salary:2026-12')
    expect(r.find((x) => x.key === 'salary:2026-12')!.completed).toBe(true)
    expect(keys.some((k) => k.startsWith('wedding:day'))).toBe(true)
    expect(toICS(r.slice(0, 2))).toContain('BEGIN:VEVENT')
  })
})

describe('storage, migration and Supabase rows', () => {
  it('migrates version 1 data', () => {
    const v1 = {
      version: 1,
      profile: { name: 'Ayvon', weddingDate: '2027-08-23' },
      job: { company: 'Old', joiningDate: '2026-08-01', targetLastDay: '2027-07-31', notes: 'hello', hrContacts: [] },
      leavePolicy: { weekendDays: [0, 6], holidays: [{ id: 'h1', date: '2026-12-25', name: 'Christmas' }] },
      leaves: [{ id: 'l1', type: 'Sick', status: 'Taken', startDate: '2026-10-01', endDate: '2026-10-01' }],
      accounts: [{ id: 'acc-main', name: 'Main', purpose: 'general', openingBalance: 100 }],
      transactions: [
        { id: 't1', date: '2026-10-01', type: 'income', amount: 13000, category: 'Salary', accountId: 'acc-main' },
        { id: 't2', date: '2026-10-02', type: 'expense', amount: 50, category: 'Food and groceries', accountId: 'acc-main' },
      ],
      wedding: { personalTotal: 0, categories: [{ id: 'wc-1', name: 'Clothes', planned: 0 }] },
      checklist: [{ id: 'ck-1', title: 'x', status: 'Not started' }],
    }
    const d = normalizeData(v1)
    expect(d.version).toBe(2)
    expect(d.employment.company).toContain('Soffit')
    expect(d.employment.notes).toBe('hello')
    expect(d.leaves[0].type).toBe('SL')
    expect(d.salaryRecords[0].actualAmount).toBe(13000)
    expect(d.transactions[0].category).toBe('Food')
    expect(d.wedding.categories.length).toBe(13)
    expect(d.checklist.length).toBe(14)
  })
  it('rejects junk and repairs bad links', () => {
    expect(() => normalizeData({ hello: 1 })).toThrow()
    const d = financeData()
    d.transactions[0].accountId = 'missing'
    expect(normalizeData(JSON.parse(JSON.stringify(d))).transactions[0].accountId).toBe('acc-main')
  })
  it('round-trips through database rows', () => {
    const d = financeData()
    d.recurring = [{ id: 'r1', description: 'Rent', type: 'expense', category: 'Accommodation / Rent', amount: 4000, accountId: 'acc-main', toAccountId: '', paymentMethod: 'UPI', dayOfMonth: 6, startMonth: '2026-12', endMonth: '', active: true }]
    d.leaves = [leave({ type: 'CL', startDate: '2027-01-04', endDate: '2027-01-05', days: 1.5, reason: 'Trip' })]
    d.reminders.completed['x'] = '2026-10-30'
    d.resignation.hrConfirmedLiability = 1000
    const back = fromRows(groupRows(toRows(d)))!
    const expected = normalizeData(JSON.parse(JSON.stringify(d)))
    const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : 1)
    back.transactions.sort(byId)
    expected.transactions.sort(byId)
    expect(back).toEqual(expected)
  })
  it('diff: changing a transaction type moves it between tables', () => {
    const a = financeData()
    const b = structuredClone(a)
    b.transactions[0].type = 'transfer'
    b.transactions[0].toAccountId = 'acc-emergency'
    b.checklist.pop()
    const diff = diffRows(toRows(a), toRows(b))
    expect(diff.upserts.get('savings_records')!.length).toBe(1)
    expect(diff.deletes.get('expenses')).toEqual([a.transactions[0].id])
    expect(diff.deletes.get('wedding_checklist')!.length).toBe(1)
    expect(diffRows(toRows(a), toRows(a)).count).toBe(0)
  })
})
