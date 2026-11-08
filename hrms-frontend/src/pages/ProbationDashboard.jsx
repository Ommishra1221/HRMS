import { Link } from 'react-router-dom'
import { ClipboardCheck, Plus } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { useProbationQuery } from '../hooks/useProbation'
import PageHeader from '../components/common/PageHeader'
import Button from '../components/common/Button'
import Card, { CardBody, CardHeader } from '../components/common/Card'
import { Loading, ErrorAlert, EmptyState } from '../components/common/Loading'
import { AssessmentTable } from '../components/probation/ProbationShared'

export default function ProbationDashboard() {
  const { isHr } = useAuth()
  const query = useProbationQuery('/statistics')
  const data = query.data
  return <div className="page probation-page">
    <PageHeader icon={ClipboardCheck} title="Probation assessments" subtitle="Track each review from manager evaluation to a published decision."
      actions={<><Button as={Link} to="/probation/assessments">All assessments</Button>{isHr && <Button as={Link} to="/probation/assessments/new" variant="primary" icon={Plus}>Create assessment</Button>}</>} />
    {query.loading ? <Loading label="Loading probation queues" /> : query.error ? <ErrorAlert message={query.error} onRetry={query.refresh} /> : data && <>
      <Card><CardBody><dl className="probation-metrics">
        <div><dt>Active assessments</dt><dd>{data.active}</dd></div>
        <div><dt>Pending manager evaluations</dt><dd>{data.pendingManager}</dd></div>
        <div><dt>Pending HR reviews</dt><dd><Link to="/probation/assessments?status=PENDING_HR_REVIEW">{data.pendingHr}</Link></dd></div>
        <div><dt>Pending ADMIN decisions</dt><dd><Link to="/probation/assessments?status=PENDING_ADMIN_APPROVAL">{data.pendingAdmin}</Link></dd></div>
      </dl></CardBody></Card>
      <Card><CardHeader title="Recently completed" subtitle={`${data.completed} completed assessment${data.completed === 1 ? '' : 's'} in total`} />
        <CardBody flush>{data.recentlyCompleted.length ? <AssessmentTable rows={data.recentlyCompleted} /> : <EmptyState title="No published decisions yet" message="Completed assessments will appear after ADMIN records a final decision." />}</CardBody>
      </Card>
    </>}
  </div>
}
