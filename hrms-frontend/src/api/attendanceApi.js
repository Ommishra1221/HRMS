import api from './axiosInstance'

// attendanceApi = every Attendance HTTP call in one place.
// Same pattern as employeeApi / leaveApi - all paths go through the GATEWAY:
//
//   GET    /api/attendance              -> 8083 GET  /attendance
//   GET    /api/attendance/{id}         -> 8083 GET  /attendance/{id}
//   POST   /api/attendance              -> 8083 POST /attendance
//   PUT    /api/attendance/{id}         -> 8083 PUT  /attendance/{id}
//   PATCH  /api/attendance/{id}/checkout -> 8083 PATCH /attendance/{id}/checkout
//   DELETE /api/attendance/{id}         -> 8083 DELETE /attendance/{id}
//
// Notice the frontend never mentions 8081/8082/8083. The gateway decides that.

export async function getAttendance() {
  const res = await api.get('/api/attendance')
  // Array of AttendanceResponse - each row already contains the nested
  // "employee" object, composed by attendance-service via its Feign call.
  return res.data
}

export async function getAttendanceForEmployee(employeeId) {
  const res = await api.get('/api/attendance', { params: { employeeId } })
  return res.data
}

export async function getAttendanceRecord(id) {
  const res = await api.get(`/api/attendance/${id}`)
  return res.data
}

export async function createAttendance(data) {
  // data must contain ONLY what AttendanceRequest expects:
  // { employeeId, attendanceDate, status, checkIn?, checkOut? }
  const res = await api.post('/api/attendance', data)
  return res.data
}

export async function updateAttendance(id, data) {
  const res = await api.put(`/api/attendance/${id}`, data)
  return res.data
}

export async function markCheckOut(id, checkOut) {
  const res = await api.patch(`/api/attendance/${id}/checkout`, { checkOut })
  return res.data
}

export async function deleteAttendance(id) {
  // 204 No Content -> no body to return
  await api.delete(`/api/attendance/${id}`)
}
