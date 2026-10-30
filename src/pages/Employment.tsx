import { useState } from 'react'
import { Building2, MapPin, Trash2, Pencil } from 'lucide-react'
import { usePlanner } from '../lib/usePlanner'
import { useUpdate } from '../lib/store'
import { daysUntil, fmtDate, relativeDays } from '../lib/dates'
import { money, uid } from '../lib/format'
import type { Employment as Emp, HrContact } from '../lib/types'
import { Alert, Button, Card, DateField, EmptyState, Modal, NumberField, PageHeader, Progress, Stat, Table, TextArea, TextField, td, th } from '../components/ui'
import { MilestoneList } from '../components/Milestones'

export default function Employment() {
  const { data, emp, today } = usePlanner()
  const update = useUpdate()
  const e = data.employment
  const set = <K extends keyof Emp>(k: K, v: Emp[K]) => update((d) => { d.employment[k] = v })
  const [contact, setContact] = useState<HrContact | null>(null)
  const started = e.joiningDate && e.joiningDate <= today
  const toLast = e.targetLastDay ? daysUntil(e.targetLastDay, today) : null
  const toJoin = e.joiningDate ? daysUntil(e.joiningDate, today) : null
  const dateErr = e.joiningDate && e.targetLastDay && e.targetLastDay <= e.joiningDate ? 'Must be after your joining date.' : undefined

  return (
    <div className="space-y-6">
      <PageHeader
        title="Job & Employment"
        subtitle={<span className="flex flex-wrap items-center gap-x-3 gap-y-1"><span className="flex items-center gap-1"><Building2 className="h-4 w-4" aria-hidden />{e.company || 'Company not set'}</span><span>{e.designation}</span><span className="flex items-center gap-1"><MapPin className="h-4 w-4" aria-hidden />{e.location}</span></span>}
      />

      <Card title="Employment journey" subtitle={started ? `Day ${emp.daysEmployed} of ${emp.employmentTotalDays} until your planned last working day` : toJoin !== null ? `You join in ${toJoin} day(s) — ${fmtDate(e.joiningDate, true)}` : 'Add your joining date'}>
        <Progress value={emp.employmentProgress} tone="navy" label="Employment progress to planned last working day" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Joining date" value={fmtDate(e.joiningDate)} sub={toJoin !== null && toJoin > 0 ? relativeDays(toJoin) : 'Started'} />
          <Stat label="Probation completion (estimate)" value={fmtDate(emp.probationEnd)} sub="Subject to HR confirmation" />
          <Stat label="Planned last working day" value={fmtDate(e.targetLastDay)} sub={toLast !== null ? `${relativeDays(toLast)} · tentative` : undefined} />
          <Stat label="One-year anniversary" value={fmtDate(emp.oneYear)} sub={emp.oneYear && e.targetLastDay && e.targetLastDay < emp.oneYear ? 'After your planned last day' : undefined} tone={emp.oneYear && e.targetLastDay < emp.oneYear ? 'amber' : undefined} />
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Employment details">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField className="sm:col-span-2" label="Company" value={e.company} onChange={(v) => set('company', v)} />
            <TextField label="Designation" value={e.designation} onChange={(v) => set('designation', v)} />
            <TextField label="Work location" value={e.location} onChange={(v) => set('location', v)} />
            <DateField label="Joining date" value={e.joiningDate} onChange={(v) => set('joiningDate', v)} />
            <DateField label="Target last working day (tentative)" value={e.targetLastDay} onChange={(v) => set('targetLastDay', v)} error={dateErr} />
            <NumberField label="Minimum employment commitment (months)" value={e.minTenureMonths} onChange={(v) => set('minTenureMonths', v)} min={0} max={120} allowDecimal={false} />
            <NumberField label="Probation period (days)" value={e.probationDays} onChange={(v) => set('probationDays', v)} min={0} max={730} allowDecimal={false} />
          </div>
        </Card>

        <Card title="Salary (from my Employment Agreement)" subtitle="Take-home salary is used for budgeting. Change it if your payslip differs.">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="Monthly take-home salary" prefix="₹" value={e.takeHomeMonthly} onChange={(v) => set('takeHomeMonthly', v)} />
            <NumberField label="Monthly gross salary" prefix="₹" value={e.grossMonthly} onChange={(v) => set('grossMonthly', v)} />
            <NumberField label="Monthly salary CTC" prefix="₹" value={e.ctcMonthly} onChange={(v) => set('ctcMonthly', v)} />
            <NumberField label="Gross CTC" prefix="₹" value={e.grossCtc} onChange={(v) => set('grossCtc', v)} />
            <NumberField label="Salary paid on or before day" value={e.salaryDueDay} onChange={(v) => set('salaryDueDay', v)} min={1} max={31} allowDecimal={false} hint="Day of each month (your agreement: the 5th)." />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Stat label="Take-home" value={money(e.takeHomeMonthly, true)} />
            <Stat label="Deductions (gross − take-home)" value={money(Math.max(0, e.grossMonthly - e.takeHomeMonthly), true)} />
          </div>
        </Card>
      </div>

      {emp.notices.filter((n) => n.level !== 'ok').length > 0 && (
        <div className="space-y-2">{emp.notices.filter((n) => n.level === 'warning' || n.level === 'info').map((n, i) => <Alert key={i} level={n.level}>{n.text}</Alert>)}</div>
      )}

      <Card title="Employment timeline" subtitle="All dates are calculated from your details. Edit any date when HR confirms it.">
        <MilestoneList items={emp.milestones} today={today} />
      </Card>

      <Card title="HR contacts" action={<Button size="sm" onClick={() => setContact({ id: '', name: '', role: '', email: '', phone: '' })}>Add contact</Button>}>
        {e.hrContacts.length === 0 ? (
          <EmptyState title="No HR contacts yet">Save the people you need for probation confirmation, leave and exit questions.</EmptyState>
        ) : (
          <Table caption="HR contacts">
            <thead><tr><th className={th}>Name</th><th className={th}>Role</th><th className={th}>Email</th><th className={th}>Phone</th><th className={th}><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {e.hrContacts.map((c) => (
                <tr key={c.id}>
                  <td className={td}>{c.name}</td>
                  <td className={td}>{c.role}</td>
                  <td className={td}>{c.email && <a className="text-navy-600 hover:underline" href={`mailto:${c.email}`}>{c.email}</a>}</td>
                  <td className={td}>{c.phone && <a className="text-navy-600 hover:underline" href={`tel:${c.phone}`}>{c.phone}</a>}</td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    <Button size="sm" variant="ghost" onClick={() => setContact(c)} aria-label={`Edit ${c.name}`}><Pencil className="h-3.5 w-3.5" aria-hidden /></Button>
                    <Button size="sm" variant="ghost" className="text-red-700" aria-label={`Delete ${c.name}`} onClick={() => confirm(`Delete ${c.name}?`) && update((d) => { d.employment.hrContacts = d.employment.hrContacts.filter((x) => x.id !== c.id) })}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card title="Notes">
        <TextArea label="Employment notes" value={e.notes} onChange={(v) => set('notes', v)} rows={5} hint="For example: what HR said about probation, leave or resignation." />
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
      if (c.id) d.employment.hrContacts = d.employment.hrContacts.map((x) => (x.id === c.id ? c : x))
      else d.employment.hrContacts.push({ ...c, id: uid() })
    })
    onClose()
  }
  return (
    <Modal open title={contact.id ? 'Edit contact' : 'Add contact'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Name" value={c.name} onChange={(v) => setC({ ...c, name: v })} error={err.name} required />
        <TextField label="Role" value={c.role} onChange={(v) => setC({ ...c, role: v })} placeholder="HR Executive" />
        <TextField label="Email" type="email" value={c.email} onChange={(v) => setC({ ...c, email: v })} error={err.email} />
        <TextField label="Phone" type="tel" value={c.phone} onChange={(v) => setC({ ...c, phone: v })} />
      </div>
    </Modal>
  )
}
