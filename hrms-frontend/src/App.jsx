import { Routes, Route, NavLink, Navigate } from 'react-router-dom'

import Dashboard from './pages/Dashboard.jsx'
import EmployeeList from './pages/EmployeeList.jsx'
import EmployeeFormPage from './pages/EmployeeFormPage.jsx'
import EmployeeDetail from './pages/EmployeeDetail.jsx'
import LeaveList from './pages/LeaveList.jsx'
import LeaveFormPage from './pages/LeaveFormPage.jsx'
import LeaveDetail from './pages/LeaveDetail.jsx'

// App = layout + routing table.
// The sidebar stays mounted; <Routes> swaps the page inside <main>.
export default function App() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <h1 className="brand">HRMS</h1>
        <nav>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/employees">Employees</NavLink>
          <NavLink to="/leaves">Leaves</NavLink>
        </nav>
      </aside>

      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />

          <Route path="/employees" element={<EmployeeList />} />
          <Route path="/employees/new" element={<EmployeeFormPage />} />
          <Route path="/employees/:id" element={<EmployeeDetail />} />
          <Route path="/employees/:id/edit" element={<EmployeeFormPage />} />

          <Route path="/leaves" element={<LeaveList />} />
          <Route path="/leaves/new" element={<LeaveFormPage />} />
          <Route path="/leaves/:id" element={<LeaveDetail />} />
          <Route path="/leaves/:id/edit" element={<LeaveFormPage />} />

          <Route
            path="*"
            element={
              <div className="page">
                <h2>Page not found</h2>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  )
}
