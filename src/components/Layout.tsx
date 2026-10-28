import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useStore } from '../lib/store'
import { usePlanner } from '../lib/usePlanner'
import { daysUntil, fmtDate } from '../lib/dates'
import { cx } from './ui'

const icons: Record<string, ReactNode> = {
  dashboard: <path d="M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6v-9h-6v9zm0-16v5h6V4h-6z" />,
  job: <path d="M10 4h4a2 2 0 0 1 2 2v1h3a1 1 0 0 1 1 1v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a1 1 0 0 1 1-1h3V6a2 2 0 0 1 2-2zm0 3h4V6h-4v1z" />,
  leave: <path d="M7 3v2H5a1 1 0 0 0-1 1v13a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1h-2V3h-2v2H9V3H7zm-1 7h12v8H6v-8z" />,
  money: <path d="M3 6h18v12H3V6zm9 3a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM5 8v2a2 2 0 0 0 2-2H5zm12 0a2 2 0 0 0 2 2V8h-2zM5 14v2h2a2 2 0 0 0-2-2zm14 0a2 2 0 0 0-2 2h2v-2z" />,
  wedding: <path d="M9 8a6 6 0 1 0 0 12A6 6 0 0 0 9 8zm6 0a6 6 0 0 0-2.2.4 7.9 7.9 0 0 1 0 11.2A6 6 0 1 0 15 8zM10 2l2 3 2-3h-4z" />,
  savings: <path d="M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm1 4v1.1c1.4.3 2.5 1.2 2.5 2.4h-2c0-.4-.6-.8-1.5-.8s-1.5.4-1.5.8.4.7 1.8 1c2 .4 3.2 1.2 3.2 2.8 0 1.2-1.1 2.1-2.5 2.4V18h-2v-1.2c-1.5-.3-2.5-1.2-2.5-2.5h2c0 .5.6.9 1.5.9s1.5-.4 1.5-.9-.4-.7-1.8-1c-2-.4-3.2-1.1-3.2-2.8 0-1.2 1-2.1 2.5-2.4V7h2z" />,
  checklist: <path d="M9 4h6v2H9V4zM6 5h2v2h8V5h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1zm4.3 11.7L16 11l-1.4-1.4-4.3 4.3-1.9-1.9L7 13.4l3.3 3.3z" />,
  settings: <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zm8.4 5.5-1.9-.3a6.9 6.9 0 0 1-.6 1.5l1.1 1.6-1.6 1.6-1.6-1.1a6.9 6.9 0 0 1-1.5.6l-.3 1.9h-2.2l-.3-1.9a6.9 6.9 0 0 1-1.5-.6l-1.6 1.1-1.6-1.6 1.1-1.6a6.9 6.9 0 0 1-.6-1.5l-1.9-.3v-2.2l1.9-.3c.1-.5.3-1 .6-1.5L5.3 7.2l1.6-1.6 1.6 1.1c.5-.3 1-.5 1.5-.6l.3-1.9h2.2l.3 1.9c.5.1 1 .3 1.5.6l1.6-1.1 1.6 1.6-1.1 1.6c.3.5.5 1 .6 1.5l1.9.3v2.2z" />,
}

const NAV = [
  { to: '/', label: 'Dashboard', icon: 'dashboard' },
  { to: '/job', label: 'Job Tracker', icon: 'job' },
  { to: '/leave', label: 'Leave Tracker', icon: 'leave' },
  { to: '/money', label: 'Money Tracker', icon: 'money' },
  { to: '/wedding', label: 'Wedding Budget', icon: 'wedding' },
  { to: '/savings', label: 'Savings Planner', icon: 'savings' },
  { to: '/checklist', label: 'Wedding Checklist', icon: 'checklist' },
  { to: '/settings', label: 'Settings', icon: 'settings' },
]

function Icon({ name }: { name: string }) {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
      {icons[name]}
    </svg>
  )
}

export default function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const loc = useLocation()
  const { loadError, saveError } = useStore()
  const { data, today } = usePlanner()
  const d = daysUntil(data.profile.weddingDate, today)
  useEffect(() => {
    setOpen(false)
    window.scrollTo(0, 0)
  }, [loc.pathname])

  const nav = (
    <nav aria-label="Main" className="flex flex-col gap-1">
      {NAV.map((n) => (
        <NavLink
          key={n.to}
          to={n.to}
          end={n.to === '/'}
          className={({ isActive }) =>
            cx(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
              isActive ? 'bg-white/10 text-white shadow-[inset_3px_0_0_#dcb866]' : 'text-navy-100 hover:bg-white/5 hover:text-white',
            )
          }
        >
          <Icon name={n.icon} />
          {n.label}
        </NavLink>
      ))}
    </nav>
  )

  const brand = (
    <div>
      <div className="font-serif text-2xl font-semibold leading-tight text-white">My Life Planner</div>
      <div className="text-xs tracking-[0.2em] text-gold-300">2027</div>
    </div>
  )

  return (
    <div className="min-h-screen bg-cream-50 lg:flex">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-white focus:px-3 focus:py-2">Skip to content</a>

      {/* Desktop sidebar */}
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between bg-navy-900 px-4 py-6 lg:flex">
        <div className="space-y-8">
          {brand}
          {nav}
        </div>
        <div className="rounded-xl border border-white/10 px-3 py-3 text-xs text-navy-100">
          <div className="text-gold-300">Wedding</div>
          <div className="mt-0.5 text-lg font-semibold text-white tabular-nums">{d >= 0 ? `${d} days` : 'Married!'}</div>
          <div>{fmtDate(data.profile.weddingDate)}</div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-30 flex items-center justify-between bg-navy-900 px-4 py-3 lg:hidden">
        {brand}
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-nav" className="rounded-lg p-2 text-white hover:bg-white/10" aria-label={open ? 'Close menu' : 'Open menu'}>
          <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current" aria-hidden>
            {open ? <path d="M6.4 5 12 10.6 17.6 5 19 6.4 13.4 12l5.6 5.6-1.4 1.4-5.6-5.6L6.4 19 5 17.6l5.6-5.6L5 6.4z" /> : <path d="M4 6h16v2H4V6zm0 5h16v2H4v-2zm0 5h16v2H4v-2z" />}
          </svg>
        </button>
      </div>
      {open && (
        <div id="mobile-nav" className="fixed inset-x-0 top-[60px] z-20 bg-navy-900 px-4 pb-4 shadow-lg lg:hidden">
          {nav}
        </div>
      )}

      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-6xl space-y-3">
          {loadError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</div>}
          {saveError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{saveError} Download a backup from Settings to keep your data safe.</div>}
        </div>
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  )
}
