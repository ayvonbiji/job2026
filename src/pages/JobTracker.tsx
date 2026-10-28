import { useState } from 'react'
import { usePlanner } from '../lib/usePlanner'
import { useUpdate } from '../lib/store'
import { daysUntil, fmtDate, relativeDays } from '../lib/dates'
import { uid } from '../lib/format'
import type { HrContact, Job, MilestoneStatus, ProbationStatus } from '../lib/types'
import { Alert, Button, Card, DateField, EmptyState, Modal, NumberField, PageHeader, SelectField, Stat, StatusBadge, Table, TextArea, TextField, td, th } from '../components/ui'

export default function JobTracker() {
  const { data, job, today } = usePlanner()
  const update = useUpdate()
  const j = data.job
  const set = <K extends keyof Job>(k: K, v: Job[K]) => update((d) => { d.job[k] = v })
  const [contact, setContact] = useState<HrContact | null>(null)

  const countdown = (date: string) => (date ? relativeDays(daysUntil(date, today)) : 'Needs a start date')

  return (
    <div className="space-y-6">
      <PageHeader title="Job Tracker" subtitle="Training, probation, notice period and exit plan. Dates use calendar months." />

      {job.notices.length > 0 && (
        <div className="space-y-2" aria-label="Job plan checks">
          {job.notices.map((n, i) => <Alert key={i} level={n.level}>{n.text}</Alert>)}
        </div>
      )}

      <Card title="Exit plan summary">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Latest safe resignation date" value={fmtDate(job.latestResignation)} sub={job.latestResignation ? countdown(job.latestResignation) : undefined} tone={job.latestResignation && job.latestResignation < today ? 'red' : undefined} />
          <Stat label={job.resignationIsPlanned ? 'Planned resignation' : 'Resignation (using latest safe date)'} value={fmtDate(job.resignationDate)} sub={job.resignationDate ? countdown(job.resignationDate) : undefined} />
          <Stat label="Calculated last working day" value={fmtDate(job.lastWorkingDay)} sub={`Target: ${fmtDate(j.targetLastDay)}`} tone={job.lastWorkingDay && job.lastWorkingDay > j.targetLastDay ? 'red' : undefined} />
          <Stat label="Wedding" value={fmtDate(data.profile.weddingDate)} sub={countdown(data.profile.weddingDate)} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Job details">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Company name" value={j.company} onChange={(v) => set('company', v)} />
            <TextField label="Job title" value={j.title} onChange={(v) => set('title', v)} />
            <DateField label="Joining date" value={j.joiningDate} onChange={(v) => set('joiningDate', v)} />
            <NumberField label="Salary per month (take-home)" prefix="₹" value={j.salaryMonthly} onChange={(v) => set('salaryMonthly', v)} hint="Used for expected income and savings planning." />
          </div>
        </Card>

        <Card title="Notice period and exit">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="Notice period (months)" value={j.noticeMonths} onChange={(v) => set('noticeMonths', v)} min={0} max={12} allowDecimal={false} />
            <NumberField label="Notice during probation (days)" value={j.noticeDuringProbationDays} onChange={(v) => set('noticeDuringProbationDays', v)} min={0} max={365} allowDecimal={false} hint="0 if your contract does not say." />
            <SelectField
              className="sm:col-span-2"
              label="How notice is counted"
              value={j.noticeCounting}
              onChange={(v) => set('noticeCounting', v)}
              options={[
                { value: 'dayBefore', label: 'Ends the day before the same date (1 May → 31 Jul)' },
                { value: 'sameDate', label: 'Ends on the same date (1 May → 1 Aug)' },
              ]}
              hint="Check your contract or ask HR which applies."
            />
            <DateField label="Target last working day" value={j.targetLastDay} onChange={(v) => set('targetLastDay', v)} />
            <div>
              <DateField label="Planned resignation date" value={j.plannedResignationDate} onChange={(v) => set('plannedResignationDate', v)} hint="Leave empty to use the latest safe date." />
              <div className="mt-2 flex gap-2">
                {job.latestResignation && <Button size="sm" variant="secondary" onClick={() => set('plannedResignationDate', job.latestResignation)}>Use {fmtDate(job.latestResignation)}</Button>}
                {j.plannedResignationDate && <Button size="sm" variant="ghost" onClick={() => set('plannedResignationDate', '')}>Clear</Button>}
              </div>
            </div>
          </div>
        </Card>

        <Card title="Training" subtitle="Training completion is tracked separately from probation." action={<StatusBadge status={j.trainingStatus} />}>
          <div className="grid gap-4 sm:grid-cols-2">
            <DateField label="Training start date" value={j.trainingStart} onChange={(v) => set('trainingStart', v)} hint="Leave empty to use your joining date." />
            <NumberField label="Training length (months)" value={j.trainingMonths} onChange={(v) => set('trainingMonths', v)} min={0} max={24} allowDecimal={false} />
            <SelectField<MilestoneStatus> label="Training status" value={j.trainingStatus} onChange={(v) => set('trainingStatus', v)} options={['Not started', 'In progress', 'Completed', 'Extended']} />
            <DateField label="Actual completion date" value={j.trainingCompletedOn} onChange={(v) => set('trainingCompletedOn', v)} />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Stat label="Expected completion" value={fmtDate(job.trainingEnd)} sub={job.trainingEnd ? countdown(job.trainingEnd) : 'Add a start date'} />
            <Stat label="Started" value={fmtDate(job.trainingStart)} />
          </div>
        </Card>

        <Card title="Probation" action={<StatusBadge status={j.probationStatus} />}>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Probation starts"
              value={j.probationStartMode}
              onChange={(v) => set('probationStartMode', v)}
              options={[
                { value: 'joining', label: 'On my joining date' },
                { value: 'afterTraining', label: 'After training ends' },
                { value: 'custom', label: 'On a specific date' },
              ]}
            />
            {j.probationStartMode === 'custom' ? (
              <DateField label="Probation start date" value={j.probationStart} onChange={(v) => set('probationStart', v)} />
            ) : (
              <div />
            )}
            <NumberField label="Probation length (months)" value={j.probationMonths} onChange={(v) => set('probationMonths', v)} min={0} max={24} allowDecimal={false} />
            <SelectField<ProbationStatus> label="Confirmation status" value={j.probationStatus} onChange={(v) => set('probationStatus', v)} options={['Not started', 'In progress', 'Confirmed', 'Extended', 'Not confirmed']} />
            <DateField label="Confirmation letter date" value={j.probationConfirmedOn} onChange={(v) => set('probationConfirmedOn', v)} />
            <DateField label="Contract review date" value={j.contractReviewDate} onChange={(v) => set('contractReviewDate', v)} hint="Empty = 2 weeks before probation ends." />
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <Stat label="Probation starts" value={fmtDate(job.probationStart)} />
            <Stat label="Expected confirmation" value={fmtDate(job.probationEnd)} sub={job.probationEnd ? countdown(job.probationEnd) : undefined} />
          </div>
        </Card>
      </div>

      <Card title="HR contacts" action={<Button size="sm" onClick={() => setContact({ id: '', name: '', role: '', email: '', phone: '' })}>Add contact</Button>}>
        {j.hrContacts.length === 0 ? (
          <EmptyState title="No HR contacts yet">Save the people you need for confirmation, leave and exit questions.</EmptyState>
        ) : (
          <Table caption="HR contacts">
            <thead><tr><th className={th}>Name</th><th className={th}>Role</th><th className={th}>Email</th><th className={th}>Phone</th><th className={th}><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {j.hrContacts.map((c) => (
                <tr key={c.id}>
                  <td className={td}>{c.name}</td>
                  <td className={td}>{c.role}</td>
                  <td className={td}>{c.email && <a className="text-navy-600 hover:underline" href={`mailto:${c.email}`}>{c.email}</a>}</td>
                  <td className={td}>{c.phone && <a className="text-navy-600 hover:underline" href={`tel:${c.phone}`}>{c.phone}</a>}</td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    <Button size="sm" variant="ghost" onClick={() => setContact(c)} aria-label={`Edit ${c.name}`}>Edit</Button>
                    <Button size="sm" variant="ghost" className="text-red-700" aria-label={`Delete ${c.name}`} onClick={() => confirm(`Delete ${c.name}?`) && update((d) => { d.job.hrContacts = d.job.hrContacts.filter((x) => x.id !== c.id) })}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card title="Notes">
        <TextArea label="Job and HR notes" value={j.notes} onChange={(v) => set('notes', v)} rows={5} hint="For example: what HR said about notice buyout, leave encashment, or relieving letter." />
      </Card>

      {contact && <ContactModal contact={contact} onClose={() => setContact(null)} />}
    </div>
  )
}

function ContactModal({ contact, onClose }: { contact: HrContact; onClose: () => void }) {
  const update = useUpdate()
  const [c, setC] = useState(contact)
  const [err, setErr] = useState<Record<string, string>>({})
  const save = () => {
    const e: Record<string, string> = {}
    if (!c.name.trim()) e.name = 'Enter a name.'
    if (c.email && !/^\S+@\S+\.\S+$/.test(c.email)) e.email = 'Enter a valid email address.'
    setErr(e)
    if (Object.keys(e).length) return
    update((d) => {
      if (c.id) d.job.hrContacts = d.job.hrContacts.map((x) => (x.id === c.id ? c : x))
      else d.job.hrContacts.push({ ...c, id: uid() })
    })
    onClose()
  }
  return (
    <Modal open title={contact.id ? 'Edit contact' : 'Add contact'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Name" value={c.name} onChange={(v) => setC({ ...c, name: v })} error={err.name} required />
        <TextField label="Role" value={c.role} onChange={(v) => setC({ ...c, role: v })} placeholder="HR Business Partner" />
        <TextField label="Email" type="email" value={c.email} onChange={(v) => setC({ ...c, email: v })} error={err.email} />
        <TextField label="Phone" type="tel" value={c.phone} onChange={(v) => setC({ ...c, phone: v })} />
      </div>
    </Modal>
  )
}
