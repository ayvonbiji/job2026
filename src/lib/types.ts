// All dates are stored as ISO calendar strings: "YYYY-MM-DD".
// Months are stored as "YYYY-MM".

export type ISODate = string
export type MonthKey = string

export interface Profile {
  name: string
  weddingDate: ISODate
}

export type MilestoneStatus = 'Not started' | 'In progress' | 'Completed' | 'Extended'
export type ProbationStatus = 'Not started' | 'In progress' | 'Confirmed' | 'Extended' | 'Not confirmed'
export type NoticeCounting = 'dayBefore' | 'sameDate'
export type ProbationStartMode = 'joining' | 'afterTraining' | 'custom'

export interface HrContact {
  id: string
  name: string
  role: string
  email: string
  phone: string
}

export interface Job {
  company: string
  title: string
  joiningDate: ISODate
  trainingStart: ISODate // blank = same as joining date
  trainingMonths: number
  trainingStatus: MilestoneStatus
  trainingCompletedOn: ISODate
  probationStartMode: ProbationStartMode
  probationStart: ISODate // used when mode = custom
  probationMonths: number
  probationStatus: ProbationStatus
  probationConfirmedOn: ISODate
  contractReviewDate: ISODate
  noticeMonths: number
  noticeDuringProbationDays: number // 0 = not set
  noticeCounting: NoticeCounting
  targetLastDay: ISODate
  plannedResignationDate: ISODate // blank = use the latest safe date
  salaryMonthly: number
  hrContacts: HrContact[]
  notes: string
}

export type LeaveType = 'Annual' | 'Sick' | 'Unpaid' | 'Other'
export type LeaveStatus = 'Planned' | 'Pending' | 'Approved' | 'Taken' | 'Rejected' | 'Cancelled'

export interface LeaveEntry {
  id: string
  type: LeaveType
  status: LeaveStatus
  startDate: ISODate
  endDate: ISODate
  startHalf: boolean // first day is a half day
  endHalf: boolean // last day is a half day (ignored for single-day leave)
  forWedding: boolean
  notes: string
}

export interface Holiday {
  id: string
  date: ISODate
  name: string
}

export type ExitLeavePolicy = 'Not confirmed' | 'Paid out' | 'Lost' | 'Can be used during notice' | 'Other'

export interface LeavePolicy {
  leaveYearStartMonth: number // 1-12
  annualEntitlement: number
  carryover: number
  carryoverConfirmedByHr: boolean
  usedBeforeTracking: number // annual leave used this leave year before you started using this app
  sickEntitlement: number
  weekendDays: number[] // 0=Sun ... 6=Sat
  holidays: Holiday[]
  requestNoticeDays: number // how many days before leave a request must be submitted
  exitLeavePolicy: ExitLeavePolicy
  nextYearEntitlementBeforeExit: number // HR-confirmed leave for next leave year up to last working day
  nextYearCarryover: number
  nextYearCarryoverConfirmed: boolean
  hrPolicyNotes: string
}

export type AccountPurpose = 'general' | 'wedding' | 'emergency'

export interface Account {
  id: string
  name: string
  purpose: AccountPurpose
  openingBalance: number
}

export type TxType = 'income' | 'expense' | 'transfer'

export const INCOME_CATEGORIES = ['Salary', 'Other income'] as const
export const EXPENSE_CATEGORIES = [
  'Food and groceries',
  'Transport',
  'Rent and bills',
  'Mobile recharge',
  'Family expenses',
  'Personal spending',
  'Wedding expenses',
  'Other expenses',
] as const

export interface Transaction {
  id: string
  date: ISODate
  type: TxType
  amount: number
  category: string // income or expense category; '' for transfers
  accountId: string // from-account for expense/transfer, to-account for income
  toAccountId: string // transfers only
  weddingCategoryId: string // expense only; links the payment to the wedding budget
  notes: string
}

export interface ExpectedIncome {
  id: string
  month: MonthKey
  label: string
  amount: number
  forWedding: number // portion planned to go to the wedding
}

export interface FinanceSettings {
  salaryPayDay: number // 1-31
  budgetReviewDay: number
}

export interface WeddingCategory {
  id: string
  name: string
  planned: number
  dueDate: ISODate
  notes: string
  receipts: string // receipt numbers / links
}

export interface WeddingBudget {
  personalTotal: number // the budget I am personally responsible for
  overallSharedBudget: number // information only
  categories: WeddingCategory[]
}

export interface SavingsPlan {
  planStartMonth: MonthKey
  monthlyAmount: number // what I plan to put aside each month
  contributionDay: number
  regularMonthlyExpenses: number
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
  completed: Record<string, string> // reminder key -> date marked complete
  notified: Record<string, string> // reminder key -> date notified
  browserNotifications: boolean
  custom: CustomReminder[]
}

export interface AppData {
  version: 1
  profile: Profile
  job: Job
  leavePolicy: LeavePolicy
  leaves: LeaveEntry[]
  accounts: Account[]
  transactions: Transaction[]
  expectedIncome: ExpectedIncome[]
  finance: FinanceSettings
  wedding: WeddingBudget
  savings: SavingsPlan
  checklist: ChecklistTask[]
  reminders: ReminderState
}
