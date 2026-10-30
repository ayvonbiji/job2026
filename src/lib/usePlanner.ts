import { useEffect, useMemo, useState } from 'react'
import { useData } from './store'
import { todayISO } from './dates'
import { calcEmployment } from './calc/employment'
import { planWeddingLeave, summariseLeave } from './calc/leave'
import { accountBalances, calcWedding, salarySchedule, totalUpcoming, upcomingPayments } from './calc/finance'
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
    const lp = data.leavePolicy
    const emp = calcEmployment(data.employment, data.resignation, data.milestones, data.profile.weddingDate, lp.holidays, lp.weekendDays, today)
    const lastDay = data.employment.targetLastDay
    const leave = summariseLeave(data.leaves, lp, data.employment.joiningDate, today)
    const weddingLeave = planWeddingLeave(data.leaves, lp, data.employment.joiningDate, lastDay, today)
    const wedding = calcWedding(data, today)
    const balances = accountBalances(data, today)
    const savings = calcSavings(data, lastDay, today)
    const upcoming = upcomingPayments(data, wedding, today)
    const commitments = totalUpcoming(data, wedding, today)
    const salary = salarySchedule(data, lastDay, today)
    const reminders = buildReminders(data, emp, today)
    return { data, today, emp, leave, weddingLeave, wedding, balances, savings, upcoming, commitments, salary, reminders }
  }, [data, today])
}
