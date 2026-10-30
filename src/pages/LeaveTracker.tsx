import { useMemo, useState } from 'react'
import { Pencil, Trash2 } from 'lucide-react'
import { usePlanner } from '../lib/usePlanner'
import { useUpdate } from '../lib/store'
import { DAY_NAMES, MONTH_NAMES, fmtDate, isValidISO } from '../lib/dates'
import { days, uid } from '../lib/format'
import { calculatedDays, countLeaveDays, requestDeadline } from '../lib/calc/leave'
import { buildCalendarEvents } from '../lib/calc/reminders'
import { downloadCSV } from '../lib/csv'
import { LEAVE_LABEL, LEAVE_TYPES, type AccrualRule, type BalancedLeave, type ExitLeavePolicy, type LeaveEntry, type LeavePolicy, type LeaveStatus, type LeaveType, type YesNoUnknown } from '../lib/types'
import { Alert, Badge, Button, Card, Checkbox, DateField, EmptyState, Modal, NumberField, PageHeader, SelectField, Stat, StatusBadge, Table, TextArea, TextField, td, th } from '../components/ui'
import MonthCalendar from '../components/MonthCalendar'

const STATUSES: LeaveStatus[] = ['Planned', 'Pending', 'Approved', 'Taken', 'Rejected', 'Cancelled']
const blank = (): LeaveEntry => ({ id: '', type: 'CL', status: 'Planned', startDate: '', endDate: '', startHalf: false, endHalf: false, days: null, reason: '', notes: '', forWedding: false })

