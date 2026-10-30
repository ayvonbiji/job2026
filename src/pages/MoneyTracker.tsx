import { useMemo, useState } from 'react'
import { ArrowDownRight, ArrowUpRight, ChevronLeft, ChevronRight, Pencil, Search, Trash2 } from 'lucide-react'
import { usePlanner } from '../lib/usePlanner'
import { useUpdate } from '../lib/store'
import { addMonthKey, fmtDate, fmtMonth, fmtMonthShort, isValidISO, monthKey } from '../lib/dates'
import { money, uid } from '../lib/format'
import { monthSummary, monthsWithData, type SalaryRow } from '../lib/calc/finance'
import { downloadCSV } from '../lib/csv'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, PAYMENT_METHODS, type ExpectedIncome, type SalaryRecord, type Transaction, type TxType } from '../lib/types'
import { Alert, Badge, Button, Card, DateField, EmptyState, Modal, NumberField, PageHeader, SelectField, Stat, Table, TextArea, TextField, cx, td, th } from '../components/ui'
import { CategoryChart, IncomeExpenseChart, SavingsBarChart } from '../components/Charts'

function Delta({ now, prev, goodWhenUp }: { now: number; prev: number; goodWhenUp: boolean }) {
  const d = now - prev
  if (Math.abs(d) < 1) return <span className="text-xs text-slate-500">Same as last month</span>
  const up = d > 0
  const good = up === goodWhenUp
  const Icon = up ? ArrowUpRight : ArrowDownRight
  return <span className={cx('inline-flex items-center gap-0.5 text-xs font-medium', good ? 'text-emerald-700' : 'text-red-700')}><Icon className="h-3.5 w-3.5" aria-hidden />{money(Math.abs(d))} {up ? 'more' : 'less'} than last month</span>
}

