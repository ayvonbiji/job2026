import { useMemo, useState } from 'react'
import { usePlanner } from '../lib/usePlanner'
import { useUpdate } from '../lib/store'
import { addMonthKey, fmtDate, fmtMonth, fmtMonthShort, isValidISO, monthKey } from '../lib/dates'
import { money, uid } from '../lib/format'
import { expectedIncomeFor, monthSummary, monthsWithData } from '../lib/calc/finance'
import { downloadCSV } from '../lib/csv'
import { EXPENSE_CATEGORIES, INCOME_CATEGORIES, type ExpectedIncome, type Transaction, type TxType } from '../lib/types'
import { Alert, Badge, Button, Card, DateField, EmptyState, Modal, NumberField, PageHeader, SelectField, Stat, Table, TextArea, TextField, td, th } from '../components/ui'
import { CategoryChart, IncomeExpenseChart, SavingsBarChart } from '../components/Charts'

export default function MoneyTracker() {
  const { data, today, balances, job } = usePlanner()
  const update = useUpdate()
  const [month, setMonth] = useState(monthKey(today))
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [fType, setFType] = useState<'all' | TxType>('all')
  const [scope, setScope] = useState<'month' | 'all'>('month')
  const [expEdit, setExpEdit] = useState<ExpectedIncome | null>(null)

  const summary = monthSummary(data, month, today)
  const months = monthsWithData(data, today)
  const history = months.map((m) => {
    const s = monthSummary(data, m, today)
    return { label: fmtMonthShort(m), income: s.income, expenses: s.expenses, savings: s.savings }
  })
  const catData = Object.entries(summary.byCategory).map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount)
  const expected = expectedIncomeFor(data, month, job.lastWorkingDay)
  const expectedTotal = expected.salary + expected.other
  const available = balances.filter((b) => b.purpose === 'general').reduce((s, b) => s + b.balance, 0)
  const accName = (id: string) => data.accounts.find((a) => a.id === id)?.name ?? 'Deleted account'
  const wcName = (id: string) => data.wedding.categories.find((c) => c.id === id)?.name

  const txs = useMemo(
    () =>
      [...data.transactions]
        .filter((t) => (scope === 'all' || monthKey(t.date) === month) && (fType === 'all' || t.type === fType))
        .sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)),
    [data.transactions, scope, month, fType],
  )

  const exportCSV = () =>
    downloadCSV(
      `transactions-${today}.csv`,
      ['Date', 'Type', 'Category', 'Amount (INR)', 'From / account', 'To account', 'Wedding budget category', 'Scheduled', 'Notes'],
      [...data.transactions].sort((a, b) => (a.date < b.date ? -1 : 1)).map((t) => [t.date, t.type, t.category, t.amount, accName(t.accountId), t.type === 'transfer' ? accName(t.toAccountId) : '', wcName(t.weddingCategoryId) ?? '', t.date > today ? 'Yes' : 'No', t.notes]),
    )

  return (
    <div className="space-y-6">
      <PageHeader
        title="Money Tracker"
        subtitle="Savings = income − expenses. Transfers between your own accounts are not counted as income or expenses."
        actions={<><Button variant="secondary" onClick={exportCSV} disabled={!data.transactions.length}>Export CSV</Button><Button onClick={() => setEditing(newTx(today, data.accounts[0]?.id ?? ''))}>Add transaction</Button></>}
      />

      <div className="flex items-center gap-2">
        <Button variant="secondary" size="sm" onClick={() => setMonth(addMonthKey(month, -1))} aria-label="Previous month">‹</Button>
        <h2 className="min-w-[8rem] text-center font-semibold text-navy-900" aria-live="polite">{fmtMonth(month)}</h2>
        <Button variant="secondary" size="sm" onClick={() => setMonth(addMonthKey(month, 1))} aria-label="Next month">›</Button>
        {month !== monthKey(today) && <Button variant="ghost" size="sm" onClick={() => setMonth(monthKey(today))}>This month</Button>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Income this month" value={money(summary.income)} />
        <Stat label="Expenses this month" value={money(summary.expenses)} />
        <Stat label="Savings this month" value={money(summary.savings)} tone={summary.savings < 0 ? 'red' : 'green'} />
        <Stat label="Available balance (today)" value={money(available)} sub="General accounts only" tone={available < 0 ? 'red' : undefined} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Account balances" subtitle="Opening balance + posted transactions. Edit accounts in Settings.">
          <ul className="divide-y divide-cream-200">
            {balances.map((b) => (
              <li key={b.id} className="flex items-center justify-between py-2 text-sm">
                <span className="flex items-center gap-2 text-navy-900">{b.name} {b.purpose !== 'general' && <Badge tone={b.purpose === 'wedding' ? 'gold' : 'navy'}>{b.purpose === 'wedding' ? 'Wedding' : 'Emergency'}</Badge>}</span>
                <span className={`font-semibold tabular-nums ${b.balance < 0 ? 'text-red-700' : 'text-navy-900'}`}>{money(b.balance)}</span>
              </li>
            ))}
            <li className="flex items-center justify-between py-2 text-sm font-semibold"><span>Total across all accounts</span><span className="tabular-nums">{money(balances.reduce((s, b) => s + b.balance, 0))}</span></li>
          </ul>
        </Card>

        <Card title="Expected vs received income" subtitle={fmtMonth(month)} action={<Button size="sm" variant="secondary" onClick={() => setExpEdit({ id: '', month, label: '', amount: 0, forWedding: 0 })}>Add expected income</Button>}>
          <ul className="divide-y divide-cream-200 text-sm">
            {expected.items.length === 0 && <li className="py-2 text-slate-500">No income expected. Set your salary in Job Tracker.</li>}
            {expected.items.map((i, k) => <li key={k} className="flex justify-between py-2"><span>{i.label}</span><span className="tabular-nums">{money(i.amount)}</span></li>)}
          </ul>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Stat label="Expected" value={money(expectedTotal)} />
            <Stat label="Received" value={money(summary.income)} />
            <Stat label="Difference" value={money(summary.income - expectedTotal)} tone={summary.income < expectedTotal ? 'amber' : 'green'} />
          </div>
          <p className="mt-2 text-xs text-slate-500">Salary is expected on day {data.finance.salaryPayDay} of each month until your last working day.</p>
          {data.expectedIncome.length > 0 && (
            <details className="mt-3 text-sm">
              <summary className="cursor-pointer text-navy-700">All expected extra income ({data.expectedIncome.length})</summary>
              <ul className="mt-2 divide-y divide-cream-200">
                {[...data.expectedIncome].sort((a, b) => (a.month < b.month ? -1 : 1)).map((e) => (
                  <li key={e.id} className="flex items-center justify-between gap-2 py-1.5">
                    <span>{fmtMonth(e.month)} · {e.label} · {money(e.amount)}{e.forWedding > 0 && <> ({money(e.forWedding)} for wedding)</>}</span>
                    <span className="whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => setExpEdit(e)}>Edit</Button>
                      <Button size="sm" variant="ghost" className="text-red-700" onClick={() => confirm('Delete this expected income?') && update((d) => { d.expectedIncome = d.expectedIncome.filter((x) => x.id !== e.id) })}>Delete</Button>
                    </span>
                  </li>
                ))}
              </ul>
            </details>
          )}
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Spending by category" subtitle={fmtMonth(month)}>
          {catData.length ? (
            <>
              <CategoryChart data={catData} />
              <Table caption="Spending by category">
                <thead><tr><th className={th}>Category</th><th className={`${th} text-right`}>Amount</th><th className={`${th} text-right`}>Share</th></tr></thead>
                <tbody>{catData.map((c) => <tr key={c.name}><td className={td}>{c.name}</td><td className={`${td} text-right tabular-nums`}>{money(c.amount)}</td><td className={`${td} text-right tabular-nums`}>{Math.round((c.amount / summary.expenses) * 100)}%</td></tr>)}</tbody>
              </Table>
            </>
          ) : <EmptyState title="No expenses this month" />}
        </Card>
        <Card title="Month-by-month" subtitle="Income vs expenses, and what was left over">
          {history.some((h) => h.income || h.expenses) ? (
            <>
              <IncomeExpenseChart data={history} />
              <h3 className="mb-1 mt-4 text-sm font-medium text-navy-800">Monthly savings</h3>
              <SavingsBarChart data={history} />
            </>
          ) : <EmptyState title="No transactions yet" />}
        </Card>
      </div>

      <Card title="Transactions" action={
        <div className="flex flex-wrap gap-2">
          <SelectField label="Show" className="w-36" value={scope} onChange={setScope} options={[{ value: 'month', label: fmtMonth(month) }, { value: 'all', label: 'All months' }]} />
          <SelectField label="Type" className="w-32" value={fType} onChange={setFType} options={[{ value: 'all', label: 'All' }, { value: 'income', label: 'Income' }, { value: 'expense', label: 'Expense' }, { value: 'transfer', label: 'Transfer' }]} />
        </div>
      }>
        {txs.length === 0 ? (
          <EmptyState title="No transactions" action={<Button size="sm" onClick={() => setEditing(newTx(today, data.accounts[0]?.id ?? ''))}>Add transaction</Button>}>Add your salary, spending and transfers to wedding savings.</EmptyState>
        ) : (
          <Table caption="Transactions">
            <thead><tr><th className={th}>Date</th><th className={th}>Details</th><th className={th}>Account</th><th className={`${th} text-right`}>Amount</th><th className={th}><span className="sr-only">Actions</span></th></tr></thead>
            <tbody>
              {txs.map((t) => (
                <tr key={t.id}>
                  <td className={`${td} whitespace-nowrap`}>{fmtDate(t.date)}{t.date > today && <div><Badge tone="amber">Scheduled</Badge></div>}</td>
                  <td className={td}>
                    <div className="font-medium text-navy-900">{t.type === 'transfer' ? 'Transfer' : t.category}</div>
                    {t.weddingCategoryId && <div className="text-xs text-gold-700">Wedding: {wcName(t.weddingCategoryId) ?? 'deleted category'}</div>}
                    {t.notes && <div className="text-xs text-slate-500">{t.notes}</div>}
                  </td>
                  <td className={`${td} text-slate-600`}>{t.type === 'transfer' ? `${accName(t.accountId)} → ${accName(t.toAccountId)}` : accName(t.accountId)}</td>
                  <td className={`${td} whitespace-nowrap text-right font-semibold tabular-nums ${t.type === 'income' ? 'text-emerald-700' : t.type === 'expense' ? 'text-navy-900' : 'text-slate-500'}`}>
                    {t.type === 'income' ? '+' : t.type === 'expense' ? '−' : '⇄ '}{money(t.amount, true)}
                  </td>
                  <td className={`${td} whitespace-nowrap text-right`}>
                    <Button size="sm" variant="ghost" onClick={() => setEditing(t)} aria-label={`Edit transaction on ${t.date}`}>Edit</Button>
                    <Button size="sm" variant="ghost" className="text-red-700" aria-label={`Delete transaction on ${t.date}`} onClick={() => confirm('Delete this transaction?') && update((d) => { d.transactions = d.transactions.filter((x) => x.id !== t.id) })}>Delete</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
      </Card>

      {editing && <TransactionModal tx={editing} onClose={() => setEditing(null)} />}
      {expEdit && <ExpectedModal item={expEdit} onClose={() => setExpEdit(null)} />}
    </div>
  )
}

export function newTx(date: string, accountId: string, extra: Partial<Transaction> = {}): Transaction {
  return { id: '', date, type: 'expense', amount: 0, category: 'Food and groceries', accountId, toAccountId: '', weddingCategoryId: '', notes: '', ...extra }
}

export function TransactionModal({ tx, onClose }: { tx: Transaction; onClose: () => void }) {
  const { data, today } = usePlanner()
  const update = useUpdate()
  const [t, setT] = useState<Transaction>({ ...tx })
  const [amountText, setAmountText] = useState(tx.amount ? String(tx.amount) : '')
  const [err, setErr] = useState<Record<string, string>>({})
  const cats = t.type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES
  const setType = (type: TxType) => setT({ ...t, type, category: type === 'income' ? 'Salary' : type === 'expense' ? 'Food and groceries' : '', weddingCategoryId: '', toAccountId: type === 'transfer' ? data.accounts.find((a) => a.id !== t.accountId)?.id ?? '' : '' })
  const save = () => {
    const e: Record<string, string> = {}
    const amount = Number(amountText.replace(/,/g, ''))
    if (!isValidISO(t.date)) e.date = 'Choose a date.'
    if (!amountText.trim() || !Number.isFinite(amount) || amount <= 0) e.amount = 'Enter an amount greater than 0.'
    else if (!/^\d+(\.\d{1,2})?$/.test(amountText.replace(/,/g, '').trim())) e.amount = 'Use up to 2 decimal places.'
    if (!data.accounts.some((a) => a.id === t.accountId)) e.account = 'Choose an account.'
    if (t.type === 'transfer') {
      if (!data.accounts.some((a) => a.id === t.toAccountId)) e.to = 'Choose the account the money goes to.'
      else if (t.toAccountId === t.accountId) e.to = 'Choose a different account.'
    }
    if (t.type !== 'transfer' && !t.category) e.category = 'Choose a category.'
    setErr(e)
    if (Object.keys(e).length) return
    const clean: Transaction = {
      ...t,
      amount,
      toAccountId: t.type === 'transfer' ? t.toAccountId : '',
      category: t.type === 'transfer' ? '' : t.weddingCategoryId ? 'Wedding expenses' : t.category,
      weddingCategoryId: t.type === 'expense' ? t.weddingCategoryId : '',
    }
    update((d) => {
      if (clean.id) d.transactions = d.transactions.map((x) => (x.id === clean.id ? clean : x))
      else d.transactions.push({ ...clean, id: uid() })
    })
    onClose()
  }
  const accOpts = data.accounts.map((a) => ({ value: a.id, label: a.name }))
  return (
    <Modal open title={tx.id ? 'Edit transaction' : 'Add transaction'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <SelectField<TxType> label="Type" value={t.type} onChange={setType} options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }, { value: 'transfer', label: 'Transfer between my accounts' }]} />
        <DateField label="Date" value={t.date} onChange={(v) => setT({ ...t, date: v })} error={err.date} required hint={t.date > today ? 'Future date: counted as scheduled, not in your balance yet.' : undefined} />
        <TextField label="Amount (₹)" value={amountText} onChange={setAmountText} error={err.amount} required placeholder="0" />
        {t.type !== 'transfer' ? (
          <SelectField label="Category" value={t.weddingCategoryId ? 'Wedding expenses' : t.category} onChange={(v) => setT({ ...t, category: v, weddingCategoryId: v === 'Wedding expenses' ? t.weddingCategoryId : '' })} options={cats} error={err.category} />
        ) : <div />}
        <SelectField label={t.type === 'income' ? 'Paid into' : t.type === 'transfer' ? 'From account' : 'Paid from'} value={t.accountId} onChange={(v) => setT({ ...t, accountId: v })} options={accOpts} error={err.account} />
        {t.type === 'transfer' && <SelectField label="To account" value={t.toAccountId} onChange={(v) => setT({ ...t, toAccountId: v })} options={[{ value: '', label: 'Choose…' }, ...accOpts]} error={err.to} />}
        {t.type === 'expense' && (
          <SelectField
            className="sm:col-span-2"
            label="Link to wedding budget"
            value={t.weddingCategoryId}
            onChange={(v) => setT({ ...t, weddingCategoryId: v, category: v ? 'Wedding expenses' : t.category })}
            options={[{ value: '', label: 'Not a wedding budget payment' }, ...data.wedding.categories.map((c) => ({ value: c.id, label: c.name }))]}
            hint="Linked payments count once: in your expenses and as paid in My Wedding Contribution."
          />
        )}
        <TextArea className="sm:col-span-2" label="Notes" value={t.notes} onChange={(v) => setT({ ...t, notes: v })} rows={2} />
      </div>
      {t.type === 'expense' && t.category === 'Wedding expenses' && !t.weddingCategoryId && <div className="mt-3"><Alert level="warning">This wedding expense is not linked to a budget category, so it won't show as paid in your wedding budget.</Alert></div>}
      {t.type === 'transfer' && <p className="mt-3 text-xs text-slate-500">Transfers move money between your accounts and do not change your income, expenses or savings.</p>}
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
      const clean = { ...e, label: e.label.trim() || 'Other income' }
      if (clean.id) d.expectedIncome = d.expectedIncome.map((x) => (x.id === clean.id ? clean : x))
      else d.expectedIncome.push({ ...clean, id: uid() })
    })
    onClose()
  }
  return (
    <Modal open title={item.id ? 'Edit expected income' : 'Add expected income'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField label="Month" type="month" value={e.month} onChange={(v) => setE({ ...e, month: v })} />
        <TextField label="Description" value={e.label} onChange={(v) => setE({ ...e, label: v })} placeholder="Bonus, freelance work…" />
        <NumberField label="Amount" prefix="₹" value={e.amount} onChange={(v) => setE({ ...e, amount: v })} />
        <NumberField label="Of which for the wedding" prefix="₹" value={e.forWedding} onChange={(v) => setE({ ...e, forWedding: v })} hint="Used by the Savings Planner." />
      </div>
      {err && <p className="mt-3 text-sm font-medium text-red-700" role="alert">{err}</p>}
    </Modal>
  )
}
