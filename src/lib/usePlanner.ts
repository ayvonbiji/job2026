import { useEffect, useMemo, useState } from 'react'
import { useData } from './store'
import { todayISO } from './dates'
import { calcJob } from './calc/job'
import { planWeddingLeave, summariseLeaveYear } from './calc/leave'
import { accountBalances, calcWedding, upcomingExpenses } from './calc/finance'
import { calcSavings } from './calc/savings'
import { buildReminders } from './calc/reminders'

/** Today's date, refreshed every minute so countdowns roll over at midnight. */
export function useToday(): string {
  const [today, setToday] = useState(todayISO())
  useEffect(() => {
    const id = setInterval(() => setToday(todayISO()), 60_000)
    return () => clearInterval(id)
  }, [])
  return today
}

export function usePlanner() {
  const data = useData()
  const today = useToday()
  return useMemo(() => {
    const job = calcJob(data.job, data.profile.weddingDate, data.leavePolicy.holidays, data.leavePolicy.weekendDays, today)
    const leave = summariseLeaveYear(data.leaves, data.leavePolicy, today)
    const weddingLeave = planWeddingLeave(data.leaves, data.leavePolicy, job.lastWorkingDay, today)
    const wedding = calcWedding(data, today)
    const balances = accountBalances(data, today)
    const savings = calcSavings(data, job.lastWorkingDay, today)
    const upcoming = upcomingExpenses(data, wedding, today)
    const reminders = buildReminders(data, job, today)
    return { data, today, job, leave, weddingLeave, wedding, balances, savings, upcoming, reminders }
  }, [data, today])
}
