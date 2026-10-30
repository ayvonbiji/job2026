import { useState } from 'react'
import { AlertTriangle, Scale } from 'lucide-react'
import { usePlanner } from '../lib/usePlanner'
import { useUpdate } from '../lib/store'
import { fmtDate, fmtDateLong, isValidISO, relativeDays } from '../lib/dates'
import { money } from '../lib/format'
import { CLAUSES, resignationScenario, type ScenarioCalc } from '../lib/calc/employment'
import type { ApprovalStatus, ResignationPlan } from '../lib/types'
import { Alert, Badge, Button, Card, DateField, NumberField, PageHeader, SelectField, Stat, TextArea, cx } from '../components/ui'
import { MilestoneList } from '../components/Milestones'

function ScenarioResult({ s }: { s: ScenarioCalc }) {
  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Stat label="Applicable scenario" value={s.scenario === 'A' ? 'A — before one year' : 'B — after one year'} tone={s.scenario === 'A' ? 'amber' : 'green'} />
        <Stat label="Notice period" value={`${s.noticeMonths} calendar months`} sub={s.clauses.map((c) => c.ref).join(', ')} />
        <Stat label="HR approval of early exit" value={s.approvalRequired ? 'Required' : 'Not needed for early exit'} sub={s.approvalRequired ? 'Clause 10.2.2 — company’s sole discretion' : 'Normal resignation process'} tone={s.approvalRequired ? 'amber' : undefined} />
        <Stat label="Submit resignation by (estimate)" value={fmtDate(s.deadline, true)} sub={relativeDays(s.daysToDeadline)} tone={s.daysToDeadline < 0 ? 'red' : undefined} />
        <Stat label="Notice period starts" value={fmtDate(s.noticeStart)} sub={`Ends ${fmtDate(s.lastDay)}`} />
        <Stat label="Days until final working day" value={s.daysToLastDay} sub={s.beforeMinTenure ? `Before one-year anniversary (${fmtDate(s.oneYear)})` : `On/after one-year anniversary (${fmtDate(s.oneYear)})`} />
      </div>
      {s.notices.map((n, i) => <Alert key={i} level={n.level}>{n.text}</Alert>)}
    </div>
  )
}

