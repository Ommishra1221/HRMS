import { useCallback, useEffect, useState } from 'react'
import { getPayrolls } from '../api/payrollApi'

// Same idea as useEmployees / useLeaves / useAttendance, but for the payroll
// list. Keeps loading/error handling OUT of the UI components.
//
// Returns: { payrolls, loading, error, refresh }
export default function usePayrolls() {
  const [payrolls, setPayrolls] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getPayrolls()
      setPayrolls(data)
    } catch (err) {
      setError(err.message) // already normalized by axiosInstance
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { payrolls, loading, error, refresh }
}
