import type { AppData, ISODate } from '../types'
import { addDays, addMonthKey, dayInMonth, fmtDate, isValidISO, monthKey, monthRange, todayISO } from '../dates'
import type { JobCalc } from './job'
import { requestDeadline } from './leave'
import { calcWedding } from './finance'
import { money } from '../format'

export type ReminderCategory = 'Job' | 'Leave' | 'Money' | 'Wedding' | 'Savings' | 'Checklist' | 'Custom'

export interface Reminder {
  key: string
  title: string
  date: ISODate
  category: ReminderCategory
  detail: string
  route: string
  completed: boolean
  custom?: boolean
  checklistId?: string
}

export function buildReminders(data: AppData, job: JobCalc, today = todayISO()): Reminder[] {
  const out: Omit<Reminder, 'completed'>[] = []
  const add = (r: Omit<Reminder, 'completed'>) => {
    if (isValidISO(r.date)) out.push(r)
  }
  const wedding = data.profile.weddingDate
  const cur = monthKey(today)

  // Job
  add({ key: `job:training:${job.trainingEnd}`, title: 'Training completion', date: job.trainingEnd, category: 'Job', detail: 'Expected end of training. Mark training as completed in Job Tracker.', route: '/job' })
  add({ key: `job:probation:${job.probationEnd}`, title: 'Probation confirmation due', date: job.probationEnd, category: 'Job', detail: 'Expected end of probation. Confirm your status with HR.', route: '/job' })
  if (job.probationEnd) {
    add({ key: `job:hrconfirm:${job.probationEnd}`, title: 'Ask HR for confirmation letter', date: addDays(job.probationEnd, 3), category: 'Job', detail: 'Get written confirmation of probation and your notice period.', route: '/job' })
  }
  const review = isValidISO(data.job.contractReviewDate) ? data.job.contractReviewDate : job.probationEnd ? addDays(job.probationEnd, -14) : ''
  add({ key: `job:contract:${review}`, title: 'Contract review', date: review, category: 'Job', detail: 'Check notice period, leave encashment, bonds and final settlement terms.', route: '/job' })
  if (job.resignationDate) {
    add({ key: `job:prepare:${job.resignationDate}`, title: 'Prepare resignation letter', date: addDays(job.resignationDate, -30), category: 'Job', detail: 'Draft your letter and plan the conversation with your manager.', route: '/job' })
    add({ key: `job:resign:${job.resignationDate}`, title: job.resignationIsPlanned ? 'Submit resignation (planned date)' : 'Resignation deadline', date: job.resignationDate, category: 'Job', detail: `Submit by this date to finish your notice period by ${fmtDate(job.lastWorkingDay)}.`, route: '/job' })
  }
  add({ key: `job:lastday:${job.lastWorkingDay}`, title: 'Last working day', date: job.lastWorkingDay, category: 'Job', detail: 'Collect relieving letter, experience letter and final settlement details.', route: '/job' })

  // Leave
  for (const l of data.leaves) {
    if (!['Planned', 'Pending', 'Approved'].includes(l.status) || l.endDate < addDays(today, -1)) continue
    add({ key: `leave:start:${l.id}:${l.startDate}`, title: `${l.type} leave starts (${l.status.toLowerCase()})`, date: l.startDate, category: 'Leave', detail: l.notes || `Until ${fmtDate(l.endDate)}`, route: '/leave' })
    if (l.status === 'Planned') {
      add({ key: `leave:request:${l.id}:${l.startDate}`, title: 'Submit leave request', date: requestDeadline(l, data.leavePolicy), category: 'Leave', detail: `For leave starting ${fmtDate(l.startDate)}. Your policy needs ${data.leavePolicy.requestNoticeDays} days' notice.`, route: '/leave' })
    }
  }

  // Monthly: salary, budget review, savings contribution
  const lastSalaryMonth = job.lastWorkingDay ? monthKey(job.lastWorkingDay) : addMonthKey(cur, 11)
  if (data.job.salaryMonthly > 0) {
    for (const m of monthRange(cur, lastSalaryMonth < addMonthKey(cur, 11) ? lastSalaryMonth : addMonthKey(cur, 11))) {
      add({ key: `money:salary:${m}`, title: 'Salary payment expected', date: dayInMonth(m, data.finance.salaryPayDay), category: 'Money', detail: `Expected ${money(data.job.salaryMonthly)}. Record it in Money Tracker when received.`, route: '/money' })
    }
  }
  const lastMonth = monthKey(wedding)
  for (const m of monthRange(cur, lastMonth)) {
    add({ key: `money:review:${m}`, title: 'Monthly budget review', date: dayInMonth(m, data.finance.budgetReviewDay), category: 'Money', detail: 'Check spending against your plan and update wedding savings.', route: '/money' })
  }
  const endSave = addMonthKey(lastMonth, -1)
  for (const m of monthRange(cur, endSave)) {
    add({ key: `savings:contribution:${m}`, title: 'Move money to wedding savings', date: dayInMonth(m, data.savings.contributionDay), category: 'Savings', detail: data.savings.monthlyAmount > 0 ? `Planned: ${money(data.savings.monthlyAmount)}` : 'Set a monthly amount in Savings Planner.', route: '/savings' })
  }

  // Wedding vendor payments
  for (const c of calcWedding(data, today).categories) {
    if (c.dueDate && c.remaining > 0) {
      add({ key: `wedding:pay:${c.id}:${c.dueDate}`, title: `Payment due: ${c.name}`, date: c.dueDate, category: 'Wedding', detail: `${money(c.remaining)} remaining`, route: '/wedding' })
    }
  }
  add({ key: `wedding:day:${wedding}`, title: 'Wedding day', date: wedding, category: 'Wedding', detail: 'The big day.', route: '/checklist' })

  // Checklist
  for (const t of data.checklist) {
    if (t.deadline) {
      add({ key: `check:${t.id}`, title: t.title, date: t.deadline, category: 'Checklist', detail: `${t.priority} priority`, route: '/checklist', checklistId: t.id })
    }
  }

  // Custom
  for (const c of data.reminders.custom) {
    add({ key: `custom:${c.id}`, title: c.title, date: c.date, category: 'Custom', detail: c.notes, route: '', custom: true })
  }

  const done = data.reminders.completed
  return out
    .map((r) => {
      const task = r.checklistId ? data.checklist.find((t) => t.id === r.checklistId) : undefined
      return { ...r, completed: task ? task.status === 'Done' : !!done[r.key] }
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.title.localeCompare(b.title)))
}

// ---------- Calendar file (.ics) ----------

function icsEscape(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

export function toICS(reminders: Reminder[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//My Life Planner 2027//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
  for (const r of reminders) {
    const d = r.date.replace(/-/g, '')
    const next = addDays(r.date, 1).replace(/-/g, '')
    lines.push(
      'BEGIN:VEVENT',
      `UID:${r.key.replace(/[^A-Za-z0-9:-]/g, '')}@my-life-planner-2027`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${d}`,
      `DTEND;VALUE=DATE:${next}`,
      `SUMMARY:${icsEscape(r.title)}`,
      `DESCRIPTION:${icsEscape(r.detail || '')}`,
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${icsEscape(r.title)}`,
      'TRIGGER:PT9H',
      'END:VALARM',
      'END:VEVENT',
    )
  }
  lines.push('END:VCALENDAR')
  return lines.join('\r\n')
}
