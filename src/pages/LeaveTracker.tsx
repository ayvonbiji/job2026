import { useMemo, useState } from 'react'
import { usePlanner } from '../lib/usePlanner'
import { useUpdate } from '../lib/store'
import { DAY_NAMES, MONTH_NAMES, fmtDate, isValidISO } from '../lib/dates'
import { days, uid } from '../lib/format'
import { countLeaveDays, leaveDays, requestDeadline } from '../lib/calc/leave'
import { downloadCSV } from '../lib/csv'
import type { ExitLeavePolicy, LeaveEntry, LeavePolicy, LeaveStatus, LeaveType } from '../lib/types'
import { Alert, Badge, Button, Card, Checkbox, DateField, EmptyState, Modal, NumberField, PageHeader, SelectField, Stat, StatusBadge, Table, TextArea, TextField, td, th } from '../components/ui'
import MonthCalendar, { type CalEvent, type CalKind } from '../components/MonthCalendar'

const TYPES: LeaveType[] = ['Annual', 'Sick', 'Unpaid', 'Other']
const STATUSES: LeaveStatus[] = ['Planned', 'Pending', 'Approved', 'Taken', 'Rejected', 'Cancelled']

function blank(): LeaveEntry {
  return { id: '', type: 'Annual', status: 'Planned', startDate: '', endDate: '', startHalf: false, endHalf: false, forWedding: false, notes: '' }
}

