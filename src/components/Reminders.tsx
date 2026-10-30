import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CalendarPlus, Trash2 } from 'lucide-react'
import { usePlanner } from '../lib/usePlanner'
import { useStore, useUpdate } from '../lib/store'
import { addDays, daysUntil, fmtDate, isValidISO, relativeDays, todayISO } from '../lib/dates'
import { toICS, type Reminder } from '../lib/calc/reminders'
import { downloadFile } from '../lib/csv'
import { uid } from '../lib/format'
import { Badge, Button, DateField, EmptyState, Modal, TextArea, TextField, cx } from './ui'

export function useReminderActions() {
  const update = useUpdate()
  const toggle = (r: Reminder) =>
    update((d) => {
      const today = todayISO()
      if (r.checklistId) {
        const t = d.checklist.find((x) => x.id === r.checklistId)
        if (t) t.status = r.completed ? 'Not started' : 'Done'
      } else if (r.milestoneKey) {
        const m = d.milestones[r.milestoneKey]
        m.done = !r.completed
        m.doneOn = m.done ? today : ''
      } else if (r.completed) delete d.reminders.completed[r.key]
      else d.reminders.completed[r.key] = today
    })
  return { toggle }
}

function ReminderRow({ r, today, compact }: { r: Reminder; today: string; compact?: boolean }) {
  const { toggle } = useReminderActions()
  const update = useUpdate()
  const n = daysUntil(r.date, today)
  const overdue = !r.completed && n < 0
  const salaryAuto = r.key.startsWith('salary:') && r.completed
  return (
    <li className={cx('flex items-start gap-3 py-2.5', r.completed && 'opacity-60')}>
      <input
        type="checkbox"
        checked={r.completed}
        disabled={salaryAuto}
        onChange={() => toggle(r)}
        aria-label={`Mark "${r.title}" as ${r.completed ? 'not complete' : 'complete'}`}
        className="mt-1 h-4 w-4 shrink-0 rounded border-cream-300 text-navy-700 focus:ring-gold-300"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cx('text-sm font-medium text-navy-900', r.completed && 'line-through')}>{r.title}</span>
          <Badge tone={r.category === 'Wedding' ? 'gold' : r.category === 'Employment' ? 'navy' : 'slate'}>{r.category}</Badge>
          {overdue && <Badge tone="red">! Overdue</Badge>}
        </div>
        <div className="text-xs text-slate-500">
          {fmtDate(r.date, true)} · <span className={overdue ? 'font-medium text-red-700' : n <= 7 && n >= 0 ? 'font-medium text-amber-700' : ''}>{relativeDays(n)}</span>
          {!compact && r.detail && <> · {r.detail}</>}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {r.route && !compact && <Link to={r.route} className="rounded px-1.5 py-1 text-xs text-navy-600 hover:bg-cream-100">Open</Link>}
        <button type="button" className="rounded p-1 text-navy-600 hover:bg-cream-100" onClick={() => downloadFile(`${r.title.replace(/[^\w]+/g, '-').toLowerCase()}.ics`, toICS([r]), 'text/calendar')} aria-label={`Add "${r.title}" to my calendar (.ics)`} title="Add to calendar (.ics)">
          <CalendarPlus className="h-4 w-4" aria-hidden />
        </button>
        {r.custom && (
          <button
            type="button"
            className="rounded p-1 text-red-700 hover:bg-red-50"
            aria-label={`Delete reminder ${r.title}`}
            onClick={() => {
              if (confirm(`Delete reminder "${r.title}"?`)) update((d) => { d.reminders.custom = d.reminders.custom.filter((c) => `custom:${c.id}` !== r.key) })
            }}
          >
            <Trash2 className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>
    </li>
  )
}

export function ReminderList({ reminders, today, compact, empty = 'Nothing here' }: { reminders: Reminder[]; today: string; compact?: boolean; empty?: string }) {
  if (!reminders.length) return <EmptyState title={empty}>Reminders are created from your dates. You can also add your own.</EmptyState>
  return (
    <ul className="divide-y divide-cream-200">
      {reminders.map((r) => <ReminderRow key={r.key} r={r} today={today} compact={compact} />)}
    </ul>
  )
}

export function AddReminderModal({ open, onClose, defaultDate = '' }: { open: boolean; onClose: () => void; defaultDate?: string }) {
  const update = useUpdate()
  const [title, setTitle] = useState('')
  const [date, setDate] = useState(defaultDate)
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  useEffect(() => { if (open) setDate(defaultDate) }, [open, defaultDate])
  const save = () => {
    const e: Record<string, string> = {}
    if (!title.trim()) e.title = 'Enter a title.'
    if (!isValidISO(date)) e.date = 'Choose a date.'
    setErrors(e)
    if (Object.keys(e).length) return
    update((d) => { d.reminders.custom.push({ id: uid(), title: title.trim(), date, notes }) })
    setTitle(''); setNotes('')
    onClose()
  }
  return (
    <Modal open={open} title="Add reminder" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save reminder</Button></>}>
      <div className="space-y-3">
        <TextField label="Title" value={title} onChange={setTitle} error={errors.title} required />
        <DateField label="Date" value={date} onChange={setDate} error={errors.date} required />
        <TextArea label="Notes" value={notes} onChange={setNotes} />
      </div>
    </Modal>
  )
}

