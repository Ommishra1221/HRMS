import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useProbationQuery, useProbationActions } from '../hooks/useProbation'
import PageHeader from '../components/common/PageHeader'
import Button from '../components/common/Button'
import Badge, { statusLabel } from '../components/common/Badge'
import Card, { CardBody, CardHeader } from '../components/common/Card'
import { Loading, ErrorAlert } from '../components/common/Loading'
import { useToast } from '../components/common/Toast'
import { formatDate } from '../utils/format'
import { FINAL_STATUSES, FormErrors } from '../components/probation/ProbationShared'
import ProbationEvaluation from '../components/probation/ProbationEvaluation'
import { HrReview, AdminDecision, ReassignManager } from '../components/probation/ProbationReviewActions'

function Evidence({ evidence }) {
  return <div className="probation-evidence">
    <p><strong>Overall score:</strong> {evidence.overallScore == null ? 'Not yet scored' : `${Number(evidence.overallScore).toFixed(2)} / 5`}</p>
    <p><strong>Manager recommendation:</strong> {statusLabel(evidence.recommendation)}</p>
    <dl className="probation-evidence-list">{evidence.ratings?.map((r) => <div key={r.criterionCode}><dt>{r.criterionName} <span className="text-muted">({r.score == null ? 'Not rated' : `${r.score} / 5`})</span></dt><dd>{r.comments || 'No evidence recorded yet.'}</dd></div>)}</dl>
    {[['Strengths', evidence.strengths], ['Areas for improvement', evidence.areasForImprovement], ['Development recommendations', evidence.developmentRecommendations]].map(([label, value]) => <div key={label}><h3>{label}</h3><p className="probation-text">{value || 'Not recorded yet.'}</p></div>)}
  </div>
}

