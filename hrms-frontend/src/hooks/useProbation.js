import { useCallback, useEffect, useState } from 'react'
import * as api from '../api/probationApi'

export function useProbationQuery(path, params = {}, enabled = true) {
  const key = JSON.stringify(params)
  const [revision, setRevision] = useState(0)
  const [state, setState] = useState({ data: null, loading: enabled, error: null })
  const refresh = useCallback(() => setRevision((v) => v + 1), [])
  useEffect(() => {
    if (!enabled) { setState({ data: null, loading: false, error: null }); return }
    const controller = new AbortController()
    setState((s) => ({ ...s, loading: true, error: null }))
    api.queryProbation(path, JSON.parse(key), controller.signal)
      .then((data) => { if (!controller.signal.aborted) setState({ data, loading: false, error: null }) })
      .catch((err) => { if (!controller.signal.aborted) setState({ data: null, loading: false, error: err.message }) })
    return () => controller.abort()
  }, [path, key, enabled, revision])
  return { ...state, refresh }
}

export function useProbationActions() {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const run = async (work) => {
    setBusy(true); setError(null)
    try { return await work() }
    catch (err) { setError(err.message); throw err }
    finally { setBusy(false) }
  }
  return {
    busy, error, clearError: () => setError(null),
    create: (body) => run(() => api.createAssessment(body)),
    update: (id, body) => run(() => api.updateAssessment(id, body)),
    evaluate: (id, body) => run(() => api.saveEvaluation(id, body)),
    action: (id, name, body) => run(() => api.assessmentAction(id, name, body)),
  }
}

export function useDebouncedProbationSearch(value) {
  const [search, setSearch] = useState(value)
  useEffect(() => { const timer = setTimeout(() => setSearch(value), 250); return () => clearTimeout(timer) }, [value])
  return search
}
