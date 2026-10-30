import type { AppData, BalancedLeave } from '../types'
import { MILESTONE_KEYS } from '../types'
import { createDefaultData } from '../defaults'
import { normalizeData } from '../store'

/** Tables in the order parents must be written before children. Deletes run in reverse. */
export const TABLES = [
  'profiles',
  'employment_details',
  'resignation_plans',
  'accounts',
  'wedding_budget_categories',
  'recurring_transactions',
  'job_milestones',
  'leave_entitlements',
  'holidays',
  'leave_transactions',
  'income_transactions',
  'expenses',
  'savings_records',
  'expected_income',
  'wedding_checklist',
  'reminders',
  'reminder_states',
] as const
export type TableName = (typeof TABLES)[number]

/** Primary-key column besides user_id (null = one row per user). */
export const PK: Record<TableName, string | null> = {
  profiles: null,
  employment_details: null,
  resignation_plans: null,
  job_milestones: 'milestone_key',
  leave_entitlements: 'leave_type',
  reminder_states: 'reminder_key',
  accounts: 'id',
  wedding_budget_categories: 'id',
  recurring_transactions: 'id',
  holidays: 'id',
  leave_transactions: 'id',
  income_transactions: 'id',
  expenses: 'id',
  savings_records: 'id',
  expected_income: 'id',
  wedding_checklist: 'id',
  reminders: 'id',
}

export type Row = Record<string, unknown>
export interface RowRef {
  table: TableName
  pk: string
  row: Row
}

const nul = (s: string) => (s ? s : null)

