import { Fragment, useState } from 'react'
import { Link } from 'react-router-dom'
import { usePlanner } from '../lib/usePlanner'
import { useUpdate } from '../lib/store'
import { fmtDate, isValidISO } from '../lib/dates'
import { money, pct, uid } from '../lib/format'
import { downloadCSV } from '../lib/csv'
import type { WeddingCategory } from '../lib/types'
import { Alert, Badge, Button, Card, DateField, EmptyState, Modal, NumberField, PageHeader, Progress, Stat, StatusBadge, Table, TextArea, TextField, td, th } from '../components/ui'
import { PlannedPaidChart } from '../components/Charts'
import { TransactionModal, newTx } from './MoneyTracker'
import type { Transaction } from '../lib/types'

export default function WeddingBudget() {
  const { data, wedding, today } = usePlanner()
  const update = useUpdate()
  const [edit, setEdit] = useState<WeddingCategory | null>(null)
  const [pay, setPay] = useState<Transaction | null>(null)
  const [open, setOpen] = useState<string | null>(null)

  const overspent = wedding.categoriesTotal > wedding.target && data.wedding.personalTotal > 0
  const overdue = wedding.categories.filter((c) => c.overdue)
  const chartData = wedding.categories.filter((c) => c.planned > 0 || c.paid > 0).map((c) => ({ name: c.name.length > 24 ? c.name.slice(0, 22) + '…' : c.name, planned: c.planned, paid: c.paid }))
  const defaultAccount = data.accounts.find((a) => a.purpose === 'wedding')?.id ?? data.accounts[0]?.id ?? ''

  const exportCSV = () =>
    downloadCSV(`wedding-budget-${today}.csv`, ['Category', 'Planned (INR)', 'Paid (INR)', 'Remaining (INR)', 'Due date', 'Status', 'Notes', 'Receipts'], wedding.categories.map((c) => [c.name, c.planned, c.paid, c.remaining, c.dueDate, c.status, c.notes, c.receipts]))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Our Wedding 2027 – My Contribution"
        subtitle={<>Only my personal share of the wedding on {fmtDate(data.profile.weddingDate, true)}. It is not combined with my partner’s or family’s money.</>}
        actions={<><Button variant="secondary" onClick={exportCSV}>Export CSV</Button><Button onClick={() => setEdit({ id: '', name: '', planned: 0, dueDate: '', notes: '', receipts: '' })}>Add category</Button></>}
      />

      <Card title="Budget">
        <div className="grid gap-4 sm:grid-cols-2">
          <NumberField label="My total personal wedding budget" prefix="₹" value={data.wedding.personalTotal} onChange={(v) => update((d) => { d.wedding.personalTotal = v })} hint={data.wedding.personalTotal === 0 ? `Not set — using the total of your categories (${money(wedding.categoriesTotal)}).` : `Categories add up to ${money(wedding.categoriesTotal)}.`} />
          <NumberField label="Overall shared wedding budget (for reference)" prefix="₹" value={data.wedding.overallSharedBudget} onChange={(v) => update((d) => { d.wedding.overallSharedBudget = v })} hint="Not used in your calculations." />
        </div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <Stat label="My total wedding budget" value={money(wedding.target)} />
          <Stat label="Total paid" value={money(wedding.paid)} />
          <Stat label="Unpaid commitments" value={money(wedding.unpaidCommitments)} sub="Planned − paid, by category" />
          <Stat label="Wedding savings available" value={money(wedding.saved)} sub="In wedding savings accounts" />
          <Stat label="Remaining savings required" value={money(wedding.remainingToSave)} tone={wedding.target > 0 && wedding.remainingToSave === 0 ? 'green' : undefined} sub="Budget − paid − saved" />
          <Stat label="Budget completion" value={pct(wedding.budgetCompletion)} sub={`Paid ÷ budget · funded ${pct(wedding.progress)}`} />
        </div>
        <div className="mt-4"><Progress value={wedding.funded} max={wedding.target} tone="gold" label="Wedding savings progress" showLabel={false} /></div>
        <p className="mt-2 text-xs text-slate-500">
          A payment is recorded once (in the Money Tracker, or with “Record payment” here) and linked to a category, so it counts as an expense and as paid — never twice. Emergency savings are never included.
        </p>
      </Card>

      {(overspent || overdue.length > 0 || wedding.unlinkedWeddingSpend > 0) && (
        <div className="space-y-2">
          {overspent && <Alert level="warning">Your categories add up to {money(wedding.categoriesTotal)}, which is {money(wedding.categoriesTotal - wedding.target)} more than your personal budget of {money(wedding.target)}.</Alert>}
          {overdue.map((c) => <Alert key={c.id} level="danger">{c.name}: {money(c.remaining)} was due on {fmtDate(c.dueDate)}.</Alert>)}
          {wedding.unlinkedWeddingSpend > 0 && <Alert level="info">{money(wedding.unlinkedWeddingSpend)} of “Wedding expenses” in the Money Tracker is not linked to a category, so it isn't counted as paid here. <Link to="/money" className="underline">Link those transactions</Link>.</Alert>}
        </div>
      )}

      {chartData.length > 0 && (
        <Card title="Planned vs paid">
          <PlannedPaidChart data={chartData} />
        </Card>
      )}

      <Card title="Categories" subtitle="Edit names, budgets, due dates and notes. Use “Record payment” to add a linked expense.">
        {wedding.categories.length === 0 ? (
          <EmptyState title="No categories" action={<Button size="sm" onClick={() => setEdit({ id: '', name: '', planned: 0, dueDate: '', notes: '', receipts: '' })}>Add category</Button>} />
        ) : (
          <Table caption="Wedding budget categories">
            <thead>
              <tr>
                <th className={th}>Category</th><th className={`${th} text-right`}>Planned</th><th className={`${th} text-right`}>Paid</th><th className={`${th} text-right`}>Remaining</th><th className={th}>Due</th><th className={th}>Status</th><th className={th}><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {wedding.categories.map((c) => {
                const payments = data.transactions.filter((t) => t.weddingCategoryId === c.id).sort((a, b) => (a.date < b.date ? -1 : 1))
                return (
                  <Fragment key={c.id}>
                    <tr>
                      <td className={td}>
                        <div className="font-medium text-navy-900">{c.name}</div>
                        {c.notes && <div className="text-xs text-slate-500">{c.notes}</div>}
                        {c.receipts && <div className="text-xs text-slate-500">Receipts: {c.receipts}</div>}
                        {c.scheduled > 0 && <div className="text-xs text-amber-700">{money(c.scheduled)} scheduled</div>}
                      </td>
                      <td className={`${td} text-right tabular-nums`}>{money(c.planned)}</td>
                      <td className={`${td} text-right tabular-nums`}>{money(c.paid)}</td>
                      <td className={`${td} text-right tabular-nums ${c.paid > c.planned && c.planned > 0 ? 'text-red-700' : ''}`}>{c.paid > c.planned && c.planned > 0 ? `Over by ${money(c.paid - c.planned)}` : money(c.remaining)}</td>
                      <td className={`${td} whitespace-nowrap`}>{c.dueDate ? fmtDate(c.dueDate) : '—'}{c.overdue && <div><Badge tone="red">! Overdue</Badge></div>}</td>
                      <td className={td}><StatusBadge status={c.status} /></td>
                      <td className={`${td} whitespace-nowrap text-right`}>
                        <Button size="sm" variant="secondary" onClick={() => setPay(newTx(today, defaultAccount, { weddingCategoryId: c.id, category: 'Wedding expenses', amount: c.remaining }))}>Record payment</Button>
                        <Button size="sm" variant="ghost" aria-expanded={open === c.id} onClick={() => setOpen(open === c.id ? null : c.id)}>Payments ({payments.length})</Button>
                        <Button size="sm" variant="ghost" onClick={() => setEdit(c)} aria-label={`Edit ${c.name}`}>Edit</Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-700"
                          aria-label={`Delete ${c.name}`}
                          onClick={() => {
                            const msg = payments.length ? `Delete "${c.name}"? Its ${payments.length} payment(s) stay in the Money Tracker but will no longer be linked to the wedding budget.` : `Delete "${c.name}"?`
                            if (confirm(msg))
                              update((d) => {
                                d.wedding.categories = d.wedding.categories.filter((x) => x.id !== c.id)
                                d.transactions.forEach((t) => { if (t.weddingCategoryId === c.id) t.weddingCategoryId = '' })
                              })
                          }}
                        >
                          Delete
                        </Button>
                      </td>
                    </tr>
                    {open === c.id && (
                      <tr>
                        <td colSpan={7} className="bg-cream-50 px-4 py-3">
                          {payments.length === 0 ? (
                            <p className="text-sm text-slate-500">No payments linked yet.</p>
                          ) : (
                            <ul className="space-y-1 text-sm">
                              {payments.map((t) => (
                                <li key={t.id} className="flex flex-wrap items-center justify-between gap-2">
                                  <span>{fmtDate(t.date)} · {money(t.amount, true)} {t.date > today && <Badge tone="amber">Scheduled</Badge>} {t.notes && <span className="text-slate-500">· {t.notes}</span>}</span>
                                  <Button size="sm" variant="ghost" onClick={() => setPay(t)}>Edit</Button>
                                </li>
                              ))}
                            </ul>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                )
              })}
              <tr className="font-semibold">
                <td className={td}>Total</td>
                <td className={`${td} text-right tabular-nums`}>{money(wedding.categoriesTotal)}</td>
                <td className={`${td} text-right tabular-nums`}>{money(wedding.paid)}</td>
                <td className={`${td} text-right tabular-nums`}>{money(wedding.categories.reduce((s, c) => s + c.remaining, 0))}</td>
                <td className={td} colSpan={3} />
              </tr>
            </tbody>
          </Table>
        )}
      </Card>

      {edit && <CategoryModal cat={edit} onClose={() => setEdit(null)} />}
      {pay && <TransactionModal tx={pay} onClose={() => setPay(null)} />}
    </div>
  )
}

function CategoryModal({ cat, onClose }: { cat: WeddingCategory; onClose: () => void }) {
  const update = useUpdate()
  const [c, setC] = useState(cat)
  const [err, setErr] = useState<Record<string, string>>({})
  const save = () => {
    const e: Record<string, string> = {}
    if (!c.name.trim()) e.name = 'Enter a category name.'
    if (c.dueDate && !isValidISO(c.dueDate)) e.due = 'Enter a valid date.'
    setErr(e)
    if (Object.keys(e).length) return
    update((d) => {
      const clean = { ...c, name: c.name.trim() }
      if (clean.id) d.wedding.categories = d.wedding.categories.map((x) => (x.id === clean.id ? clean : x))
      else d.wedding.categories.push({ ...clean, id: uid() })
    })
    onClose()
  }
  return (
    <Modal open title={cat.id ? 'Edit category' : 'Add category'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField className="sm:col-span-2" label="Category name" value={c.name} onChange={(v) => setC({ ...c, name: v })} error={err.name} required />
        <NumberField label="Planned budget" prefix="₹" value={c.planned} onChange={(v) => setC({ ...c, planned: v })} />
        <DateField label="Payment due date" value={c.dueDate} onChange={(v) => setC({ ...c, dueDate: v })} error={err.due} />
        <TextArea className="sm:col-span-2" label="Notes" value={c.notes} onChange={(v) => setC({ ...c, notes: v })} rows={2} />
        <TextField className="sm:col-span-2" label="Receipts" value={c.receipts} onChange={(v) => setC({ ...c, receipts: v })} hint="Receipt numbers, invoice IDs or links to where you keep the files." />
      </div>
    </Modal>
  )
}
