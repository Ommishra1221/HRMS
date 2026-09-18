import { useCallback, useEffect, useState } from 'react'
import { getEmployees } from '../api/employeeApi'

// useEmployees = reusable "fetch the employee list" logic.
//
// WHY a hook? Both the EmployeeList page AND the form pages' employee
// dropdown need the same data with the same loading/error handling.
// A hook means we write that logic ONCE and reuse it everywhere.
//
// `enabled` (default true): pass false when the caller is not allowed to
// call GET /api/employees at all (e.g. an EMPLOYEE token gets 403 there).
// This avoids a pointless request + a spurious error on pages an employee
// can reach, without inventing any client-side authorization — the backend
// remains the real gatekeeper.
//
// Returns: { employees, loading, error, refresh }
export default function useEmployees(enabled = true) {
  const [employees, setEmployees] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  // useCallback: keep the same function identity between renders so that
  // useEffect dependencies don't re-trigger fetches in child components.
  const refresh = useCallback(async () => {
    if (!enabled) return
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
  }, [enabled])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { employees, loading: loading && enabled, error, refresh }
}