/** Flatten planner data into database rows (user_id is added when sending). */
export function toRows(d: AppData): RowRef[] {
  const out: RowRef[] = []
  const add = (table: TableName, row: Row) => {
    const col = PK[table]
    out.push({ table, pk: col ? String(row[col]) : 'me', row })
  }
  const { savings, leavePolicy: lp, employment: e, resignation: r } = d
  add('profiles', {
    full_name: d.profile.name,
    wedding_date: d.profile.weddingDate,
    wedding_personal_target: d.wedding.personalTotal,
    wedding_shared_budget: d.wedding.overallSharedBudget,
    budget_review_day: d.finance.budgetReviewDay,
    savings_plan: { ...savings },
    leave_policy: {
      leaveYearStartMonth: lp.leaveYearStartMonth,
      dayCountRule: lp.dayCountRule,
      weekendDays: lp.weekendDays,
      accrual: lp.accrual,
      carryForward: lp.carryForward,
      encashment: lp.encashment,
      exitLeavePolicy: lp.exitLeavePolicy,
      requestNoticeDays: lp.requestNoticeDays,
      nextYearCLBeforeExit: lp.nextYearCLBeforeExit,
      hrPolicyNotes: lp.hrPolicyNotes,
    },
    notifications_enabled: d.reminders.browserNotifications,
  })
  add('employment_details', {
    company: e.company,
    designation: e.designation,
    location: e.location,
    joining_date: nul(e.joiningDate),
    probation_days: e.probationDays,
    probation_status: e.probationStatus,
    probation_confirmed_on: nul(e.probationConfirmedOn),
    min_tenure_months: e.minTenureMonths,
    early_notice_months: e.earlyNoticeMonths,
    standard_notice_months: e.standardNoticeMonths,
    notice_counting: e.noticeCounting,
    target_last_day: nul(e.targetLastDay),
    gross_monthly: e.grossMonthly,
    take_home_monthly: e.takeHomeMonthly,
    ctc_monthly: e.ctcMonthly,
    gross_ctc: e.grossCtc,
    salary_due_day: e.salaryDueDay,
    hr_contacts: e.hrContacts,
    notes: e.notes,
  })
  add('resignation_plans', {
    planned_submission_date: nul(r.plannedSubmissionDate),
    early_exit_approval: r.earlyExitApproval,
    approval_notes: r.approvalNotes,
    hr_confirmed_liability: r.hrConfirmedLiability,
    hr_confirmed_liability_on: nul(r.hrConfirmedLiabilityOn),
    liability_notes: r.liabilityNotes,
  })
  d.accounts.forEach((a, i) => add('accounts', { id: a.id, name: a.name, purpose: a.purpose, opening_balance: a.openingBalance, sort_order: i }))
  d.wedding.categories.forEach((c, i) =>
    add('wedding_budget_categories', { id: c.id, name: c.name, planned: c.planned, due_date: nul(c.dueDate), notes: c.notes, receipts: c.receipts, sort_order: i }),
  )
  for (const x of d.recurring) {
    add('recurring_transactions', {
      id: x.id,
      description: x.description,
      txn_type: x.type,
      category: x.category,
      amount: x.amount,
      account_id: x.accountId,
      to_account_id: nul(x.toAccountId),
      payment_method: x.paymentMethod,
      day_of_month: x.dayOfMonth,
      start_month: x.startMonth,
      end_month: nul(x.endMonth),
      active: x.active,
    })
  }
  for (const k of MILESTONE_KEYS) {
    const m = d.milestones[k]
    add('job_milestones', { milestone_key: k, date_override: nul(m.dateOverride), done: m.done, done_on: nul(m.doneOn), notes: m.notes })
  }
  for (const t of ['CL', 'SL', 'Comp'] as BalancedLeave[]) {
    const x = lp.entitlements[t]
    add('leave_entitlements', { leave_type: t, annual_days: x.annualDays, carryover: x.carryover, carryover_confirmed: x.carryoverConfirmed, used_before_tracking: x.usedBeforeTracking })
  }
  for (const h of lp.holidays) add('holidays', { id: h.id, holiday_date: h.date, name: h.name })
  for (const l of d.leaves) {
    add('leave_transactions', {
      id: l.id,
      leave_type: l.type,
      status: l.status,
      start_date: l.startDate,
      end_date: l.endDate >= l.startDate ? l.endDate : l.startDate,
      half_day_start: l.startHalf,
      half_day_end: l.endHalf,
      days: l.days,
      reason: l.reason,
      notes: l.notes,
      for_wedding: l.forWedding,
    })
  }
  for (const s of d.salaryRecords) {
    add('income_transactions', {
      id: s.id,
      is_salary: true,
      txn_date: nul(s.actualDate),
      amount: s.actualAmount,
      category: 'Salary',
      description: '',
      account_id: nul(s.accountId),
      payment_method: 'Bank transfer',
      notes: s.notes,
      pay_month: s.payMonth,
      expected_date: nul(s.expectedDate),
      expected_amount: s.expectedAmount,
    })
  }
  for (const t of d.transactions) {
    const common = { id: t.id, txn_date: t.date, amount: t.amount, description: t.description, payment_method: t.paymentMethod, notes: t.notes }
    if (t.type === 'income') {
      add('income_transactions', { ...common, is_salary: false, category: t.category, account_id: nul(t.accountId), pay_month: null, expected_date: null, expected_amount: null })
    } else if (t.type === 'expense') {
      add('expenses', { ...common, category: t.category, account_id: t.accountId, wedding_category_id: nul(t.weddingCategoryId), recurring_id: nul(t.recurringId), occurrence: nul(t.occurrence) })
    } else {
      add('savings_records', { ...common, from_account_id: t.accountId, to_account_id: t.toAccountId, recurring_id: nul(t.recurringId), occurrence: nul(t.occurrence) })
    }
  }
  for (const x of d.expectedIncome) add('expected_income', { id: x.id, month: x.month, label: x.label, amount: x.amount, for_wedding: x.forWedding })
  d.checklist.forEach((c, i) => add('wedding_checklist', { id: c.id, title: c.title, deadline: nul(c.deadline), priority: c.priority, status: c.status, notes: c.notes, sort_order: i }))
  for (const c of d.reminders.custom) add('reminders', { id: c.id, title: c.title, reminder_date: c.date, notes: c.notes })
  const keys = new Set([...Object.keys(d.reminders.completed), ...Object.keys(d.reminders.notified)])
  for (const k of keys) add('reminder_states', { reminder_key: k, completed_on: d.reminders.completed[k] ?? null, notified_on: d.reminders.notified[k] ?? null })
  return out
}

const s = (v: unknown) => (typeof v === 'string' ? v : '')
const n = (v: unknown) => (v === null || v === undefined || v === '' ? 0 : Number(v))
const nn = (v: unknown) => (v === null || v === undefined || v === '' ? null : Number(v))
const bySort = (a: Row, b: Row) => n(a.sort_order) - n(b.sort_order)

