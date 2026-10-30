import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { BadgeCheck, Briefcase, CalendarRange, Gem, PiggyBank, Wallet } from 'lucide-react'
import { usePlanner } from '../lib/usePlanner'
import { addDays, daysUntil, fmtDate, fmtMonthShort, monthKey, relativeDays } from '../lib/dates'
import { money, pct } from '../lib/format'
import { monthSummary, monthsWithData } from '../lib/calc/finance'
import { Alert, Badge, Card, PageHeader, Progress, cx } from '../components/ui'
import { IncomeExpenseChart, SavingsTrackChart } from '../components/Charts'
import { ReminderList } from '../components/Reminders'

function Tile({ label, icon, value, sub, to, children, tone }: { label: string; icon?: ReactNode; value: ReactNode; sub?: ReactNode; to: string; children?: ReactNode; tone?: 'red' | 'amber' | 'green' | 'gold' }) {
  const ring = tone === 'red' ? 'border-red-200' : tone === 'amber' ? 'border-amber-200' : 'border-cream-300/70'
  return (
    <Link to={to} className={cx('group block rounded-2xl border bg-white p-4 shadow-card transition hover:border-gold-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300', ring)}>
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-500">{icon}{label}</div>
      <div className={cx('mt-1 text-2xl font-semibold tabular-nums', tone === 'red' ? 'text-red-700' : tone === 'green' ? 'text-emerald-700' : tone === 'gold' ? 'text-gold-600' : 'text-navy-900')}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
      {children && <div className="mt-3">{children}</div>}
    </Link>
  )
}

const ic = 'h-3.5 w-3.5'

