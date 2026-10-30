// All dates are ISO calendar strings "YYYY-MM-DD" ('' = not set). Months are "YYYY-MM".

export type ISODate = string
export type MonthKey = string

export interface Profile {
  name: string
  weddingDate: ISODate
}

// ---------- Employment ----------

export type ProbationStatus = 'Not started' | 'In progress' | 'Confirmed' | 'Extended' | 'Not confirmed'
/** calendar: notice runs from the day after you submit (30 Apr → 31 Jul). inclusive: the submission day counts (1 May → 31 Jul). */
export type NoticeCounting = 'calendar' | 'inclusive'

export interface HrContact {
  id: string
  name: string
  role: string
  email: string
  phone: string
}

export interface Employment {
  company: string
  designation: string
  location: string
  joiningDate: ISODate
  probationDays: number
  probationStatus: ProbationStatus
  probationConfirmedOn: ISODate
  minTenureMonths: number // minimum employment commitment
  earlyNoticeMonths: number // Clause 10.2.1 — resignation before minimum tenure
  standardNoticeMonths: number // Clause 10.3 — resignation after minimum tenure
  noticeCounting: NoticeCounting
  targetLastDay: ISODate
  grossMonthly: number
  takeHomeMonthly: number
  ctcMonthly: number
  grossCtc: number
  salaryDueDay: number // salary paid on or before this day of each month
  hrContacts: HrContact[]
  notes: string
}

export type ApprovalStatus = 'Not requested' | 'Requested' | 'Approved' | 'Rejected'

export interface ResignationPlan {
  plannedSubmissionDate: ISODate // '' = use the calculated deadline
  earlyExitApproval: ApprovalStatus
  approvalNotes: string
  hrConfirmedLiability: number | null // only an amount HR has confirmed in writing
  hrConfirmedLiabilityOn: ISODate
  liabilityNotes: string
}

export const MILESTONE_KEYS = [
  'joining',
  'day30',
  'day60',
  'probation',
  'hrConfirmation',
  'resignationPlanning',
  'resignationSubmission',
  'noticeStart',
  'handover',
  'lastDay',
  'fullAndFinal',
  'relievingLetter',
  'experienceCertificate',
  'oneYear',
] as const
export type MilestoneKey = (typeof MILESTONE_KEYS)[number]

export interface MilestoneState {
  dateOverride: ISODate
  done: boolean
  doneOn: ISODate
  notes: string
}

// ---------- Leave ----------

export type LeaveType = 'CL' | 'SL' | 'LOA' | 'Comp'
export const LEAVE_TYPES: LeaveType[] = ['CL', 'SL', 'LOA', 'Comp']
export const LEAVE_LABEL: Record<LeaveType, string> = {
  CL: 'Casual Leave (CL)',
  SL: 'Sick Leave (SL)',
  LOA: 'Leave of Absence (unpaid)',
  Comp: 'Compensatory Leave',
}
export type LeaveStatus = 'Planned' | 'Pending' | 'Approved' | 'Taken' | 'Rejected' | 'Cancelled'

export interface LeaveEntry {
  id: string
  type: LeaveType
  status: LeaveStatus
  startDate: ISODate
  endDate: ISODate
  startHalf: boolean
  endHalf: boolean
  days: number | null // manual override; null = calculated from the counting rule
  reason: string
  notes: string
  forWedding: boolean
}

export type BalancedLeave = 'CL' | 'SL' | 'Comp'
export interface LeaveEntitlement {
  annualDays: number // for Comp: days earned so far
  carryover: number
  carryoverConfirmed: boolean
  usedBeforeTracking: number
}

export interface Holiday {
  id: string
  date: ISODate
  name: string
}

export type DayCountRule = 'calendar' | 'working'
export type AccrualRule = 'Not confirmed' | 'Full at start of leave year' | 'Monthly'
export type YesNoUnknown = 'Not confirmed' | 'Allowed' | 'Not allowed'
export type ExitLeavePolicy = 'Not confirmed' | 'Paid out' | 'Lost' | 'Can be used during notice' | 'Other'