/** Rebuild planner data from database rows. Returns null for a brand-new account (no profile yet). */
export function fromRows(t: Partial<Record<TableName, Row[]>>): AppData | null {
  const profile = t.profiles?.[0]
  if (!profile) return null
  const d = createDefaultData() as AppData
  const emp = t.employment_details?.[0]
  const res = t.resignation_plans?.[0]
  const sp = (profile.savings_plan ?? {}) as Record<string, unknown>
  const lp = (profile.leave_policy ?? {}) as Record<string, unknown>
  const raw: Record<string, unknown> = {
    version: 2,
    profile: { name: s(profile.full_name), weddingDate: s(profile.wedding_date) },
    finance: { budgetReviewDay: n(profile.budget_review_day) },
    savings: { ...d.savings, ...sp },
    employment: emp
      ? {
          company: s(emp.company),
          designation: s(emp.designation),
          location: s(emp.location),
          joiningDate: s(emp.joining_date),
          probationDays: n(emp.probation_days),
          probationStatus: s(emp.probation_status),
          probationConfirmedOn: s(emp.probation_confirmed_on),
          minTenureMonths: n(emp.min_tenure_months),
          earlyNoticeMonths: n(emp.early_notice_months),
          standardNoticeMonths: n(emp.standard_notice_months),
          noticeCounting: s(emp.notice_counting),
          targetLastDay: s(emp.target_last_day),
          grossMonthly: n(emp.gross_monthly),
          takeHomeMonthly: n(emp.take_home_monthly),
          ctcMonthly: n(emp.ctc_monthly),
          grossCtc: n(emp.gross_ctc),
          salaryDueDay: n(emp.salary_due_day),
          hrContacts: Array.isArray(emp.hr_contacts) ? emp.hr_contacts : [],
          notes: s(emp.notes),
        }
      : d.employment,
    resignation: res
      ? {
          plannedSubmissionDate: s(res.planned_submission_date),
          earlyExitApproval: s(res.early_exit_approval),
          approvalNotes: s(res.approval_notes),
          hrConfirmedLiability: nn(res.hr_confirmed_liability),
          hrConfirmedLiabilityOn: s(res.hr_confirmed_liability_on),
          liabilityNotes: s(res.liability_notes),
        }
      : d.resignation,
    milestones: Object.fromEntries((t.job_milestones ?? []).map((m) => [s(m.milestone_key), { dateOverride: s(m.date_override), done: !!m.done, doneOn: s(m.done_on), notes: s(m.notes) }])),
    leavePolicy: {
      ...d.leavePolicy,
      ...lp,
      entitlements: {
        ...d.leavePolicy.entitlements,
        ...Object.fromEntries(
          (t.leave_entitlements ?? []).map((x) => [
            s(x.leave_type),
            { annualDays: n(x.annual_days), carryover: n(x.carryover), carryoverConfirmed: !!x.carryover_confirmed, usedBeforeTracking: n(x.used_before_tracking) },
          ]),
        ),
      },
      holidays: (t.holidays ?? []).map((h) => ({ id: s(h.id), date: s(h.holiday_date), name: s(h.name) })).sort((a, b) => (a.date < b.date ? -1 : 1)),
    },
    leaves: (t.leave_transactions ?? []).map((l) => ({
      id: s(l.id),
      type: s(l.leave_type),
      status: s(l.status),
      startDate: s(l.start_date),
      endDate: s(l.end_date),
      startHalf: !!l.half_day_start,
      endHalf: !!l.half_day_end,
      days: nn(l.days),
      reason: s(l.reason),
      notes: s(l.notes),
      forWedding: !!l.for_wedding,
    })),
    accounts: [...(t.accounts ?? [])].sort(bySort).map((a) => ({ id: s(a.id), name: s(a.name), purpose: s(a.purpose), openingBalance: n(a.opening_balance) })),
    salaryRecords: (t.income_transactions ?? [])
      .filter((x) => x.is_salary)
      .map((x) => ({
        id: s(x.id),
        payMonth: s(x.pay_month),
        expectedDate: s(x.expected_date),
        expectedAmount: n(x.expected_amount),
        actualDate: s(x.txn_date),
        actualAmount: nn(x.amount),
        accountId: s(x.account_id),
        notes: s(x.notes),
      })),
    transactions: [
      ...(t.income_transactions ?? [])
        .filter((x) => !x.is_salary)
        .map((x) => ({ id: s(x.id), date: s(x.txn_date), type: 'income', amount: n(x.amount), category: s(x.category), description: s(x.description), paymentMethod: s(x.payment_method), accountId: s(x.account_id), toAccountId: '', weddingCategoryId: '', recurringId: '', occurrence: '', notes: s(x.notes) })),
      ...(t.expenses ?? []).map((x) => ({
        id: s(x.id),
        date: s(x.txn_date),
        type: 'expense',
        amount: n(x.amount),
        category: s(x.category),
        description: s(x.description),
        paymentMethod: s(x.payment_method),
        accountId: s(x.account_id),
        toAccountId: '',
        weddingCategoryId: s(x.wedding_category_id),
        recurringId: s(x.recurring_id),
        occurrence: s(x.occurrence),
        notes: s(x.notes),
      })),
      ...(t.savings_records ?? []).map((x) => ({
        id: s(x.id),
        date: s(x.txn_date),
        type: 'transfer',
        amount: n(x.amount),
        category: '',
        description: s(x.description),
        paymentMethod: s(x.payment_method),
        accountId: s(x.from_account_id),
        toAccountId: s(x.to_account_id),
        weddingCategoryId: '',
        recurringId: s(x.recurring_id),
        occurrence: s(x.occurrence),
        notes: s(x.notes),
      })),
    ],
    recurring: (t.recurring_transactions ?? []).map((x) => ({
      id: s(x.id),
      description: s(x.description),
      type: s(x.txn_type),
      category: s(x.category),
      amount: n(x.amount),
      accountId: s(x.account_id),
      toAccountId: s(x.to_account_id),
      paymentMethod: s(x.payment_method),
      dayOfMonth: n(x.day_of_month),
      startMonth: s(x.start_month),
      endMonth: s(x.end_month),
      active: x.active !== false,
    })),
    expectedIncome: (t.expected_income ?? []).map((x) => ({ id: s(x.id), month: s(x.month), label: s(x.label), amount: n(x.amount), forWedding: n(x.for_wedding) })),
    wedding: {
      personalTotal: n(profile.wedding_personal_target),
      overallSharedBudget: n(profile.wedding_shared_budget),
      categories: [...(t.wedding_budget_categories ?? [])].sort(bySort).map((c) => ({ id: s(c.id), name: s(c.name), planned: n(c.planned), dueDate: s(c.due_date), notes: s(c.notes), receipts: s(c.receipts) })),
    },
    checklist: [...(t.wedding_checklist ?? [])].sort(bySort).map((c) => ({ id: s(c.id), title: s(c.title), deadline: s(c.deadline), priority: s(c.priority), status: s(c.status), notes: s(c.notes) })),
    reminders: {
      browserNotifications: !!profile.notifications_enabled,
      custom: (t.reminders ?? []).map((r) => ({ id: s(r.id), title: s(r.title), date: s(r.reminder_date), notes: s(r.notes) })),
      completed: Object.fromEntries((t.reminder_states ?? []).filter((r) => r.completed_on).map((r) => [s(r.reminder_key), s(r.completed_on)])),
      notified: Object.fromEntries((t.reminder_states ?? []).filter((r) => r.notified_on).map((r) => [s(r.reminder_key), s(r.notified_on)])),
    },
  }
  return normalizeData(raw)
}

