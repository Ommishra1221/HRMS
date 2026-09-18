import { useCallback, useEffect, useState } from 'react'
import { listUsers } from '../api/userApi'

// useUsers = the ADMIN account list, same shape as useEmployees/useLeaves.
//
// Every endpoint behind this hook is ADMIN-only on the backend
// (/auth/users/**), so a non-admin caller simply gets a 403 - which surfaces
// here as the usual error state. The UI never decides access, it only
// displays what the backend allowed.
//
// Returns: { users, loading, error, refresh }
export default function useUsers() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listUsers()
      setUsers(data)
    } catch (err) {
      setError(err.message) // already normalized by axiosInstance
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { users, loading, error, refresh }
}
