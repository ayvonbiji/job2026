import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { usePlanner } from '../lib/usePlanner'
import { addDays, daysUntil, fmtDate, fmtMonthShort, monthKey, relativeDays } from '../lib/dates'
import { days, money, pct } from '../lib/format'
import { monthSummary, monthsWithData } from '../lib/calc/finance'
import { Alert, Badge, Button, Card, PageHeader, Progress, cx } from '../components/ui'
import { IncomeExpenseChart, SavingsTrackChart } from '../components/Charts'
import { AddReminderModal, NotificationSettings, ReminderList, downloadAllICS } from '../components/Reminders'

function Tile({ label, value, sub, to, children, tone }: { label: string; value: ReactNode; sub?: ReactNode; to: string; children?: ReactNode; tone?: 'red' | 'amber' | 'green' | 'gold' }) {
  const ring = tone === 'red' ? 'border-red-200' : tone === 'amber' ? 'border-amber-200' : 'border-cream-300/70'
  return (
    <Link to={to} className={cx('group block rounded-2xl border bg-white p-4 shadow-card transition hover:border-gold-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-300', ring)}>
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</div>
      <div className={cx('mt-1 text-2xl font-semibold tabular-nums', tone === 'red' ? 'text-red-700' : tone === 'green' ? 'text-emerald-700' : tone === 'gold' ? 'text-gold-600' : 'text-navy-900')}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
      {children && <div className="mt-3">{children}</div>}
    </Link>
  )
}