export interface LeavePolicy {
  entitlements: Record<BalancedLeave, LeaveEntitlement>
  leaveYearStartMonth: number
  dayCountRule: DayCountRule
  weekendDays: number[]
  holidays: Holiday[]
  accrual: AccrualRule
  carryForward: YesNoUnknown
  encashment: YesNoUnknown
  exitLeavePolicy: ExitLeavePolicy
  requestNoticeDays: number // 0 = not set by HR
  nextYearCLBeforeExit: number // HR-confirmed CL available in the next leave year before your last day
  hrPolicyNotes: string
}

// ---------- Money ----------

export type AccountPurpose = 'general' | 'wedding' | 'emergency'
export interface Account {
  id: string
  name: string
  purpose: AccountPurpose
  openingBalance: number
}

export type TxType = 'income' | 'expense' | 'transfer'
export const INCOME_CATEGORIES = ['Other income', 'Bonus', 'Gift received', 'Refund'] as const
export const EXPENSE_CATEGORIES = [
  'Accommodation / Rent',
  'Food',
  'Transportation',
  'Mobile recharge',
  'Personal expenses',
  'Family expenses',
  'Shopping',
  'Travel',
  'Wedding expenses',
  'Other expenses',
] as const
export const PAYMENT_METHODS = ['UPI', 'Cash', 'Debit card', 'Credit card', 'Bank transfer', 'Other'] as const

/** A transfer between my own accounts is shown as "Savings" and never counted as income or expense. */
export interface Transaction {
  id: string
  date: ISODate
  type: TxType
  amount: number
  category: string
  description: string
  paymentMethod: string
  accountId: string
  toAccountId: string
  weddingCategoryId: string
  recurringId: string
  occurrence: MonthKey // which month of a recurring item this records
  notes: string
}

/** A salary payment, keyed by the month it is paid in. */
export interface SalaryRecord {
  id: string
  payMonth: MonthKey
  expectedDate: ISODate
  expectedAmount: number
  actualDate: ISODate
  actualAmount: number | null
  accountId: string
  notes: string
}

export interface RecurringItem {
  id: string
  description: string
  type: 'expense' | 'transfer'
  category: string
  amount: number
  accountId: string
  toAccountId: string
  paymentMethod: string
  dayOfMonth: number
  startMonth: MonthKey
  endMonth: MonthKey // '' = no end
  active: boolean
}

export interface ExpectedIncome {
  id: string
  month: MonthKey
  label: string
  amount: number
  forWedding: number
}

export interface FinanceSettings {
  budgetReviewDay: number
}

// ---------- Wedding ----------

export interface WeddingCategory {
  id: string
  name: string
  planned: number
  dueDate: ISODate
  notes: string
  receipts: string
}

export interface WeddingBudget {
  personalTotal: number
  overallSharedBudget: number
  categories: WeddingCategory[]
}

export interface SavingsPlan {
  planStartMonth: MonthKey
  monthlyAmount: number
  contributionDay: number
  regularMonthlyExpenses: number
  otherCommitments: number
  minimumEmergencyReserve: number
}

export type Priority = 'High' | 'Medium' | 'Low'
export type TaskStatus = 'Not started' | 'In progress' | 'Done'
export interface ChecklistTask {
  id: string
  title: string
  deadline: ISODate
  priority: Priority
  status: TaskStatus
  notes: string
}

export interface CustomReminder {
  id: string
  title: string
  date: ISODate
  notes: string
}

export interface ReminderState {
  completed: Record<string, string>
  notified: Record<string, string>
  browserNotifications: boolean
  custom: CustomReminder[]
}

export interface AppData {
  version: 2
  profile: Profile
  employment: Employment
  resignation: ResignationPlan
  milestones: Record<MilestoneKey, MilestoneState>
  leavePolicy: LeavePolicy
  leaves: LeaveEntry[]
  accounts: Account[]
  transactions: Transaction[]
  salaryRecords: SalaryRecord[]
  recurring: RecurringItem[]
  expectedIncome: ExpectedIncome[]
  finance: FinanceSettings
  wedding: WeddingBudget
  savings: SavingsPlan
  checklist: ChecklistTask[]
  reminders: ReminderState
}
