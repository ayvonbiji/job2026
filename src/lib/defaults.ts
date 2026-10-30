import type { AppData, ChecklistTask, MilestoneKey, MilestoneState, WeddingCategory } from './types'
import { MILESTONE_KEYS } from './types'
import { monthKey, todayISO } from './dates'

export const WEDDING_DATE = '2027-08-23'

export const WEDDING_CATEGORY_NAMES = [
  'Wedding clothes',
  'Wedding rings and jewellery',
  'Church-related expenses',
  'Reception contribution',
  'Photography and videography',
  'Travel expenses',
  'Accommodation',
  'Wedding gifts',
  'Invitations',
  "Groom's personal expenses",
  'Family contribution',
  'Emergency wedding expenses',
  'Miscellaneous',
]

export function defaultWeddingCategories(): WeddingCategory[] {
  return WEDDING_CATEGORY_NAMES.map((name, i) => ({ id: `wc2-${i + 1}`, name, planned: 0, dueDate: '', notes: '', receipts: '' }))
}

export function defaultChecklist(): ChecklistTask[] {
  const t = (n: number, title: string, deadline: string, priority: ChecklistTask['priority']): ChecklistTask => ({
    id: `ck2-${n}`,
    title,
    deadline,
    priority,
    status: 'Not started',
    notes: '',
  })
  return [
    t(1, 'Confirm my wedding budget and contribution', '2026-11-30', 'High'),
    t(2, 'Church arrangements', '2027-03-31', 'High'),
    t(3, 'Reception arrangements', '2027-03-31', 'High'),
    t(4, 'Photography booking', '2027-03-31', 'Medium'),
    t(5, 'Ring and jewellery', '2027-05-31', 'Medium'),
    t(6, 'Wedding clothes', '2027-06-30', 'Medium'),
    t(7, 'Invitations', '2027-06-15', 'Medium'),
    t(8, 'Travel arrangements', '2027-07-15', 'Medium'),
    t(9, 'Accommodation', '2027-07-15', 'Medium'),
    t(10, "Groom's preparations", '2027-08-10', 'Low'),
    t(11, 'Employment resignation planning (speak to HR about early termination)', '2027-03-31', 'High'),
    t(12, 'Leave planning before the wedding', '2027-02-28', 'Medium'),
    t(13, 'Final salary and full & final settlement', '2027-08-31', 'High'),
    t(14, 'Collect relieving letter and experience certificate', '2027-07-31', 'High'),
  ]
}

function milestones(): Record<MilestoneKey, MilestoneState> {
  return Object.fromEntries(MILESTONE_KEYS.map((k) => [k, { dateOverride: '', done: false, doneOn: '', notes: '' }])) as Record<MilestoneKey, MilestoneState>
}

export function createDefaultData(): AppData {
  return {
    version: 2,
    profile: { name: '', weddingDate: WEDDING_DATE },
    employment: {
      company: 'Soffit Infrastructure Services Pvt. Ltd.',
      designation: 'ServiceDesk Coordinator',
      location: 'Kochi, Kerala',
      joiningDate: '2026-11-02',
      probationDays: 90,
      probationStatus: 'Not started',
      probationConfirmedOn: '',
      minTenureMonths: 12,
      earlyNoticeMonths: 3,
      standardNoticeMonths: 2,
      noticeCounting: 'calendar',
      targetLastDay: '2027-07-31',
      grossMonthly: 15176.76,
      takeHomeMonthly: 13137.93,
      ctcMonthly: 17620,
      grossCtc: 18028.8,
      salaryDueDay: 5,
      hrContacts: [],
      notes: '',
    },
    resignation: {
      plannedSubmissionDate: '',
      earlyExitApproval: 'Not requested',
      approvalNotes: '',
      hrConfirmedLiability: null,
      hrConfirmedLiabilityOn: '',
      liabilityNotes: '',
    },
    milestones: milestones(),
    leavePolicy: {
      entitlements: {
        CL: { annualDays: 12, carryover: 0, carryoverConfirmed: false, usedBeforeTracking: 0 },
        SL: { annualDays: 12, carryover: 0, carryoverConfirmed: false, usedBeforeTracking: 0 },
        Comp: { annualDays: 0, carryover: 0, carryoverConfirmed: false, usedBeforeTracking: 0 },
      },
      leaveYearStartMonth: 1,
      dayCountRule: 'calendar',
      weekendDays: [0],
      holidays: [],
      accrual: 'Not confirmed',
      carryForward: 'Not confirmed',
      encashment: 'Not confirmed',
      exitLeavePolicy: 'Not confirmed',
      requestNoticeDays: 0,
      nextYearCLBeforeExit: 0,
      hrPolicyNotes: '',
    },
    leaves: [],
    accounts: [
      { id: 'acc-main', name: 'Salary account', purpose: 'general', openingBalance: 0 },
      { id: 'acc-wedding', name: 'Wedding savings', purpose: 'wedding', openingBalance: 0 },
      { id: 'acc-emergency', name: 'Emergency fund', purpose: 'emergency', openingBalance: 0 },
    ],
    transactions: [],
    salaryRecords: [],
    recurring: [],
    expectedIncome: [],
    finance: { budgetReviewDay: 28 },
    wedding: { personalTotal: 0, overallSharedBudget: 0, categories: defaultWeddingCategories() },
    savings: {
      planStartMonth: monthKey(todayISO()),
      monthlyAmount: 0,
      contributionDay: 6,
      regularMonthlyExpenses: 0,
      otherCommitments: 0,
      minimumEmergencyReserve: 0,
    },
    checklist: defaultChecklist(),
    reminders: { completed: {}, notified: {}, browserNotifications: false, custom: [] },
  }
}