function ArchivedEvidence({ snapshot }) {
  try {
    const evidence = JSON.parse(snapshot)
    return <div className="probation-section">
      {evidence.probationStartDate && <p>Period: {formatDate(evidence.probationStartDate)} – {formatDate(evidence.probationEndDate)} · Review due: {formatDate(evidence.reviewDueDate)} · Manager account #{evidence.reviewerUserId}</p>}
      {evidence.initialRemarks && <p className="probation-text">Initial remarks: {evidence.initialRemarks}</p>}
      {evidence.hrReviewRemarks && <p className="probation-text">HR review: {evidence.hrReviewRemarks}</p>}
      <Evidence evidence={evidence} />
    </div>
  } catch { return <p>Archived evidence is unavailable.</p> }
}

function Outcome({ data }) {
  return <Card><CardHeader title={data.finalDecision ? 'Published outcome' : 'Probation status'} /><CardBody>
    <dl className="detail-list">
      <div className="detail-row"><dt>Status</dt><dd><Badge status={data.status} /></dd></div>
      <div className="detail-row"><dt>Probation period</dt><dd>{formatDate(data.probationStartDate)} – {formatDate(data.probationEndDate)}</dd></div>
      <div className="detail-row"><dt>Review due</dt><dd>{formatDate(data.reviewDueDate)}</dd></div>
      {data.finalDecision && <><div className="detail-row"><dt>Decision</dt><dd>{statusLabel(data.finalDecision)}</dd></div>
        {data.revisedEndDate && <div className="detail-row"><dt>Approved revised end date</dt><dd>{formatDate(data.revisedEndDate)}</dd></div>}
        <div className="detail-row"><dt>Published on</dt><dd>{formatDate(data.publishedAt)}</dd></div>
        <div className="detail-row"><dt>Approved comments</dt><dd className="probation-text">{data.publishedComments || 'No additional comments were published.'}</dd></div></>}
    </dl>
    {!data.finalDecision && <p className="text-muted">A final outcome will appear after the review is completed and published.</p>}
  </CardBody></Card>
}

export default function ProbationDetail() {
  const { id } = useParams()
  const { isHr, isAdmin } = useAuth()
  const office = isHr || isAdmin
  const query = useProbationQuery(`/assessments/${id}`)
  const actions = useProbationActions()
  const toast = useToast()
  if (query.loading) return <Loading label="Loading probation assessment" />
  if (query.error) return <div className="page probation-page"><PageHeader title="Probation assessment" /><ErrorAlert message={query.error} onRetry={query.refresh} /></div>
  const detail = query.data
  if (!detail) return null
  if (!detail.assessment) return <div className="page probation-page"><PageHeader title="My probation assessment" actions={<Button as={Link} to="/my-probation">All my cycles</Button>} /><Outcome data={detail} /></div>
  const a = detail.assessment
  const finalized = FINAL_STATUSES.includes(a.status)
  async function send() {
    try { await actions.action(a.id, 'send-for-evaluation', { version: a.version }); toast.success('Assessment sent to reporting manager'); query.refresh() } catch { /* Inline error. */ }
  }
  return <div className="page probation-page">
    <PageHeader title={`Probation assessment #${a.id}`} subtitle={`${a.employeeName} · ${a.employeeDepartment || 'Employee'}`}
      actions={<><Button as={Link} to={office ? '/probation/assessments' : '/manager-evaluations'}>Back to assessments</Button>
        {isHr && a.status === 'DRAFT' && <><Button as={Link} to={`/probation/assessments/${a.id}/edit`}>Edit draft</Button><Button variant="primary" loading={actions.busy} onClick={send}>Send to manager</Button></>}
        {isHr && a.status === 'EXTENDED' && <Button as={Link} to={`/probation/assessments/new?previousAssessmentId=${a.id}`}>Create follow-up cycle</Button>}</>} />
    <FormErrors message={actions.error} />
    <Card><CardHeader title="Assessment summary" actions={<Badge status={a.status} />} /><CardBody>
      <dl className="detail-list">
        <div className="detail-row"><dt>Employee</dt><dd>{a.employeeName}</dd></div>
        <div className="detail-row"><dt>Reporting manager</dt><dd>{a.managerName}</dd></div>
        <div className="detail-row"><dt>Probation period</dt><dd>{formatDate(a.probationStartDate)} – {formatDate(a.probationEndDate)}</dd></div>
        <div className="detail-row"><dt>Review due</dt><dd>{formatDate(a.reviewDueDate)}</dd></div>
        <div className="detail-row"><dt>Initial remarks</dt><dd className="probation-text">{detail.initialRemarks || '—'}</dd></div>
        {detail.previousAssessmentId && <div className="detail-row"><dt>Previous cycle</dt><dd>{office ? <Link to={`/probation/assessments/${detail.previousAssessmentId}`}>Assessment #{detail.previousAssessmentId}</Link> : `Assessment #${detail.previousAssessmentId}`}</dd></div>}
      </dl>
      {office && <Button as={Link} to={`/probation/assessments?employeeId=${a.employeeId}`}>Employee assessment history</Button>}
    </CardBody></Card>
    {detail.canEvaluate ? <ProbationEvaluation key={`${a.id}-${a.version}`} detail={detail} onSaved={query.refresh} /> : <Card><CardHeader title="Evaluation evidence" subtitle="Manager scores and feedback retained for this assessment cycle." /><CardBody><Evidence evidence={{ ...detail, overallScore: a.overallScore }} /></CardBody></Card>}
    {office && detail.hrReviewRemarks && <Card><CardHeader title="HR review remarks" /><CardBody><p className="probation-text">{detail.hrReviewRemarks}</p></CardBody></Card>}
    {isHr && a.status === 'PENDING_HR_REVIEW' && <HrReview key={a.version} detail={detail} onSaved={query.refresh} />}
    {isAdmin && a.status === 'PENDING_ADMIN_APPROVAL' && <AdminDecision key={a.version} detail={detail} onSaved={query.refresh} />}
    {office && ['DRAFT', 'PENDING_MANAGER_EVALUATION', 'MANAGER_EVALUATION_IN_PROGRESS', 'RETURNED_TO_MANAGER'].includes(a.status) && <ReassignManager key={`reassign-${a.version}`} detail={detail} onSaved={query.refresh} />}
    {finalized && <><Outcome data={{ ...a, ...detail }} />{office && <Card><CardHeader title="Internal decision record" /><CardBody><p className="probation-text">{detail.decisionRemarks || 'No additional internal remarks.'}</p><p>Decision recorded by account #{detail.decidedBy} on {formatDate(detail.decisionDate)}.</p></CardBody></Card>}</>}
    <Card><CardHeader title="Assessment history" /><CardBody>
      <ol className="probation-history">{detail.history.map((h) => <li key={h.id}>
        <div className="probation-history__heading"><strong>{statusLabel(h.action)}</strong><time dateTime={h.performedAt}>{new Date(h.performedAt).toLocaleString()}</time></div>
        <p>{h.previousStatus ? `${statusLabel(h.previousStatus)} → ` : ''}{statusLabel(h.newStatus)} · Account #{h.performedBy}</p>
        {h.remarks && <p className="probation-text">{h.remarks}</p>}
        {office && h.evidenceSnapshot && <details><summary>Evaluation evidence at this step</summary><ArchivedEvidence snapshot={h.evidenceSnapshot} /></details>}
      </li>)}</ol>
    </CardBody></Card>
  </div>
}
