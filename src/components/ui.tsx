import { useEffect, useId, useRef, useState, type ReactNode, type ButtonHTMLAttributes } from 'react'
import type { Level } from '../lib/calc/job'

export function cx(...c: (string | false | null | undefined)[]) {
  return c.filter(Boolean).join(' ')
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="font-serif text-3xl font-semibold text-navy-900 sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  )
}

export function Card({ title, subtitle, action, children, className, id }: { title?: ReactNode; subtitle?: ReactNode; action?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={cx('rounded-2xl border border-cream-300/70 bg-white p-5 shadow-card', className)}>
      {(title || action) && (
        <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
          <div>
            {title && <h2 className="text-base font-semibold text-navy-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

type Tone = 'navy' | 'gold' | 'green' | 'amber' | 'red' | 'slate'

const badgeTone: Record<Tone, string> = {
  navy: 'bg-navy-50 text-navy-700 ring-navy-100',
  gold: 'bg-gold-50 text-gold-700 ring-gold-100',
  green: 'bg-emerald-50 text-emerald-800 ring-emerald-100',
  amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  red: 'bg-red-50 text-red-800 ring-red-100',
  slate: 'bg-slate-100 text-slate-700 ring-slate-200',
}

export function Badge({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset', badgeTone[tone])}>{children}</span>
}

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, Tone> = {
    Paid: 'green', 'Partially Paid': 'amber', 'Not Paid': 'slate',
    Approved: 'green', Taken: 'navy', Pending: 'amber', Planned: 'gold', Rejected: 'red', Cancelled: 'slate',
    Done: 'green', 'In progress': 'amber', 'Not started': 'slate',
    Completed: 'green', Confirmed: 'green', Extended: 'amber', 'Not confirmed': 'red',
    Met: 'green', Missed: 'red', Upcoming: 'slate',
    High: 'red', Medium: 'amber', Low: 'slate',
  }
  const icon = map[status] === 'green' ? '✓ ' : map[status] === 'red' ? '! ' : ''
  return <Badge tone={map[status] ?? 'slate'}>{icon}{status}</Badge>
}

export function Progress({ value, max = 100, tone = 'navy', label, showLabel = true }: { value: number; max?: number; tone?: 'navy' | 'gold' | 'green' | 'red' | 'amber'; label: string; showLabel?: boolean }) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0
  const bar = { navy: 'bg-navy-600', gold: 'bg-gold-500', green: 'bg-emerald-600', red: 'bg-red-600', amber: 'bg-amber-500' }[tone]
  return (
    <div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-cream-200" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <div className={cx('h-full rounded-full', bar)} style={{ width: `${pct}%` }} />
      </div>
      {showLabel && <div className="mt-1 text-xs text-slate-500">{Math.round(pct)}%</div>}
    </div>
  )
}

const noticeStyles: Record<Level, { box: string; icon: string; label: string }> = {
  danger: { box: 'border-red-200 bg-red-50 text-red-900', icon: '⚠', label: 'Warning' },
  warning: { box: 'border-amber-200 bg-amber-50 text-amber-900', icon: '!', label: 'Check' },
  info: { box: 'border-navy-100 bg-navy-50 text-navy-800', icon: 'i', label: 'Note' },
  ok: { box: 'border-emerald-200 bg-emerald-50 text-emerald-900', icon: '✓', label: 'OK' },
}

export function Alert({ level, children }: { level: Level; children: ReactNode }) {
  const s = noticeStyles[level]
  return (
    <div className={cx('flex gap-3 rounded-xl border px-3 py-2.5 text-sm', s.box)} role={level === 'danger' ? 'alert' : undefined}>
      <span aria-hidden className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white/70 text-xs font-bold">{s.icon}</span>
      <div><span className="sr-only">{s.label}: </span>{children}</div>
    </div>
  )
}

export function Button({ variant = 'primary', size = 'md', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'gold'; size?: 'sm' | 'md' }) {
  const v = {
    primary: 'bg-navy-800 text-white hover:bg-navy-700',
    gold: 'bg-gold-500 text-white hover:bg-gold-600',
    secondary: 'border border-cream-300 bg-white text-navy-800 hover:bg-cream-100',
    ghost: 'text-navy-700 hover:bg-cream-100',
    danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
  }[variant]
  const s = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-2 text-sm'
  return (
    <button
      type="button"
      {...props}
      className={cx('inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50', v, s, className)}
    />
  )
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-cream-300 bg-cream-50 px-4 py-8 text-center">
      <p className="font-medium text-navy-800">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">{children}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}

// ---------- Form fields ----------

const inputBase =
  'mt-1 block w-full rounded-lg border bg-white px-3 py-2 text-sm text-navy-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-gold-300 disabled:bg-cream-100'

interface FieldProps {
  label: string
  hint?: ReactNode
  error?: string
  className?: string
}

function FieldShell({ id, label, hint, error, className, children }: FieldProps & { id: string; children: ReactNode }) {
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-medium text-navy-800">{label}</label>
      {children}
      {hint && !error && <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">{hint}</p>}
      {error && <p id={`${id}-err`} className="mt-1 text-xs font-medium text-red-700">{error}</p>}
    </div>
  )
}

export function TextField({ label, hint, error, className, value, onChange, type = 'text', placeholder, required, autoComplete }: FieldProps & { value: string; onChange: (v: string) => void; type?: string; placeholder?: string; required?: boolean; autoComplete?: string }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <input
        id={id}
        type={type}
        value={value}
        placeholder={placeholder}
        required={required}
        autoComplete={autoComplete}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cx(inputBase, error ? 'border-red-400' : 'border-cream-300')}
      />
    </FieldShell>
  )
}

export function DateField(props: FieldProps & { value: string; onChange: (v: string) => void; required?: boolean; min?: string; max?: string }) {
  const id = useId()
  const { label, hint, error, className, value, onChange, required, min, max } = props
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <input
        id={id}
        type="date"
        value={value}
        min={min}
        max={max}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value)}
        className={cx(inputBase, error ? 'border-red-400' : 'border-cream-300')}
      />
    </FieldShell>
  )
}

