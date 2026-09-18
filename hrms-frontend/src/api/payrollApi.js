import api from './axiosInstance'

// payrollApi = every Payroll HTTP call in one place.
// Same pattern as employeeApi / leaveApi / attendanceApi - all paths go
// through the GATEWAY:
//
//   GET    /api/payroll             -> 8084 GET  /payroll
//   GET    /api/payroll/{id}        -> 8084 GET  /payroll/{id}
//   POST   /api/payroll             -> 8084 POST /payroll
//   PUT    /api/payroll/{id}        -> 8084 PUT  /payroll/{id}
//   PATCH  /api/payroll/{id}/paid   -> 8084 PATCH /payroll/{id}/paid
//   DELETE /api/payroll/{id}        -> 8084 DELETE /payroll/{id}
//
// Notice the frontend never mentions 8081/8082/8083/8084. The gateway decides that.

export async function getPayrolls() {
  const res = await api.get('/api/payroll')
  // Array of PayrollResponse - each row already contains the nested
  // "employee" object, composed by payroll-service via its Feign call.
  return res.data
}

export async function getPayrollForEmployee(employeeId) {
  const res = await api.get('/api/payroll', { params: { employeeId } })
  return res.data
}

export async function getPayroll(id) {
  const res = await api.get(`/api/payroll/${id}`)
  return res.data
}

export async function createPayroll(data) {
  // data must contain ONLY what PayrollRequest expects:
  // { employeeId, month, basicSalary, allowances, deductions, paymentDate? }
  // (status is backend-set - every new payslip starts as PENDING)
  const res = await api.post('/api/payroll', data)
  return res.data
}

export async function updatePayroll(id, data) {
  const res = await api.put(`/api/payroll/${id}`, data)
  return res.data
}

export async function markPayrollPaid(id, paymentDate) {
  // paymentDate may be null -> backend uses today's date
  const res = await api.patch(`/api/payroll/${id}/paid`, { paymentDate })
  return res.data
}

export async function deletePayroll(id) {
  // 204 No Content -> no body to return
  await api.delete(`/api/payroll/${id}`)
}
