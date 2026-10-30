import { useState } from 'react'
import { Check, Pencil } from 'lucide-react'
import { useUpdate } from '../lib/store'
import { daysUntil, fmtDate, relativeDays, todayISO } from '../lib/dates'
import type { MilestoneInfo } from '../lib/calc/employment'
import type { MilestoneKey } from '../lib/types'
import { Badge, Button, DateField, Modal, TextArea, cx } from './ui'

export function MilestoneList({ items, today }: { items: MilestoneInfo[]; today: string }) {
  const update = useUpdate()
  const [edit, setEdit] = useState<MilestoneInfo | null>(null)
  const toggle = (m: MilestoneInfo) =>
    update((d) => {
      const s = d.milestones[m.key]
      s.done = !m.done
      s.doneOn = s.done ? todayISO() : ''
    })
  return (
    <>
      <ol className="relative space-y-0 border-l-2 border-cream-200 pl-5">
        {items.map((m) => {
          const n = m.date ? daysUntil(m.date, today) : null
          const overdue = !m.done && n !== null && n < 0
          return (
            <li key={m.key} className="relative py-2.5">
              <span aria-hidden className={cx('absolute -left-[27px] top-3.5 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-white', m.done ? 'bg-emerald-600' : overdue ? 'bg-red-500' : n !== null && n <= 30 ? 'bg-gold-500' : 'bg-navy-300')} />
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cx('text-sm font-medium text-navy-900', m.done && 'text-slate-500 line-through')}>{m.label}</span>
                    {m.done && <Badge tone="green">✓ Done{m.doneOn ? ` ${fmtDate(m.doneOn)}` : ''}</Badge>}
                    {overdue && <Badge tone="red">! Due</Badge>}
                    {m.overridden && <Badge tone="slate">Date edited</Badge>}
                  </div>
                  <div className="text-xs text-slate-500">
                    {m.date ? <>{fmtDate(m.date, true)} · {relativeDays(n!)}</> : 'Date not set'} · {m.hint}
                  </div>
                  {m.notes && <div className="mt-0.5 text-xs text-slate-600">{m.notes}</div>}
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button size="sm" variant={m.done ? 'ghost' : 'secondary'} onClick={() => toggle(m)} aria-pressed={m.done} aria-label={`${m.done ? 'Mark not done' : 'Mark done'}: ${m.label}`}>
                    <Check className="h-3.5 w-3.5" aria-hidden /> {m.done ? 'Undo' : 'Done'}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEdit(m)} aria-label={`Edit ${m.label}`}><Pencil className="h-3.5 w-3.5" aria-hidden /></Button>
                </div>
              </div>
            </li>
          )
        })}
      </ol>
      {edit && <MilestoneModal m={edit} onClose={() => setEdit(null)} />}
    </>
  )
}

function MilestoneModal({ m, onClose }: { m: MilestoneInfo; onClose: () => void }) {
  const update = useUpdate()
  const [date, setDate] = useState(m.overridden ? m.date : '')
  const [notes, setNotes] = useState(m.notes)
  const save = () => {
    update((d) => {
      const s = d.milestones[m.key as MilestoneKey]
      s.dateOverride = date
      s.notes = notes
    })
    onClose()
  }
  return (
    <Modal open title={m.label} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">Calculated date: <strong>{fmtDate(m.calculated)}</strong> ({m.hint})</p>
        <DateField label="Use a different date" value={date} onChange={setDate} hint="Leave empty to use the calculated date. Use this when HR gives you a date." />
        <TextArea label="Notes" value={notes} onChange={setNotes} rows={3} />
      </div>
    </Modal>
  )
}