export interface Diff {
  upserts: Map<TableName, Row[]>
  deletes: Map<TableName, string[]>
  count: number
}

/** Rows to write and delete to go from `prev` to `next`. */
export function diffRows(prev: RowRef[], next: RowRef[]): Diff {
  const key = (r: RowRef) => `${r.table}\u0000${r.pk}`
  const before = new Map(prev.map((r) => [key(r), JSON.stringify(r.row)]))
  const after = new Set(next.map(key))
  const upserts = new Map<TableName, Row[]>()
  const deletes = new Map<TableName, string[]>()
  let count = 0
  for (const r of next) {
    if (before.get(key(r)) === JSON.stringify(r.row)) continue
    upserts.set(r.table, [...(upserts.get(r.table) ?? []), r.row])
    count++
  }
  for (const r of prev) {
    if (after.has(key(r))) continue
    deletes.set(r.table, [...(deletes.get(r.table) ?? []), r.pk])
    count++
  }
  return { upserts, deletes, count }
}

/** Group a flat list of rows by table (used for round-trip tests and first upload). */
export function groupRows(rows: RowRef[]): Partial<Record<TableName, Row[]>> {
  const out: Partial<Record<TableName, Row[]>> = {}
  for (const r of rows) (out[r.table] ??= []).push(r.row)
  return out
}
