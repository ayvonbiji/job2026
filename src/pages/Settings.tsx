import { useRef, useState } from 'react'
import { usePlanner } from '../lib/usePlanner'
import { normalizeData, useStore, useUpdate } from '../lib/store'
import { fmtDate } from '../lib/dates'
import { money, uid } from '../lib/format'
import { downloadCSV, downloadFile } from '../lib/csv'
import { countLeaveDays } from '../lib/calc/leave'
import type { Account, AccountPurpose } from '../lib/types'
import { Alert, Badge, Button, Card, DateField, Modal, NumberField, PageHeader, SelectField, TextField } from '../components/ui'
import { NotificationSettings } from '../components/Reminders'

export default function Settings() {
  const { data, today, balances } = usePlanner()
  const update = useUpdate()
  const replace = useStore((s) => s.replace)
  const reset = useStore((s) => s.reset)
  const lastSaved = useStore((s) => s.lastSaved)
  const [acc, setAcc] = useState<Account | null>(null)
  const [msg, setMsg] = useState<{ level: 'ok' | 'danger'; text: string } | null>(null)
  const [resetOpen, setResetOpen] = useState(false)
  const [resetText, setResetText] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const backup = () => {
    downloadFile(`life-planner-backup-${today}.json`, JSON.stringify(data, null, 2), 'application/json')
    setMsg({ level: 'ok', text: 'Backup downloaded. Keep it somewhere safe, such as Google Drive.' })
  }

  const restore = async (file: File) => {
    try {
      if (file.size > 5_000_000) throw new Error('The file is too large to be a planner backup.')
      const parsed = normalizeData(JSON.parse(await file.text()))
      if (!confirm(`Restore this backup? It has ${parsed.transactions.length} transactions and ${parsed.leaves.length} leave records. Your current data will be replaced.`)) return
      replace(parsed)
      setMsg({ level: 'ok', text: 'Backup restored.' })
    } catch (e) {
      setMsg({ level: 'danger', text: `Could not restore: ${e instanceof SyntaxError ? 'the file is not valid JSON.' : (e as Error).message}` })
    } finally {
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const accName = (id: string) => data.accounts.find((a) => a.id === id)?.name ?? ''

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" subtitle="Your details, accounts, reminders and data." />

      {msg && <Alert level={msg.level}>{msg.text}</Alert>}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Profile">
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Your name" value={data.profile.name} onChange={(v) => update((d) => { d.profile.name = v })} autoComplete="given-name" />
            <DateField label="Wedding date" value={data.profile.weddingDate} onChange={(v) => v && update((d) => { d.profile.weddingDate = v })} required />
          </div>
        </Card>

        <Card title="Money settings">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField label="Salary payment day" value={data.finance.salaryPayDay} onChange={(v) => update((d) => { d.finance.salaryPayDay = v })} min={1} max={31} allowDecimal={false} hint="Day of the month. Currency: Indian rupees (₹)." />
            <NumberField label="Monthly budget review day" value={data.finance.budgetReviewDay} onChange={(v) => update((d) => { d.finance.budgetReviewDay = v })} min={1} max={31} allowDecimal={false} />
          </div>
        </Card>
      </div>

      <Card title="Accounts and opening balances" subtitle="Balances are worked out from the opening balance plus your transactions. Wedding and emergency accounts are kept separate in calculations." action={<Button size="sm" onClick={() => setAcc({ id: '', name: '', purpose: 'general', openingBalance: 0 })}>Add account</Button>}>
        <ul className="divide-y divide-cream-200">
          {data.accounts.map((a) => {
            const used = data.transactions.filter((t) => t.accountId === a.id || t.toAccountId === a.id).length
            const bal = balances.find((b) => b.id === a.id)?.balance ?? 0
            return (
              <li key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
                <div>
                  <div className="flex items-center gap-2 font-medium text-navy-900">{a.name} <Badge tone={a.purpose === 'wedding' ? 'gold' : a.purpose === 'emergency' ? 'navy' : 'slate'}>{a.purpose === 'general' ? 'Everyday' : a.purpose === 'wedding' ? 'Wedding savings' : 'Emergency'}</Badge></div>
                  <div className="text-xs text-slate-500">Opening {money(a.openingBalance)} · Now {money(bal)} · {used} transactions</div>
                </div>
                <div>
                  <Button size="sm" variant="ghost" onClick={() => setAcc(a)} aria-label={`Edit ${a.name}`}>Edit</Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-700"
                    aria-label={`Delete ${a.name}`}
                    onClick={() => {
                      if (used > 0) return alert(`"${a.name}" has ${used} transactions. Move or delete them first.`)
                      if (data.accounts.length <= 1) return alert('You need at least one account.')
                      if (confirm(`Delete "${a.name}"?`)) update((d) => { d.accounts = d.accounts.filter((x) => x.id !== a.id) })
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>
      </Card>

      <Card title="Reminders and notifications">
        <NotificationSettings />
      </Card>

      <Card title="Your data" subtitle={<>Stored privately in this browser on this device only. Nothing is sent to a server.{lastSaved && <> Last saved {new Date(lastSaved).toLocaleTimeString('en-IN')}.</>}</>}>
        <div className="space-y-5">
          <div>
            <h3 className="text-sm font-semibold text-navy-900">Backup and restore</h3>
            <p className="mb-2 text-sm text-slate-600">Clearing your browser data deletes everything. Download a backup regularly, and use it to move your data to another device.</p>
            <div className="flex flex-wrap gap-2">
              <Button onClick={backup}>Download backup (.json)</Button>
              <Button variant="secondary" onClick={() => fileRef.current?.click()}>Restore from backup</Button>
              <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" aria-label="Choose backup file" onChange={(e) => e.target.files?.[0] && restore(e.target.files[0])} />
            </div>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-navy-900">Export to CSV</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="secondary" disabled={!data.transactions.length} onClick={() => downloadCSV(`transactions-${today}.csv`, ['Date', 'Type', 'Category', 'Amount (INR)', 'Account', 'To account', 'Notes'], data.transactions.map((t) => [t.date, t.type, t.category, t.amount, accName(t.accountId), accName(t.toAccountId), t.notes]))}>Transactions</Button>
              <Button variant="secondary" disabled={!data.leaves.length} onClick={() => downloadCSV(`leave-records-${today}.csv`, ['Start', 'End', 'Type', 'Status', 'Working days', 'For wedding', 'Notes'], data.leaves.map((l) => [l.startDate, l.endDate, l.type, l.status, countLeaveDays(l, data.leavePolicy), l.forWedding ? 'Yes' : 'No', l.notes]))}>Leave records</Button>
            </div>
          </div>
          <div className="rounded-xl border border-red-200 p-4">
            <h3 className="text-sm font-semibold text-red-800">Reset all data</h3>
            <p className="mb-2 text-sm text-slate-600">Deletes everything in this planner on this device. Download a backup first.</p>
            <Button variant="danger" onClick={() => setResetOpen(true)}>Reset planner</Button>
          </div>
        </div>
      </Card>

      <p className="text-center text-xs text-slate-400">My Life Planner 2027 · Today: {fmtDate(today, true)}</p>

      {acc && <AccountModal acc={acc} onClose={() => setAcc(null)} />}
      <Modal open={resetOpen} title="Reset all data?" onClose={() => { setResetOpen(false); setResetText('') }} footer={<><Button variant="secondary" onClick={() => { setResetOpen(false); setResetText('') }}>Cancel</Button><Button variant="danger" disabled={resetText !== 'RESET'} onClick={() => { reset(); setResetOpen(false); setResetText(''); setMsg({ level: 'ok', text: 'Planner reset to defaults.' }) }}>Delete everything</Button></>}>
        <p className="mb-3 text-sm">This cannot be undone. Type <strong>RESET</strong> to confirm.</p>
        <TextField label="Confirmation" value={resetText} onChange={setResetText} />
      </Modal>
    </div>
  )
}

function AccountModal({ acc, onClose }: { acc: Account; onClose: () => void }) {
  const update = useUpdate()
  const [a, setA] = useState(acc)
  const [err, setErr] = useState('')
  const save = () => {
    if (!a.name.trim()) return setErr('Enter an account name.')
    update((d) => {
      const clean = { ...a, name: a.name.trim() }
      if (clean.id) d.accounts = d.accounts.map((x) => (x.id === clean.id ? clean : x))
      else d.accounts.push({ ...clean, id: uid() })
    })
    onClose()
  }
  return (
    <Modal open title={acc.id ? 'Edit account' : 'Add account'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField className="sm:col-span-2" label="Account name" value={a.name} onChange={(v) => setA({ ...a, name: v })} error={err} required placeholder="SBI savings, Cash…" />
        <SelectField<AccountPurpose> label="Used for" value={a.purpose} onChange={(v) => setA({ ...a, purpose: v })} options={[{ value: 'general', label: 'Everyday money' }, { value: 'wedding', label: 'Wedding savings' }, { value: 'emergency', label: 'Emergency savings' }]} />
        <NumberField label="Opening balance" prefix="₹" value={a.openingBalance} onChange={(v) => setA({ ...a, openingBalance: v })} min={-1e12} hint="The balance when you started tracking." />
      </div>
    </Modal>
  )
}