export default function Dashboard() {
  const p = usePlanner()
  const { data, today, job, leave, wedding, savings, upcoming, reminders } = p
  const [tab, setTab] = useState<'soon' | 'overdue' | 'all' | 'done'>('soon')
  const [adding, setAdding] = useState(false)

  const weddingDays = daysUntil(data.profile.weddingDate, today)
  const doneTasks = data.checklist.filter((t) => t.status === 'Done').length

  const trainingLeft = job.trainingEnd ? daysUntil(job.trainingEnd, today) : null
  const probationLeft = job.probationEnd ? daysUntil(job.probationEnd, today) : null
  const resignLeft = job.resignationDate ? daysUntil(job.resignationDate, today) : null
  const lastDayLeft = job.lastWorkingDay ? daysUntil(job.lastWorkingDay, today) : null

  const months = monthsWithData(data, today).slice(-6)
  const chartData = months.map((m) => {
    const s = monthSummary(data, m, today)
    return { label: fmtMonthShort(m), income: s.income, expenses: s.expenses }
  })
  const hasMoney = chartData.some((d) => d.income || d.expenses)
  const thisMonth = monthSummary(data, monthKey(today), today)

  const overdue = reminders.filter((r) => !r.completed && r.date < today)
  const soon = reminders.filter((r) => !r.completed && r.date >= today && r.date <= addDays(today, 30))
  const list = tab === 'soon' ? soon : tab === 'overdue' ? overdue : tab === 'done' ? reminders.filter((r) => r.completed) : reminders.filter((r) => !r.completed && r.date >= today)

  const setup: { done: boolean; text: string; to: string }[] = [
    { done: !!data.job.joiningDate, text: 'Add your joining date and job details', to: '/job' },
    { done: data.job.salaryMonthly > 0, text: 'Enter your monthly salary', to: '/job' },
    { done: data.leavePolicy.annualEntitlement > 0, text: 'Enter your leave entitlement and policy', to: '/leave' },
    { done: wedding.target > 0, text: 'Set your personal wedding contribution', to: '/wedding' },
    { done: data.savings.monthlyAmount > 0, text: 'Choose how much to save each month', to: '/savings' },
    { done: data.accounts.some((a) => a.openingBalance !== 0) || data.transactions.length > 0, text: 'Enter opening balances or your first transaction', to: '/settings' },
  ]
  const setupLeft = setup.filter((s) => !s.done)

  const milestones = [
    { label: 'Training complete', date: job.trainingEnd, done: data.job.trainingStatus === 'Completed' },
    { label: 'Probation confirmed', date: job.probationEnd, done: data.job.probationStatus === 'Confirmed' },
    { label: job.resignationIsPlanned ? 'Resign (planned)' : 'Resign by', date: job.resignationDate, done: false },
    { label: 'Last working day', date: job.lastWorkingDay, done: false },
    { label: 'Wedding', date: data.profile.weddingDate, done: false },
  ]
  const serious = job.notices.filter((n) => n.level === 'danger')

  const trackData = savings.rows.map((r) => ({ label: fmtMonthShort(r.month), target: r.cumulativeTarget, actual: r.cumulativeActual }))

  return (
    <div>
      <PageHeader
        title={data.profile.name ? `Hello, ${data.profile.name}` : 'Dashboard'}
        subtitle={<>Today is {fmtDate(today, true)}. All figures come from the data you have saved.</>}
      />

      {serious.length > 0 && (
        <div className="mb-4 space-y-2">
          {serious.map((n, i) => <Alert key={i} level="danger">{n.text}</Alert>)}
        </div>
      )}

      {setupLeft.length > 0 && (
        <Card className="mb-6 border-gold-300 bg-gold-50/40" title="Finish setting up" subtitle={`${setup.length - setupLeft.length} of ${setup.length} done. Cards show real figures once these are filled in.`}>
          <ul className="grid gap-2 sm:grid-cols-2">
            {setupLeft.map((s) => (
              <li key={s.text}><Link to={s.to} className="flex items-center gap-2 text-sm text-navy-700 underline-offset-2 hover:underline"><span aria-hidden className="h-4 w-4 rounded-full border border-gold-500" />{s.text}</Link></li>
            ))}
          </ul>
        </Card>
      )}

      {/* Hero: wedding countdown */}
      <div className="mb-6 overflow-hidden rounded-2xl bg-navy-900 p-6 text-white shadow-card sm:p-8">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.25em] text-gold-300">Wedding countdown</div>
            <div className="mt-2 font-serif text-6xl font-semibold tabular-nums sm:text-7xl">{weddingDays >= 0 ? weddingDays : 0}</div>
            <div className="text-navy-100">{weddingDays >= 0 ? `days until ${fmtDate(data.profile.weddingDate, true)}` : 'Congratulations!'}</div>
          </div>
          <div className="w-full max-w-xs space-y-3 text-sm">
            <div>
              <div className="mb-1 flex justify-between text-navy-100"><span>Savings progress</span><span className="text-white">{pct(wedding.progress)}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Wedding savings progress" aria-valuenow={Math.round(wedding.progress)} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-gold-300" style={{ width: `${wedding.progress}%` }} /></div>
            </div>
            <div>
              <div className="mb-1 flex justify-between text-navy-100"><span>Checklist</span><span className="text-white">{doneTasks} / {data.checklist.length}</span></div>
              <div className="h-2 overflow-hidden rounded-full bg-white/15" role="progressbar" aria-label="Wedding checklist progress" aria-valuenow={data.checklist.length ? Math.round((doneTasks / data.checklist.length) * 100) : 0} aria-valuemin={0} aria-valuemax={100}><div className="h-full rounded-full bg-gold-300" style={{ width: `${data.checklist.length ? (doneTasks / data.checklist.length) * 100 : 0}%` }} /></div>
            </div>
          </div>
        </div>
      </div>

      <h2 className="sr-only">Summary</h2>
      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Tile
          label="Training / probation"
          to="/job"
          value={trainingLeft === null ? '—' : data.job.trainingStatus === 'Completed' ? 'Training done' : trainingLeft >= 0 ? days(trainingLeft) : 'Due'}
          sub={
            job.trainingEnd ? (
              <>Training ends {fmtDate(job.trainingEnd)} · Probation {data.job.probationStatus === 'Confirmed' ? 'confirmed' : probationLeft !== null ? `ends ${fmtDate(job.probationEnd)} (${relativeDays(probationLeft).toLowerCase()})` : '—'}</>
            ) : 'Add your joining date'
          }
        />
        <Tile
          label={job.resignationIsPlanned ? 'Planned resignation' : 'Resignation deadline'}
          to="/job"
          tone={resignLeft !== null && resignLeft < 0 ? 'red' : resignLeft !== null && resignLeft <= 30 ? 'amber' : undefined}
          value={job.resignationDate ? fmtDate(job.resignationDate) : '—'}
          sub={resignLeft !== null ? `${relativeDays(resignLeft)} · ${data.job.noticeMonths}-month notice` : 'Set your target last day'}
        />
        <Tile label="Last working day" to="/job" value={job.lastWorkingDay ? fmtDate(job.lastWorkingDay) : '—'} sub={lastDayLeft !== null ? `${relativeDays(lastDayLeft)} · target ${fmtDate(data.job.targetLastDay)}` : undefined} tone={job.lastWorkingDay && job.lastWorkingDay > data.job.targetLastDay ? 'red' : undefined} />
        <Tile
          label="Available leave"
          to="/leave"
          value={days(leave.available)}
          tone={leave.projected < 0 ? 'red' : undefined}
          sub={<>After approved: {leave.afterApproved} · Projected incl. pending: {leave.projected}</>}
        />
        <Tile label="Saved for wedding" to="/wedding" tone="gold" value={money(wedding.funded)} sub={<>{money(wedding.saved)} in savings + {money(wedding.paid)} already paid</>}>
          <Progress value={wedding.funded} max={wedding.target} tone="gold" label="Saved towards wedding target" />
        </Tile>
        <Tile label="Wedding budget vs spent" to="/wedding" value={<>{money(wedding.paid)} <span className="text-sm font-normal text-slate-500">of {money(wedding.target)}</span></>} tone={wedding.target > 0 && wedding.paid > wedding.target ? 'red' : undefined} sub={wedding.target > 0 ? `${money(wedding.remainingBudget)} of budget left` : 'Set your budget'}>
          <Progress value={wedding.paid} max={wedding.target} tone={wedding.paid > wedding.target ? 'red' : 'navy'} label="Wedding budget spent" />
        </Tile>
        <Tile label="Still to save" to="/savings" value={money(wedding.remainingToSave)} tone={wedding.target > 0 && wedding.remainingToSave === 0 ? 'green' : undefined} sub={`${savings.monthsLeft} saving months left (to ${fmtMonthShort(savings.endMonth)})`} />
        <Tile
          label="Monthly savings target"
          to="/savings"
          value={money(savings.recommendedMonthly)}
          tone={savings.plannedMonthly > 0 && savings.plannedMonthly < savings.recommendedMonthly ? 'amber' : undefined}
          sub={savings.plannedMonthly > 0 ? `You plan ${money(savings.plannedMonthly)} · this month ${money(savings.thisMonthActual)}` : 'Needed per month to reach your target'}
        />
        <Tile label="Upcoming expenses" to="/wedding" value={money(upcoming.total)} sub={<>{money(upcoming.weddingRemaining)} wedding payments + {money(upcoming.scheduledOther)} scheduled</>} />
        <Tile label="Emergency savings" to="/savings" value={money(savings.emergencyBalance)} tone={savings.emergencyBelowReserve ? 'amber' : undefined} sub={savings.emergencyBelowReserve ? `Below your minimum of ${money(data.savings.minimumEmergencyReserve)}` : 'Kept separate — never used for the wedding'} />
        <Tile label="This month" to="/money" value={money(thisMonth.savings)} tone={thisMonth.savings < 0 ? 'red' : undefined} sub={<>Income {money(thisMonth.income)} · Expenses {money(thisMonth.expenses)}</>} />
      </div>

      <Card title="Milestones" className="mb-6">
        <ol className="relative grid gap-4 md:grid-cols-5">
          {milestones.map((m) => {
            const n = m.date ? daysUntil(m.date, today) : null
            const passed = n !== null && n < 0
            return (
              <li key={m.label} className="flex gap-3 md:flex-col md:gap-2">
                <span aria-hidden className={cx('mt-1 h-3 w-3 shrink-0 rounded-full ring-4', m.done ? 'bg-emerald-600 ring-emerald-100' : passed ? 'bg-slate-400 ring-slate-100' : m.label === 'Wedding' ? 'bg-gold-500 ring-gold-100' : 'bg-navy-600 ring-navy-100')} />
                <div>
                  <div className="text-sm font-medium text-navy-900">{m.label}</div>
                  <div className="text-xs text-slate-500">{m.date ? fmtDate(m.date) : 'Not set'}</div>
                  {n !== null && <div className="text-xs">{m.done ? <Badge tone="green">✓ Done</Badge> : <span className={passed ? 'text-slate-500' : 'text-navy-700'}>{relativeDays(n)}</span>}</div>}
                </div>
              </li>
            )
          })}
        </ol>
      </Card>

      <div className="mb-6 grid gap-6 lg:grid-cols-2">
        <Card title="Income and expenses" subtitle="Last 6 months. Transfers between your accounts are not counted." action={<Link className="text-sm text-navy-600 hover:underline" to="/money">Details</Link>}>
          {hasMoney ? <IncomeExpenseChart data={chartData} /> : <p className="py-10 text-center text-sm text-slate-500">Add income and expenses in Money Tracker to see this chart.</p>}
        </Card>
        <Card title="Wedding savings plan" subtitle={savings.plannedMonthly > 0 ? (savings.onTrack ? 'On track for your target' : `Projected shortfall of ${money(-savings.gap)}`) : 'Set a monthly amount in Savings Planner'} action={<Link className="text-sm text-navy-600 hover:underline" to="/savings">Details</Link>}>
          {wedding.target > 0 && trackData.length ? <SavingsTrackChart data={trackData} /> : <p className="py-10 text-center text-sm text-slate-500">Set your wedding contribution to see your savings plan.</p>}
        </Card>
      </div>

      <Card
        id="reminders"
        title="Reminders"
        subtitle={`${overdue.length} overdue · ${soon.length} in the next 30 days`}
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" onClick={() => downloadAllICS(reminders, today)}>Download all (.ics)</Button>
            <Button size="sm" onClick={() => setAdding(true)}>Add reminder</Button>
          </div>
        }
      >
        <div className="mb-3 flex flex-wrap gap-1" role="tablist" aria-label="Reminder filter">
          {([['soon', 'Next 30 days'], ['overdue', `Overdue (${overdue.length})`], ['all', 'All upcoming'], ['done', 'Completed']] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={cx('rounded-full px-3 py-1 text-xs font-medium', tab === k ? 'bg-navy-800 text-white' : 'bg-cream-100 text-navy-700 hover:bg-cream-200')}>
              {l}
            </button>
          ))}
        </div>
        <ReminderList reminders={list} today={today} />
        <div className="mt-4 border-t border-cream-200 pt-4">
          <NotificationSettings />
        </div>
      </Card>
      <AddReminderModal open={adding} onClose={() => setAdding(false)} />
    </div>
  )
}
