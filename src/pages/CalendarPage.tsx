import { useState } from 'react'
import { Pencil, Repeat, Trash2 } from 'lucide-react'
import { usePlanner } from '../lib/usePlanner'
import { useUpdate } from '../lib/store'
import { addDays, addMonthKey, fmtDate, fmtMonth, monthKey } from '../lib/dates'
import { money, uid } from '../lib/format'
import { buildCalendarEvents } from '../lib/calc/reminders'
import { recurringOccurrences } from '../lib/calc/finance'
import { EXPENSE_CATEGORIES, PAYMENT_METHODS, type RecurringItem } from '../lib/types'
import { Badge, Button, Card, Checkbox, EmptyState, Modal, PageHeader, SelectField, TextField, cx } from '../components/ui'
import MonthCalendar from '../components/MonthCalendar'
import { AddReminderModal, NotificationSettings, ReminderList, downloadAllICS } from '../components/Reminders'
import { TransactionModal, newTx } from './MoneyTracker'
import type { Transaction } from '../lib/types'

export default function CalendarPage() {
  const { data, today, reminders, upcoming } = usePlanner()
  const update = useUpdate()
  const [showLeave, setShowLeave] = useState(true)
  const [showReminders, setShowReminders] = useState(true)
  const [selected, setSelected] = useState(today)
  const [tab, setTab] = useState<'soon' | 'overdue' | 'all' | 'done'>('soon')
  const [adding, setAdding] = useState(false)
  const [rec, setRec] = useState<RecurringItem | null>(null)
  const [post, setPost] = useState<Transaction | null>(null)

  const events = buildCalendarEvents(data, reminders, today, { leave: showLeave, reminders: showReminders })
  events.push({ date: data.profile.weddingDate, kind: 'wedding', label: 'Wedding day' })
  const dayEvents = events.filter((e) => e.date === selected)
  const overdue = reminders.filter((r) => !r.completed && r.date < today)
  const soon = reminders.filter((r) => !r.completed && r.date >= today && r.date <= addDays(today, 30))
  const list = tab === 'soon' ? soon : tab === 'overdue' ? overdue : tab === 'done' ? reminders.filter((r) => r.completed) : reminders.filter((r) => !r.completed && r.date >= today)
  const due = recurringOccurrences(data, addMonthKey(monthKey(today), -2), addMonthKey(monthKey(today), 1)).filter((o) => !o.posted && o.date <= addDays(today, 31))

  return (
    <div className="space-y-6">
      <PageHeader
        title="Calendar & Reminders"
        subtitle="Salary dates, rent and bills, wedding payments, savings, leave and every reminder in one place."
        actions={<><Button variant="secondary" onClick={() => downloadAllICS(reminders, today)}>Download all reminders (.ics)</Button><Button onClick={() => setAdding(true)}>Add reminder</Button></>}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
        <Card title="Financial calendar" action={<div className="flex flex-wrap gap-3"><Checkbox label="Leave" checked={showLeave} onChange={setShowLeave} /><Checkbox label="Reminders" checked={showReminders} onChange={setShowReminders} /></div>}>
          <MonthCalendar events={events} weekendDays={data.leavePolicy.dayCountRule === 'working' ? data.leavePolicy.weekendDays : [0]} today={today} onSelectDate={setSelected} selected={selected} />
        </Card>
        <div className="space-y-6">
          <Card title={fmtDate(selected, true)} subtitle="Selected day">
            {dayEvents.length === 0 ? <p className="text-sm text-slate-500">Nothing on this day.</p> : (
              <ul className="space-y-1.5 text-sm">{dayEvents.map((e, i) => <li key={i} className="flex items-start gap-2"><span aria-hidden className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-gold-500" />{e.half ? '½ ' : ''}{e.label}</li>)}</ul>
            )}
            <Button className="mt-3" size="sm" variant="secondary" onClick={() => setAdding(true)}>Add reminder on this day</Button>
          </Card>
          <Card title="Upcoming payments" subtitle="Next 45 days">
            {upcoming.length === 0 ? <p className="text-sm text-slate-500">No payments due.</p> : (
              <ul className="divide-y divide-cream-200 text-sm">
                {upcoming.map((u, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 py-2">
                    <span><span className="font-medium text-navy-900">{u.label}</span><div className={cx('text-xs', u.date < today ? 'text-red-700' : 'text-slate-500')}>{fmtDate(u.date)}{u.date < today && ' · overdue'}</div></span>
                    <span className="tabular-nums">{money(u.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card title={<span className="flex items-center gap-2"><Repeat className="h-4 w-4" aria-hidden /> Recurring payments</span>} subtitle="Rent, bills, recharges and monthly savings. They appear on the calendar; record each one when you pay it." action={<Button size="sm" onClick={() => setRec(blankRecurring(data.accounts[0]?.id ?? '', monthKey(today)))}>Add recurring</Button>}>
        {due.length > 0 && (
          <div className="mb-4 rounded-xl border border-gold-300 bg-gold-50/50 p-3">
            <h3 className="mb-2 text-sm font-semibold text-navy-900">Due to record</h3>
            <ul className="space-y-2 text-sm">
              {due.map((o) => (
                <li key={o.item.id + o.month} className="flex flex-wrap items-center justify-between gap-2">
                  <span>{o.item.description} · {fmtDate(o.date)} · {money(o.item.amount)}</span>
                  <Button size="sm" onClick={() => setPost(newTx(o.date <= today ? o.date : today, o.item.accountId, { type: o.item.type, category: o.item.category, amount: o.item.amount, description: o.item.description, paymentMethod: o.item.paymentMethod, toAccountId: o.item.toAccountId, recurringId: o.item.id, occurrence: o.month }))}>Record payment</Button>
                </li>
              ))}
            </ul>
          </div>
        )}
        {data.recurring.length === 0 ? <EmptyState title="No recurring payments">Add rent, mobile recharge or a monthly transfer to wedding savings.</EmptyState> : (
          <ul className="divide-y divide-cream-200">
            {data.recurring.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div>
                  <div className="flex items-center gap-2 font-medium text-navy-900">{r.description} {!r.active && <Badge>Paused</Badge>} {r.type === 'transfer' && <Badge tone="navy">Savings</Badge>}</div>
                  <div className="text-xs text-slate-500">{money(r.amount)} on day {r.dayOfMonth} · from {fmtMonth(r.startMonth)}{r.endMonth ? ` to ${fmtMonth(r.endMonth)}` : ''} · {r.type === 'transfer' ? 'Savings' : r.category}</div>
                </div>
                <div>
                  <Button size="sm" variant="ghost" onClick={() => setRec(r)} aria-label={`Edit ${r.description}`}><Pencil className="h-3.5 w-3.5" aria-hidden /></Button>
                  <Button size="sm" variant="ghost" className="text-red-700" aria-label={`Delete ${r.description}`} onClick={() => confirm(`Delete recurring payment "${r.description}"? Payments you already recorded are kept.`) && update((d) => { d.recurring = d.recurring.filter((x) => x.id !== r.id); d.transactions.forEach((t) => { if (t.recurringId === r.id) { t.recurringId = ''; t.occurrence = '' } }) })}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card id="reminders" title="Reminder centre" subtitle={`${overdue.length} overdue · ${soon.length} in the next 30 days`}>
        <div className="mb-3 flex flex-wrap gap-1" role="tablist" aria-label="Reminder filter">
          {([['soon', 'Next 30 days'], ['overdue', `Overdue (${overdue.length})`], ['all', 'All upcoming'], ['done', 'Completed']] as const).map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} type="button" onClick={() => setTab(k)} className={cx('rounded-full px-3 py-1 text-xs font-medium', tab === k ? 'bg-navy-800 text-white' : 'bg-cream-100 text-navy-700 hover:bg-cream-200')}>{l}</button>
          ))}
        </div>
        <ReminderList reminders={list} today={today} empty={tab === 'overdue' ? 'Nothing overdue' : 'Nothing here'} />
        <div className="mt-4 border-t border-cream-200 pt-4"><NotificationSettings /></div>
      </Card>

      <AddReminderModal open={adding} onClose={() => setAdding(false)} defaultDate={selected} />
      {rec && <RecurringModal item={rec} onClose={() => setRec(null)} />}
      {post && <TransactionModal tx={post} onClose={() => setPost(null)} />}
    </div>
  )
}

function blankRecurring(accountId: string, start: string): RecurringItem {
  return { id: '', description: '', type: 'expense', category: 'Accommodation / Rent', amount: 0, accountId, toAccountId: '', paymentMethod: 'UPI', dayOfMonth: 5, startMonth: start, endMonth: '', active: true }
}

function RecurringModal({ item, onClose }: { item: RecurringItem; onClose: () => void }) {
  const { data } = usePlanner()
  const update = useUpdate()
  const [r, setR] = useState(item)
  const [amount, setAmount] = useState(item.amount ? String(item.amount) : '')
  const [day, setDay] = useState(String(item.dayOfMonth))
  const [err, setErr] = useState<Record<string, string>>({})
  const accOpts = data.accounts.map((a) => ({ value: a.id, label: a.name }))
  const save = () => {
    const e: Record<string, string> = {}
    const n = Number(amount.replace(/,/g, ''))
    const dd = Number(day)
    if (!r.description.trim()) e.description = 'Enter a description.'
    if (!Number.isFinite(n) || n <= 0) e.amount = 'Enter an amount greater than 0.'
    if (!Number.isInteger(dd) || dd < 1 || dd > 31) e.day = 'Enter a day from 1 to 31.'
    if (!/^\d{4}-\d{2}$/.test(r.startMonth)) e.start = 'Choose a start month.'
    if (r.endMonth && r.endMonth < r.startMonth) e.end = 'End month must be after the start month.'
    if (r.type === 'transfer' && (!r.toAccountId || r.toAccountId === r.accountId)) e.to = 'Choose a different account to move money to.'
    setErr(e)
    if (Object.keys(e).length) return
    const out = { ...r, description: r.description.trim(), amount: n, dayOfMonth: dd, toAccountId: r.type === 'transfer' ? r.toAccountId : '', category: r.type === 'transfer' ? '' : r.category }
    update((d) => {
      if (out.id) d.recurring = d.recurring.map((x) => (x.id === out.id ? out : x))
      else d.recurring.push({ ...out, id: uid() })
    })
    onClose()
  }
  return (
    <Modal open title={item.id ? 'Edit recurring payment' : 'Add recurring payment'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField className="sm:col-span-2" label="Description" value={r.description} onChange={(v) => setR({ ...r, description: v })} error={err.description} placeholder="Room rent, Jio recharge, Wedding savings…" />
        <SelectField label="Type" value={r.type} onChange={(v) => setR({ ...r, type: v, toAccountId: v === 'transfer' ? data.accounts.find((a) => a.purpose === 'wedding')?.id ?? '' : '' })} options={[{ value: 'expense', label: 'Expense' }, { value: 'transfer', label: 'Savings (move to my account)' }]} />
        {r.type === 'expense' ? <SelectField label="Category" value={r.category} onChange={(v) => setR({ ...r, category: v })} options={EXPENSE_CATEGORIES.filter((c) => c !== 'Wedding expenses')} /> : <SelectField label="To account" value={r.toAccountId} onChange={(v) => setR({ ...r, toAccountId: v })} options={[{ value: '', label: 'Choose…' }, ...accOpts]} error={err.to} />}
        <TextField label="Amount (₹)" value={amount} onChange={setAmount} error={err.amount} />
        <TextField label="Day of month" value={day} onChange={setDay} error={err.day} />
        <SelectField label="From account" value={r.accountId} onChange={(v) => setR({ ...r, accountId: v })} options={accOpts} />
        <SelectField label="Payment method" value={r.paymentMethod} onChange={(v) => setR({ ...r, paymentMethod: v })} options={[{ value: '', label: 'Not specified' }, ...PAYMENT_METHODS.map((m) => ({ value: m, label: m }))]} />
        <TextField label="Start month" type="month" value={r.startMonth} onChange={(v) => setR({ ...r, startMonth: v })} error={err.start} />
        <TextField label="End month (optional)" type="month" value={r.endMonth} onChange={(v) => setR({ ...r, endMonth: v })} error={err.end} />
        <div className="sm:col-span-2"><Checkbox label="Active" checked={r.active} onChange={(v) => setR({ ...r, active: v })} /></div>
      </div>
    </Modal>
  )
}
