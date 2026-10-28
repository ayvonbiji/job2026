import type { Job, NoticeCounting, Holiday, ISODate } from '../types'
import { addDays, addMonths, dayOfWeek, fmtDate, isValidISO, todayISO } from '../dates'

const FULL_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

export type Level = 'danger' | 'warning' | 'info' | 'ok'
export interface Notice {
  level: Level
  text: string
}

/** End of a period of `months` calendar months starting on `start`. */
export function periodEnd(start: ISODate, months: number, counting: NoticeCounting = 'dayBefore'): ISODate {
  const plain = addMonths(start, months)
  return counting === 'dayBefore' ? addDays(plain, -1) : plain
}

/** Latest resignation date whose notice period ends on or before `lastDay`. */
export function latestResignationDate(lastDay: ISODate, months: number, counting: NoticeCounting): ISODate {
  let d = counting === 'dayBefore' ? addMonths(addDays(lastDay, 1), -months) : addMonths(lastDay, -months)
  // Adjust for month-end clamping so the answer is exact.
  let guard = 0
  while (periodEnd(d, months, counting) > lastDay && guard++ < 40) d = addDays(d, -1)
  guard = 0
  while (periodEnd(addDays(d, 1), months, counting) <= lastDay && guard++ < 40) d = addDays(d, 1)
  return d
}

export interface JobCalc {
  trainingStart: ISODate
  trainingEnd: ISODate
  probationStart: ISODate
  probationEnd: ISODate
  latestResignation: ISODate
  resignationDate: ISODate // planned, or the latest safe date if none planned
  resignationIsPlanned: boolean
  lastWorkingDay: ISODate // from the resignation date + notice
  notices: Notice[]
}

export function calcJob(job: Job, weddingDate: ISODate, holidays: Holiday[] = [], weekendDays: number[] = [0, 6], today = todayISO()): JobCalc {
  const notices: Notice[] = []
  const trainingStart = isValidISO(job.trainingStart) ? job.trainingStart : job.joiningDate
  const trainingEnd = isValidISO(trainingStart) && job.trainingMonths > 0 ? periodEnd(trainingStart, job.trainingMonths) : ''

  let probationStart = ''
  if (job.probationStartMode === 'custom') probationStart = isValidISO(job.probationStart) ? job.probationStart : ''
  else if (job.probationStartMode === 'afterTraining') probationStart = trainingEnd ? addDays(trainingEnd, 1) : ''
  else probationStart = isValidISO(job.joiningDate) ? job.joiningDate : ''
  const probationEnd = probationStart && job.probationMonths > 0 ? periodEnd(probationStart, job.probationMonths) : ''

  const target = isValidISO(job.targetLastDay) ? job.targetLastDay : ''
  const latestResignation = target && job.noticeMonths > 0 ? latestResignationDate(target, job.noticeMonths, job.noticeCounting) : ''

  const resignationIsPlanned = isValidISO(job.plannedResignationDate)
  const resignationDate = resignationIsPlanned ? job.plannedResignationDate : latestResignation
  const lastWorkingDay = resignationDate && job.noticeMonths > 0 ? periodEnd(resignationDate, job.noticeMonths, job.noticeCounting) : ''

  if (!isValidISO(job.joiningDate)) {
    notices.push({ level: 'info', text: 'Add your joining date to calculate training and probation dates.' })
  }
  if (!target) notices.push({ level: 'warning', text: 'Set a target last working day to calculate your resignation deadline.' })

  if (target && target >= weddingDate) {
    notices.push({ level: 'danger', text: `Your target last working day (${fmtDate(target)}) is on or after your wedding (${fmtDate(weddingDate)}).` })
  }

  if (resignationIsPlanned && latestResignation) {
    if (resignationDate > latestResignation) {
      notices.push({
        level: 'danger',
        text: `Resigning on ${fmtDate(resignationDate)} gives a last working day of ${fmtDate(lastWorkingDay)}, which is after your target of ${fmtDate(target)}. To meet a ${job.noticeMonths}-month notice period, submit by ${fmtDate(latestResignation)}.`,
      })
    } else if (resignationDate < latestResignation) {
      notices.push({
        level: 'info',
        text: `Your planned resignation is ${fmtDate(resignationDate)}, earlier than needed. Your notice would end on ${fmtDate(lastWorkingDay)}, before your target of ${fmtDate(target)}.`,
      })
    } else {
      notices.push({ level: 'ok', text: `Your planned resignation date meets the ${job.noticeMonths}-month notice period exactly.` })
    }
  }

  if (lastWorkingDay && lastWorkingDay >= weddingDate) {
    notices.push({ level: 'danger', text: `With this plan your notice period ends on ${fmtDate(lastWorkingDay)}, on or after your wedding.` })
  }

  if (resignationDate && resignationDate < today && !resignationIsPlanned) {
    notices.push({
      level: 'danger',
      text: `The latest resignation date for your target (${fmtDate(resignationDate)}) has already passed. Speak to HR about the notice period, early release or notice buyout.`,
    })
  } else if (resignationDate && resignationIsPlanned && resignationDate < today) {
    notices.push({ level: 'info', text: `Planned resignation date ${fmtDate(resignationDate)} is in the past. Update it if you have already resigned or changed plans.` })
  }

  if (resignationDate && probationEnd && resignationDate <= probationEnd && job.probationStatus !== 'Confirmed') {
    const alt =
      job.noticeDuringProbationDays > 0
        ? ` If the probation notice of ${job.noticeDuringProbationDays} days applies, your last day would be ${fmtDate(addDays(resignationDate, job.noticeDuringProbationDays - (job.noticeCounting === 'dayBefore' ? 1 : 0)))}.`
        : ''
    notices.push({
      level: 'warning',
      text: `Your resignation date falls before probation confirmation (${fmtDate(probationEnd)}). The notice period during probation is often different — check your contract.${alt}`,
    })
  }

  if (resignationDate && trainingEnd && resignationDate <= trainingEnd && job.trainingStatus !== 'Completed') {
    notices.push({ level: 'warning', text: 'Your resignation date falls before your training is expected to finish. Check whether any training bond or repayment clause applies.' })
  }

  if (resignationDate) {
    const dow = dayOfWeek(resignationDate)
    const hol = holidays.find((h) => h.date === resignationDate)
    if (weekendDays.includes(dow) || hol) {
      notices.push({
        level: 'warning',
        text: `${fmtDate(resignationDate)} is a ${hol ? `holiday (${hol.name})` : FULL_DAYS[dow]}. Submit on the previous working day so the notice period is not delayed.`,
      })
    }
  }

  if (job.probationStatus === 'Extended') {
    notices.push({ level: 'warning', text: 'Probation has been extended. Update the probation length so the confirmation date stays correct.' })
  }
  if (probationEnd && probationEnd < today && job.probationStatus !== 'Confirmed' && job.probationStatus !== 'Extended') {
    notices.push({ level: 'warning', text: `Probation was due to end on ${fmtDate(probationEnd)} but is not marked as confirmed. Ask HR for your confirmation letter.` })
  }
  if (trainingEnd && trainingEnd < today && job.trainingStatus !== 'Completed' && job.trainingStatus !== 'Extended') {
    notices.push({ level: 'warning', text: `Training was due to finish on ${fmtDate(trainingEnd)} but is not marked as completed.` })
  }

  return { trainingStart, trainingEnd, probationStart, probationEnd, latestResignation, resignationDate, resignationIsPlanned, lastWorkingDay, notices }
}
