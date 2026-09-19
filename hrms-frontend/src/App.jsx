import { Navigate, Route, Routes } from 'react-router-dom'

import AppLayout from './components/layout/AppLayout'
import ProtectedRoute from './components/ProtectedRoute'

import Dashboard from './pages/Dashboard.jsx'
import EmployeeDashboard from './pages/EmployeeDashboard.jsx'
import NotFound from './pages/NotFound.jsx'

import EmployeeList from './pages/EmployeeList.jsx'
import EmployeeFormPage from './pages/EmployeeFormPage.jsx'
import EmployeeDetail from './pages/EmployeeDetail.jsx'

import LeaveList from './pages/LeaveList.jsx'
import LeaveFormPage from './pages/LeaveFormPage.jsx'
import LeaveDetail from './pages/LeaveDetail.jsx'

import AttendanceList from './pages/AttendanceList.jsx'
import AttendanceFormPage from './pages/AttendanceFormPage.jsx'
import AttendanceDetail from './pages/AttendanceDetail.jsx'

import PayrollList from './pages/PayrollList.jsx'
import PayrollFormPage from './pages/PayrollFormPage.jsx'
import PayrollDetail from './pages/PayrollDetail.jsx'

import MyProfile from './pages/MyProfile.jsx'
import UserManagement from './pages/UserManagement.jsx'
import Login from './pages/Login.jsx'

// =============================================================================
// App - the routing table, now ROLE-AWARE.
// =============================================================================
// Route protection follows the same three roles the backend enforces
// (ADMIN / HR / EMPLOYEE). Two things to understand about the model:
//
// 1. The backend is the REAL gate. These wrappers are UX: they keep users
//    away from pages that would answer 403 and stop them deep-linking into
//    screens whose actions their role may not perform. Nothing here "secures"
//    data - every API call still carries the JWT and the backend decides.
// 2. Shared routes stay shared on purpose. /leaves, /attendance and /payrolls
//    are visible to ADMIN+HR (org-wide) AND to EMPLOYEE (the backend scopes
//    the lists to the caller's own rows). A separate /my/leaves route would
//    duplicate pages for no security gain.
//
// Write routes (new/edit forms, users) are wrapped so an EMPLOYEE deep link
// lands on a friendly "no permission" card instead of a half-working form.
//
// ⚠ The guards below are the real rule. config/access.js keeps a second copy of
// them, used only to pick a landing page after login - change both together.

export default function App() {
  return (
    <Routes>
      {/* ---- public: full screen, no app chrome ----
          /login is the ONLY public route in the whole app. */}
      <Route path="/login" element={<Login />} />

      {/* ---- protected: everything inside gets the app shell ---- */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        {/* Dashboard is role-aware on the inside (AdminDashboard vs
            EmployeeDashboard); one route for all three roles. */}
        <Route path="/dashboard" element={<Dashboard />} />

        {/* ---- Workforce: ADMIN + HR (EMPLOYEE tokens get 403 from the
             employees list API, so the route is wrapped to match) ---- */}
        <Route element={<ProtectedRoute roles={['ADMIN', 'HR']} />}>
          <Route path="/employees" element={<EmployeeList />} />
          <Route path="/employees/:id" element={<EmployeeDetail />} />
        </Route>

        {/* Employee master data is ADMIN-only to write (backend: 403 for HR) */}
        <Route element={<ProtectedRoute roles={['ADMIN']} />}>
          <Route path="/employees/new" element={<EmployeeFormPage />} />
          <Route path="/employees/:id/edit" element={<EmployeeFormPage />} />
          {/* Account management - the ADMIN toolbox. */}
          <Route path="/users" element={<UserManagement />} />
        </Route>

        {/* ---- Leave / Attendance / Payroll: shared routes, role-shaped
             content. ADMIN+HR see org-wide lists; EMPLOYEE sees their own
             rows (backend scoping). Writes are ADMIN/EMPLOYEE for leave and
             ADMIN-only for attendance/payroll, mirrored below. ---- */}
        <Route path="/leaves" element={<LeaveList />} />
        <Route path="/leaves/:id" element={<LeaveDetail />} />
        <Route element={<ProtectedRoute roles={['ADMIN', 'EMPLOYEE']} />}>
          <Route path="/leaves/new" element={<LeaveFormPage />} />
          <Route path="/leaves/:id/edit" element={<LeaveFormPage />} />
        </Route>

        <Route path="/attendance" element={<AttendanceList />} />
        <Route path="/attendance/:id" element={<AttendanceDetail />} />
        <Route element={<ProtectedRoute roles={['ADMIN']} />}>
          <Route path="/attendance/new" element={<AttendanceFormPage />} />
          <Route path="/attendance/:id/edit" element={<AttendanceFormPage />} />
        </Route>

        <Route path="/payrolls" element={<PayrollList />} />
        <Route path="/payrolls/:id" element={<PayrollDetail />} />
        <Route element={<ProtectedRoute roles={['ADMIN']} />}>
          <Route path="/payrolls/new" element={<PayrollFormPage />} />
          <Route path="/payrolls/:id/edit" element={<PayrollFormPage />} />
        </Route>

        {/* ---- Employee self-service profile (my own record, from the JWT) ---- */}
        <Route element={<ProtectedRoute roles={['EMPLOYEE']} />}>
          <Route path="/me" element={<MyProfile />} />
        </Route>

        {/* Anything else, inside the shell so the nav is still available. */}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  )
}
