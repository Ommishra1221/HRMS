import { useState } from 'react'
import { useConfirm } from '../common/ConfirmProvider'
import { useToast } from '../common/Toast'
import Card, { CardBody, CardHeader } from '../common/Card'
import Field from '../common/Field'
import Button from '../common/Button'
import { useProbationActions } from '../../hooks/useProbation'
import { FormErrors, ReviewerPicker } from './ProbationShared'

export function HrReview({ detail, onSaved }) {
  const [remarks, setRemarks] = useState('')
  const [errors, setErrors] = useState({})
  const actions = useProbationActions()
  const toast = useToast()
  async function review(action) {
    if (!remarks.trim()) { setErrors({ hrRemarks: 'Enter review remarks or the reason for returning this evaluation.' }); return }
    setErrors({})
    try { await actions.action(detail.assessment.id, action, { version: detail.assessment.version, remarks: remarks.trim() }); toast.success(action === 'return-to-manager' ? 'Returned to manager' : 'Forwarded to ADMIN'); onSaved() } catch { /* Inline error. */ }
  }
  return <Card><CardHeader title="HR review" subtitle="Review the manager’s evidence before forwarding or requesting corrections." /><CardBody>
    <FormErrors errors={errors} message={actions.error} />
    <Field label="HR review remarks" htmlFor="hrRemarks" required error={errors.hrRemarks}><textarea id="hrRemarks" rows={4} maxLength={4000} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
    <div className="form-actions"><Button disabled={actions.busy} onClick={() => review('return-to-manager')}>Return to manager</Button><Button variant="primary" loading={actions.busy} onClick={() => review('forward-for-approval')}>Forward to ADMIN</Button></div>
  </CardBody></Card>
}

export function AdminDecision({ detail, onSaved }) {
  const [values, setValues] = useState({ decision: '', remarks: '', revisedEndDate: '', publishedComments: '' })
  const [errors, setErrors] = useState({})
  const actions = useProbationActions()
  const confirm = useConfirm()
  const toast = useToast()
  const change = (e) => setValues((v) => ({ ...v, [e.target.name]: e.target.value }))
  async function submit(e) {
    e.preventDefault()
    const next = {}
    if (!values.decision) next.decision = 'Choose a final decision.'
    if (values.decision && values.decision !== 'CONFIRMED' && !values.remarks.trim()) next.decisionRemarks = 'Provide the reason for extension or non-confirmation.'
    if (values.decision === 'EXTENDED' && (!values.revisedEndDate || values.revisedEndDate <= detail.assessment.probationEndDate)) next.revisedEndDate = 'The revised end date must be after the current probation end date.'
    setErrors(next)
    if (Object.keys(next).length) return
    if (!(await confirm({ title: 'Publish final probation decision?', message: `Record ${values.decision.toLowerCase().replaceAll('_', ' ')} for ${detail.assessment.employeeName}${values.decision === 'EXTENDED' ? ` through ${values.revisedEndDate}` : ''}? This outcome is final and the approved comments will be visible to the employee.`, confirmLabel: 'Publish decision', tone: values.decision === 'NOT_CONFIRMED' ? 'danger' : 'primary' }))) return
    try {
      await actions.action(detail.assessment.id, 'decision', { version: detail.assessment.version, decision: values.decision, remarks: values.remarks.trim(), revisedEndDate: values.decision === 'EXTENDED' ? values.revisedEndDate : null, publishedComments: values.publishedComments.trim() })
      toast.success('Final decision published'); onSaved()
    } catch { /* Stale or invalid decisions stay on the form for review. */ }
  }
  return <Card><CardHeader title="ADMIN decision" subtitle="Review all evidence and history. No score automatically determines the outcome." /><CardBody>
    <form onSubmit={submit} noValidate><FormErrors errors={errors} message={actions.error} />
      <div className="form-grid">
        <Field label="Final decision" htmlFor="decision" error={errors.decision} required><select id="decision" name="decision" value={values.decision} onChange={change}><option value="">Choose decision…</option><option value="CONFIRMED">Confirm</option><option value="EXTENDED">Extend</option><option value="NOT_CONFIRMED">Not confirm</option></select></Field>
        {values.decision === 'EXTENDED' && <Field label="Approved revised end date" htmlFor="revisedEndDate" error={errors.revisedEndDate} required><input id="revisedEndDate" name="revisedEndDate" type="date" min={detail.assessment.probationEndDate} value={values.revisedEndDate} onChange={change} /></Field>}
        <Field label="Internal decision remarks" htmlFor="decisionRemarks" full required={values.decision === 'EXTENDED' || values.decision === 'NOT_CONFIRMED'} error={errors.decisionRemarks} hint="Retained for HR and ADMIN; excluded from the employee outcome."><textarea id="decisionRemarks" name="remarks" rows={4} maxLength={4000} value={values.remarks} onChange={change} /></Field>
        <Field label="Approved comments for employee" htmlFor="publishedComments" full hint="Only this comment and the final outcome are published to the employee."><textarea id="publishedComments" name="publishedComments" rows={4} maxLength={4000} value={values.publishedComments} onChange={change} /></Field>
      </div>
      <p className="text-muted">This decision records the probation outcome. Any employment changes require a separate process.</p>
      <div className="form-actions"><Button type="submit" variant="primary" loading={actions.busy}>Publish final decision</Button></div>
    </form>
  </CardBody></Card>
}

export function ReassignManager({ detail, onSaved }) {
  const [manager, setManager] = useState('')
  const [remarks, setRemarks] = useState('')
  const [errors, setErrors] = useState({})
  const actions = useProbationActions()
  const confirm = useConfirm()
  const toast = useToast()
  async function submit(e) {
    e.preventDefault()
    const next = {}
    if (!manager || Number(manager) === detail.assessment.reportingManagerUserId) next.reportingManagerUserId = 'Choose a different reporting manager.'
    if (!remarks.trim()) next.reassignRemarks = 'Explain this reassignment.'
    setErrors(next)
    if (Object.keys(next).length) return
    if (!(await confirm({ title: 'Reassign reporting manager?', message: 'The existing evaluation will be preserved in history. The new manager starts a fresh draft, and the previous manager loses access.', confirmLabel: 'Reassign manager' }))) return
    try { await actions.action(detail.assessment.id, 'reassign', { version: detail.assessment.version, reportingManagerUserId: Number(manager), remarks: remarks.trim() }); toast.success('Reporting manager reassigned'); onSaved() } catch { /* Inline error. */ }
  }
  return <Card><CardHeader title="Reporting manager assignment" /><CardBody><details><summary>Reassign reporting manager</summary>
    <form onSubmit={submit} noValidate className="probation-section"><FormErrors errors={errors} message={actions.error} />
      <ReviewerPicker value={manager} employeeId={detail.assessment.employeeId} error={errors.reportingManagerUserId} onChange={setManager} />
      <Field label="Reason for reassignment" htmlFor="reassignRemarks" required error={errors.reassignRemarks}><textarea id="reassignRemarks" rows={3} maxLength={4000} value={remarks} onChange={(e) => setRemarks(e.target.value)} /></Field>
      <div className="form-actions"><Button type="submit" loading={actions.busy}>Reassign manager</Button></div>
    </form>
  </details></CardBody></Card>
}
