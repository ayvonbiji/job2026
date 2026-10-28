import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import Layout from './components/Layout'
import { Notifier } from './components/Reminders'
import Dashboard from './pages/Dashboard'
import JobTracker from './pages/JobTracker'
import LeaveTracker from './pages/LeaveTracker'
import MoneyTracker from './pages/MoneyTracker'
import WeddingBudget from './pages/WeddingBudget'
import SavingsPlanner from './pages/SavingsPlanner'
import Checklist from './pages/Checklist'
import Settings from './pages/Settings'

// HashRouter keeps routing working on static hosts such as GitHub Pages.
export default function App() {
  return (
    <HashRouter>
      <Notifier />
      <Layout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/job" element={<JobTracker />} />
          <Route path="/leave" element={<LeaveTracker />} />
          <Route path="/money" element={<MoneyTracker />} />
          <Route path="/wedding" element={<WeddingBudget />} />
          <Route path="/savings" element={<SavingsPlanner />} />
          <Route path="/checklist" element={<Checklist />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Layout>
    </HashRouter>
  )
}