export default function Resignation() {
  const { data, emp, today } = usePlanner()
  const update = useUpdate()
  const e = data.employment
  const r = data.resignation
  const setR = <K extends keyof ResignationPlan>(k: K, v: ResignationPlan[K]) => update((d) => { d.resignation[k] = v })
  const [proposed, setProposed] = useState(e.targetLastDay)
  const calc = isValidISO(proposed) ? resignationScenario(e, proposed, data.profile.weddingDate, data.leavePolicy.holidays, data.leavePolicy.weekendDays, today) : null
  const plan = emp.plan
  const exitItems = emp.milestones.filter((m) => ['resignationPlanning', 'resignationSubmission', 'noticeStart', 'handover', 'lastDay', 'fullAndFinal', 'relievingLetter', 'experienceCertificate'].includes(m.key))
  const [liabilityText, setLiabilityText] = useState(r.hrConfirmedLiability === null ? '' : String(r.hrConfirmedLiability))
  const [liabilityErr, setLiabilityErr] = useState('')

  return (
    <div className="space-y-6">
      <PageHeader title="Resignation Planner" subtitle="Based on Clause 10 of my Employment Agreement. All dates are estimates until the company confirms them." />

      {plan?.beforeMinTenure && (
        <div role="alert" className="flex gap-3 rounded-2xl border-2 border-amber-300 bg-amber-50 p-5 text-amber-950">
          <AlertTriangle className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" aria-hidden />
          <div>
            <h2 className="font-semibold">Contractual warning</h2>
            <p className="mt-1 text-sm leading-relaxed">
              My planned last working day of {fmtDateLong(plan.lastDay)} is before my one-year employment anniversary of {fmtDateLong(plan.oneYear)}. Early termination is subject to company acceptance and may involve the liabilities described in my employment agreement.
            </p>
          </div>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        {(['A', 'B'] as const).map((k) => {
          const active = plan?.scenario === k
          const clauses = k === 'A' ? CLAUSES.early : CLAUSES.standard
          return (
            <section key={k} aria-label={`Scenario ${k}`} className={cx('rounded-2xl border bg-white p-5 shadow-card', active ? 'border-navy-600 ring-2 ring-navy-100' : 'border-cream-300/70 opacity-80')}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-gold-600">Scenario {k}</div>
                  <h2 className="text-lg font-semibold text-navy-900">{k === 'A' ? 'Resign before one year' : 'Resign after one year'}</h2>
                </div>
                {active && <Badge tone="navy">Applies to my plan</Badge>}
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-serif text-4xl font-semibold text-navy-900">{k === 'A' ? e.earlyNoticeMonths : e.standardNoticeMonths}</span>
                <span className="text-sm text-slate-600">months’ notice</span>
              </div>
              <ul className="mt-3 space-y-2 text-sm">
                {clauses.map((c) => (
                  <li key={c.ref}><span className="font-medium text-navy-800">{c.ref}:</span> <span className="text-slate-700">{c.text}</span></li>
                ))}
                <li className="text-slate-700"><span className="font-medium text-navy-800">Company approval:</span> {k === 'A' ? 'Required — acceptance is at the company’s discretion.' : 'Not needed for early exit; normal resignation process.'}</li>
                {k === 'A' && <li className="text-slate-700"><span className="font-medium text-navy-800">Possible liabilities:</span> see below. Not a confirmed amount.</li>}
              </ul>
            </section>
          )
        })}
      </div>

      <Card title="My current plan" subtitle={plan ? `Final working day ${fmtDate(plan.lastDay, true)} (tentative)` : 'Set a target last working day'}>
        {plan ? <ScenarioResult s={plan} /> : <p className="text-sm text-slate-500">Enter your target last working day below.</p>}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <DateField label="Target last working day" value={e.targetLastDay} onChange={(v) => update((d) => { d.employment.targetLastDay = v })} />
          <div>
            <DateField label="Planned resignation submission date" value={r.plannedSubmissionDate} onChange={(v) => setR('plannedSubmissionDate', v)} hint="Leave empty to use the calculated deadline." />
            {r.plannedSubmissionDate && <Button className="mt-2" size="sm" variant="ghost" onClick={() => setR('plannedSubmissionDate', '')}>Clear</Button>}
          </div>
        </div>
        {emp.submissionIsPlanned && emp.notices.filter((n) => n.text.startsWith('Submitting') || n.text.startsWith('Your planned submission')).map((n, i) => <div key={i} className="mt-3"><Alert level={n.level}>{n.text}</Alert></div>)}
        <div className="mt-4"><Alert level="info">The company must confirm how the notice period is calculated and must approve early termination. Ask HR to confirm your last working day in writing.</Alert></div>
      </Card>

      <Card title="Resignation calculator" subtitle="Try a different final working day. Nothing is saved until you press “Use as my plan”.">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          <DateField className="w-56" label="Proposed final working day" value={proposed} onChange={setProposed} />
          <Button variant="secondary" disabled={!calc || proposed === e.targetLastDay} onClick={() => update((d) => { d.employment.targetLastDay = proposed })}>Use as my plan</Button>
        </div>
        {calc ? <ScenarioResult s={calc} /> : <p className="text-sm text-slate-500">Choose a date to see the result.</p>}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Early termination approval" subtitle="Clause 10.2.2 — acceptance is at the company’s sole discretion.">
          <div className="grid gap-4">
            <SelectField<ApprovalStatus> label="Status" value={r.earlyExitApproval} onChange={(v) => setR('earlyExitApproval', v)} options={['Not requested', 'Requested', 'Approved', 'Rejected']} />
            <TextArea label="Notes from HR / manager" value={r.approvalNotes} onChange={(v) => setR('approvalNotes', v)} rows={3} />
          </div>
        </Card>

        <Card title={<span className="flex items-center gap-2"><Scale className="h-4 w-4" aria-hidden /> Potential liabilities (Clause 10.2.3)</span>} subtitle="Listed for awareness only. The planner does not calculate a penalty.">
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-700">
            {CLAUSES.liabilityItems.map((x) => <li key={x}>{x}</li>)}
          </ul>
          <div className="mt-4 rounded-xl bg-cream-100 p-3 text-sm">
            <span className="text-slate-600">Amount confirmed by HR: </span>
            <strong className="text-navy-900">{r.hrConfirmedLiability === null ? 'None recorded' : money(r.hrConfirmedLiability, true)}</strong>
            {r.hrConfirmedLiabilityOn && <span className="text-slate-500"> · confirmed {fmtDate(r.hrConfirmedLiabilityOn)}</span>}
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="liab" className="block text-sm font-medium text-navy-800">Record an amount HR has confirmed</label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-3 mt-1 flex items-center text-sm text-slate-500">₹</span>
                <input
                  id="liab"
                  inputMode="decimal"
                  value={liabilityText}
                  onChange={(ev) => {
                    const t = ev.target.value
                    setLiabilityText(t)
                    if (t.trim() === '') { setLiabilityErr(''); setR('hrConfirmedLiability', null); return }
                    const n = Number(t.replace(/,/g, ''))
                    if (!Number.isFinite(n) || n < 0) { setLiabilityErr('Enter a valid amount, or leave empty.'); return }
                    setLiabilityErr('')
                    setR('hrConfirmedLiability', n)
                  }}
                  aria-invalid={!!liabilityErr}
                  aria-describedby="liab-hint"
                  className="mt-1 block w-full rounded-lg border border-cream-300 bg-white py-2 pl-7 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-300"
                />
              </div>
              <p id="liab-hint" className={cx('mt-1 text-xs', liabilityErr ? 'font-medium text-red-700' : 'text-slate-500')}>{liabilityErr || 'Only enter an amount HR has confirmed in writing. Leave empty if none.'}</p>
            </div>
            <DateField label="Date HR confirmed it" value={r.hrConfirmedLiabilityOn} onChange={(v) => setR('hrConfirmedLiabilityOn', v)} />
            <TextArea className="sm:col-span-2" label="Notes" value={r.liabilityNotes} onChange={(v) => setR('liabilityNotes', v)} rows={2} />
          </div>
        </Card>
      </div>

      <Card title="Exit steps" subtitle="Resignation, notice, handover, final settlement and documents.">
        <MilestoneList items={exitItems} today={today} />
      </Card>

      <Card title="Contract settings" subtitle="Change these only if your agreement or HR says otherwise.">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <NumberField label="Minimum tenure (months)" value={e.minTenureMonths} onChange={(v) => update((d) => { d.employment.minTenureMonths = v })} min={0} max={120} allowDecimal={false} />
          <NumberField label="Notice before one year (months)" value={e.earlyNoticeMonths} onChange={(v) => update((d) => { d.employment.earlyNoticeMonths = v })} min={0} max={24} allowDecimal={false} hint="Clause 10.2.1" />
          <NumberField label="Notice after one year (months)" value={e.standardNoticeMonths} onChange={(v) => update((d) => { d.employment.standardNoticeMonths = v })} min={0} max={24} allowDecimal={false} hint="Clause 10.3" />
          <SelectField
            label="How notice is counted"
            value={e.noticeCounting}
            onChange={(v) => update((d) => { d.employment.noticeCounting = v })}
            options={[
              { value: 'calendar', label: 'From the day after I submit (30 Apr → 31 Jul)' },
              { value: 'inclusive', label: 'Including the day I submit (1 May → 31 Jul)' },
            ]}
            hint="Ask HR which one they use."
          />
        </div>
      </Card>
    </div>
  )
}
