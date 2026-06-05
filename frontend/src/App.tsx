import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import DashboardLayout from './layouts/DashboardLayout'
import HomePage from './pages/HomePage'
import LoginPage from './pages/LoginPage'
import InboxPage from './pages/inbox/InboxPage'
import CampaignsPage from './pages/CampaignsPage'
import CompliancePage from './pages/CompliancePage'
import AnalyticsPage from './pages/AnalyticsPage'
import BackendGate from './components/BackendGate'

export default function App() {
  return (
    <BackendGate>
    <BrowserRouter>
      <Routes>
        {/* Root → landing */}
        <Route path="/" element={<Navigate to="/home" replace />} />
        <Route path="/home" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />

        {/* Dashboard pages */}
        <Route element={<DashboardLayout />}>
          <Route path="/inbox" element={<InboxPage />} />
          <Route path="/campaigns" element={<CampaignsPage />} />
          <Route path="/compliance" element={<CompliancePage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
        </Route>

        {/* Catch-all → landing */}
        <Route path="*" element={<Navigate to="/home" replace />} />
      </Routes>
    </BrowserRouter>
    </BackendGate>
  )
}