export default function Dashboard() {
  const { data, today, emp, leave, wedding, savings, upcoming, reminders, balances, salary } = usePlanner()
  const e = data.employment
  const weddingDays = daysUntil(data.profile.weddingDate, today)
  const doneTasks = data.checklist.filter((t) => t.status === 'Done').length
  const toLast = e.targetLastDay ? daysUntil(e.targetLastDay, today) : null
  const toJoin = e.joiningDate ? daysUntil(e.joiningDate, today) : null
  const probLeft = emp.probationEnd ? daysUntil(emp.probationEnd, today) : null
  const thisMonth = monthSummary(data, monthKey(today), today)
  const available = balances.filter((b) => b.purpose === 'general').reduce((a, b) => a + b.balance, 0)
  const nextSalary = salary.find((r) => r.status !== 'Received' && r.status !== 'Received (less than expected)')
  const chartData = monthsWithData(data, today).slice(-6).map((m) => {
    const s = monthSummary(data, m, today)
    return { label: fmtMonthShort(m), income: s.income, expenses: s.expenses }
  })
  const trackData = savings.rows.map((r) => ({ label: fmtMonthShort(r.month), target: r.cumulativeTarget, actual: r.cumulativeActual }))
  const keyMilestones = emp.milestones.filter((m) => !m.done && m.date && m.date >= today).slice(0, 6)
  const dueReminders = reminders.filter((r) => !r.completed && r.date <= addDays(today, 14)).slice(0, 6)
  const danger = emp.notices.filter((n) => n.level === 'danger')

  return (
    <div>
      <PageHeader title={data.profile.name ? `Hello, ${data.profile.name}` : 'Overview'} subtitle={<>Today is {fmtDate(today, true)}. Every figure comes from your saved data.</>} />

      {danger.length > 0 && <div className="mb-4 space-y-2">{danger.map((n, i) => <Alert key={i} level="danger">{n.text}</Alert>)}</div>}

      <div className="mb-6 overflow-hidden rounded-2xl bg-navy-900 p-6 text-white shadow-card sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-gold-300">Our wedding</div>
            <div className="mt-2 font-serif text-6xl font-semibold tabular-nums sm:text-7xl">{Math.max(0, weddingDays)}</div>
            <div className="text-navy-100">{weddingDays >= 0 ? `days until ${fmtDate(data.profile.weddingDate, true)}` : 'Congratulations!'}</div>
          </div>
          <div className="w-full max-w-xs space-y-3 text-sm">
            {[['Wedding savings', wedding.progress, pct(wedding.progress)], ['Checklist', data.checklist.length ? (doneTasks / data.checklist.length) * 100 : 0, `${doneTasks} / ${data.checklist.length}`], ['Employment journey', emp.employmentProgress, toLast !== null && toLast >= 0 ? `${toLast} days to last day` : '']].map(([l, v, t]) => (
              <div key={l as string}>
                <div className="mb-1 flex justify-between text-navy-100"><span>{l}</span><span className="text-white">{t}</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label={l as string} aria-valuenow={Math.round(v as number)} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-gold-300" style={{ width: `${v}%` }} /></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <h2 className="sr-only">Summary</h2>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label="Employment" icon={<Briefcase className={ic} aria-hidden />} to="/employment" value={toJoin !== null && toJoin > 0 ? `Joins in ${toJoin}d` : toLast !== null ? `${Math.max(0, toLast)} days left` : '—'} sub={toJoin !== null && toJoin > 0 ? `${e.designation} · ${fmtDate(e.joiningDate)}` : `Planned last day ${fmtDate(e.targetLastDay)} (tentative)`} />
        <Tile
          label="Probation"
          icon={<BadgeCheck className={ic} aria-hidden />}
          to="/probation"
          tone={e.probationStatus === 'Confirmed' ? 'green' : probLeft !== null && probLeft < 0 ? 'amber' : undefined}
          value={e.probationStatus === 'Confirmed' ? 'Confirmed' : probLeft === null ? '—' : probLeft >= 0 ? `${probLeft} days left` : 'Awaiting HR'}
          sub={`Completes ${fmtDate(emp.probationEnd)} (estimate) · ${e.probationStatus}`}
        />
        <Tile
          label="Resignation"
          icon={<CalendarRange className={ic} aria-hidden />}
          to="/resignation"
          tone={emp.plan?.beforeMinTenure ? 'amber' : undefined}
          value={emp.submissionDate ? fmtDate(emp.submissionDate) : '—'}
          sub={emp.plan ? `${emp.submissionIsPlanned ? 'Planned' : 'Submit by'} · ${emp.plan.noticeMonths}-month notice · Scenario ${emp.plan.scenario}${emp.plan.approvalRequired ? ' (HR approval needed)' : ''}` : 'Set a last working day'}
        />
        <Tile
          label="Leave balance"
          icon={<CalendarRange className={ic} aria-hidden />}
          to="/leave"
          value={<>{leave.byType.CL.available} <span className="text-sm font-normal text-slate-500">CL</span> · {leave.byType.SL.available} <span className="text-sm font-normal text-slate-500">SL</span></>}
          sub={`Pending: ${leave.byType.CL.pending} CL, ${leave.byType.SL.pending} SL`}
        />
        <Tile label="Monthly take-home" icon={<Wallet className={ic} aria-hidden />} to="/money" value={money(e.takeHomeMonthly, true)} sub={nextSalary ? `Next salary due by ${fmtDate(nextSalary.expectedDate)}${nextSalary.status === 'Overdue' ? ' — overdue' : ''}` : 'No salary months set'} tone={nextSalary?.status === 'Overdue' ? 'amber' : undefined} />
        <Tile label="Available balance" icon={<Wallet className={ic} aria-hidden />} to="/money" value={money(available)} tone={available < 0 ? 'red' : undefined} sub={<>This month: {money(thisMonth.income)} in · {money(thisMonth.expenses)} out · {money(thisMonth.savings)} saved</>} />
        <Tile label="Wedding savings" icon={<Gem className={ic} aria-hidden />} to="/wedding" tone="gold" value={money(wedding.funded)} sub={wedding.target > 0 ? `of ${money(wedding.target)} · ${money(wedding.remainingToSave)} still to save` : 'Set your contribution target'}>
          <Progress value={wedding.funded} max={wedding.target} tone="gold" label="Wedding savings progress" />
        </Tile>
        <Tile label="Monthly savings needed" icon={<PiggyBank className={ic} aria-hidden />} to="/savings" value={money(savings.recommendedMonthly)} tone={savings.target > 0 && savings.expensesSource !== 'none' && !savings.affordable ? 'red' : savings.behind ? 'amber' : undefined} sub={savings.target <= 0 ? 'Set a target' : savings.expensesSource === 'none' ? 'Add expenses to check affordability' : savings.affordable ? `Fits your spare money (${money(savings.avgSpareMoney)}/month)` : `More than your spare money (${money(Math.max(0, savings.avgSpareMoney))}/month)`} />
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card title="Upcoming payments" subtitle="Next 45 days" action={<Link className="text-sm text-navy-600 hover:underline" to="/calendar">Calendar</Link>}>
          {upcoming.length === 0 ? <p className="text-sm text-slate-500">Nothing due. Add rent and bills as recurring payments in Calendar & Reminders.</p> : (
            <ul className="divide-y divide-cream-200 text-sm">
              {upcoming.slice(0, 7).map((u, i) => (
                <li key={i} className="flex items-center justify-between gap-2 py-2">
                  <span className="min-w-0"><span className="block truncate font-medium text-navy-900">{u.label}</span><span className={cx('text-xs', u.date < today ? 'text-red-700' : 'text-slate-500')}>{fmtDate(u.date)} · {relativeDays(daysUntil(u.date, today))}</span></span>
                  <span className="shrink-0 tabular-nums">{money(u.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Important milestones" action={<Link className="text-sm text-navy-600 hover:underline" to="/employment">Timeline</Link>}>
          <ol className="space-y-2.5">
            {keyMilestones.map((m) => (
              <li key={m.key} className="flex items-start justify-between gap-3 text-sm">
                <span className="font-medium text-navy-900">{m.label}</span>
                <span className="shrink-0 text-right text-xs text-slate-500">{fmtDate(m.date)}<br />{relativeDays(daysUntil(m.date, today))}</span>
              </li>
            ))}
            <li className="flex items-start justify-between gap-3 text-sm"><span className="font-medium text-gold-700">Wedding day</span><span className="text-right text-xs text-slate-500">{fmtDate(data.profile.weddingDate)}<br />{relativeDays(weddingDays)}</span></li>
          </ol>
        </Card>
      </div>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card title="Income and expenses" subtitle="Last 6 months" action={<Link className="text-sm text-navy-600 hover:underline" to="/money">Details</Link>}>
          {chartData.some((d) => d.income || d.expenses) ? <IncomeExpenseChart data={chartData} /> : <p className="py-10 text-center text-sm text-slate-500">Record your salary and expenses in the Money Tracker to see this chart.</p>}
        </Card>
        <Card title="Wedding savings plan" subtitle={savings.target <= 0 ? 'Set your contribution target' : savings.behind ? 'Behind target' : savings.plannedMonthly > 0 ? (savings.onTrack ? 'On track' : `Projected shortfall ${money(-savings.gap)}`) : `${savings.monthsLeft} saving months left`} action={<Link className="text-sm text-navy-600 hover:underline" to="/savings">Details</Link>}>
          {savings.target > 0 && trackData.length ? <SavingsTrackChart data={trackData} /> : <p className="py-10 text-center text-sm text-slate-500">Set your wedding contribution to see your savings plan.</p>}
        </Card>
      </div>

      <Card title="Due soon" subtitle="Reminders for the next 14 days and anything overdue" action={<Link className="text-sm text-navy-600 hover:underline" to="/calendar">All reminders</Link>}>
        <ReminderList reminders={dueReminders} today={today} empty="Nothing due in the next 14 days" />
        {reminders.some((r) => !r.completed && r.date < today) && <div className="mt-2"><Badge tone="red">! You have overdue reminders</Badge></div>}
      </Card>
    </div>
  )
}
