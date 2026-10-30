import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  BadgeCheck,
  Briefcase,
  CalendarDays,
  CalendarRange,
  CircleCheckBig,
  Cloud,
  CloudOff,
  Gem,
  LayoutDashboard,
  LogOut,
  Menu,
  PiggyBank,
  Settings,
  Wallet,
  X,
  DoorOpen,
  Loader2,
} from 'lucide-react'
import { useStore } from '../lib/store'
import { usePlanner } from '../lib/usePlanner'
import { daysUntil, fmtDate } from '../lib/dates'
import { cloudEnabled, retrySync, signOut, useCloud } from '../lib/cloud/sync'
import { cx } from './ui'

const NAV = [
  { to: '/', label: 'Overview', icon: LayoutDashboard },
  { to: '/employment', label: 'Job & Employment', icon: Briefcase },
  { to: '/probation', label: 'Probation Tracker', icon: BadgeCheck },
  { to: '/resignation', label: 'Resignation Planner', icon: DoorOpen },
  { to: '/leave', label: 'Leave Management', icon: CalendarRange },
  { to: '/money', label: 'Money Tracker', icon: Wallet },
  { to: '/wedding', label: 'Wedding Budget', icon: Gem },
  { to: '/savings', label: 'Savings Planner', icon: PiggyBank },
  { to: '/checklist', label: 'Wedding Checklist', icon: CircleCheckBig },
  { to: '/calendar', label: 'Calendar & Reminders', icon: CalendarDays },
  { to: '/settings', label: 'Settings', icon: Settings },
]

function SyncBadge() {
  const sync = useStore((s) => s.sync)
  const user = useCloud((s) => s.user)
  if (!cloudEnabled) return <div className="flex items-center gap-1.5 text-xs text-navy-100"><CloudOff className="h-3.5 w-3.5" aria-hidden /> Saved on this device</div>
  const label = sync === 'saving' || sync === 'loading' ? 'Saving…' : sync === 'error' ? 'Not saved — retrying' : 'Saved to your account'
  return (
    <div className="space-y-1 text-xs text-navy-100">
      <div className="flex items-center gap-1.5">
        {sync === 'saving' || sync === 'loading' ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : sync === 'error' ? <CloudOff className="h-3.5 w-3.5 text-amber-300" aria-hidden /> : <Cloud className="h-3.5 w-3.5" aria-hidden />}
        <span aria-live="polite">{label}</span>
        {sync === 'error' && <button type="button" className="underline" onClick={retrySync}>Retry</button>}
      </div>
      {user && (
        <button type="button" onClick={() => void signOut()} className="flex items-center gap-1.5 hover:text-white">
          <LogOut className="h-3.5 w-3.5" aria-hidden /> Sign out ({user.email})
        </button>
      )}
    </div>
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
    <nav aria-label="Main" className="flex flex-col gap-0.5">
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
          <n.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
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

      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col justify-between overflow-y-auto bg-navy-900 px-4 py-6 lg:flex">
        <div className="space-y-6">
          {brand}
          {nav}
        </div>
        <div className="mt-6 space-y-3">
          <div className="rounded-xl border border-white/10 px-3 py-3 text-xs text-navy-100">
            <div className="text-gold-300">Wedding</div>
            <div className="mt-0.5 text-lg font-semibold tabular-nums text-white">{d >= 0 ? `${d} days` : 'Married!'}</div>
            <div>{fmtDate(data.profile.weddingDate)}</div>
          </div>
          <SyncBadge />
        </div>
      </aside>

      <div className="sticky top-0 z-30 flex items-center justify-between bg-navy-900 px-4 py-3 lg:hidden">
        {brand}
        <button type="button" onClick={() => setOpen(!open)} aria-expanded={open} aria-controls="mobile-nav" className="rounded-lg p-2 text-white hover:bg-white/10" aria-label={open ? 'Close menu' : 'Open menu'}>
          {open ? <X className="h-6 w-6" aria-hidden /> : <Menu className="h-6 w-6" aria-hidden />}
        </button>
      </div>
      {open && (
        <div id="mobile-nav" className="fixed inset-x-0 bottom-0 top-[60px] z-20 overflow-y-auto bg-navy-900 px-4 pb-6 shadow-lg lg:hidden">
          {nav}
          <div className="mt-4 border-t border-white/10 pt-4"><SyncBadge /></div>
        </div>
      )}

      <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto mb-3 max-w-6xl space-y-3">
          {loadError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{loadError}</div>}
          {saveError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{saveError} You can also download a backup from Settings.</div>}
        </div>
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  )
}