/**
 * Number input that commits valid values straight to the store and shows an
 * error for invalid text without overwriting your saved value.
 */
export function NumberField({ label, hint, className, value, onChange, min = 0, max, step = 1, prefix, allowDecimal = true }: FieldProps & { value: number; onChange: (v: number) => void; min?: number; max?: number; step?: number; prefix?: string; allowDecimal?: boolean }) {
  const id = useId()
  const [text, setText] = useState(String(value))
  const [error, setError] = useState('')
  const last = useRef(value)
  useEffect(() => {
    if (value !== last.current) {
      setText(String(value))
      last.current = value
    }
  }, [value])
  const commit = (t: string) => {
    setText(t)
    const clean = t.replace(/,/g, '').trim()
    if (clean === '') {
      setError('Enter a number (use 0 if none).')
      return
    }
    const n = Number(clean)
    if (!Number.isFinite(n)) return setError('Enter a valid number.')
    if (!allowDecimal && !Number.isInteger(n)) return setError('Enter a whole number.')
    if (n < min) return setError(`Must be ${min} or more.`)
    if (max !== undefined && n > max) return setError(`Must be ${max} or less.`)
    setError('')
    last.current = n
    onChange(n)
  }
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <div className="relative">
        {prefix && <span className="pointer-events-none absolute inset-y-0 left-3 mt-1 flex items-center text-sm text-slate-500">{prefix}</span>}
        <input
          id={id}
          type="text"
          inputMode={allowDecimal ? 'decimal' : 'numeric'}
          value={text}
          step={step}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
          onChange={(e) => commit(e.target.value)}
          onBlur={() => {
            if (error) {
              setText(String(last.current))
              setError('')
            }
          }}
          className={cx(inputBase, prefix && 'pl-7', error ? 'border-red-400' : 'border-cream-300')}
        />
      </div>
    </FieldShell>
  )
}

export function SelectField<T extends string>({ label, hint, error, className, value, onChange, options }: FieldProps & { value: T; onChange: (v: T) => void; options: readonly (T | { value: T; label: string })[] }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <select
        id={id}
        value={value}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : hint ? `${id}-hint` : undefined}
        onChange={(e) => onChange(e.target.value as T)}
        className={cx(inputBase, error ? 'border-red-400' : 'border-cream-300')}
      >
        {options.map((o) => {
          const v = typeof o === 'string' ? o : o.value
          const l = typeof o === 'string' ? o : o.label
          return <option key={v} value={v}>{l}</option>
        })}
      </select>
    </FieldShell>
  )
}

export function TextArea({ label, hint, error, className, value, onChange, rows = 3 }: FieldProps & { value: string; onChange: (v: string) => void; rows?: number }) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} hint={hint} error={error} className={className}>
      <textarea id={id} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} className={cx(inputBase, 'border-cream-300')} />
    </FieldShell>
  )
}

export function Checkbox({ label, checked, onChange, hint }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: string }) {
  const id = useId()
  return (
    <div className="flex items-start gap-2">
      <input id={id} type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-cream-300 text-navy-700 focus:ring-gold-300" />
      <div>
        <label htmlFor={id} className="text-sm text-navy-800">{label}</label>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
    </div>
  )
}

// ---------- Modal ----------

export function Modal({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onCancel={(e) => {
        e.preventDefault()
        onClose()
      }}
      aria-labelledby="modal-title"
      className="w-[calc(100%-2rem)] max-w-lg rounded-2xl border border-cream-300 bg-white p-0 text-navy-900 shadow-xl backdrop:bg-navy-900/40"
    >
      {open && (
        <div className="flex max-h-[85vh] flex-col">
          <div className="flex items-center justify-between border-b border-cream-200 px-5 py-3">
            <h2 id="modal-title" className="text-base font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="rounded-md p-1 text-slate-500 hover:bg-cream-100" aria-label="Close">✕</button>
          </div>
          <div className="overflow-y-auto px-5 py-4">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-cream-200 px-5 py-3">{footer}</div>}
        </div>
      )}
    </dialog>
  )
}

export function Table({ children, caption }: { children: ReactNode; caption?: string }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[560px] border-collapse text-left text-sm">
        {caption && <caption className="sr-only">{caption}</caption>}
        {children}
      </table>
    </div>
  )
}

export const th = 'border-b border-cream-200 px-2 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500'
export const td = 'border-b border-cream-100 px-2 py-2 align-top'

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'red' | 'green' | 'amber' }) {
  const color = tone === 'red' ? 'text-red-700' : tone === 'green' ? 'text-emerald-700' : tone === 'amber' ? 'text-amber-700' : 'text-navy-900'
  return (
    <div className="rounded-xl bg-cream-100 px-3 py-2.5">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={cx('mt-0.5 text-lg font-semibold tabular-nums', color)}>{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  )
}
