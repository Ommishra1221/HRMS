import api from './axiosInstance'

// leaveApi = every Leave HTTP call in one place.
// Same pattern as employeeApi - all paths go through the GATEWAY:
//
//   GET    /api/leaves        -> 8082 GET  /leaves
//   GET    /api/leaves/{id}   -> 8082 GET  /leaves/{id}
//   POST   /api/leaves        -> 8082 POST /leaves
//   PUT    /api/leaves/{id}   -> 8082 PUT  /leaves/{id}
//   DELETE /api/leaves/{id}   -> 8082 DELETE /leaves/{id}
//
// Notice the frontend never mentions 8081/8082. The gateway decides that.

export async function getLeaves() {
  const res = await api.get('/api/leaves')
  // Array of LeaveResponse - each row already contains the nested
  // "employee" object, composed by leave-service via its Feign call.
  return res.data
}

export async function getLeave(id) {
  const res = await api.get(`/api/leaves/${id}`)
  return res.data
}

export async function createLeave(data) {
  // data must contain ONLY what LeaveRequest expects:
  // { employeeId, leaveType, fromDate, toDate, reason }  (status is backend-set)
  const res = await api.post('/api/leaves', data)
  return res.data
}

export async function updateLeave(id, data) {
  const res = await api.put(`/api/leaves/${id}`, data)
  return res.data
}

export async function deleteLeave(id) {
  await api.delete(`/api/leaves/${id}`)
}
