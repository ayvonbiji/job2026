import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { addMonthKey, DAY_NAMES, fmtMonth, monthKey, parseISO, toISO } from '../lib/dates'
import type { CalEvent, CalKind } from '../lib/calc/reminders'
import { Button, cx } from './ui'

const kindStyle: Record<CalKind, { chip: string; legend: string }> = {
  salary: { chip: 'bg-emerald-50 text-emerald-900 ring-1 ring-dashed ring-emerald-300', legend: 'Salary due' },
  salaryPaid: { chip: 'bg-emerald-600 text-white', legend: 'Salary received' },
  expense: { chip: 'bg-slate-200 text-slate-800', legend: 'Rent, bills & expenses' },
  wedding: { chip: 'bg-gold-500 text-white', legend: 'Wedding' },
  savings: { chip: 'bg-navy-100 text-navy-800', legend: 'Savings' },
  leave: { chip: 'bg-navy-700 text-white', legend: 'Leave (approved/taken)' },
  leavePending: { chip: 'bg-amber-100 text-amber-900 ring-1 ring-amber-300', legend: 'Leave (planned/pending)' },
  holiday: { chip: 'bg-rose-100 text-rose-900', legend: 'Holiday' },
  job: { chip: 'bg-white text-navy-800 ring-1 ring-navy-300', legend: 'Employment' },
  reminder: { chip: 'bg-white text-slate-700 ring-1 ring-cream-300', legend: 'Reminder' },
}

export default function MonthCalendar({ events, weekendDays, today, onSelectDate, selected }: { events: CalEvent[]; weekendDays: number[]; today: string; onSelectDate?: (d: string) => void; selected?: string }) {
  const [month, setMonth] = useState(monthKey(today))
  const first = parseISO(`${month}-01`)
  const offset = (first.getDay() + 6) % 7
  const start = new Date(first)
  start.setDate(1 - offset)
  const cells: string[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    cells.push(toISO(d))
  }
  const rows = cells.slice(35).some((c) => monthKey(c) === month) ? 6 : 5
  const byDate = new Map<string, CalEvent[]>()
  for (const e of events) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e])
  const order = [1, 2, 3, 4, 5, 6, 0]
  const kindsShown = Array.from(new Set(events.filter((e) => monthKey(e.date) === month).map((e) => e.kind)))

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <Button variant="secondary" size="sm" onClick={() => setMonth(addMonthKey(month, -1))} aria-label="Previous month"><ChevronLeft className="h-4 w-4" aria-hidden /></Button>
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-navy-900" aria-live="polite">{fmtMonth(month)}</h3>
          {month !== monthKey(today) && <Button variant="ghost" size="sm" onClick={() => setMonth(monthKey(today))}>Today</Button>}
        </div>
        <Button variant="secondary" size="sm" onClick={() => setMonth(addMonthKey(month, 1))} aria-label="Next month"><ChevronRight className="h-4 w-4" aria-hidden /></Button>
      </div>
      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-cream-200 bg-cream-200 text-xs" role="grid" aria-label={`Calendar for ${fmtMonth(month)}`}>
        {order.map((d) => (
          <div key={d} role="columnheader" className="bg-cream-100 px-1 py-1.5 text-center font-semibold text-slate-600">{DAY_NAMES[d]}</div>
        ))}
        {cells.slice(0, rows * 7).map((c) => {
          const inMonth = monthKey(c) === month
          const evs = byDate.get(c) ?? []
          const weekend = weekendDays.includes(parseISO(c).getDay())
          const label = `${c}${evs.length ? ': ' + evs.map((e) => e.label).join(', ') : ''}`
          const Tag = onSelectDate ? 'button' : 'div'
          return (
            <Tag
              key={c}
              type={onSelectDate ? 'button' : undefined}
              role="gridcell"
              aria-label={label}
              aria-selected={selected === c || undefined}
              onClick={onSelectDate ? () => onSelectDate(c) : undefined}
              className={cx('min-h-[64px] p-1 text-left align-top sm:min-h-[88px]', inMonth ? (weekend ? 'bg-cream-50' : 'bg-white') : 'bg-cream-100/60 text-slate-400', selected === c && 'ring-2 ring-inset ring-gold-300')}
            >
              <div className={cx('mb-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[11px]', c === today ? 'bg-gold-500 font-bold text-white' : 'text-slate-600')}>{Number(c.slice(8))}</div>
              <div className="space-y-0.5">
                {evs.slice(0, 3).map((e, i) => (
                  <div key={i} title={e.label} className={cx('truncate rounded px-1 py-px text-[10px] leading-tight sm:text-[11px]', kindStyle[e.kind].chip)}>
                    {e.half ? '½ ' : ''}{e.label}
                  </div>
                ))}
                {evs.length > 3 && <div className="text-[10px] text-slate-500">+{evs.length - 3} more</div>}
              </div>
            </Tag>
          )
        })}
      </div>
      {kindsShown.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600" aria-label="Legend">
          {kindsShown.map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className={cx('inline-block h-3 w-3 rounded-sm', kindStyle[k].chip)} aria-hidden />
              {kindStyle[k].legend}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
