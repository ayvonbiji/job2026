import { Link } from 'react-router-dom'
import { usePlanner } from '../lib/usePlanner'
import { useUpdate } from '../lib/store'
import { fmtDate, fmtMonth, fmtMonthShort, monthKey } from '../lib/dates'
import { money } from '../lib/format'
import type { SavingsPlan } from '../lib/types'
import { Alert, Card, NumberField, PageHeader, Stat, StatusBadge, Table, TextField, td, th } from '../components/ui'
import { SavingsTrackChart } from '../components/Charts'

export default function SavingsPlanner() {
  const { data, savings: s, wedding, balances, job, today } = usePlanner()
  const update = useUpdate()
  const set = <K extends keyof SavingsPlan>(k: K, v: SavingsPlan[K]) => update((d) => { d.savings[k] = v })
  const cur = monthKey(today)
  const weddingAccounts = balances.filter((b) => b.purpose === 'wedding')
  const trackData = s.rows.map((r) => ({ label: fmtMonthShort(r.month), target: r.cumulativeTarget, actual: r.cumulativeActual }))
  const extra = s.revisedMonthly - s.plannedMonthly

  return (
    <div className="space-y-6">
      <PageHeader title="Savings Planner" subtitle={<>Working backwards from {fmtDate(data.profile.weddingDate)}. Saving months run until {fmtMonth(s.endMonth)}.</>} />

      {/* Status */}
      {s.target <= 0 ? (
        <Alert level="info">Set your personal wedding budget in <Link className="underline" to="/wedding">Wedding Budget</Link> to start planning.</Alert>
      ) : s.remaining <= 0 ? (
        <Alert level="ok">You have already saved or paid your full personal contribution of {money(s.target)}.</Alert>
      ) : s.plannedMonthly <= 0 ? (
        <Alert level="warning">You need about {money(s.recommendedMonthly)} a month for the next {s.monthsLeft} months. Enter the amount you plan to save each month below to see if you are on track.</Alert>
      ) : s.onTrack ? (
        <Alert level="ok">On track. Saving {money(s.plannedMonthly)} a month, you are projected to have {money(s.projected)} by the wedding — {money(s.gap)} more than you need.</Alert>
      ) : (
        <Alert level="danger">
          Behind plan. At {money(s.plannedMonthly)} a month you are projected to reach {money(s.projected)}, a shortfall of {money(-s.gap)}. To close the gap you would need about {money(s.revisedMonthly)} a month ({money(extra)} more).
          {s.revisedExceedsSpare
            ? ` That is more than your estimated spare money of ${money(s.avgSpareMoney)} a month, so it may not be realistic. Consider reducing the budget, using expected extra income, or agreeing a different split with your family.`
            : ` Your estimated spare money is about ${money(s.avgSpareMoney)} a month. Check this is realistic before you commit to it.`}
        </Alert>
      )}
      {s.emergencyBelowReserve && <Alert level="warning">Your emergency savings ({money(s.emergencyBalance)}) are below your minimum of {money(data.savings.minimumEmergencyReserve)}. Do not use wedding money planning to dip into this.</Alert>}
      {s.monthsWithoutSalary.length > 0 && <Alert level="info">No salary is expected after your last working day ({fmtDate(job.lastWorkingDay)}): {s.monthsWithoutSalary.map(fmtMonth).join(', ')}. Plan to finish saving before then.</Alert>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Target personal contribution" value={money(s.target)} />
        <Stat label="Saved + paid so far" value={money(s.funded)} sub={`${money(wedding.saved)} saved · ${money(wedding.paid)} paid`} />
        <Stat label="Still needed" value={money(s.remaining)} />
        <Stat label="Recommended per month" value={money(s.recommendedMonthly)} sub={`${s.monthsLeft} months incl. ${fmtMonthShort(cur)}`} />
        <Stat label="Projected by wedding" value={money(s.projected)} sub={s.futureWeddingIncome ? `incl. ${money(s.futureWeddingIncome)} expected extra income` : undefined} />
        <Stat label={s.gap >= 0 ? 'Surplus' : 'Shortfall'} value={money(Math.abs(s.gap))} tone={s.target > 0 ? (s.gap >= 0 ? 'green' : 'red') : undefined} />
        <Stat label="Saved this month" value={money(s.thisMonthActual)} sub={s.plannedMonthly ? `Plan: ${money(s.plannedMonthly)}` : undefined} tone={s.plannedMonthly && s.thisMonthActual >= s.plannedMonthly ? 'green' : undefined} />
        <Stat label="Emergency savings (separate)" value={money(s.emergencyBalance)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Your plan">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="Monthly amount I plan to save" prefix="₹" value={data.savings.monthlyAmount} onChange={(v) => set('monthlyAmount', v)} />
            <NumberField label="Day of month to move savings" value={data.savings.contributionDay} onChange={(v) => set('contributionDay', v)} min={1} max={31} allowDecimal={false} />
            <NumberField label="Regular monthly expenses" prefix="₹" value={data.savings.regularMonthlyExpenses} onChange={(v) => set('regularMonthlyExpenses', v)} hint="Rent, food, bills, family — your usual spending." />
            <NumberField label="Minimum emergency savings" prefix="₹" value={data.savings.minimumEmergencyReserve} onChange={(v) => set('minimumEmergencyReserve', v)} hint="Never counted towards the wedding." />
            <TextField label="Plan start month" type="month" value={data.savings.planStartMonth} onChange={(v) => /^\d{4}-\d{2}$/.test(v) && set('planStartMonth', v)} />
            <NumberField label="Expected salary (from Job Tracker)" prefix="₹" value={data.job.salaryMonthly} onChange={(v) => update((d) => { d.job.salaryMonthly = v })} />
          </div>
          <p className="mt-3 text-xs text-slate-500">Spare money estimate = expected salary + expected extra income − regular expenses. Add bonuses or other expected income in the <Link className="underline" to="/money">Money Tracker</Link>.</p>
        </Card>

        <Card title="Where your wedding money is">
          <ul className="divide-y divide-cream-200 text-sm">
            {weddingAccounts.map((a) => <li key={a.id} className="flex justify-between py-2"><span>{a.name}</span><span className="font-semibold tabular-nums">{money(a.balance)}</span></li>)}
            <li className="flex justify-between py-2"><span>Already paid to vendors</span><span className="font-semibold tabular-nums">{money(wedding.paid)}</span></li>
            <li className="flex justify-between py-2 font-semibold"><span>Total towards wedding</span><span className="tabular-nums">{money(s.funded)}</span></li>
          </ul>
          <p className="mt-3 text-xs text-slate-500">
            To set your current wedding savings, edit the opening balance of your wedding account in <Link className="underline" to="/settings">Settings</Link>. Each month, record a transfer from your salary account to your wedding account in the Money Tracker — that counts as that month's actual saving.
          </p>
        </Card>
      </div>

      <Card title="Cumulative target vs saved">
        {s.target > 0 && s.rows.length ? <SavingsTrackChart data={trackData} /> : <p className="py-8 text-center text-sm text-slate-500">Set a target to see the chart.</p>}
      </Card>

      <Card title="Month by month" subtitle="Actual = money added to wedding accounts + wedding payments made from other accounts in that month.">
        <Table caption="Monthly savings plan">
          <thead><tr><th className={th}>Month</th><th className={`${th} text-right`}>Target</th><th className={`${th} text-right`}>Actual</th><th className={`${th} text-right`}>Cumulative target</th><th className={`${th} text-right`}>Cumulative saved</th><th className={`${th} text-right`}>Spare money (est.)</th><th className={th}>Status</th></tr></thead>
          <tbody>
            {s.rows.map((r) => (
              <tr key={r.month} className={r.month === cur ? 'bg-gold-50/50' : undefined}>
                <td className={`${td} whitespace-nowrap font-medium`}>{fmtMonth(r.month)}</td>
                <td className={`${td} text-right tabular-nums`}>{money(r.target)}</td>
                <td className={`${td} text-right tabular-nums`}>{r.actual === null ? '—' : money(r.actual)}</td>
                <td className={`${td} text-right tabular-nums`}>{money(r.cumulativeTarget)}</td>
                <td className={`${td} text-right tabular-nums`}>{r.cumulativeActual === null ? '—' : money(r.cumulativeActual)}</td>
                <td className={`${td} text-right tabular-nums ${r.spareMoney < r.target ? 'text-amber-700' : ''}`}>{money(r.spareMoney)}</td>
                <td className={td}><StatusBadge status={r.status} /></td>
              </tr>
            ))}
          </tbody>
        </Table>
        {s.rows.length === 0 && <p className="py-4 text-sm text-slate-500">No saving months left before the wedding.</p>}
      </Card>
    </div>
  )
}
