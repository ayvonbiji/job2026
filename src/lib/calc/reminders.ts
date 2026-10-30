import type { AppData, ISODate, MilestoneKey } from '../types'
import { addDays, addMonthKey, dayInMonth, fmtDate, isValidISO, monthKey, monthRange, todayISO } from '../dates'
import type { EmploymentCalc } from './employment'
import { countLeaveDays, leaveDays, requestDeadline } from './leave'
import { calcWedding, recurringOccurrences, salarySchedule, weddingContribution } from './finance'
import { money } from '../format'

export type ReminderCategory = 'Employment' | 'Leave' | 'Money' | 'Wedding' | 'Savings' | 'Checklist' | 'Custom'

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
  milestoneKey?: MilestoneKey
}

const MILESTONE_REMINDERS: Partial<Record<MilestoneKey, string>> = {
  day30: 'Check in on your first 30 days',
  day60: 'Check in on your first 60 days',
  probation: 'Probation completion (estimate)',
  hrConfirmation: 'Ask HR for probation confirmation in writing',
  resignationPlanning: 'Start resignation planning — talk to HR about early termination',
  resignationSubmission: 'Resignation submission / notice period deadline',
  handover: 'Start handover',
  lastDay: 'Final working day',
  fullAndFinal: 'Full and final settlement',
  relievingLetter: 'Collect relieving letter',
  experienceCertificate: 'Collect experience / conduct certificate',
  oneYear: 'One-year employment anniversary',
}

export function buildReminders(data: AppData, emp: EmploymentCalc, today = todayISO()): Reminder[] {
  const out: Omit<Reminder, 'completed'>[] = []
  const add = (r: Omit<Reminder, 'completed'>) => isValidISO(r.date) && out.push(r)
  const wedding = data.profile.weddingDate
  const cur = monthKey(today)

  for (const m of emp.milestones) {
    const title = MILESTONE_REMINDERS[m.key]
    if (!title) continue
    if (m.key === 'oneYear' && m.date > wedding) continue
    add({ key: `ms:${m.key}`, title, date: m.date, category: 'Employment', detail: m.hint, route: m.key.startsWith('resign') || ['handover', 'lastDay', 'fullAndFinal', 'relievingLetter', 'experienceCertificate'].includes(m.key) ? '/resignation' : '/probation', milestoneKey: m.key })
  }

  for (const l of data.leaves) {
    if (!['Planned', 'Pending', 'Approved'].includes(l.status) || l.endDate < addDays(today, -1)) continue
    add({ key: `leave:start:${l.id}:${l.startDate}`, title: `${l.type} leave starts (${l.status.toLowerCase()})`, date: l.startDate, category: 'Leave', detail: `${countLeaveDays(l, data.leavePolicy)} day(s)${l.reason ? ` · ${l.reason}` : ''}`, route: '/leave' })
    if (l.status === 'Planned') {
      const rd = requestDeadline(l, data.leavePolicy)
      add({ key: `leave:request:${l.id}:${l.startDate}`, title: 'Request leave', date: rd.date, category: 'Leave', detail: `For leave from ${fmtDate(l.startDate)}. ${rd.fromPolicy ? `HR needs ${data.leavePolicy.requestNoticeDays} days’ notice.` : 'Planning reminder — no HR notice rule recorded.'}`, route: '/leave' })
    }
  }

  const lastDay = data.employment.targetLastDay
  for (const row of salarySchedule(data, lastDay, today)) {
    if (row.payMonth < addMonthKey(cur, -2) || row.payMonth > addMonthKey(cur, 12)) continue
    add({ key: `salary:${row.payMonth}`, title: 'Salary due (on or before)', date: row.expectedDate, category: 'Money', detail: `Expected ${money(row.expectedAmount, true)}. Record it in Money Tracker when received.`, route: '/money' })
  }

  const lastMonth = monthKey(wedding)
  for (const m of monthRange(cur, lastMonth)) {
    add({ key: `money:review:${m}`, title: 'Monthly budget review', date: dayInMonth(m, data.finance.budgetReviewDay), category: 'Money', detail: 'Check spending, record transactions and update savings.', route: '/money' })
  }
  for (const o of recurringOccurrences(data, cur, addMonthKey(cur, 2))) {
    if (o.posted) continue
    add({ key: `rec:${o.item.id}:${o.month}`, title: o.item.description, date: o.date, category: 'Money', detail: `${money(o.item.amount)} · recurring`, route: '/calendar' })
  }

  const weddingDay = Number(wedding.slice(8))
  const endSave = data.savings.contributionDay <= weddingDay ? lastMonth : addMonthKey(lastMonth, -1)
  const weddingAccounts = new Set(data.accounts.filter((a) => a.purpose === 'wedding').map((a) => a.id))
  const coveredByRecurring = (m: string) => data.recurring.some((r) => r.active && r.type === 'transfer' && weddingAccounts.has(r.toAccountId) && r.startMonth <= m && (!r.endMonth || r.endMonth >= m))
  for (const m of monthRange(cur, endSave)) {
    if (coveredByRecurring(m)) continue // the recurring transfer already reminds you
    add({ key: `savings:${m}`, title: 'Move money to wedding savings', date: dayInMonth(m, data.savings.contributionDay), category: 'Savings', detail: data.savings.monthlyAmount > 0 ? `Planned: ${money(data.savings.monthlyAmount)}` : 'Set a monthly amount in Savings Planner.', route: '/savings' })
  }

  for (const c of calcWedding(data, today).categories) {
    if (c.dueDate && c.remaining > 0) add({ key: `wedding:pay:${c.id}:${c.dueDate}`, title: `Wedding payment due: ${c.name}`, date: c.dueDate, category: 'Wedding', detail: `${money(c.remaining)} remaining`, route: '/wedding' })
  }
  add({ key: `wedding:day:${wedding}`, title: 'Wedding day', date: wedding, category: 'Wedding', detail: '23 August 2027 — the big day.', route: '/checklist' })

  for (const t of data.checklist) if (t.deadline) add({ key: `check:${t.id}`, title: t.title, date: t.deadline, category: 'Checklist', detail: `${t.priority} priority`, route: '/checklist', checklistId: t.id })
  for (const c of data.reminders.custom) add({ key: `custom:${c.id}`, title: c.title, date: c.date, category: 'Custom', detail: c.notes, route: '', custom: true })

  const salaryReceived = new Set(data.salaryRecords.filter((s) => s.actualAmount !== null && s.actualDate).map((s) => `salary:${s.payMonth}`))
  const done = data.reminders.completed
  return out
    .map((r) => {
      let completed = !!done[r.key]
      if (r.checklistId) completed = data.checklist.find((t) => t.id === r.checklistId)?.status === 'Done'
      else if (r.milestoneKey) completed = emp.milestones.find((m) => m.key === r.milestoneKey)?.done ?? false
      else if (salaryReceived.has(r.key)) completed = true
      else if (r.key.startsWith('savings:') && data.savings.monthlyAmount > 0 && weddingContribution(data, r.key.slice(8), today) >= data.savings.monthlyAmount) completed = true
      return { ...r, completed }
    })
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.title.localeCompare(b.title)))
}