export default function MoneyTracker() {
  const { data, today, balances, salary } = usePlanner()
  const update = useUpdate()
  const [month, setMonth] = useState(monthKey(today))
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [salaryEdit, setSalaryEdit] = useState<SalaryRow | null>(null)
  const [expEdit, setExpEdit] = useState<ExpectedIncome | null>(null)
  const [f, setF] = useState({ scope: 'month' as 'month' | 'all', type: 'all' as 'all' | TxType, category: 'all', method: 'all', q: '' })

  const s = monthSummary(data, month, today)
  const p = monthSummary(data, addMonthKey(month, -1), today)
  const history = monthsWithData(data, today).map((m) => {
    const x = monthSummary(data, m, today)
    return { label: fmtMonthShort(m), income: x.income, expenses: x.expenses, savings: x.savings }
  })
  const cats = Array.from(new Set([...Object.keys(s.byCategory), ...Object.keys(p.byCategory)]))
  const catData = Object.entries(s.byCategory).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount)
  const available = balances.filter((b) => b.purpose === 'general').reduce((a, b) => a + b.balance, 0)
  const accName = (id: string) => data.accounts.find((a) => a.id === id)?.name ?? '—'
  const wcName = (id: string) => data.wedding.categories.find((c) => c.id === id)?.name
  const salaryThisMonth = salary.find((r) => r.payMonth === month)

  const txs = useMemo(() => {
    const q = f.q.trim().toLowerCase()
    return [...data.transactions]
      .filter((t) => (f.scope === 'all' || monthKey(t.date) === month) && (f.type === 'all' || t.type === f.type))
      .filter((t) => (f.category === 'all' || (f.category === 'Savings' ? t.type === 'transfer' : t.category === f.category)) && (f.method === 'all' || t.paymentMethod === f.method))
      .filter((t) => !q || `${t.description} ${t.notes} ${t.category}`.toLowerCase().includes(q))
      .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0))
  }, [data.transactions, f, month])

  const exportCSV = () =>
    downloadCSV(
      `transactions-${today}.csv`,
      ['Date', 'Type', 'Category', 'Description', 'Amount (INR)', 'Payment method', 'Account', 'To account', 'Wedding budget category', 'Scheduled', 'Notes'],
      [
        ...data.salaryRecords.filter((r) => r.actualAmount !== null).map((r) => [r.actualDate, 'income', 'Salary', `Salary paid ${fmtMonth(r.payMonth)}`, r.actualAmount, 'Bank transfer', accName(r.accountId), '', '', 'No', r.notes]),
        ...data.transactions.map((t) => [t.date, t.type === 'transfer' ? 'savings / transfer' : t.type, t.type === 'transfer' ? 'Savings' : t.category, t.description, t.amount, t.paymentMethod, accName(t.accountId), t.type === 'transfer' ? accName(t.toAccountId) : '', wcName(t.weddingCategoryId) ?? '', t.date > today ? 'Yes' : 'No', t.notes]),
      ].sort((a, b) => (String(a[0]) < String(b[0]) ? -1 : 1)),
    )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Money Tracker"
        subtitle="Savings = income − expenses. Money moved into your own savings accounts is not an expense."
        actions={<><Button variant="secondary" onClick={exportCSV} disabled={!data.transactions.length && !data.salaryRecords.length}>Export CSV</Button><Button onClick={() => setEditing(newTx(today, data.accounts[0]?.id ?? ''))}>Add transaction</Button></>}
      />

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setMonth(addMonthKey(month, -1))} aria-label="Previous month"><ChevronLeft className="h-4 w-4" aria-hidden /></Button>
        <h2 className="min-w-[8rem] text-center font-semibold text-navy-900" aria-live="polite">{fmtMonth(month)}</h2>
        <Button variant="secondary" size="sm" onClick={() => setMonth(addMonthKey(month, 1))} aria-label="Next month"><ChevronRight className="h-4 w-4" aria-hidden /></Button>
        {month !== monthKey(today) && <Button variant="ghost" size="sm" onClick={() => setMonth(monthKey(today))}>This month</Button>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total income" value={money(s.income)} sub={<Delta now={s.income} prev={p.income} goodWhenUp />} />
        <Stat label="Total expenses" value={money(s.expenses)} sub={<Delta now={s.expenses} prev={p.expenses} goodWhenUp={false} />} />
        <Stat label="Savings (income − expenses)" value={money(s.savings)} tone={s.savings < 0 ? 'red' : 'green'} sub={<Delta now={s.savings} prev={p.savings} goodWhenUp />} />
        <Stat label="Available balance today" value={money(available)} sub={`Everyday accounts · ${money(s.movedToSavings)} moved to savings this month`} tone={available < 0 ? 'red' : undefined} />
      </div>

      <Card title="Salary" subtitle={`Take-home ${money(data.employment.takeHomeMonthly, true)} · paid on or before the ${data.employment.salaryDueDay}th of each month for the previous month’s work.`}>
        {salary.length === 0 ? (
          <EmptyState title="No salary months yet">Add your joining date in Job & Employment.</EmptyState>
        ) : (
          <Table caption="Salary payments">
            <thead><tr><th className={th}>Paid in</th><th className={th}>Expected by</th><th className={`${th} text-right`}>Expected</th><th className={th}>Received on</th><th className={`${th} text-right`}>Received</th><th className={th}>Status</th><th className={th}><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {salary.map((r) => (
                <tr key={r.payMonth} className={r.payMonth === month ? 'bg-gold-50/50' : undefined}>
                  <td className={`${td} whitespace-nowrap font-medium`}>{fmtMonth(r.payMonth)}</td>
                  <td className={`${td} whitespace-nowrap`}>{fmtDate(r.expectedDate)}</td>
                  <td className={`${td} text-right tabular-nums`}>{money(r.expectedAmount, true)}</td>
                  <td className={`${td} whitespace-nowrap`}>{r.record?.actualDate ? fmtDate(r.record.actualDate) : '—'}</td>
                  <td className={`${td} text-right tabular-nums`}>{r.record?.actualAmount != null ? money(r.record.actualAmount, true) : '—'}</td>
                  <td className={td}><Badge tone={r.status === 'Received' ? 'green' : r.status === 'Overdue' ? 'red' : r.status === 'Expected' ? 'slate' : 'amber'}>{r.status === 'Overdue' ? '! ' : r.status === 'Received' ? '✓ ' : ''}{r.status}</Badge></td>
                  <td className={`${td} whitespace-nowrap text-right`}><Button size="sm" variant={r.record?.actualAmount != null ? 'ghost' : 'secondary'} onClick={() => setSalaryEdit(r)}>{r.record?.actualAmount != null ? 'Edit' : 'Record'}</Button></td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {salaryThisMonth?.status === 'Overdue' && <div className="mt-3"><Alert level="warning">The salary due by {fmtDate(salaryThisMonth.expectedDate)} has not been recorded as received.</Alert></div>}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Account balances" subtitle="Opening balance + received salary + recorded transactions. Manage accounts in Settings.">
          <ul className="divide-y divide-cream-200">
            {balances.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-2 text-navy-900">{b.name} {b.purpose !== 'general' && <Badge tone={b.purpose === 'wedding' ? 'gold' : 'navy'}>{b.purpose === 'wedding' ? 'Wedding' : 'Emergency'}</Badge>}</span>
                <span className={`font-semibold tabular-nums ${b.balance < 0 ? 'text-red-700' : 'text-navy-900'}`}>{money(b.balance, true)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card title="Spending by category" subtitle={`${fmtMonth(month)} compared with ${fmtMonth(addMonthKey(month, -1))}`}>
          {cats.length ? (
            <>
              {catData.length > 0 && <CategoryChart data={catData} />}
              <Table caption="Spending by category compared with last month">
                <thead><tr><th className={th}>Category</th><th className={`${th} text-right`}>This month</th><th className={`${th} text-right`}>Last month</th><th className={`${th} text-right`}>Change</th></tr></thead>
                <tbody>
                  {cats.sort((a, b) => (s.byCategory[b] ?? 0) - (s.byCategory[a] ?? 0)).map((c) => {
                    const a = s.byCategory[c] ?? 0
                    const b = p.byCategory[c] ?? 0
                    return <tr key={c}><td className={td}>{c}</td><td className={`${td} text-right tabular-nums`}>{money(a)}</td><td className={`${td} text-right tabular-nums text-slate-500`}>{money(b)}</td><td className={`${td} text-right tabular-nums ${a > b ? 'text-red-700' : a < b ? 'text-emerald-700' : 'text-slate-500'}`}>{a === b ? '—' : `${a > b ? '+' : '−'}${money(Math.abs(a - b))}`}</td></tr>
                  })}
                </tbody>
              </Table>
            </>
          ) : <EmptyState title="No expenses in these months" />}
        </Card>
      </div>

      <Card title="Monthly history" subtitle="Income vs expenses, and what was left over">
        {history.some((h) => h.income || h.expenses) ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <IncomeExpenseChart data={history} />
            <div><h3 className="mb-1 text-sm font-medium text-navy-800">Monthly savings</h3><SavingsBarChart data={history} /></div>
          </div>
        ) : <EmptyState title="No income or expenses recorded yet" />}
      </Card>

      <Card title="Transactions">
        <div className="mb-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
          <SelectField label="Show" value={f.scope} onChange={(v) => setF({ ...f, scope: v })} options={[{ value: 'month', label: fmtMonth(month) }, { value: 'all', label: 'All months' }]} />
          <SelectField label="Type" value={f.type} onChange={(v) => setF({ ...f, type: v })} options={[{ value: 'all', label: 'All' }, { value: 'expense', label: 'Expense' }, { value: 'income', label: 'Other income' }, { value: 'transfer', label: 'Savings / transfer' }]} />
          <SelectField label="Category" value={f.category} onChange={(v) => setF({ ...f, category: v })} options={['all', ...EXPENSE_CATEGORIES, 'Savings', ...INCOME_CATEGORIES].map((c) => ({ value: c, label: c === 'all' ? 'All' : c }))} />
          <SelectField label="Payment method" value={f.method} onChange={(v) => setF({ ...f, method: v })} options={['all', ...PAYMENT_METHODS].map((c) => ({ value: c, label: c === 'all' ? 'All' : c }))} />
          <div>
            <label htmlFor="tx-search" className="block text-sm font-medium text-navy-800">Search</label>
            <div className="relative mt-1">
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input id="tx-search" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Description or notes" className="block w-full rounded-lg border border-cream-300 bg-white py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-gold-300" />
            </div>
          </div>
        </div>
        {txs.length === 0 ? (
          <EmptyState title={data.transactions.length ? 'No transactions match these filters' : 'No transactions yet'} action={<Button size="sm" onClick={() => setEditing(newTx(today, data.accounts[0]?.id ?? ''))}>Add transaction</Button>}>Record spending, other income, and money you move into savings. Salary is recorded in the Salary table above.</EmptyState>
        ) : (
          <Table caption="Transactions">
            <thead><tr><th className={th}>Date</th><th className={th}>Description</th><th className={th}>Category</th><th className={th}>Paid with</th><th className={`${th} text-right`}>Amount</th><th className={th}><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id}>
                  <td className={`${td} whitespace-nowrap`}>{fmtDate(t.date)}{t.date > today && <div><Badge tone="amber">Scheduled</Badge></div>}</td>
                  <td className={td}>
                    <div className="font-medium text-navy-900">{t.description || (t.type === 'transfer' ? `${accName(t.accountId)} → ${accName(t.toAccountId)}` : t.category)}</div>
                    {t.weddingCategoryId && <div className="text-xs text-gold-700">Wedding: {wcName(t.weddingCategoryId)}</div>}
                    {t.recurringId && <div className="text-xs text-slate-500">Recurring · {fmtMonth(t.occurrence || monthKey(t.date))}</div>}
                    {t.notes && <div className="text-xs text-slate-500">{t.notes}</div>}
                  </td>
                  <td className={`${td} text-slate-600`}>{t.type === 'transfer' ? 'Savings' : t.category}</td>
                  <td className={`${td} text-slate-600`}>{t.paymentMethod || '—'}<div className="text-xs text-slate-400">{accName(t.accountId)}</div></td>
                  <td className={`${td} whitespace-nowrap text-right font-semibold tabular-nums ${t.type === 'income' ? 'text-emerald-700' : t.type === 'expense' ? 'text-navy-900' : 'text-slate-500'}`}>{t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '⇄ '}{money(t.amount, true)}</td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(t)} aria-label={`Edit transaction on ${t.date}`}><Pencil className="h-3.5 w-3.5" aria-hidden /></Button>
                    <Button size="sm" variant="ghost" className="text-red-700" aria-label={`Delete transaction on ${t.date}`} onClick={() => confirm(`Delete this ${t.type === 'transfer' ? 'savings transfer' : t.type} of ${money(t.amount, true)}?`) && update((d) => { d.transactions = d.transactions.filter((x) => x.id !== t.id) })}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      <Card title="Expected extra income" subtitle="Bonuses or other money you expect. Used by the Savings Planner." action={<Button size="sm" variant="secondary" onClick={() => setExpEdit({ id: '', month, label: '', amount: 0, forWedding: 0 })}>Add</Button>}>
        {data.expectedIncome.length === 0 ? <p className="text-sm text-slate-500">None added.</p> : (
          <ul className="divide-y divide-cream-200 text-sm">
            {[...data.expectedIncome].sort((a, b) => (a.month < b.month ? -1 : 1)).map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-2 py-2">
                <span>{fmtMonth(e.month)} · {e.label || 'Other income'} · {money(e.amount)}{e.forWedding > 0 && <> ({money(e.forWedding)} for wedding)</>}</span>
                <span className="whitespace-nowrap">
                  <Button size="sm" variant="ghost" onClick={() => setExpEdit(e)} aria-label="Edit expected income"><Pencil className="h-3.5 w-3.5" aria-hidden /></Button>
                  <Button size="sm" variant="ghost" className="text-red-700" aria-label="Delete expected income" onClick={() => confirm('Delete this expected income?') && update((d) => { d.expectedIncome = d.expectedIncome.filter((x) => x.id !== e.id) })}><Trash2 className="h-3.5 w-3.5" aria-hidden /></Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {editing && <TransactionModal tx={editing} onClose={() => setEditing(null)} />}
      {salaryEdit && <SalaryModal row={salaryEdit} onClose={() => setSalaryEdit(null)} />}
      {expEdit && <ExpectedModal item={expEdit} onClose={() => setExpEdit(null)} />}
    </div>
  )
}

export function newTx(date: string, accountId: string, extra: Partial<Transaction> = {}): Transaction {
  return { id: '', date, type: 'expense', amount: 0, category: 'Food', description: '', paymentMethod: 'UPI', accountId, toAccountId: '', weddingCategoryId: '', recurringId: '', occurrence: '', notes: '', ...extra }
}

export function TransactionModal({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const { data, today } = usePlanner()
  const update = useUpdate()
  const [t, setT] = useState<Transaction>({ ...tx })
  const [amountText, setAmountText] = useState(tx.amount ? String(tx.amount) : '')
  const [err, setErr] = useState<Record<string, string>>({})
  const setType = (type: TxType) =>
    setT({ ...t, type, category: type === 'income' ? 'Other income' : type === 'expense' ? 'Food' : '', weddingCategoryId: '', toAccountId: type === 'transfer' ? data.accounts.find((a) => a.id !== t.accountId && a.purpose !== 'general')?.id ?? data.accounts.find((a) => a.id !== t.accountId)?.id ?? '' : '' })
  const save = () => {
    const e: Record<string, string> = {}
    const clean = amountText.replace(/,/g, '').trim()
    const amount = Number(clean)
    if (!isValidISO(t.date)) e.date = 'Choose a date.'
    if (!clean || !Number.isFinite(amount) || amount <= 0) e.amount = 'Enter an amount greater than 0.'
    else if (!/^\d+(\.\d{1,2})?$/.test(clean)) e.amount = 'Use numbers only, with up to 2 decimal places.'
    if (!data.accounts.some((a) => a.id === t.accountId)) e.account = 'Choose an account.'
    if (t.type === 'transfer') {
      if (!data.accounts.some((a) => a.id === t.toAccountId)) e.to = 'Choose the account the money goes to.'
      else if (t.toAccountId === t.accountId) e.to = 'Choose a different account.'
    }
    setErr(e)
    if (Object.keys(e).length) return
    const out: Transaction = {
      ...t,
      amount,
      description: t.description.trim(),
      toAccountId: t.type === 'transfer' ? t.toAccountId : '',
      category: t.type === 'transfer' ? '' : t.weddingCategoryId ? 'Wedding expenses' : t.category,
      weddingCategoryId: t.type === 'expense' ? t.weddingCategoryId : '',
    }
    update((d) => {
      if (out.id) d.transactions = d.transactions.map((x) => (x.id === out.id ? out : x))
      else d.transactions.push({ ...out, id: uid() })
    })
    onClose()
  }
  const accOpts = data.accounts.map((a) => ({ value: a.id, label: a.name }))
  return (
    <Modal open title={tx.id ? 'Edit transaction' : 'Add transaction'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField<TxType> label="Type" value={t.type} onChange={setType} options={[{ value: 'expense', label: 'Expense' }, { value: 'transfer', label: 'Savings (move money to my savings account)' }, { value: 'income', label: 'Other income (not salary)' }]} />
        <DateField label="Date" value={t.date} onChange={(v) => setT({ ...t, date: v })} error={err.date} required hint={t.date > today ? 'Future date: shown as scheduled, not in your balance yet.' : undefined} />
        <TextField className="sm:col-span-2" label="Description" value={t.description} onChange={(v) => setT({ ...t, description: v })} placeholder="e.g. Hostel rent, Groceries, Bus pass" />
        <TextField label="Amount (₹)" value={amountText} onChange={setAmountText} error={err.amount} required placeholder="0" />
        {t.type !== 'transfer' ? (
          <SelectField label="Category" value={t.weddingCategoryId ? 'Wedding expenses' : t.category} onChange={(v) => setT({ ...t, category: v, weddingCategoryId: v === 'Wedding expenses' ? t.weddingCategoryId : '' })} options={t.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES} />
        ) : <div />}
        <SelectField label="Payment method" value={t.paymentMethod} onChange={(v) => setT({ ...t, paymentMethod: v })} options={[{ value: '', label: 'Not specified' }, ...PAYMENT_METHODS.map((m) => ({ value: m, label: m }))]} />
        <SelectField label={t.type === 'income' ? 'Paid into' : t.type === 'transfer' ? 'From account' : 'Paid from'} value={t.accountId} onChange={(v) => setT({ ...t, accountId: v })} options={accOpts} error={err.account} />
        {t.type === 'transfer' && <SelectField label="To account" value={t.toAccountId} onChange={(v) => setT({ ...t, toAccountId: v })} options={[{ value: '', label: 'Choose…' }, ...accOpts]} error={err.to} />}
        {t.type === 'expense' && (
          <SelectField
            className="sm:col-span-2"
            label="Link to wedding budget"
            value={t.weddingCategoryId}
            onChange={(v) => setT({ ...t, weddingCategoryId: v, category: v ? 'Wedding expenses' : t.category === 'Wedding expenses' ? 'Other expenses' : t.category })}
            options={[{ value: '', label: 'Not a wedding budget payment' }, ...data.wedding.categories.map((c) => ({ value: c.id, label: c.name }))]}
            hint="Linked payments are counted once: as an expense here and as paid in your wedding budget."
          />
        )}
        <TextArea className="sm:col-span-2" label="Notes" value={t.notes} onChange={(v) => setT({ ...t, notes: v })} rows={2} />
      </div>
      {t.type === 'expense' && t.category === 'Wedding expenses' && !t.weddingCategoryId && <div className="mt-3"><Alert level="warning">This wedding expense is not linked to a budget category, so it won’t show as paid in your wedding budget.</Alert></div>}
      {t.type === 'transfer' && <p className="mt-3 text-xs text-slate-500">Savings transfers move money between your own accounts. They do not change your income, expenses or savings figures.</p>}
    </Modal>
  )
}

function SalaryModal({ row, onClose }: { row: SalaryRow; onClose: () => void }) {
  const { data, today } = usePlanner()
  const update = useUpdate()
  const rec = row.record
  const [expectedDate, setExpectedDate] = useState(row.expectedDate)
  const [expectedAmount, setExpectedAmount] = useState(row.expectedAmount)
  const [actualDate, setActualDate] = useState(rec?.actualDate || (monthKey(today) === row.payMonth && today <= row.expectedDate ? today : row.expectedDate))
  const [actualText, setActualText] = useState(rec?.actualAmount != null ? String(rec.actualAmount) : String(row.expectedAmount))
  const [received, setReceived] = useState(rec ? rec.actualAmount !== null : true)
  const [accountId, setAccountId] = useState(rec?.accountId || data.accounts.find((a) => a.purpose === 'general')?.id || data.accounts[0]?.id || '')
  const [notes, setNotes] = useState(rec?.notes ?? '')
  const [err, setErr] = useState<Record<string, string>>({})
  const save = () => {
    const e: Record<string, string> = {}
    const n = Number(actualText.replace(/,/g, ''))
    if (!isValidISO(expectedDate)) e.expectedDate = 'Choose a date.'
    if (received) {
      if (!isValidISO(actualDate)) e.actualDate = 'Choose the date you received it.'
      if (!Number.isFinite(n) || n < 0 || actualText.trim() === '') e.actual = 'Enter the amount received.'
    }
    setErr(e)
    if (Object.keys(e).length) return
    const out: SalaryRecord = { id: rec?.id || uid(), payMonth: row.payMonth, expectedDate, expectedAmount, actualDate: received ? actualDate : '', actualAmount: received ? n : null, accountId, notes }
    update((d) => {
      d.salaryRecords = [...d.salaryRecords.filter((x) => x.payMonth !== row.payMonth), out]
    })
    onClose()
  }
  return (
    <Modal open title={`Salary paid in ${fmtMonth(row.payMonth)}`} onClose={onClose} footer={<>
      {rec && <Button variant="danger" className="mr-auto" onClick={() => { if (confirm('Clear this salary record?')) { update((d) => { d.salaryRecords = d.salaryRecords.filter((x) => x.payMonth !== row.payMonth) }); onClose() } }}>Clear</Button>}
      <Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button>
    </>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <DateField label="Expected by" value={expectedDate} onChange={setExpectedDate} error={err.expectedDate} />
        <NumberField label="Expected amount" prefix="₹" value={expectedAmount} onChange={setExpectedAmount} hint="Change this if the month is pro-rated or has deductions." />
        <div className="sm:col-span-2"><SelectField label="Salary status" value={received ? 'yes' : 'no'} onChange={(v) => setReceived(v === 'yes')} options={[{ value: 'yes', label: 'Received' }, { value: 'no', label: 'Not received yet' }]} /></div>
        {received && <>
          <DateField label="Received on" value={actualDate} onChange={setActualDate} error={err.actualDate} />
          <TextField label="Amount received (₹)" value={actualText} onChange={setActualText} error={err.actual} />
          <SelectField className="sm:col-span-2" label="Paid into" value={accountId} onChange={setAccountId} options={data.accounts.map((a) => ({ value: a.id, label: a.name }))} />
        </>}
        <TextArea className="sm:col-span-2" label="Notes" value={notes} onChange={setNotes} rows={2} />
      </div>
    </Modal>
  )
}

function ExpectedModal({ item, onClose }: { item: ExpectedIncome; onClose: () => void }) {
  const update = useUpdate()
  const [e, setE] = useState(item)
  const [err, setErr] = useState('')
  const save = () => {
    if (!/^\d{4}-\d{2}$/.test(e.month)) return setErr('Choose a month.')
    if (e.amount <= 0) return setErr('Enter an amount greater than 0.')
    if (e.forWedding > e.amount) return setErr('The wedding portion cannot be more than the amount.')
    update((d) => {
      const out = { ...e, label: e.label.trim() || 'Other income' }
      if (out.id) d.expectedIncome = d.expectedIncome.map((x) => (x.id === out.id ? out : x))
      else d.expectedIncome.push({ ...out, id: uid() })
    })
    onClose()
  }
  return (
    <Modal open title={item.id ? 'Edit expected income' : 'Add expected income'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Month" type="month" value={e.month} onChange={(v) => setE({ ...e, month: v })} />
        <TextField label="Description" value={e.label} onChange={(v) => setE({ ...e, label: v })} placeholder="Bonus, gift…" />
        <NumberField label="Amount" prefix="₹" value={e.amount} onChange={(v) => setE({ ...e, amount: v })} />
        <NumberField label="Of which for the wedding" prefix="₹" value={e.forWedding} onChange={(v) => setE({ ...e, forWedding: v })} />
      </div>
      {err && <p className="mt-3 text-sm font-medium text-red-700" role="alert">{err}</p>}
    </Modal>
  )
}
