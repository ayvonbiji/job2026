import type { AppData, ChecklistTask, WeddingCategory } from './types'
import { monthKey, todayISO } from './dates'

export const WEDDING_DATE = '2027-08-23'

const weddingCategoryNames = [
  'Wedding clothes and suits',
  'Wedding rings and jewellery',
  'Church and marriage-related expenses',
  'Reception contribution',
  'Photography and videography',
  'Travel and accommodation',
  'Gifts',
  'Wedding invitations',
  'Personal grooming',
  'Family contribution',
  'Emergency fund (wedding contingency)',
  'Other expenses',
]

function weddingCategories(): WeddingCategory[] {
  return weddingCategoryNames.map((name, i) => ({
    id: `wc-${i + 1}`,
    name,
    planned: 0,
    dueDate: '',
    notes: '',
    receipts: '',
  }))
}

function checklist(): ChecklistTask[] {
  const t = (id: string, title: string, deadline: string, priority: ChecklistTask['priority']): ChecklistTask => ({
    id,
    title,
    deadline,
    priority,
    status: 'Not started',
    notes: '',
  })
  return [
    t('ck-1', 'Confirm wedding budget', '2026-11-30', 'High'),
    t('ck-2', 'Book wedding vendors', '2027-02-28', 'High'),
    t('ck-3', 'Confirm church and reception arrangements', '2027-03-31', 'High'),
    t('ck-4', 'Prepare invitations', '2027-06-15', 'Medium'),
    t('ck-5', 'Purchase wedding clothes', '2027-06-30', 'Medium'),
    t('ck-6', 'Arrange travel', '2027-07-15', 'Medium'),
    t('ck-7', 'Review job exit plan', '2027-04-15', 'High'),
    t('ck-8', 'Arrange required employment documents (relieving letter, experience letter, payslips)', '2027-07-31', 'High'),
    t('ck-9', 'Complete final salary and expense checks', '2027-08-10', 'Medium'),
  ]
}

export function createDefaultData(): AppData {
  return {
    version: 1,
    profile: { name: '', weddingDate: WEDDING_DATE },
    job: {
      company: '',
      title: '',
      joiningDate: '',
      trainingStart: '',
      trainingMonths: 3,
      trainingStatus: 'Not started',
      trainingCompletedOn: '',
      probationStartMode: 'joining',
      probationStart: '',
      probationMonths: 3,
      probationStatus: 'Not started',
      probationConfirmedOn: '',
      contractReviewDate: '',
      noticeMonths: 3,
      noticeDuringProbationDays: 0,
      noticeCounting: 'dayBefore',
      targetLastDay: '2027-07-31',
      plannedResignationDate: '',
      salaryMonthly: 0,
      hrContacts: [],
      notes: '',
    },
    leavePolicy: {
      leaveYearStartMonth: 1,
      annualEntitlement: 0,
      carryover: 0,
      carryoverConfirmedByHr: false,
      usedBeforeTracking: 0,
      sickEntitlement: 0,
      weekendDays: [0, 6],
      holidays: [
        { id: 'h-1', date: '2026-12-25', name: 'Christmas' },
        { id: 'h-2', date: '2027-01-26', name: 'Republic Day' },
        { id: 'h-3', date: '2027-08-15', name: 'Independence Day' },
      ],
      requestNoticeDays: 14,
      exitLeavePolicy: 'Not confirmed',
      nextYearEntitlementBeforeExit: 0,
      nextYearCarryover: 0,
      nextYearCarryoverConfirmed: false,
      hrPolicyNotes: '',
    },
    leaves: [],
    accounts: [
      { id: 'acc-main', name: 'Salary account', purpose: 'general', openingBalance: 0 },
      { id: 'acc-wedding', name: 'Wedding savings', purpose: 'wedding', openingBalance: 0 },
      { id: 'acc-emergency', name: 'Emergency fund', purpose: 'emergency', openingBalance: 0 },
    ],
    transactions: [],
    expectedIncome: [],
    finance: { salaryPayDay: 1, budgetReviewDay: 28 },
    wedding: { personalTotal: 0, overallSharedBudget: 0, categories: weddingCategories() },
    savings: {
      planStartMonth: monthKey(todayISO()),
      monthlyAmount: 0,
      contributionDay: 5,
      regularMonthlyExpenses: 0,
      minimumEmergencyReserve: 0,
    },
    checklist: checklist(),
    reminders: { completed: {}, notified: {}, browserNotifications: false, custom: [] },
  }
}