// ---------- Calendar events ----------

export type CalKind = 'salary' | 'salaryPaid' | 'expense' | 'wedding' | 'savings' | 'leave' | 'leavePending' | 'holiday' | 'job' | 'reminder'

export interface CalEvent {
  date: ISODate
  label: string
  kind: CalKind
  half?: boolean
}

export function buildCalendarEvents(data: AppData, reminders: Reminder[], today = todayISO(), opts = { leave: true, reminders: true }): CalEvent[] {
  const ev: CalEvent[] = []
  for (const row of salarySchedule(data, data.employment.targetLastDay, today)) {
    if (row.record?.actualDate && row.record.actualAmount !== null) ev.push({ date: row.record.actualDate, label: `Salary received ${money(row.record.actualAmount)}`, kind: 'salaryPaid' })
    else ev.push({ date: row.expectedDate, label: 'Salary due', kind: 'salary' })
  }
  const from = addMonthKey(monthKey(today), -12)
  const to = monthKey(data.profile.weddingDate)
  for (const o of recurringOccurrences(data, from, to)) {
    ev.push({ date: o.posted?.date ?? o.date, label: `${o.posted ? '✓ ' : ''}${o.item.description}`, kind: o.item.type === 'transfer' ? 'savings' : 'expense' })
  }
  for (const t of data.transactions) {
    if (t.recurringId) continue
    if (t.type === 'expense' && t.weddingCategoryId) ev.push({ date: t.date, label: `Wedding ${money(t.amount)}`, kind: 'wedding' })
    else if (t.type === 'transfer') ev.push({ date: t.date, label: `Savings ${money(t.amount)}`, kind: 'savings' })
    else if (t.type === 'expense' && (t.date > today || t.amount >= 2000)) ev.push({ date: t.date, label: `${t.description || t.category} ${money(t.amount)}`, kind: 'expense' })
  }
  if (opts.leave) {
    for (const l of data.leaves) {
      if (l.status === 'Rejected' || l.status === 'Cancelled') continue
      for (const d of leaveDays(l, data.leavePolicy)) ev.push({ date: d.date, label: `${l.type}${l.forWedding ? ' (wedding)' : ''}`, kind: l.status === 'Pending' || l.status === 'Planned' ? 'leavePending' : 'leave', half: d.amount < 1 })
    }
    for (const h of data.leavePolicy.holidays) ev.push({ date: h.date, label: h.name, kind: 'holiday' })
  }
  if (opts.reminders) {
    for (const r of reminders) {
      if (r.key.startsWith('salary:') || r.key.startsWith('rec:') || r.key.startsWith('leave:start')) continue
      ev.push({ date: r.date, label: r.title, kind: r.category === 'Employment' ? 'job' : r.category === 'Wedding' ? 'wedding' : r.category === 'Savings' ? 'savings' : 'reminder' })
    }
  }
  return ev
}

// ---------- Calendar file (.ics) ----------

function icsEscape(s: string) {
  return s.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;')
}

export function toICS(reminders: Reminder[]): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
  const lines = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//My Life Planner 2027//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH']
  for (const r of reminders) {
    lines.push(
      'BEGIN:VEVENT',
      `UID:${r.key.replace(/[^A-Za-z0-9:-]/g, '')}@my-life-planner-2027`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${r.date.replace(/-/g, '')}`,
      `DTEND;VALUE=DATE:${addDays(r.date, 1).replace(/-/g, '')}`,
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
