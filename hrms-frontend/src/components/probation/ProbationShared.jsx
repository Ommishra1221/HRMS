import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import Button from '../common/Button'
import Badge from '../common/Badge'
import Field from '../common/Field'
import { Loading, ErrorAlert, EmptyState } from '../common/Loading'
import { useProbationQuery, useDebouncedProbationSearch } from '../../hooks/useProbation'
import { formatDate } from '../../utils/format'

export const PROBATION_STATUSES = ['DRAFT', 'PENDING_MANAGER_EVALUATION', 'MANAGER_EVALUATION_IN_PROGRESS', 'PENDING_HR_REVIEW', 'RETURNED_TO_MANAGER', 'PENDING_ADMIN_APPROVAL', 'CONFIRMED', 'EXTENDED', 'NOT_CONFIRMED']
export const FINAL_STATUSES = ['CONFIRMED', 'EXTENDED', 'NOT_CONFIRMED']

export function FormErrors({ errors = {}, message }) {
  const ref = useRef(null)
  const entries = Object.entries(errors)
  const key = JSON.stringify(errors) + message
  useEffect(() => { if (entries.length || message) ref.current?.focus() }, [key]) // Focus only after validation, never on blur.
  if (!entries.length && !message) return null
  return <div className="alert alert--error probation-error" role="alert" tabIndex={-1} ref={ref}>
    <div><strong>Could not save this assessment</strong>{message && <p>{message}</p>}
      {entries.length > 0 && <ul>{entries.map(([id, text]) => <li key={id}><a href={`#${id}`}>{text}</a></li>)}</ul>}
    </div>
  </div>
}

export function Pagination({ data, onPage }) {
  if (!data || !data.totalElements) return null
  return <div className="probation-pagination" aria-label="Pagination">
    <span>{data.page * data.size + 1}–{Math.min((data.page + 1) * data.size, data.totalElements)} of {data.totalElements}</span>
    <div className="row"><Button disabled={data.page === 0} onClick={() => onPage(data.page - 1)}>Previous</Button>
      <Button disabled={data.page + 1 >= data.totalPages} onClick={() => onPage(data.page + 1)}>Next</Button></div>
  </div>
}

export function AssessmentTable({ rows, own = false }) {
  return <div className="table-wrap"><table className="table table--stack probation-table">
    <caption className="sr-only">{own ? 'Your probation cycles' : 'Probation assessments'}</caption>
    <thead><tr>{!own && <><th scope="col">Employee</th><th scope="col">Reporting manager</th></>}
      <th scope="col">Probation period</th><th scope="col">Review due</th><th scope="col">Status</th><th scope="col">Action</th></tr></thead>
    <tbody>{rows.map((a) => <tr key={a.id}>
      {!own && <><td data-label="Employee"><strong>{a.employeeName}</strong><div className="text-muted">{a.employeeDepartment || '—'}</div></td>
        <td data-label="Reporting manager">{a.managerName}</td></>}
      <td data-label="Probation period">{formatDate(a.probationStartDate)} – {formatDate(a.probationEndDate)}</td>
      <td data-label="Review due">{formatDate(a.reviewDueDate)}</td><td data-label="Status"><Badge status={a.status} /></td>
      <td data-label="Action"><Button as={Link} to={`/probation/assessments/${a.id}`} size="sm" aria-label={`View assessment ${a.id}`}>View</Button></td>
    </tr>)}</tbody>
  </table></div>
}

export function QueryState({ query, emptyTitle, children }) {
  if (query.loading) return <Loading label="Loading probation assessments" />
  if (query.error) return <ErrorAlert title="Could not load probation assessments" message={query.error} onRetry={query.refresh} />
  if (!query.data?.content?.length) return <EmptyState title={emptyTitle || 'No assessments yet'} message="New assessment cycles will appear here." />
  return children
}

export function ReviewerPicker({ value, onChange, employeeId, error }) {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const [selectedName, setSelectedName] = useState('Selected reporting manager')
  const debounced = useDebouncedProbationSearch(search)
  const query = useProbationQuery('/reviewers', { search: debounced, page, size: 50 })
  const options = (query.data?.content || []).filter((r) => String(r.employeeId) !== String(employeeId))
  return <div className="probation-reviewer-picker">
    <Field label="Find reporting manager" htmlFor="reviewer-search" hint="Search employee-linked accounts by name or username.">
      <input id="reviewer-search" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} />
    </Field>
    <Field label="Assigned manager" htmlFor="reportingManagerUserId" required error={error}>
      <select id="reportingManagerUserId" value={value} onChange={(e) => { setSelectedName(e.target.selectedOptions[0]?.text || 'Selected reporting manager'); onChange(e.target.value) }} disabled={query.loading || !!query.error}>
        <option value="">Select manager…</option>
        {value && !options.some((r) => String(r.id) === String(value)) && <option value={value}>{selectedName}</option>}
        {options.map((r) => <option key={r.id} value={r.id}>{r.fullName || r.username} ({r.username})</option>)}
      </select>
    </Field>
    {query.loading && <p role="status">Loading reporting managers…</p>}
    {query.error && <ErrorAlert message={query.error} onRetry={query.refresh} />}
    <Pagination data={query.data} onPage={setPage} />
  </div>
}
