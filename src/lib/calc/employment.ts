import type { Employment, Holiday, ISODate, MilestoneKey, MilestoneState, ResignationPlan } from '../types'
import { addDays, addMonths, addMonthsKeepEnd, dayOfWeek, diffDays, fmtDate, isValidISO, todayISO } from '../dates'

export type Level = 'danger' | 'warning' | 'info' | 'ok'
export interface Notice {
  level: Level
  text: string
}

const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

/** Summaries of the clauses in my Employment Agreement (as I recorded them). */
export const CLAUSES = {
  early: [
    { ref: 'Clause 10.2.1', text: 'Leaving before completing the one-year minimum tenure requires three months’ notice.' },
    { ref: 'Clause 10.2.2', text: 'Acceptance of early termination is at the company’s sole discretion.' },
    {
      ref: 'Clause 10.2.3',
      text: 'The company may seek compensation, which may include an amount equivalent to three months’ salary, recruitment and training expenses, training programme expenses, and losses caused to the employer or its clients.',
    },
  ],
  standard: [{ ref: 'Clause 10.3', text: 'After completing the one-year mandatory tenure, two months’ notice applies.' }],
  liabilityItems: [
    'An amount equivalent to three months’ salary',
    'Recruitment and training expenses',
    'Training programme expenses',
    'Losses caused to the employer or its clients',
  ],
}

/** Last working day for a notice period that starts from a submission date. */
export function lastDayFromSubmission(submission: ISODate, months: number, counting: Employment['noticeCounting']): ISODate {
  if (counting === 'inclusive') return addDays(addMonths(submission, months), -1)
  return addMonthsKeepEnd(submission, months)
}

/** Latest date to submit a resignation so the notice period ends on or before `lastDay`. */
export function submissionDeadline(lastDay: ISODate, months: number, counting: Employment['noticeCounting']): ISODate {
  let d = counting === 'inclusive' ? addMonths(addDays(lastDay, 1), -months) : addMonths(lastDay, -months)
  let guard = 0
  while (lastDayFromSubmission(d, months, counting) > lastDay && guard++ < 40) d = addDays(d, -1)
  guard = 0
  while (lastDayFromSubmission(addDays(d, 1), months, counting) <= lastDay && guard++ < 40) d = addDays(d, 1)
  return d
}

export interface ScenarioCalc {
  lastDay: ISODate
  oneYear: ISODate
  beforeMinTenure: boolean
  scenario: 'A' | 'B'
  noticeMonths: number
  clauses: { ref: string; text: string }[]
  approvalRequired: boolean
  deadline: ISODate
  noticeStart: ISODate
  daysToDeadline: number
  daysToLastDay: number
  notices: Notice[]
}

export function oneYearDate(e: Employment): ISODate {
  return isValidISO(e.joiningDate) ? addMonths(e.joiningDate, e.minTenureMonths) : ''
}

export function probationEndDate(e: Employment): ISODate {
  return isValidISO(e.joiningDate) && e.probationDays > 0 ? addDays(e.joiningDate, e.probationDays) : ''
}

