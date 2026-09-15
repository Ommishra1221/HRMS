import { useCallback, useEffect, useState } from 'react'
import { getAttendance } from '../api/attendanceApi'

// Same idea as useEmployees / useLeaves, but for the attendance list.
// Keeps loading/error handling OUT of the UI components.
//
// Returns: { attendance, loading, error, refresh }
export default function useAttendance() {
  const [attendance, setAttendance] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getAttendance()
      setAttendance(data)
    } catch (err) {
      setError(err.message) // already normalized by axiosInstance
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { attendance, loading, error, refresh }
}
