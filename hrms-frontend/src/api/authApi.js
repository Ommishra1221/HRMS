import api from './axiosInstance'

// authApi = every AUTHENTICATION HTTP call in one place.
// Same pattern as employeeApi / leaveApi / attendanceApi / payrollApi - all
// paths go through the GATEWAY:
//
//   POST /api/auth/login    -> 8085 POST /auth/login     (PUBLIC)
//   GET  /api/auth/me       -> 8085 GET  /auth/me        (needs JWT)
//
// THERE IS NO register() HERE ANY MORE. Public signup was removed from the
// architecture: accounts are created by an ADMIN, and that lives in
// userApi.js (POST /api/auth/users). Deleting this function - rather than
// leaving it unused - is deliberate: a dead register() is an invitation for
// someone to wire a signup button back in without noticing the backend no
// longer accepts it (it would now just 401).
//
// The difference from the other APIs: we SEND a token (via the axios
// interceptor in axiosInstance.js) and RECEIVE one in the response body.

export async function login(credentials) {
  // credentials: { username, password }
  // Works for ALL THREE roles - ADMIN, HR and EMPLOYEE log in the same way;
  // the role only changes what they may do afterwards.
  // Wrong password / unknown user / disabled account -> identical 401
  // { status: 401, message: 'Invalid username or password' }.
  const res = await api.post('/api/auth/login', credentials)
  return res.data
}

export async function getMe() {
  // The "who am I?" call. Requires the Authorization header - the interceptor
  // attaches it automatically from localStorage. Returns the profile WITH
  // roles and employeeId, and never the password hash.
  const res = await api.get('/api/auth/me')
  return res.data
}
