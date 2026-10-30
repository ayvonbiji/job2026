import { Link } from 'react-router-dom'
import { usePlanner } from '../lib/usePlanner'
import { useUpdate } from '../lib/store'
import { fmtDate, fmtMonth, fmtMonthShort, monthKey } from '../lib/dates'
import { money } from '../lib/format'
import type { SavingsPlan } from '../lib/types'
import { Alert, Card, NumberField, PageHeader, Progress, Stat, StatusBadge, Table, TextField, td, th } from '../components/ui'
import { SavingsTrackChart } from '../components/Charts'

export default function SavingsPlanner() {
  const { data, savings: s, wedding, today } = usePlanner()
  const update = useUpdate()
  const set = <K extends keyof SavingsPlan>(k: K, v: SavingsPlan[K]) => update((d) => { d.savings[k] = v })
  const cur = monthKey(today)
  const weddingAcc = data.accounts.find((a) => a.purpose === 'wedding')
  const emergencyAcc = data.accounts.find((a) => a.purpose === 'emergency')
  const setOpening = (id: string | undefined, v: number) => id && update((d) => { const a = d.accounts.find((x) => x.id === id); if (a) a.openingBalance = v })
  const trackData = s.rows.map((r) => ({ label: fmtMonthShort(r.month), target: r.cumulativeTarget, actual: r.cumulativeActual }))
  const income = data.employment.takeHomeMonthly

  return (
    <div className="space-y-6">
      <PageHeader title="Savings Planner" subtitle={<>Working back from {fmtDate(data.profile.weddingDate)}. Saving months run until {fmtMonth(s.endMonth)}. Affordability uses your real income and expenses.</>} />

      {s.target <= 0 ? (
        <Alert level="info">Enter your total wedding contribution target below (or in <Link className="underline" to="/wedding">Wedding Budget</Link>) to start planning.</Alert>
      ) : s.remaining <= 0 ? (
        <Alert level="ok">You have already saved or paid your full contribution of {money(s.target)}.</Alert>
      ) : (
        <>
          {s.behind && <Alert level="danger">You are behind your savings target. See the month-by-month table below.</Alert>}
          {s.plannedMonthly > 0 && (s.onTrack
            ? <Alert level="ok">On track: saving {money(s.plannedMonthly)} a month, you are projected to have {money(s.projected)} by the wedding — {money(s.gap)} more than your target.</Alert>
            : <Alert level="warning">At {money(s.plannedMonthly)} a month you are projected to reach {money(s.projected)} — {money(-s.gap)} short. Closing the gap needs about {money(s.recommendedMonthly)} a month.</Alert>)}
          {s.expensesSource === 'none' ? (
            <Alert level="info">Enter your usual monthly expenses (or record a few months of spending) so the planner can check what you can afford.</Alert>
          ) : s.affordable ? (
            <Alert level="ok">The recommended {money(s.recommendedMonthly)} a month fits within your estimated spare money of {money(s.avgSpareMoney)} a month.</Alert>
          ) : (
            <Alert level="danger">
              The recommended {money(s.recommendedMonthly)} a month is more than your estimated spare money of {money(Math.max(0, s.avgSpareMoney))} a month (income − expenses − commitments). The target may not be affordable at current numbers — consider a smaller contribution, more time, extra income, or agreeing a different split with your family.
            </Alert>
          )}
        </>
      )}
      {s.emergencyBelowReserve && <Alert level="warning">Emergency savings ({money(s.emergencyBalance)}) are below your minimum of {money(data.savings.minimumEmergencyReserve)}. Keep this money separate from wedding savings.</Alert>}
      {s.monthsWithoutSalary.length > 0 && <Alert level="info">No salary is expected in {s.monthsWithoutSalary.map(fmtMonth).join(', ')} (after your last working day). Plan to finish saving before then.</Alert>}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Contribution target" value={money(s.target)} />
        <Stat label="Saved + paid so far" value={money(s.funded)} sub={`${money(wedding.saved)} saved · ${money(wedding.paid)} paid`} />
        <Stat label="Remaining savings gap" value={money(s.remaining)} />
        <Stat label="Recommended monthly savings" value={money(s.recommendedMonthly)} sub={`${s.monthsLeft} months incl. ${fmtMonthShort(cur)}`} tone={s.target > 0 && !s.affordable && s.expensesSource !== 'none' ? 'red' : undefined} />
        <Stat label="Actual savings this month" value={money(s.thisMonthActual)} sub={s.plannedMonthly ? `Target ${money(s.plannedMonthly)}` : undefined} tone={s.plannedMonthly && s.thisMonthActual >= s.plannedMonthly ? 'green' : undefined} />
        <Stat label="Projected by wedding date" value={money(s.projected)} sub={s.futureWeddingIncome ? `incl. ${money(s.futureWeddingIncome)} expected extra income` : 'At your monthly target'} />
        <Stat label="Spare money per month (est.)" value={money(s.avgSpareMoney)} sub={`${money(income, true)} income − ${money(s.expensesUsed)} expenses − ${money(data.savings.otherCommitments)} commitments`} tone={s.avgSpareMoney < 0 ? 'red' : undefined} />
        <Stat label="Emergency savings (separate)" value={money(s.emergencyBalance)} />
      </div>
      {s.target > 0 && <Progress value={s.funded} max={s.target} tone="gold" label="Wedding savings progress" />}

      <Card title="My numbers" subtitle="Every figure can be changed at any time.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <NumberField label="Current wedding savings" prefix="₹" value={weddingAcc?.openingBalance ?? 0} onChange={(v) => setOpening(weddingAcc?.id, v)} hint={`Opening balance of “${weddingAcc?.name ?? 'Wedding savings'}”. Later transfers are added automatically.`} />
          <NumberField label="Total wedding contribution target" prefix="₹" value={data.wedding.personalTotal} onChange={(v) => update((d) => { d.wedding.personalTotal = v })} />
          <NumberField label="Monthly savings target" prefix="₹" value={data.savings.monthlyAmount} onChange={(v) => set('monthlyAmount', v)} hint="What you plan to move to wedding savings each month." />
          <NumberField label="Monthly expenses" prefix="₹" value={data.savings.regularMonthlyExpenses} onChange={(v) => set('regularMonthlyExpenses', v)} hint={s.expensesSource === 'recorded' ? `Leave 0 to use your recorded average (${money(s.expensesUsed)}).` : 'Rent, food, transport, family, personal.'} />
          <NumberField label="Other financial commitments (monthly)" prefix="₹" value={data.savings.otherCommitments} onChange={(v) => set('otherCommitments', v)} hint="Loan EMIs, money sent home, insurance…" />
          <NumberField label="Emergency savings (current)" prefix="₹" value={emergencyAcc?.openingBalance ?? 0} onChange={(v) => setOpening(emergencyAcc?.id, v)} hint="Opening balance of your emergency account. Never used for the wedding." />
          <NumberField label="Minimum emergency savings to keep" prefix="₹" value={data.savings.minimumEmergencyReserve} onChange={(v) => set('minimumEmergencyReserve', v)} />
          <NumberField label="Day of month I move savings" value={data.savings.contributionDay} onChange={(v) => set('contributionDay', v)} min={1} max={31} allowDecimal={false} hint="Salary arrives by the 5th." />
          <TextField label="Plan start month" type="month" value={data.savings.planStartMonth} onChange={(v) => /^\d{4}-\d{2}$/.test(v) && set('planStartMonth', v)} />
        </div>
        <p className="mt-3 text-xs text-slate-500">Each month, record a “Savings” transaction in the Money Tracker from your salary account to your wedding savings account. That is your actual saving for the month.</p>
      </Card>

      <Card title="Savings progress" subtitle="Cumulative target vs actual">
        {s.target > 0 && s.rows.length ? <SavingsTrackChart data={trackData} /> : <p className="py-8 text-center text-sm text-slate-500">Set a target to see the chart.</p>}
      </Card>

      <Card title="Target vs actual by month" subtitle="Actual = money added to wedding savings + wedding payments made from other accounts that month.">
        <Table caption="Monthly savings target versus actual">
          <thead><tr><th className={th}>Month</th><th className={`${th} text-right`}>Target</th><th className={`${th} text-right`}>Actual</th><th className={`${th} text-right`}>Cumulative target</th><th className={`${th} text-right`}>Cumulative actual</th><th className={`${th} text-right`}>Spare money (est.)</th><th className={th}>Status</th></tr></thead>
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