/** Resignation calculator for a proposed last working day. */
export function resignationScenario(e: Employment, lastDay: ISODate, weddingDate: ISODate, holidays: Holiday[], weekendDays: number[], today = todayISO()): ScenarioCalc | null {
  if (!isValidISO(lastDay)) return null
  const oneYear = oneYearDate(e)
  const beforeMinTenure = !!oneYear && lastDay < oneYear
  const noticeMonths = beforeMinTenure ? e.earlyNoticeMonths : e.standardNoticeMonths
  const deadline = submissionDeadline(lastDay, noticeMonths, e.noticeCounting)
  const noticeStart = e.noticeCounting === 'inclusive' ? deadline : addDays(deadline, 1)
  const notices: Notice[] = []
  const probationEnd = probationEndDate(e)

  if (isValidISO(e.joiningDate) && lastDay <= e.joiningDate) notices.push({ level: 'danger', text: 'This last working day is before your joining date.' })
  if (lastDay >= weddingDate) notices.push({ level: 'danger', text: `This last working day is on or after your wedding (${fmtDate(weddingDate)}).` })
  if (deadline < today) notices.push({ level: 'danger', text: `The submission deadline for this date (${fmtDate(deadline)}) has already passed. Speak to HR about the notice period.` })
  const dow = dayOfWeek(deadline)
  const hol = holidays.find((h) => h.date === deadline)
  if (weekendDays.includes(dow) || hol) {
    notices.push({ level: 'warning', text: `${fmtDate(deadline)} is a ${hol ? `holiday (${hol.name})` : FULL_DAYS[dow]}. Plan to submit on the previous working day.` })
  }
  if (probationEnd && deadline <= probationEnd && e.probationStatus !== 'Confirmed') {
    notices.push({ level: 'warning', text: `You would resign on or before your probation completion estimate (${fmtDate(probationEnd)}). Check with HR how resignation during probation is handled.` })
  }
  if (!beforeMinTenure && oneYear && deadline < oneYear) {
    notices.push({
      level: 'warning',
      text: `Your last day is after your one-year anniversary (${fmtDate(oneYear)}), but you would submit your resignation before it. Ask HR to confirm whether Clause 10.2 or Clause 10.3 applies.`,
    })
  }

  return {
    lastDay,
    oneYear,
    beforeMinTenure,
    scenario: beforeMinTenure ? 'A' : 'B',
    noticeMonths,
    clauses: beforeMinTenure ? CLAUSES.early : CLAUSES.standard,
    approvalRequired: beforeMinTenure,
    deadline,
    noticeStart,
    daysToDeadline: diffDays(today, deadline),
    daysToLastDay: diffDays(today, lastDay),
    notices,
  }
}

export interface MilestoneInfo {
  key: MilestoneKey
  label: string
  date: ISODate // effective date (override or calculated)
  calculated: ISODate
  hint: string
  done: boolean
  doneOn: ISODate
  notes: string
  overridden: boolean
}

export interface EmploymentCalc {
  oneYear: ISODate
  probationEnd: ISODate
  day30: ISODate
  day60: ISODate
  plan: ScenarioCalc | null // based on the target last working day
  submissionDate: ISODate // planned submission, or the deadline
  submissionIsPlanned: boolean
  plannedLastDay: ISODate // last day that results from the planned submission date
  milestones: MilestoneInfo[]
  daysEmployed: number
  employmentTotalDays: number
  employmentProgress: number
  notices: Notice[]
}

const MILESTONE_LABEL: Record<MilestoneKey, [string, string]> = {
  joining: ['Joining date', 'From your employment details'],
  day30: ['30-day milestone', 'Joining date + 30 days'],
  day60: ['60-day milestone', 'Joining date + 60 days'],
  probation: ['Probation completion (90 days)', 'Joining date + probation days, subject to HR confirmation'],
  hrConfirmation: ['HR probation confirmation', 'Expected around probation completion — enter the actual date'],
  resignationPlanning: ['Resignation planning', '30 days before the submission deadline'],
  resignationSubmission: ['Resignation submission', 'Planned date, or the calculated deadline'],
  noticeStart: ['Notice period starts', 'From the resignation calculator'],
  handover: ['Handover', 'Suggested: 2 weeks before your last day — agree with your manager'],
  lastDay: ['Final working day', 'Your target last working day'],
  fullAndFinal: ['Full and final settlement', 'Enter the date HR gives you'],
  relievingLetter: ['Relieving letter', 'Request on your final working day'],
  experienceCertificate: ['Experience / conduct certificate', 'Request on your final working day'],
  oneYear: ['One-year employment anniversary', 'Joining date + minimum tenure'],
}

