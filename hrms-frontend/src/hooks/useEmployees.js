import { useCallback, useEffect, useState } from 'react'
import { getEmployees } from '../api/employeeApi'

// useEmployees = reusable "fetch the employee list" logic.
//
// WHY a hook? Both the EmployeeList page AND the future LeaveForm employee
// dropdown need the same data with the same loading/error handling.
// A hook means we write that logic ONCE and reuse it everywhere.
//
// Returns: { employees, loading, error, refresh }
export default function useEmployees() {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // useCallback: keep the same function identity between renders so that
  // useEffect dependencies don't re-trigger fetches in child components.
  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getEmployees()
      setEmployees(data)
    } catch (err) {
      setError(err.message) // already normalized by axiosInstance
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { employees, loading, error, refresh }
}