export function NotificationSettings() {
  const update = useUpdate()
  const enabled = useStore((s) => s.data.reminders.browserNotifications)
  const supported = typeof window !== 'undefined' && 'Notification' in window
  const [perm, setPerm] = useState(supported ? Notification.permission : 'denied')
  const enable = async () => {
    if (!supported) return
    const p = await Notification.requestPermission()
    setPerm(p)
    if (p === 'granted') update((d) => { d.reminders.browserNotifications = true })
  }
  return (
    <div className="space-y-2 text-sm">
      {!supported ? (
        <p className="text-slate-600">This browser does not support notifications. Use the calendar (.ics) downloads instead.</p>
      ) : perm === 'denied' ? (
        <p className="text-slate-600">Notifications are blocked for this site. Allow them in your browser’s site settings, or use calendar downloads.</p>
      ) : enabled && perm === 'granted' ? (
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="green">✓ Browser notifications on</Badge>
          <Button size="sm" variant="secondary" onClick={() => update((d) => { d.reminders.browserNotifications = false })}>Turn off</Button>
        </div>
      ) : (
        <Button size="sm" variant="secondary" onClick={enable}>Turn on browser notifications</Button>
      )}
      <p className="text-xs text-slate-500">
        Browser notifications only appear while this planner is open in a browser tab — they are not sent when the site is closed. For reminders that work in the background, download the calendar file and add it to Google Calendar or your phone’s calendar.
      </p>
    </div>
  )
}

/** Shows due reminders as browser notifications while the app is open. */
export function Notifier() {
  const { reminders, today, data } = usePlanner()
  const update = useUpdate()
  useEffect(() => {
    if (!data.reminders.browserNotifications || !('Notification' in window) || Notification.permission !== 'granted') return
    const due = reminders.filter((r) => !r.completed && r.date <= today && r.date >= addDays(today, -7) && data.reminders.notified[r.key] !== today)
    if (!due.length) return
    try {
      if (due.length <= 3) due.forEach((r) => new Notification(r.title, { body: `${fmtDate(r.date)} — ${r.detail}`, tag: r.key }))
      else new Notification(`${due.length} reminders due`, { body: due.slice(0, 4).map((r) => r.title).join(', ') + '…', tag: 'summary-' + today })
    } catch {
      return // some mobile browsers only allow notifications from a service worker
    }
    update((d) => { due.forEach((r) => (d.reminders.notified[r.key] = today)) })
  }, [reminders, today, data.reminders.browserNotifications, data.reminders.notified, update])
  return null
}

export function downloadAllICS(reminders: Reminder[], today: string) {
  downloadFile('life-planner-reminders.ics', toICS(reminders.filter((r) => !r.completed && r.date >= today)), 'text/calendar')
}
