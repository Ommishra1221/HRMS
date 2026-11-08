import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useProbationQuery, useProbationActions } from '../hooks/useProbation'
import PageHeader from '../components/common/PageHeader'
import Button from '../components/common/Button'
import Field from '../components/common/Field'
import { Loading, ErrorAlert } from '../components/common/Loading'
import { useToast } from '../components/common/Toast'
import { FormErrors, ReviewerPicker } from '../components/probation/ProbationShared'

const empty = { employeeId: '', probationStartDate: '', probationEndDate: '', reviewDueDate: '', reportingManagerUserId: '', initialRemarks: '' }
export default function ProbationAssessmentForm() {
  const { id } = useParams()
  const [params] = useSearchParams()
  const previousId = params.get('previousAssessmentId')
  const isEdit = Boolean(id)
  const navigate = useNavigate()
  const toast = useToast()
  const actions = useProbationActions()
  const employees = useProbationQuery('/employees', {}, !isEdit)
  const existing = useProbationQuery(`/assessments/${id || previousId}`, {}, Boolean(id || previousId))
  const [values, setValues] = useState(empty)
  const [errors, setErrors] = useState({})
  useEffect(() => {
    if (!existing.data?.assessment) return
    const a = existing.data.assessment
    if (isEdit) setValues({ employeeId: String(a.employeeId), reportingManagerUserId: String(a.reportingManagerUserId), probationStartDate: a.probationStartDate, probationEndDate: a.probationEndDate, reviewDueDate: a.reviewDueDate, initialRemarks: existing.data.initialRemarks || '' })
    else {
      const next = new Date(`${a.probationEndDate}T00:00:00Z`); next.setUTCDate(next.getUTCDate() + 1)
      setValues({ ...empty, employeeId: String(a.employeeId), probationStartDate: next.toISOString().slice(0, 10), probationEndDate: existing.data.revisedEndDate || '', reviewDueDate: existing.data.revisedEndDate || '' })
    }
  }, [existing.data, isEdit])
  const change = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }))
  async function submit(e) {
    e.preventDefault()
    const next = {}
    if (!values.employeeId) next.employeeId = 'Select an employee.'
    if (!isEdit && !values.reportingManagerUserId) next.reportingManagerUserId = 'Select a reporting manager.'
    if (!values.probationStartDate) next.probationStartDate = 'Enter the probation start date.'
    if (!values.probationEndDate || values.probationEndDate < values.probationStartDate) next.probationEndDate = 'End date must be on or after the start date.'
    if (!values.reviewDueDate || values.reviewDueDate < values.probationStartDate || values.reviewDueDate > values.probationEndDate) next.reviewDueDate = 'Review due date must be within the probation period.'
    setErrors(next)
    if (Object.keys(next).length) return
    const body = { probationStartDate: values.probationStartDate, probationEndDate: values.probationEndDate, reviewDueDate: values.reviewDueDate, initialRemarks: values.initialRemarks.trim() }
    try {
      const result = isEdit ? await actions.update(id, { ...body, version: existing.data.assessment.version }) : await actions.create({ ...body, employeeId: Number(values.employeeId), reportingManagerUserId: Number(values.reportingManagerUserId), ...(previousId ? { previousAssessmentId: Number(previousId) } : {}) })
      toast.success(isEdit ? 'Draft updated' : 'Assessment draft created')
      navigate(`/probation/assessments/${result.assessment.id}`)
    } catch { /* Inline server error is provided by the mutation hook. */ }
  }
  if ((!isEdit && employees.loading) || ((id || previousId) && existing.loading)) return <Loading label="Loading assessment form" />
  if (employees.error || existing.error) return <ErrorAlert message={employees.error || existing.error} onRetry={() => { employees.refresh(); existing.refresh() }} />
  if (isEdit && existing.data?.assessment?.status !== 'DRAFT') return <ErrorAlert title="This assessment is no longer a draft" message="Reload the assessment to continue its current workflow." />
  if (previousId && existing.data?.finalDecision !== 'EXTENDED') return <ErrorAlert message="Only an approved extension can start a linked follow-up cycle." />
  return <div className="page probation-page">
    <PageHeader title={isEdit ? 'Edit probation draft' : previousId ? 'Create extension assessment' : 'Create probation assessment'} subtitle="Prepare the review period and assign its reporting manager." actions={<Button as={Link} to="/probation/assessments">Back to assessments</Button>} />
    <form className="form-card" onSubmit={submit} noValidate>
      <FormErrors errors={errors} message={actions.error} />
      <div className="form-grid">
        <Field label="Employee" htmlFor="employeeId" error={errors.employeeId} required>
          {isEdit ? <input id="employeeId" value={existing.data?.assessment.employeeName || ''} readOnly /> : <select id="employeeId" name="employeeId" value={values.employeeId} onChange={change} disabled={Boolean(previousId)}>
            <option value="">Select employee…</option>{employees.data?.map((employee) => <option key={employee.id} value={employee.id}>{employee.name} — {employee.department}</option>)}
          </select>}
        </Field>
        <Field label="Probation start date" htmlFor="probationStartDate" error={errors.probationStartDate} required><input id="probationStartDate" name="probationStartDate" type="date" value={values.probationStartDate} onChange={change} readOnly={Boolean(previousId)} /></Field>
        <Field label="Probation end date" htmlFor="probationEndDate" error={errors.probationEndDate} required><input id="probationEndDate" name="probationEndDate" type="date" min={values.probationStartDate} value={values.probationEndDate} onChange={change} readOnly={Boolean(previousId)} /></Field>
        <Field label="Review due date" htmlFor="reviewDueDate" error={errors.reviewDueDate} required><input id="reviewDueDate" name="reviewDueDate" type="date" min={values.probationStartDate} max={values.probationEndDate} value={values.reviewDueDate} onChange={change} /></Field>
        {!isEdit && <ReviewerPicker value={values.reportingManagerUserId} employeeId={values.employeeId} error={errors.reportingManagerUserId} onChange={(value) => setValues((v) => ({ ...v, reportingManagerUserId: value }))} />}
        <Field label="Initial remarks" htmlFor="initialRemarks" full hint="Shared with the assigned manager; excluded from the employee outcome."><textarea id="initialRemarks" name="initialRemarks" rows={4} maxLength={4000} value={values.initialRemarks} onChange={change} /></Field>
      </div>
      <div className="form-actions"><Button type="submit" variant="primary" loading={actions.busy}>Save draft</Button><Button as={Link} to="/probation/assessments">Cancel</Button></div>
    </form>
  </div>
}
