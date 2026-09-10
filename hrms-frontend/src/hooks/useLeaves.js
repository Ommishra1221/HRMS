import { useCallback, useEffect, useState } from 'react'
import { getLeaves } from '../api/leaveApi'

// Same idea as useEmployees, but for the leave list.
// Keeps loading/error handling OUT of the UI components.
export default function useLeaves() {
  const [leaves, setLeaves] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getLeaves()
      setLeaves(data)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  return { leaves, loading, error, refresh }
}
