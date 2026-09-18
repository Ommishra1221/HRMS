import api from './axiosInstance'

// employeeApi = every Employee HTTP call in one place.
//
// These paths are NOT the service URLs (8081). They go through the gateway,
// which forwards /api/employees -> employee-service /employees (StripPrefix=1).
//
//   GET    /api/employees        -> 8081 GET  /employees
//   GET    /api/employees/{id}   -> 8081 GET  /employees/{id}
//   POST   /api/employees        -> 8081 POST /employees
//   PUT    /api/employees/{id}   -> 8081 PUT  /employees/{id}
//   DELETE /api/employees/{id}   -> 8081 DELETE /employees/{id}

export async function getEmployees() {
  const res = await api.get('/api/employees')
  return res.data // array of { id, name, email, department }
}

export async function getMyProfile() {
  // EMPLOYEE self-service: the backend resolves "me" from the JWT's
  // employeeId claim - there is no id in the URL to fake. ADMIN/HR accounts
  // (no employee link) get a 403, which is why only employees call this.
  const res = await api.get('/api/employees/me')
  return res.data // { id, name, email, department }
}

export async function getEmployee(id) {
  const res = await api.get(`/api/employees/${id}`)
  return res.data // { id, name, email, department }
}

export async function createEmployee(data) {
  // data must contain ONLY what EmployeeRequest expects: name, email, department
  const res = await api.post('/api/employees', data)
  return res.data // the created employee, including backend-generated id
}

export async function updateEmployee(id, data) {
  const res = await api.put(`/api/employees/${id}`, data)
  return res.data
}

export async function deleteEmployee(id) {
  // 204 No Content -> no body to return
  await api.delete(`/api/employees/${id}`)
}
