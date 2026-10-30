import { usePlanner } from '../lib/usePlanner'
import { useUpdate } from '../lib/store'
import { daysUntil, diffDays, fmtDate, relativeDays } from '../lib/dates'
import type { ProbationStatus } from '../lib/types'
import { Alert, Button, Card, DateField, NumberField, PageHeader, SelectField, Stat, StatusBadge, cx } from '../components/ui'
import { MilestoneList } from '../components/Milestones'

export default function Probation() {
  const { data, emp, today } = usePlanner()
  const update = useUpdate()
  const e = data.employment
  const total = e.probationDays
  const elapsed = e.joiningDate ? Math.max(0, Math.min(total, diffDays(e.joiningDate, today))) : 0
  const pct = total ? (elapsed / total) * 100 : 0
  const left = emp.probationEnd ? daysUntil(emp.probationEnd, today) : null
  const items = emp.milestones.filter((m) => ['joining', 'day30', 'day60', 'probation', 'hrConfirmation'].includes(m.key))
  const marks = [30, 60, total].filter((x, i, a) => x <= total && a.indexOf(x) === i)

  return (
    <div className="space-y-6">
      <PageHeader title="Probation Tracker" subtitle={`${total}-day probation from your joining date. The completion date is an estimate until HR confirms it.`} actions={<StatusBadge status={e.probationStatus} />} />

      <Card>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-slate-500">Probation</div>
            <div className="mt-1 font-serif text-4xl font-semibold text-navy-900 tabular-nums">
              {e.probationStatus === 'Confirmed' ? 'Confirmed' : left === null ? '—' : left > 0 ? `${left} days left` : left === 0 ? 'Completes today' : 'Awaiting confirmation'}
            </div>
            <div className="text-sm text-slate-500">
              {fmtDate(e.joiningDate)} → {fmtDate(emp.probationEnd)} (estimate){e.probationConfirmedOn && <> · Confirmed {fmtDate(e.probationConfirmedOn)}</>}
            </div>
          </div>
          {e.probationStatus !== 'Confirmed' && left !== null && left <= 0 && (
            <Button onClick={() => update((d) => { d.employment.probationStatus = 'Confirmed'; d.employment.probationConfirmedOn = d.employment.probationConfirmedOn || today })}>I received confirmation</Button>
          )}
        </div>
        <div className="mt-6">
          <div className="relative h-3 rounded-full bg-cream-200" role="progressbar" aria-label="Probation progress" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
            <div className="h-full rounded-full bg-navy-600" style={{ width: `${pct}%` }} />
            {marks.map((m) => (
              <span key={m} aria-hidden className={cx('absolute top-1/2 h-5 w-0.5 -translate-y-1/2', elapsed >= m ? 'bg-gold-500' : 'bg-cream-300')} style={{ left: `calc(${(m / total) * 100}% - 1px)` }} />
            ))}
          </div>
          <div className="relative mt-2 h-8 text-xs text-slate-500">
            {marks.map((m) => (
              <span key={m} className="absolute -translate-x-full text-right" style={{ left: `${(m / total) * 100}%` }}>Day {m}</span>
            ))}
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-4">
          <Stat label="Days completed" value={`${elapsed} / ${total}`} />
          <Stat label="30-day milestone" value={fmtDate(emp.day30)} sub={emp.day30 ? relativeDays(daysUntil(emp.day30, today)) : undefined} />
          <Stat label="60-day milestone" value={fmtDate(emp.day60)} sub={emp.day60 ? relativeDays(daysUntil(emp.day60, today)) : undefined} />
          <Stat label="90-day completion" value={fmtDate(emp.probationEnd)} sub="Subject to HR confirmation" />
        </div>
      </Card>

      {e.probationStatus === 'Extended' && <Alert level="warning">Probation is marked as extended. Increase the probation days below so the dates stay correct.</Alert>}
      {left !== null && left < 0 && e.probationStatus !== 'Confirmed' && <Alert level="warning">Your estimated completion date has passed. Ask HR for written confirmation of probation.</Alert>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Confirmation">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField<ProbationStatus> label="Probation status" value={e.probationStatus} onChange={(v) => update((d) => { d.employment.probationStatus = v })} options={['Not started', 'In progress', 'Confirmed', 'Extended', 'Not confirmed']} />
            <DateField label="HR confirmation date" value={e.probationConfirmedOn} onChange={(v) => update((d) => { d.employment.probationConfirmedOn = v })} hint="The date on your confirmation letter or email." />
            <NumberField label="Probation length (days)" value={e.probationDays} onChange={(v) => update((d) => { d.employment.probationDays = v })} min={0} max={730} allowDecimal={false} />
            <DateField label="Joining date" value={e.joiningDate} onChange={(v) => update((d) => { d.employment.joiningDate = v })} />
          </div>
        </Card>
        <Card title="Probation milestones" subtitle="Tick each one off and add notes from check-ins with your manager.">
          <MilestoneList items={items} today={today} />
        </Card>
      </div>
    </div>
  )
}
