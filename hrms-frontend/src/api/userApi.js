import api from './axiosInstance'

// userApi = ADMIN user management, one function per backend endpoint.
//
// WHY THIS FILE EXISTS AT ALL: with public signup gone, an ADMIN is the only
// way an account comes into being - so this IS the account-creation surface of
// the app. It is a thin 1:1 map of UserController:
//
//   POST   /api/auth/users              -> 8085 POST   /auth/users
//   GET    /api/auth/users              -> 8085 GET    /auth/users
//   GET    /api/auth/users/{id}         -> 8085 GET    /auth/users/{id}
//   PUT    /api/auth/users/{id}         -> 8085 PUT    /auth/users/{id}
//   PATCH  /api/auth/users/{id}/status  -> 8085 PATCH  /auth/users/{id}/status
//   PATCH  /api/auth/users/{id}/role    -> 8085 PATCH  /auth/users/{id}/role
//
// EVERY ONE OF THESE REQUIRES AN ADMIN TOKEN. The backend enforces it twice
// (URL rule + @PreAuthorize), so an HR or EMPLOYEE token gets a 403 with
// { status: 403, message: 'Access denied: this operation requires the ADMIN role' }
// - the UI is not what keeps this safe, the server is.
//
// Scope note: this is the API layer only. No admin screens are built yet, so
// nothing imports these functions today; they are the foundation the user
// management pages will sit on.

export async function listUsers() {
  const res = await api.get('/api/auth/users')
  return res.data
}

export async function getUserById(id) {
  const res = await api.get(`/api/auth/users/${id}`)
  return res.data
}

/**
 * Create an HR or EMPLOYEE account (an extra ADMIN is allowed too).
 * data: { username, email, password, fullName?, role: 'ADMIN'|'HR'|'EMPLOYEE', employeeId? }
 * role is REQUIRED and whitelisted server-side - anything else is a 400.
 * Duplicate username/email/employeeId -> 409.
 */
export async function createUser(data) {
  const res = await api.post('/api/auth/users', data)
  return res.data
}

/**
 * Update profile fields. Only what you send is applied.
 * Leaving `password` out keeps the current password.
 * data: { username?, email?, fullName?, password?, employeeId?, changeEmployeeId? }
 * Send { employeeId: null, changeEmployeeId: true } to UNLINK the employee.
 */
export async function updateUser(id, data) {
  const res = await api.put(`/api/auth/users/${id}`, data)
  return res.data
}

/** Switch an account on/off. 403 when disabling yourself or the last admin. */
export async function setUserEnabled(id, enabled) {
  const res = await api.patch(`/api/auth/users/${id}/status`, { enabled })
  return res.data
}

/** Replace the account's single role. 400 for an unknown role, 403 for the last admin. */
export async function changeUserRole(id, role) {
  const res = await api.patch(`/api/auth/users/${id}/role`, { role })
  return res.data
}