export default function LeaveTracker() {
  const { data, leave, weddingLeave, today } = usePlanner()
  const update = useUpdate()
  const policy = data.leavePolicy
  const setP = <K extends keyof LeavePolicy>(k: K, v: LeavePolicy[K]) => update((d) => { d.leavePolicy[k] = v })
  const setEnt = (t: BalancedLeave, k: keyof LeavePolicy['entitlements']['CL'], v: number | boolean) => update((d) => { (d.leavePolicy.entitlements[t] as unknown as Record<string, number | boolean>)[k] = v })
  const [editing, setEditing] = useState<LeaveEntry | null>(null)
  const [fType, setFType] = useState<'All' | LeaveType>('All')
  const [fStatus, setFStatus] = useState<'All' | LeaveStatus>('All')
  const [hol, setHol] = useState({ date: '', name: '' })
  const [holErr, setHolErr] = useState('')

  const rows = useMemo(
    () =>
      [...data.leaves]
        .sort((a, b) => (a.startDate < b.startDate ? 1 : -1))
        .filter((l) => (fType === 'All' || l.type === fType) && (fStatus === 'All' || l.status === fStatus))
        .map((l) => ({ ...l, n: countLeaveDays(l, policy) })),
    [data.leaves, fType, fStatus, policy],
  )
  const events = buildCalendarEvents({ ...data, transactions: [], salaryRecords: [], recurring: [] }, [], today, { leave: true, reminders: false }).filter((e) => !e.kind.startsWith('salary'))
  events.push({ date: data.profile.weddingDate, kind: 'wedding', label: 'Wedding' })

  const exportCSV = () =>
    downloadCSV(
      `leave-records-${today}.csv`,
      ['Leave type', 'Start date', 'End date', 'Half day (start)', 'Half day (end)', 'Days', 'Status', 'Reason', 'For wedding', 'Notes'],
      [...data.leaves].sort((a, b) => (a.startDate < b.startDate ? -1 : 1)).map((l) => [LEAVE_LABEL[l.type], l.startDate, l.endDate, l.startHalf ? 'Yes' : 'No', l.endHalf ? 'Yes' : 'No', countLeaveDays(l, policy), l.status, l.reason, l.forWedding ? 'Yes' : 'No', l.notes]),
    )

  const addHoliday = () => {
    if (!isValidISO(hol.date)) return setHolErr('Choose a date.')
    if (!hol.name.trim()) return setHolErr('Enter a holiday name.')
    if (policy.holidays.some((h) => h.date === hol.date)) return setHolErr('A holiday already exists on that date.')
    setHolErr('')
    update((d) => { d.leavePolicy.holidays.push({ id: uid(), date: hol.date, name: hol.name.trim() }); d.leavePolicy.holidays.sort((a, b) => (a.date < b.date ? -1 : 1)) })
    setHol({ date: '', name: '' })
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave Management"
        subtitle={<>Leave year {fmtDate(leave.start)} – {fmtDate(leave.end)}. Casual and sick leave are tracked separately.</>}
        actions={<><Button variant="secondary" onClick={exportCSV} disabled={!data.leaves.length}>Export CSV</Button><Button onClick={() => setEditing(blank())}>Add leave</Button></>}
      />

      {leave.notes.map((n, i) => <Alert key={i} level="info">{n}</Alert>)}

      <div className="grid gap-4 lg:grid-cols-3">
        {(['CL', 'SL', 'Comp'] as BalancedLeave[]).map((t) => {
          const s = leave.byType[t]
          return (
            <Card key={t} title={LEAVE_LABEL[t]} subtitle={t === 'Comp' ? 'Subject to company policy' : `${s.annual} days per year (agreement)`}>
              <div className="font-serif text-4xl font-semibold tabular-nums text-navy-900">{s.available}<span className="ml-1 font-sans text-sm font-normal text-slate-500">days remaining</span></div>
              <dl className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 text-sm">
                <dt className="text-slate-500">{t === 'Comp' ? 'Earned' : policy.accrual === 'Monthly' ? 'Credited so far' : 'Entitlement'}</dt><dd className="text-right tabular-nums">{s.accruedToDate}</dd>
                {s.carryoverCounted > 0 && <><dt className="text-slate-500">Carried forward</dt><dd className="text-right tabular-nums">{s.carryoverCounted}</dd></>}
                <dt className="text-slate-500">Used</dt><dd className="text-right tabular-nums">{s.used}</dd>
                <dt className="text-slate-500">Approved upcoming</dt><dd className="text-right tabular-nums">{s.approvedUpcoming}</dd>
                <dt className="text-slate-500">Pending requests</dt><dd className="text-right tabular-nums text-amber-700">{s.pending}</dd>
                <dt className="text-slate-500">Planned</dt><dd className="text-right tabular-nums">{s.planned}</dd>
                <dt className="font-medium text-navy-800">If all are approved</dt><dd className={`text-right font-medium tabular-nums ${s.projected < 0 ? 'text-red-700' : ''}`}>{s.projected}</dd>
              </dl>
              {s.carryoverUnconfirmed > 0 && <p className="mt-2 text-xs text-slate-500">{s.carryoverUnconfirmed} carried-forward day(s) not counted until HR confirms.</p>}
            </Card>
          )
        })}
      </div>
      <Card title="Leave of Absence (without pay)">
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Taken this leave year" value={days(leave.loa.taken)} />
          <Stat label="Approved, upcoming" value={days(leave.loa.upcoming)} />
          <Stat label="Planned / pending" value={days(leave.loa.pending)} />
        </div>
        <p className="mt-2 text-xs text-slate-500">Unpaid days may reduce your salary. Adjust the expected salary for that month in the Money Tracker once HR confirms.</p>
      </Card>

      <Card title="Wedding leave planner" subtitle={`Casual leave you could use before your last working day (${fmtDate(weddingLeave.lastWorkingDay)}).`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="CL left this leave year" value={days(weddingLeave.currentYearCL)} sub={`Use by ${fmtDate(leave.end)}`} />
          {!weddingLeave.exitInCurrentYear && <Stat label="CL from next leave year" value={days(weddingLeave.nextYearCL)} sub={`From ${fmtDate(weddingLeave.nextYearStart)} · ${weddingLeave.nextYearCLBooked} booked`} />}
          <Stat label="Total CL before you leave" value={days(weddingLeave.totalCLBeforeExit)} tone={weddingLeave.totalCLBeforeExit < 0 ? 'red' : 'green'} />
          <Stat label="Leave marked for wedding" value={days(weddingLeave.weddingLeaveBooked)} />
        </div>
        {!weddingLeave.exitInCurrentYear && (
          <NumberField className="mt-4 max-w-sm" label="CL available next leave year before my last day (from HR)" value={policy.nextYearCLBeforeExit} onChange={(v) => setP('nextYearCLBeforeExit', v)} max={366} hint="Ask HR whether leave is pro-rated when you leave mid-year." />
        )}
        {weddingLeave.notes.length > 0 && <div className="mt-4 space-y-2">{weddingLeave.notes.map((n, i) => <Alert key={i} level="warning">{n}</Alert>)}</div>}
      </Card>

      <Card title="Leave calendar">
        <MonthCalendar events={events} weekendDays={policy.weekendDays} today={today} />
      </Card>

      <Card title="Leave history" action={
        <div className="flex gap-2">
          <SelectField label="Type" className="w-28" value={fType} onChange={setFType} options={['All', ...LEAVE_TYPES] as const} />
          <SelectField label="Status" className="w-32" value={fStatus} onChange={setFStatus} options={['All', ...STATUSES] as const} />
        </div>
      }>
        {rows.length === 0 ? (
          <EmptyState title={data.leaves.length ? 'No leave matches these filters' : 'No leave recorded yet'} action={!data.leaves.length && <Button size="sm" onClick={() => setEditing(blank())}>Add leave</Button>}>
            {!data.leaves.length && 'Record leave you have taken, approved leave, pending requests and plans.'}
          </EmptyState>
        ) : (
          <Table caption="Leave history">
            <thead><tr><th className={th}>Dates</th><th className={th}>Type</th><th className={th}>Days</th><th className={th}>Status</th><th className={th}>Reason</th><th className={th}><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td className={td}>
                    <div className="font-medium text-navy-900">{fmtDate(l.startDate)}{l.endDate !== l.startDate && <> – {fmtDate(l.endDate)}</>}</div>
                    {l.status === 'Planned' && <div className="text-xs text-slate-500">Request by {fmtDate(requestDeadline(l, policy).date)}</div>}
                  </td>
                  <td className={td}>{l.type} {l.forWedding && <Badge tone="gold">Wedding</Badge>}</td>
                  <td className={`${td} tabular-nums`}>{l.n}{(l.startHalf || l.endHalf) && <span className="text-xs text-slate-500"> (half day)</span>}</td>
                  <td className={td}><StatusBadge status={l.status} /></td>
                  <td className={`${td} max-w-xs text-slate-600`}>{l.reason}{l.notes && <div className="text-xs text-slate-500">{l.notes}</div>}</td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(l)} aria-label={`Edit leave from ${l.startDate}`}><Pencil className="h-3.5 w-3.5" aria-hidden /></Button>
                    <Button size="sm" variant="ghost" className="text-red-700" aria-label={`Delete leave from ${l.startDate}`} onClick={() => confirm('Delete this leave record?') && update((d) => { d.leaves = d.leaves.filter((x) => x.id !== l.id) })}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card title="Leave policy" subtitle="Your agreement gives 12 CL and 12 SL. Everything else stays “Not confirmed” until you receive the official HR Leave Policy.">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-sm">
            <thead><tr><th className={th}>Leave type</th><th className={th}>Days per year / earned</th><th className={th}>Carried forward</th><th className={th}>HR confirmed carry-forward</th><th className={th}>Used before tracking</th></tr></thead>
            <tbody>
              {(['CL', 'SL', 'Comp'] as BalancedLeave[]).map((t) => {
                const ent = policy.entitlements[t]
                return (
                  <tr key={t}>
                    <td className={`${td} font-medium`}>{LEAVE_LABEL[t]}</td>
                    <td className={td}><NumberField label={`${t} days`} value={ent.annualDays} onChange={(v) => setEnt(t, 'annualDays', v)} max={366} /></td>
                    <td className={td}><NumberField label={`${t} carried forward`} value={ent.carryover} onChange={(v) => setEnt(t, 'carryover', v)} max={366} /></td>
                    <td className={`${td} pt-8`}><Checkbox label="Confirmed" checked={ent.carryoverConfirmed} onChange={(v) => setEnt(t, 'carryoverConfirmed', v)} /></td>
                    <td className={td}><NumberField label={`${t} used before`} value={ent.usedBeforeTracking} onChange={(v) => setEnt(t, 'usedBeforeTracking', v)} max={366} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <SelectField label="How leave days are counted" value={policy.dayCountRule} onChange={(v) => setP('dayCountRule', v)} options={[{ value: 'calendar', label: 'Every calendar day (no rule assumed)' }, { value: 'working', label: 'Skip weekends and holidays (HR confirmed)' }]} hint="You can also type the exact days for each leave." />
          <SelectField<AccrualRule> label="How leave is credited" value={policy.accrual} onChange={(v) => setP('accrual', v)} options={['Not confirmed', 'Full at start of leave year', 'Monthly']} />
          <SelectField label="Leave year starts in" value={String(policy.leaveYearStartMonth)} onChange={(v) => setP('leaveYearStartMonth', Number(v))} options={MONTH_NAMES.map((m, i) => ({ value: String(i + 1), label: m }))} hint="Confirm with HR." />
          <SelectField<YesNoUnknown> label="Carry-forward" value={policy.carryForward} onChange={(v) => setP('carryForward', v)} options={['Not confirmed', 'Allowed', 'Not allowed']} />
          <SelectField<YesNoUnknown> label="Encashment" value={policy.encashment} onChange={(v) => setP('encashment', v)} options={['Not confirmed', 'Allowed', 'Not allowed']} />
          <SelectField<ExitLeavePolicy> label="Unused leave when I leave" value={policy.exitLeavePolicy} onChange={(v) => setP('exitLeavePolicy', v)} options={['Not confirmed', 'Paid out', 'Lost', 'Can be used during notice', 'Other']} />
          <NumberField label="Days’ notice to request leave" value={policy.requestNoticeDays} onChange={(v) => setP('requestNoticeDays', v)} max={180} allowDecimal={false} hint="0 = not set by HR." />
        </div>
        {policy.dayCountRule === 'working' && (
          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-navy-800">Weekly off days</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {DAY_NAMES.map((n, i) => (
                <Checkbox key={n} label={n} checked={policy.weekendDays.includes(i)} onChange={(v) => setP('weekendDays', v ? [...policy.weekendDays, i].sort() : policy.weekendDays.filter((x) => x !== i))} />
              ))}
            </div>
          </fieldset>
        )}
        <TextArea className="mt-4" label="HR leave policy notes" value={policy.hrPolicyNotes} onChange={(v) => setP('hrPolicyNotes', v)} hint="Paste or summarise the official HR Leave Policy here when you receive it." />
      </Card>

      <Card title="Company holidays" subtitle="Shown on calendars. Excluded from leave counts only if you choose “Skip weekends and holidays”.">
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <DateField label="Date" value={hol.date} onChange={(v) => setHol({ ...hol, date: v })} />
          <TextField label="Holiday name" value={hol.name} onChange={(v) => setHol({ ...hol, name: v })} />
          <Button onClick={addHoliday}>Add</Button>
        </div>
        {holErr && <p className="mt-2 text-xs font-medium text-red-700" role="alert">{holErr}</p>}
        <ul className="mt-4 divide-y divide-cream-200">
          {policy.holidays.length === 0 && <li className="py-3 text-sm text-slate-500">No holidays added yet. Add the company holiday list when HR shares it.</li>}
          {policy.holidays.map((h) => (
            <li key={h.id} className="flex items-center justify-between py-2 text-sm">
              <span><span className="font-medium text-navy-900">{h.name}</span> <span className="text-slate-500">· {fmtDate(h.date, true)}</span></span>
              <Button size="sm" variant="ghost" className="text-red-700" aria-label={`Delete holiday ${h.name}`} onClick={() => confirm(`Delete holiday "${h.name}"?`) && update((d) => { d.leavePolicy.holidays = d.leavePolicy.holidays.filter((x) => x.id !== h.id) })}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
            </li>
          ))}
        </ul>
      </Card>

      {editing && <LeaveModal entry={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function LeaveModal({ entry, onClose }: { entry: LeaveEntry; onClose: () => void }) {
  const { data, leave } = usePlanner()
  const update = useUpdate()
  const [l, setL] = useState<LeaveEntry>({ ...entry })
  const [manual, setManual] = useState(entry.days !== null)
  const [daysText, setDaysText] = useState(entry.days !== null ? String(entry.days) : '')
  const [err, setErr] = useState<Record<string, string>>({})
  const single = !l.endDate || l.endDate === l.startDate
  const auto = isValidISO(l.startDate) ? calculatedDays({ ...l, endDate: l.endDate || l.startDate }, data.leavePolicy) : 0
  const save = () => {
    const e: Record<string, string> = {}
    if (!isValidISO(l.startDate)) e.start = 'Choose a start date.'
    if (l.endDate && isValidISO(l.startDate) && l.endDate < l.startDate) e.end = 'End date must be on or after the start date.'
    let daysVal: number | null = null
    if (manual) {
      const n = Number(daysText)
      if (daysText.trim() === '' || !Number.isFinite(n) || n < 0 || n > 366 || (n * 2) % 1 !== 0) e.days = 'Enter days in steps of 0.5 (for example 1 or 1.5).'
      else daysVal = n
    } else if (!e.start && !e.end && auto === 0) e.start = 'These dates are all days off, so no leave is counted. Enter the days manually if HR counts them.'
    setErr(e)
    if (Object.keys(e).length) return
    const clean: LeaveEntry = { ...l, endDate: l.endDate || l.startDate, endHalf: single ? false : l.endHalf, days: daysVal, reason: l.reason.trim() }
    update((d) => {
      if (clean.id) d.leaves = d.leaves.map((x) => (x.id === clean.id ? clean : x))
      else d.leaves.push({ ...clean, id: uid() })
    })
    onClose()
  }
  const count = manual ? Number(daysText) || 0 : auto
  const bal = l.type !== 'LOA' ? leave.byType[l.type as BalancedLeave] : null
  const negative = bal && !entry.id && ['Planned', 'Pending', 'Approved', 'Taken'].includes(l.status) && bal.projected - count < 0
  return (
    <Modal open title={entry.id ? 'Edit leave' : 'Add leave'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save leave</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField<LeaveType> label="Leave type" value={l.type} onChange={(v) => setL({ ...l, type: v })} options={LEAVE_TYPES.map((t) => ({ value: t, label: LEAVE_LABEL[t] }))} />
        <SelectField<LeaveStatus> label="Approval status" value={l.status} onChange={(v) => setL({ ...l, status: v })} options={STATUSES} hint="Planned = not requested yet." />
        <DateField label="Start date" value={l.startDate} onChange={(v) => setL({ ...l, startDate: v })} error={err.start} required />
        <DateField label="End date" value={l.endDate} onChange={(v) => setL({ ...l, endDate: v })} error={err.end} min={l.startDate || undefined} hint="Leave empty for one day." />
        <SelectField
          label={single ? 'Day' : 'First day'}
          value={l.startHalf ? 'half' : 'full'}
          onChange={(v) => setL({ ...l, startHalf: v === 'half' })}
          options={[{ value: 'full', label: 'Full day' }, { value: 'half', label: 'Half day' }]}
        />
        {!single ? <SelectField label="Last day" value={l.endHalf ? 'half' : 'full'} onChange={(v) => setL({ ...l, endHalf: v === 'half' })} options={[{ value: 'full', label: 'Full day' }, { value: 'half', label: 'Half day' }]} /> : <div />}
        <TextField className="sm:col-span-2" label="Reason" value={l.reason} onChange={(v) => setL({ ...l, reason: v })} />
        <div className="sm:col-span-2 rounded-lg bg-cream-100 px-3 py-2 text-sm text-navy-800" aria-live="polite">
          Calculated: <strong>{auto}</strong> day(s) ({data.leavePolicy.dayCountRule === 'calendar' ? 'every calendar day' : 'working days only'})
          <div className="mt-2"><Checkbox label="Enter the number of days myself" checked={manual} onChange={(v) => { setManual(v); if (v && !daysText) setDaysText(String(auto)) }} /></div>
          {manual && <TextField className="mt-2 max-w-[10rem]" label="Number of days" value={daysText} onChange={setDaysText} error={err.days} />}
        </div>
        <div className="sm:col-span-2"><Checkbox label="This leave is for wedding preparation" checked={l.forWedding} onChange={(v) => setL({ ...l, forWedding: v })} /></div>
        <TextArea className="sm:col-span-2" label="Notes" value={l.notes} onChange={(v) => setL({ ...l, notes: v })} rows={2} />
      </div>
      {negative && <div className="mt-3"><Alert level="warning">This would take your projected {l.type} balance below zero.</Alert></div>}
    </Modal>
  )
}
