import { useEffect } from 'react'
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { Notifier } from './components/Reminders'
import Dashboard from './pages/Dashboard'
import Employment from './pages/Employment'
import Probation from './pages/Probation'
import Resignation from './pages/Resignation'
import LeaveTracker from './pages/LeaveTracker'
import MoneyTracker from './pages/MoneyTracker'
import WeddingBudget from './pages/WeddingBudget'
import SavingsPlanner from './pages/SavingsPlanner'
import Checklist from './pages/Checklist'
import CalendarPage from './pages/CalendarPage'
import Settings from './pages/Settings'
import { ChooseStart, Loading, Login } from './pages/Login'
import { cloudEnabled, initCloud, useCloud } from './lib/cloud/sync'

function Planner() {
  return (
    <HashRouter>
      <Notifier />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/employment" element={<Employment />} />
          <Route path="/probation" element={<Probation />} />
          <Route path="/resignation" element={<Resignation />} />
          <Route path="/leave" element={<LeaveTracker />} />
          <Route path="/money" element={<MoneyTracker />} />
          <Route path="/wedding" element={<WeddingBudget />} />
          <Route path="/savings" element={<SavingsPlanner />} />
          <Route path="/checklist" element={<Checklist />} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/job" element={<Navigate to="/employment" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  )
}

/** With Supabase configured, the planner is only shown to a signed-in user. Otherwise it runs privately on this device. */
export default function App() {
  const phase = useCloud((s) => s.phase)
  useEffect(() => {
    if (cloudEnabled) initCloud()
  }, [])
  if (!cloudEnabled) return <Planner />
  if (phase === 'signedOut') return <Login />
  if (phase === 'loading') return <Loading />
  if (phase === 'choose') return <ChooseStart />
  if (phase === 'error') return <Loading text="Could not reach your account. Check your connection and reload the page." />
  return <Planner />
}
