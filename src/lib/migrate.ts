import type { AppData, LeaveType, SalaryRecord, Transaction } from './types'
import { createDefaultData } from './defaults'
import { dayInMonth, isValidISO, monthKey } from './dates'

type Obj = Record<string, unknown>
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown) => (typeof v === 'string' ? v : '')
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : 0)
const arr = (v: unknown): Obj[] => (Array.isArray(v) ? v.filter(isObj) : [])

const CATEGORY_MAP: Record<string, string> = {
  'Food and groceries': 'Food',
  Transport: 'Transportation',
  'Rent and bills': 'Accommodation / Rent',
  'Personal spending': 'Personal expenses',
}
const LEAVE_MAP: Record<string, LeaveType> = { Annual: 'CL', Sick: 'SL', Unpaid: 'LOA', Other: 'Comp' }

/**
 * Converts data saved by version 1 of the planner into version 2.
 * Employment facts come from the Employment Agreement (version 2 defaults);
 * everything you recorded yourself (transactions, leave, budgets, notes, contacts) is kept.
 */
export function migrateV1(v1: Obj): Obj {
  const d = createDefaultData() as unknown as Obj
  const job = isObj(v1.job) ? v1.job : {}
  const lp = isObj(v1.leavePolicy) ? v1.leavePolicy : {}
  const out = d as unknown as AppData

  if (isObj(v1.profile)) {
    out.profile.name = str(v1.profile.name)
    if (isValidISO(str(v1.profile.weddingDate))) out.profile.weddingDate = str(v1.profile.weddingDate)
  }
  if (isValidISO(str(job.targetLastDay))) out.employment.targetLastDay = str(job.targetLastDay)
  out.employment.notes = str(job.notes)
  out.employment.hrContacts = arr(job.hrContacts) as unknown as AppData['employment']['hrContacts']
  if (['Confirmed', 'Extended', 'Not confirmed', 'In progress'].includes(str(job.probationStatus))) out.employment.probationStatus = str(job.probationStatus) as AppData['employment']['probationStatus']
  out.employment.probationConfirmedOn = isValidISO(str(job.probationConfirmedOn)) ? str(job.probationConfirmedOn) : ''
  if (isValidISO(str(job.plannedResignationDate))) out.resignation.plannedSubmissionDate = str(job.plannedResignationDate)

  out.leavePolicy.entitlements.CL.carryover = num(lp.carryover)
  out.leavePolicy.entitlements.CL.carryoverConfirmed = !!lp.carryoverConfirmedByHr
  out.leavePolicy.entitlements.CL.usedBeforeTracking = num(lp.usedBeforeTracking)
  if (Array.isArray(lp.weekendDays)) out.leavePolicy.weekendDays = lp.weekendDays.filter((n) => Number.isInteger(n))
  out.leavePolicy.holidays = arr(lp.holidays) as unknown as AppData['leavePolicy']['holidays']
  if (typeof lp.leaveYearStartMonth === 'number') out.leavePolicy.leaveYearStartMonth = lp.leaveYearStartMonth
  out.leavePolicy.hrPolicyNotes = str(lp.hrPolicyNotes)
  if (str(lp.exitLeavePolicy)) out.leavePolicy.exitLeavePolicy = str(lp.exitLeavePolicy) as AppData['leavePolicy']['exitLeavePolicy']

  out.leaves = arr(v1.leaves).map((l) => ({
    id: str(l.id),
    type: LEAVE_MAP[str(l.type)] ?? 'CL',
    status: str(l.status) as AppData['leaves'][number]['status'],
    startDate: str(l.startDate),
    endDate: str(l.endDate),
    startHalf: !!l.startHalf,
    endHalf: !!l.endHalf,
    days: null,
    reason: '',
    notes: str(l.notes),
    forWedding: !!l.forWedding,
  }))

  if (arr(v1.accounts).length) out.accounts = arr(v1.accounts) as unknown as AppData['accounts']
  const salaryRecords: SalaryRecord[] = []
  const txs: Transaction[] = []
  for (const t of arr(v1.transactions)) {
    const type = str(t.type) as Transaction['type']
    const date = str(t.date)
    if (type === 'income' && str(t.category) === 'Salary' && isValidISO(date) && !salaryRecords.some((s) => s.payMonth === monthKey(date))) {
      salaryRecords.push({ id: str(t.id), payMonth: monthKey(date), expectedDate: dayInMonth(monthKey(date), 5), expectedAmount: out.employment.takeHomeMonthly, actualDate: date, actualAmount: num(t.amount), accountId: str(t.accountId), notes: str(t.notes) })
      continue
    }
    const cat = str(t.category)
    txs.push({
      id: str(t.id),
      date,
      type,
      amount: num(t.amount),
      category: type === 'income' ? (cat === 'Salary' ? 'Other income' : cat || 'Other income') : type === 'expense' ? CATEGORY_MAP[cat] ?? cat : '',
      description: '',
      paymentMethod: '',
      accountId: str(t.accountId),
      toAccountId: str(t.toAccountId),
      weddingCategoryId: str(t.weddingCategoryId),
      recurringId: '',
      occurrence: '',
      notes: str(t.notes),
    })
  }
  out.transactions = txs
  out.salaryRecords = salaryRecords
  out.expectedIncome = arr(v1.expectedIncome) as unknown as AppData['expectedIncome']
  if (isObj(v1.finance)) out.finance.budgetReviewDay = num(v1.finance.budgetReviewDay) || 28

  const w = isObj(v1.wedding) ? v1.wedding : {}
  out.wedding.personalTotal = num(w.personalTotal)
  out.wedding.overallSharedBudget = num(w.overallSharedBudget)
  const oldCats = arr(w.categories)
  const linked = txs.some((t) => t.weddingCategoryId)
  const untouched = oldCats.every((c) => !num(c.planned) && !str(c.notes) && !str(c.dueDate))
  if (oldCats.length && !(untouched && !linked)) out.wedding.categories = oldCats as unknown as AppData['wedding']['categories']

  if (isObj(v1.savings)) {
    const s = v1.savings
    out.savings.monthlyAmount = num(s.monthlyAmount)
    out.savings.regularMonthlyExpenses = num(s.regularMonthlyExpenses)
    out.savings.minimumEmergencyReserve = num(s.minimumEmergencyReserve)
    if (/^\d{4}-\d{2}$/.test(str(s.planStartMonth))) out.savings.planStartMonth = str(s.planStartMonth)
  }

  const oldChecklist = arr(v1.checklist)
  const checklistUntouched = oldChecklist.every((c) => str(c.id).startsWith('ck-') && str(c.status) === 'Not started' && !str(c.notes))
  if (oldChecklist.length && !checklistUntouched) out.checklist = oldChecklist as unknown as AppData['checklist']

  if (isObj(v1.reminders)) {
    const r = v1.reminders
    out.reminders.custom = arr(r.custom) as unknown as AppData['reminders']['custom']
    out.reminders.browserNotifications = !!r.browserNotifications
  }
  return out as unknown as Obj
}