export function calcEmployment(
  e: Employment,
  r: ResignationPlan,
  ms: Record<MilestoneKey, MilestoneState>,
  weddingDate: ISODate,
  holidays: Holiday[],
  weekendDays: number[],
  today = todayISO(),
): EmploymentCalc {
  const notices: Notice[] = []
  const joining = isValidISO(e.joiningDate) ? e.joiningDate : ''
  const oneYear = oneYearDate(e)
  const probationEnd = probationEndDate(e)
  const day30 = joining ? addDays(joining, 30) : ''
  const day60 = joining ? addDays(joining, 60) : ''
  const plan = resignationScenario(e, e.targetLastDay, weddingDate, holidays, weekendDays, today)

  const submissionIsPlanned = isValidISO(r.plannedSubmissionDate)
  const submissionDate = submissionIsPlanned ? r.plannedSubmissionDate : plan?.deadline ?? ''
  const plannedLastDay = submissionDate && plan ? lastDayFromSubmission(submissionDate, plan.noticeMonths, e.noticeCounting) : e.targetLastDay
  if (plan) notices.push(...plan.notices)
  if (submissionIsPlanned && plan) {
    if (submissionDate > plan.deadline) {
      notices.push({ level: 'danger', text: `Submitting on ${fmtDate(submissionDate)} gives a last day of ${fmtDate(plannedLastDay)}, after your target of ${fmtDate(plan.lastDay)}. Submit by ${fmtDate(plan.deadline)}.` })
    } else if (submissionDate < plan.deadline) {
      notices.push({ level: 'info', text: `Your planned submission (${fmtDate(submissionDate)}) is earlier than needed; your notice would end on ${fmtDate(plannedLastDay)}.` })
    }
  }
  if (probationEnd && probationEnd < today && e.probationStatus !== 'Confirmed' && e.probationStatus !== 'Extended') {
    notices.push({ level: 'warning', text: `Probation was estimated to complete on ${fmtDate(probationEnd)} but is not marked as confirmed. Ask HR for written confirmation.` })
  }
  if (e.probationStatus === 'Extended') notices.push({ level: 'info', text: 'Probation is marked as extended. Update the probation length so the dates stay correct.' })
  if (!joining) notices.push({ level: 'info', text: 'Add your joining date to calculate your milestones.' })

  const calcDate: Record<MilestoneKey, ISODate> = {
    joining,
    day30,
    day60,
    probation: probationEnd,
    hrConfirmation: isValidISO(e.probationConfirmedOn) ? e.probationConfirmedOn : probationEnd,
    resignationPlanning: plan ? addDays(submissionDate, -30) : '',
    resignationSubmission: submissionDate,
    noticeStart: plan ? (e.noticeCounting === 'inclusive' ? submissionDate : addDays(submissionDate, 1)) : '',
    handover: isValidISO(e.targetLastDay) ? addDays(e.targetLastDay, -14) : '',
    lastDay: isValidISO(e.targetLastDay) ? e.targetLastDay : '',
    fullAndFinal: '',
    relievingLetter: isValidISO(e.targetLastDay) ? e.targetLastDay : '',
    experienceCertificate: isValidISO(e.targetLastDay) ? e.targetLastDay : '',
    oneYear,
  }
  const milestones: MilestoneInfo[] = (Object.keys(MILESTONE_LABEL) as MilestoneKey[]).map((key) => {
    const s = ms[key] ?? { dateOverride: '', done: false, doneOn: '', notes: '' }
    const overridden = isValidISO(s.dateOverride)
    let done = s.done
    if (key === 'hrConfirmation' && e.probationStatus === 'Confirmed') done = true
    if (key === 'joining' && joining && joining <= today) done = true
    return {
      key,
      label: MILESTONE_LABEL[key][0],
      hint: MILESTONE_LABEL[key][1],
      calculated: calcDate[key],
      date: overridden ? s.dateOverride : calcDate[key],
      done,
      doneOn: s.doneOn,
      notes: s.notes,
      overridden,
    }
  })
  milestones.sort((a, b) => (a.date || '9999') < (b.date || '9999') ? -1 : (a.date || '9999') > (b.date || '9999') ? 1 : 0)

  const lastDay = isValidISO(e.targetLastDay) ? e.targetLastDay : ''
  const employmentTotalDays = joining && lastDay ? Math.max(0, diffDays(joining, lastDay)) : 0
  const daysEmployed = joining ? Math.max(0, Math.min(diffDays(joining, today), employmentTotalDays || Infinity)) : 0
  const employmentProgress = employmentTotalDays ? Math.min(100, (daysEmployed / employmentTotalDays) * 100) : 0

  return { oneYear, probationEnd, day30, day60, plan, submissionDate, submissionIsPlanned, plannedLastDay, milestones, daysEmployed, employmentTotalDays, employmentProgress, notices }
}
