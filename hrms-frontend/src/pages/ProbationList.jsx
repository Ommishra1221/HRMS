import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ClipboardCheck, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProbationQuery, useDebouncedProbationSearch } from '../hooks/useProbation'
import PageHeader from '../components/common/PageHeader'
import Button from '../components/common/Button'
import Card, { CardBody } from '../components/common/Card'
import Field from '../components/common/Field'
import { statusLabel } from '../components/common/Badge'
import { AssessmentTable, Pagination, PROBATION_STATUSES, QueryState } from '../components/probation/ProbationShared'

export default function ProbationList({ manager = false, own = false }) {
  const { isHr } = useAuth()
  const [params, setParams] = useSearchParams()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(0)
  const debounced = useDebouncedProbationSearch(search)
  const path = own ? '/me' : manager ? '/manager/assignments' : '/assessments'
  const query = useProbationQuery(path, { page, size: 20, ...(!own ? { search: debounced, status: params.get('status') || undefined, employeeId: manager ? undefined : params.get('employeeId') || undefined } : {}) })
  const title = own ? 'My probation' : manager ? 'Assigned evaluations' : 'Assessment list'
  return <div className="page probation-page">
    <PageHeader icon={ClipboardCheck} title={title} subtitle={own ? 'Your probation periods and published outcomes.' : manager ? 'Evaluations assigned to your account.' : 'Find an assessment and continue its review.'}
      actions={!own && !manager && isHr && <Button as={Link} to="/probation/assessments/new" variant="primary" icon={Plus}>Create assessment</Button>} />
    {!own && <Card><CardBody><div className="probation-filters">
      <Field label="Search assessments" htmlFor="assessment-search"><input id="assessment-search" type="search" value={search} onChange={(e) => { setSearch(e.target.value); setPage(0) }} placeholder="Employee or manager name" /></Field>
      <Field label="Status" htmlFor="assessment-status"><select id="assessment-status" value={params.get('status') || ''} onChange={(e) => { const next = new URLSearchParams(params); e.target.value ? next.set('status', e.target.value) : next.delete('status'); setParams(next); setPage(0) }}>
        <option value="">All statuses</option>{PROBATION_STATUSES.filter((s) => !manager || s !== 'DRAFT').map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
      </select></Field>
      {params.get('employeeId') && <Button onClick={() => { const next = new URLSearchParams(params); next.delete('employeeId'); setParams(next); setPage(0) }}>Clear employee filter</Button>}
    </div></CardBody></Card>}
    <Card><CardBody flush><QueryState query={query} emptyTitle={manager ? 'No assigned evaluations' : own ? 'No probation assessments yet' : 'No matching assessments'}>
      <AssessmentTable rows={query.data?.content || []} own={own} /><Pagination data={query.data} onPage={setPage} />
    </QueryState></CardBody></Card>
  </div>
}
