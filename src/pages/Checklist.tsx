import { useState } from 'react'
import { usePlanner } from '../lib/usePlanner'
import { useUpdate } from '../lib/store'
import { daysUntil, fmtDate, isValidISO, relativeDays } from '../lib/dates'
import { uid } from '../lib/format'
import type { ChecklistTask, Priority, TaskStatus } from '../lib/types'
import { Badge, Button, Card, DateField, EmptyState, Modal, PageHeader, Progress, SelectField, StatusBadge, TextArea, TextField, cx } from '../components/ui'

const PRI_ORDER: Record<Priority, number> = { High: 0, Medium: 1, Low: 2 }

export default function Checklist() {
  const { data, today } = usePlanner()
  const update = useUpdate()
  const [edit, setEdit] = useState<ChecklistTask | null>(null)
  const [show, setShow] = useState<'open' | 'all' | 'done'>('open')
  const [sort, setSort] = useState<'deadline' | 'priority'>('deadline')

  const total = data.checklist.length
  const done = data.checklist.filter((t) => t.status === 'Done').length
  const daysLeft = daysUntil(data.profile.weddingDate, today)
  const tasks = data.checklist
    .filter((t) => (show === 'all' ? true : show === 'done' ? t.status === 'Done' : t.status !== 'Done'))
    .sort((a, b) => {
      if (sort === 'priority' && a.priority !== b.priority) return PRI_ORDER[a.priority] - PRI_ORDER[b.priority]
      return (a.deadline || '9999') < (b.deadline || '9999') ? -1 : (a.deadline || '9999') > (b.deadline || '9999') ? 1 : PRI_ORDER[a.priority] - PRI_ORDER[b.priority]
    })
  const overdue = data.checklist.filter((t) => t.status !== 'Done' && t.deadline && t.deadline < today).length

  return (
    <div className="space-y-6">
      <PageHeader title="Wedding Checklist" subtitle={`${fmtDate(data.profile.weddingDate, true)} · ${daysLeft >= 0 ? `${daysLeft} days to go` : 'Wedding date has passed'}`} actions={<Button onClick={() => setEdit({ id: '', title: '', deadline: '', priority: 'Medium', status: 'Not started', notes: '' })}>Add task</Button>} />

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl bg-navy-900 p-5 text-white shadow-card sm:col-span-1">
          <div className="text-xs uppercase tracking-[0.2em] text-gold-300">Countdown</div>
          <div className="mt-1 font-serif text-5xl font-semibold tabular-nums">{Math.max(0, daysLeft)}</div>
          <div className="text-sm text-navy-100">days · about {Math.max(0, Math.floor(daysLeft / 7))} weeks</div>
        </div>
        <Card className="sm:col-span-2" title={`${done} of ${total} tasks done`} subtitle={overdue ? `${overdue} overdue` : 'Nothing overdue'}>
          <Progress value={done} max={total || 1} tone="gold" label="Checklist progress" />
        </Card>
      </div>

      <Card title="Tasks" action={
        <div className="flex gap-2">
          <SelectField label="Show" className="w-32" value={show} onChange={setShow} options={[{ value: 'open', label: 'To do' }, { value: 'done', label: 'Done' }, { value: 'all', label: 'All' }]} />
          <SelectField label="Sort by" className="w-32" value={sort} onChange={setSort} options={[{ value: 'deadline', label: 'Deadline' }, { value: 'priority', label: 'Priority' }]} />
        </div>
      }>
        {tasks.length === 0 ? (
          <EmptyState title={show === 'done' ? 'No completed tasks yet' : 'All done here'}>{show === 'open' && total > 0 ? 'Every task is complete.' : undefined}</EmptyState>
        ) : (
          <ul className="divide-y divide-cream-200">
            {tasks.map((t) => {
              const n = t.deadline ? daysUntil(t.deadline, today) : null
              const late = t.status !== 'Done' && n !== null && n < 0
              return (
                <li key={t.id} className="flex items-start gap-3 py-3">
                  <input type="checkbox" checked={t.status === 'Done'} onChange={(e) => update((d) => { const x = d.checklist.find((y) => y.id === t.id); if (x) x.status = e.target.checked ? 'Done' : 'Not started' })} aria-label={`Mark "${t.title}" as ${t.status === 'Done' ? 'not done' : 'done'}`} className="mt-1 h-4 w-4 rounded border-cream-300 text-navy-700 focus:ring-gold-300" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={cx('text-sm font-medium text-navy-900', t.status === 'Done' && 'text-slate-500 line-through')}>{t.title}</span>
                      <StatusBadge status={t.priority} />
                      {t.status === 'In progress' && <StatusBadge status="In progress" />}
                      {late && <Badge tone="red">! Overdue</Badge>}
                    </div>
                    <div className="text-xs text-slate-500">{t.deadline ? <>Due {fmtDate(t.deadline)} · <span className={late ? 'text-red-700' : ''}>{relativeDays(n!)}</span></> : 'No deadline'}{t.notes && <> · {t.notes}</>}</div>
                  </div>
                  <div className="flex shrink-0 gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEdit(t)} aria-label={`Edit ${t.title}`}>Edit</Button>
                    <Button size="sm" variant="ghost" className="text-red-700" aria-label={`Delete ${t.title}`} onClick={() => confirm(`Delete "${t.title}"?`) && update((d) => { d.checklist = d.checklist.filter((x) => x.id !== t.id) })}>Delete</Button>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </Card>

      {edit && <TaskModal task={edit} weddingDate={data.profile.weddingDate} onClose={() => setEdit(null)} />}
    </div>
  )
}

function TaskModal({ task, weddingDate, onClose }: { task: ChecklistTask; weddingDate: string; onClose: () => void }) {
  const update = useUpdate()
  const [t, setT] = useState(task)
  const [err, setErr] = useState<Record<string, string>>({})
  const save = () => {
    const e: Record<string, string> = {}
    if (!t.title.trim()) e.title = 'Enter a task.'
    if (t.deadline && !isValidISO(t.deadline)) e.deadline = 'Enter a valid date.'
    setErr(e)
    if (Object.keys(e).length) return
    update((d) => {
      const clean = { ...t, title: t.title.trim() }
      if (clean.id) d.checklist = d.checklist.map((x) => (x.id === clean.id ? clean : x))
      else d.checklist.push({ ...clean, id: uid() })
    })
    onClose()
  }
  return (
    <Modal open title={task.id ? 'Edit task' : 'Add task'} onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button onClick={save}>Save</Button></>}>
      <div className="grid gap-3 sm:grid-cols-2">
        <TextField className="sm:col-span-2" label="Task" value={t.title} onChange={(v) => setT({ ...t, title: v })} error={err.title} required />
        <DateField label="Deadline" value={t.deadline} onChange={(v) => setT({ ...t, deadline: v })} error={err.deadline} hint={t.deadline > weddingDate ? 'This is after the wedding.' : undefined} />
        <SelectField<Priority> label="Priority" value={t.priority} onChange={(v) => setT({ ...t, priority: v })} options={['High', 'Medium', 'Low']} />
        <SelectField<TaskStatus> label="Status" value={t.status} onChange={(v) => setT({ ...t, status: v })} options={['Not started', 'In progress', 'Done']} />
        <TextArea className="sm:col-span-2" label="Notes" value={t.notes} onChange={(v) => setT({ ...t, notes: v })} rows={2} />
      </div>
    </Modal>
  )
}