export default function LeaveTracker() {
  const { data, leave, weddingLeave, job, today, reminders } = usePlanner()
  const update = useUpdate()
  const policy = data.leavePolicy
  const setP = <K extends keyof LeavePolicy>(k: K, v: LeavePolicy[K]) => update((d) => { d.leavePolicy[k] = v })
  const [editing, setEditing] = useState<LeaveEntry | null>(null)
  const [fType, setFType] = useState<'All' | LeaveType>('All')
  const [fStatus, setFStatus] = useState<'All' | LeaveStatus>('All')
  const [showReminders, setShowReminders] = useState(false)
  const [hol, setHol] = useState({ date: '', name: '' })
  const [holErr, setHolErr] = useState('')

  const rows = useMemo(
    () =>
      [...data.leaves]
        .sort((a, b) => (a.startDate < b.startDate ? 1 : -1))
        .filter((l) => (fType === 'All' || l.type === fType) && (fStatus === 'All' || l.status === fStatus))
        .map((l) => ({ ...l, days: countLeaveDays(l, policy) })),
    [data.leaves, fType, fStatus, policy],
  )

  const events: CalEvent[] = []
  for (const l of data.leaves) {
    if (l.status === 'Rejected' || l.status === 'Cancelled') continue
    const kind: CalKind = l.type === 'Sick' ? 'sick' : l.type === 'Unpaid' ? 'unpaid' : l.type === 'Other' ? 'other' : l.status === 'Pending' ? 'pending' : l.status === 'Planned' ? 'planned' : 'annual'
    for (const d of leaveDays(l, policy)) events.push({ date: d.date, kind, label: `${l.type}${l.forWedding ? ' (wedding)' : ''}`, half: d.amount < 1 })
  }
  for (const h of policy.holidays) events.push({ date: h.date, kind: 'holiday', label: h.name })
  events.push({ date: data.profile.weddingDate, kind: 'wedding', label: 'Wedding' })
  if (showReminders) for (const r of reminders) if (!r.completed && !r.key.startsWith('leave:start')) events.push({ date: r.date, kind: 'reminder', label: r.title })

  const exportCSV = () =>
    downloadCSV(
      `leave-records-${today}.csv`,
      ['Start date', 'End date', 'Type', 'Status', 'Working days', 'First day half', 'Last day half', 'For wedding', 'Request deadline', 'Notes'],
      [...data.leaves].sort((a, b) => (a.startDate < b.startDate ? -1 : 1)).map((l) => [l.startDate, l.endDate, l.type, l.status, countLeaveDays(l, policy), l.startHalf ? 'Yes' : 'No', l.endHalf ? 'Yes' : 'No', l.forWedding ? 'Yes' : 'No', requestDeadline(l, policy), l.notes]),
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
        title="Leave Tracker"
        subtitle={<>Leave year {fmtDate(leave.start)} – {fmtDate(leave.end)}. Weekends and company holidays are not counted.</>}
        actions={<><Button variant="secondary" onClick={exportCSV} disabled={!data.leaves.length}>Export CSV</Button><Button onClick={() => setEditing(blank())}>Add leave</Button></>}
      />

      {policy.annualEntitlement === 0 && <Alert level="info">Enter your annual leave entitlement in the leave policy below to calculate your balance.</Alert>}

      <Card title="Annual leave balance" subtitle="Available = entitlement + HR-confirmed carryover − leave used. Pending and planned leave are shown separately and not deducted.">
        <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Entitlement" value={days(leave.entitlement)} />
          <Stat label="Carryover counted" value={days(leave.carryoverCounted)} sub={leave.carryoverUnconfirmed > 0 ? `${leave.carryoverUnconfirmed} not counted — not confirmed by HR` : undefined} />
          <Stat label="Used" value={days(leave.used)} sub={policy.usedBeforeTracking ? `incl. ${policy.usedBeforeTracking} before tracking` : undefined} />
          <Stat label="Available (confirmed)" value={days(leave.available)} tone={leave.available < 0 ? 'red' : 'green'} />
          <Stat label="Approved, still to take" value={days(leave.approvedUpcoming)} />
          <Stat label="After approved leave" value={days(leave.afterApproved)} tone={leave.afterApproved < 0 ? 'red' : undefined} />
          <Stat label="Pending requests" value={days(leave.pending)} tone={leave.pending ? 'amber' : undefined} />
          <Stat label="Planned (not requested)" value={days(leave.planned)} />
          <Stat label="Projected balance" value={days(leave.projected)} sub="If all pending and planned leave is approved" tone={leave.projected < 0 ? 'red' : undefined} />
          <Stat label="Sick leave left" value={days(leave.sickRemaining)} sub={`${leave.sickUsed} used · unpaid ${leave.unpaid}`} tone={leave.sickRemaining < 0 ? 'red' : undefined} />
        </div>
      </Card>

      <Card title="Wedding preparation leave planner" subtitle={`How much leave you may be able to use before your last working day (${fmtDate(job.lastWorkingDay)}).`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Left this leave year (projected)" value={days(weddingLeave.currentYearLeft)} sub={`Until ${fmtDate(leave.end)}`} />
          {!weddingLeave.exitInCurrentYear && <Stat label="Next leave year, before exit" value={days(weddingLeave.nextYearAvailable)} sub={`From ${fmtDate(weddingLeave.nextYearStart)} · ${weddingLeave.nextYearBooked} booked`} />}
          <Stat label="Total you could use before exit" value={days(weddingLeave.totalBeforeExit)} tone={weddingLeave.totalBeforeExit < 0 ? 'red' : 'green'} />
          <Stat label="Wedding leave booked" value={days(weddingLeave.weddingLeaveBooked)} sub="Entries marked 'for wedding'" />
          <Stat label="Working days until last day" value={weddingLeave.lastWorkingDay ? days(weddingLeave.workingDaysToExit) : '—'} />
        </div>
        {!weddingLeave.exitInCurrentYear && (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <NumberField label="Next-year leave up to last day (from HR)" value={policy.nextYearEntitlementBeforeExit} onChange={(v) => setP('nextYearEntitlementBeforeExit', v)} hint={policy.annualEntitlement > 0 && job.lastWorkingDay ? `Rough pro-rata estimate: ${estimateProRata(policy.annualEntitlement, weddingLeave.nextYearStart, job.lastWorkingDay)} days. Confirm with HR.` : 'Ask HR how leave is pro-rated when you resign.'} />
            <NumberField label="Days HR will carry into next year" value={policy.nextYearCarryover} onChange={(v) => setP('nextYearCarryover', v)} />
            <div className="pt-6"><Checkbox label="HR has confirmed this carryover" checked={policy.nextYearCarryoverConfirmed} onChange={(v) => setP('nextYearCarryoverConfirmed', v)} /></div>
          </div>
        )}
        {weddingLeave.notes.length > 0 && <div className="mt-4 space-y-2">{weddingLeave.notes.map((n, i) => <Alert key={i} level="warning">{n}</Alert>)}</div>}
      </Card>

      <Card title="Calendar" action={<Checkbox label="Show reminders" checked={showReminders} onChange={setShowReminders} />}>
        <MonthCalendar events={events} weekendDays={policy.weekendDays} today={today} />
      </Card>

      <Card title="Leave history" action={
        <div className="flex gap-2">
          <SelectField label="Type" className="w-28" value={fType} onChange={setFType} options={['All', ...TYPES] as const} />
          <SelectField label="Status" className="w-32" value={fStatus} onChange={setFStatus} options={['All', ...STATUSES] as const} />
        </div>
      }>
        {rows.length === 0 ? (
          <EmptyState title={data.leaves.length ? 'No leave matches these filters' : 'No leave recorded yet'} action={!data.leaves.length && <Button size="sm" onClick={() => setEditing(blank())}>Add leave</Button>}>
            {!data.leaves.length && 'Record leave you have taken, approved leave, pending requests and plans.'}
          </EmptyState>
        ) : (
          <Table caption="Leave history">
            <thead><tr><th className={th}>Dates</th><th className={th}>Type</th><th className={th}>Status</th><th className={th}>Days</th><th className={th}>Notes</th><th className={th}><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {rows.map((l) => (
                <tr key={l.id}>
                  <td className={td}>
                    <div className="font-medium text-navy-900">{fmtDate(l.startDate)}{l.endDate !== l.startDate && <> – {fmtDate(l.endDate)}</>}</div>
                    {l.status === 'Planned' && <div className="text-xs text-slate-500">Request by {fmtDate(requestDeadline(l, policy))}</div>}
                  </td>
                  <td className={td}>{l.type} {l.forWedding && <Badge tone="gold">Wedding</Badge>}</td>
                  <td className={td}><StatusBadge status={l.status} /></td>
                  <td className={`${td} tabular-nums`}>{l.days}</td>
                  <td className={`${td} max-w-xs text-slate-600`}>{l.notes}</td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(l)} aria-label={`Edit leave from ${l.startDate}`}>Edit</Button>
                    <Button size="sm" variant="ghost" className="text-red-700" aria-label={`Delete leave from ${l.startDate}`} onClick={() => confirm('Delete this leave record?') && update((d) => { d.leaves = d.leaves.filter((x) => x.id !== l.id) })}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Company leave policy" subtitle="Record what HR has confirmed. Nothing is assumed about carryover or payout.">
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField label="Leave year starts in" value={String(policy.leaveYearStartMonth)} onChange={(v) => setP('leaveYearStartMonth', Number(v))} options={MONTH_NAMES.map((m, i) => ({ value: String(i + 1), label: m }))} />
            <NumberField label="Annual leave entitlement (days)" value={policy.annualEntitlement} onChange={(v) => setP('annualEntitlement', v)} max={366} />
            <NumberField label="Carryover from last year (days)" value={policy.carryover} onChange={(v) => setP('carryover', v)} max={366} />
            <div className="pt-6"><Checkbox label="HR confirmed this carryover" hint="Only confirmed carryover is added to your balance." checked={policy.carryoverConfirmedByHr} onChange={(v) => setP('carryoverConfirmedByHr', v)} /></div>
            <NumberField label="Annual leave used before tracking" value={policy.usedBeforeTracking} onChange={(v) => setP('usedBeforeTracking', v)} max={366} hint="This leave year, before you started using this planner." />
            <NumberField label="Sick leave entitlement (days)" value={policy.sickEntitlement} onChange={(v) => setP('sickEntitlement', v)} max={366} />
            <NumberField label="Leave request notice (days before)" value={policy.requestNoticeDays} onChange={(v) => setP('requestNoticeDays', v)} max={180} allowDecimal={false} />
            <SelectField<ExitLeavePolicy> label="Unused leave when you leave" value={policy.exitLeavePolicy} onChange={(v) => setP('exitLeavePolicy', v)} options={['Not confirmed', 'Paid out', 'Lost', 'Can be used during notice', 'Other']} />
          </div>
          <fieldset className="mt-4">
            <legend className="text-sm font-medium text-navy-800">Weekend days</legend>
            <div className="mt-2 flex flex-wrap gap-3">
              {DAY_NAMES.map((n, i) => (
                <Checkbox key={n} label={n} checked={policy.weekendDays.includes(i)} onChange={(v) => setP('weekendDays', v ? [...policy.weekendDays, i].sort() : policy.weekendDays.filter((x) => x !== i))} />
              ))}
            </div>
          </fieldset>
          <TextArea className="mt-4" label="HR policy notes" value={policy.hrPolicyNotes} onChange={(v) => setP('hrPolicyNotes', v)} hint="E.g. 'Leave can't be used during notice period — confirmed by HR on 3 Nov.'" />
        </Card>

        <Card title="Company holidays" subtitle="Holidays are not counted as leave days.">
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <DateField label="Date" value={hol.date} onChange={(v) => setHol({ ...hol, date: v })} />
            <TextField label="Holiday name" value={hol.name} onChange={(v) => setHol({ ...hol, name: v })} />
            <Button onClick={addHoliday}>Add</Button>
          </div>
          {holErr && <p className="mt-2 text-xs font-medium text-red-700" role="alert">{holErr}</p>}
          <ul className="mt-4 divide-y divide-cream-200">
            {policy.holidays.length === 0 && <li className="py-3 text-sm text-slate-500">No holidays added.</li>}
            {policy.holidays.map((h) => (
              <li key={h.id} className="flex items-center justify-between py-2 text-sm">
                <span><span className="font-medium text-navy-900">{h.name}</span> <span className="text-slate-500">· {fmtDate(h.date, true)}</span></span>
                <Button size="sm" variant="ghost" className="text-red-700" aria-label={`Delete holiday ${h.name}`} onClick={() => update((d) => { d.leavePolicy.holidays = d.leavePolicy.holidays.filter((x) => x.id !== h.id) })}>Delete</Button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {editing && <LeaveModal entry={editing} onClose={() => setEditing(null)} />}
    </div>
  )
}

function estimateProRata(annual: number, start: string, end: string): number {
  if (!isValidISO(start) || !isValidISO(end) || end < start) return 0
  const [sy, sm] = start.split('-').map(Number)
  const [ey, em] = end.split('-').map(Number)
  const months = (ey - sy) * 12 + (em - sm) + 1
  return Math.round(((annual * Math.min(12, months)) / 12) * 2) / 2
}

function LeaveModal({ entry, onClose }: { entry: LeaveEntry; onClose: () => void }) {
  const { data, leave } = usePlanner()
  const update = useUpdate()
  const [l, setL] = useState<LeaveEntry>({ ...entry })
  const [err, setErr] = useState<Record<string, string>>({})
  const single = !l.endDate || l.endDate === l.startDate
  const count = isValidISO(l.startDate) ? countLeaveDays({ ...l, endDate: l.endDate || l.startDate }, data.leavePolicy) : 0
  const save = () => {
    const e: Record<string, string> = {}
    if (!isValidISO(l.startDate)) e.start = 'Choose a start date.'
    if (l.endDate && isValidISO(l.startDate) && l.endDate < l.startDate) e.end = 'End date must be on or after the start date.'
    if (!e.start && !e.end && count === 0) e.start = 'These dates are all weekends or holidays, so no leave is needed.'
    setErr(e)
    if (Object.keys(e).length) return
    const clean = { ...l, endDate: l.endDate || l.startDate, endHalf: single ? false : l.endHalf }
    update((d) => {
      if (clean.id) d.leaves = d.leaves.map((x) => (x.id === clean.id ? clean : x))
      else d.leaves.push({ ...clean, id: uid() })
    })
    onClose()
  }
  const wouldGoNegative = l.type === 'Annual' && !entry.id && ['Planned', 'Pending', 'Approved', 'Taken'].includes(l.status) && leave.projected - count < 0
  return (
    <Modal open title={entry.id ? 'Edit leave' : 'Add leave'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save leave</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField<LeaveType> label="Leave type" value={l.type} onChange={(v) => setL({ ...l, type: v })} options={TYPES} />
        <SelectField<LeaveStatus> label="Status" value={l.status} onChange={(v) => setL({ ...l, status: v })} options={STATUSES} hint="Planned = not requested yet." />
        <DateField label="Start date" value={l.startDate} onChange={(v) => setL({ ...l, startDate: v })} error={err.start} required />
        <DateField label="End date" value={l.endDate} onChange={(v) => setL({ ...l, endDate: v })} error={err.end} min={l.startDate || undefined} hint="Leave empty for one day." />
        <Checkbox label={single ? 'Half day' : 'First day is a half day'} checked={l.startHalf} onChange={(v) => setL({ ...l, startHalf: v })} />
        {!single && <Checkbox label="Last day is a half day" checked={l.endHalf} onChange={(v) => setL({ ...l, endHalf: v })} />}
        <div className="sm:col-span-2"><Checkbox label="This leave is for wedding preparation" checked={l.forWedding} onChange={(v) => setL({ ...l, forWedding: v })} /></div>
        <TextArea className="sm:col-span-2" label="Notes" value={l.notes} onChange={(v) => setL({ ...l, notes: v })} rows={2} />
      </div>
      <div className="mt-4 rounded-lg bg-cream-100 px-3 py-2 text-sm text-navy-800" aria-live="polite">
        Working days counted: <strong>{count}</strong>
      </div>
      {wouldGoNegative && <div className="mt-2"><Alert level="warning">This would take your projected annual leave balance below zero.</Alert></div>}
    </Modal>
  )
}
