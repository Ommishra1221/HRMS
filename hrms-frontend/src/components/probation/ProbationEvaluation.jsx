import { useState } from 'react'
import { useProbationQuery, useProbationActions } from '../../hooks/useProbation'
import { useToast } from '../common/Toast'
import { useConfirm } from '../common/ConfirmProvider'
import Card, { CardBody, CardHeader } from '../common/Card'
import Field from '../common/Field'
import Button from '../common/Button'
import { ErrorAlert } from '../common/Loading'
import { statusLabel } from '../common/Badge'
import { FormErrors } from './ProbationShared'

export default function ProbationEvaluation({ detail, onSaved }) {
  const a = detail.assessment
  const [ratings, setRatings] = useState(detail.ratings)
  const [notes, setNotes] = useState({ strengths: detail.strengths || '', areasForImprovement: detail.areasForImprovement || '', developmentRecommendations: detail.developmentRecommendations || '', recommendation: detail.recommendation || '' })
  const [errors, setErrors] = useState({})
  const actions = useProbationActions()
  const criteria = useProbationQuery('/criteria')
  const toast = useToast()
  const confirm = useConfirm()
  const updateRating = (index, key, value) => setRatings((rows) => rows.map((r, i) => i === index ? { ...r, [key]: value } : r))
  async function save(submit) {
    const next = {}
    if (submit) {
      ratings.forEach((r) => { if (!r.score) next[`score-${r.criterionCode}`] = `Score ${r.criterionName}.`; if (!r.comments?.trim()) next[`comments-${r.criterionCode}`] = `Add evidence for ${r.criterionName}.` })
      for (const [key, label] of [['strengths', 'strengths'], ['areasForImprovement', 'areas for improvement'], ['developmentRecommendations', 'development recommendations'], ['recommendation', 'a manager recommendation']]) if (!notes[key]?.trim()) next[key] = `Enter ${label}.`
    }
    setErrors(next)
    if (Object.keys(next).length) return
    if (submit && !(await confirm({ title: 'Submit manager evaluation?', message: `Submit your evaluation for ${a.employeeName} to HR? It will be locked until HR returns it for correction.`, confirmLabel: 'Submit evaluation' }))) return
    try {
      const saved = await actions.evaluate(a.id, { version: a.version, ratings: ratings.map((r) => ({ criterionCode: r.criterionCode, score: r.score ? Number(r.score) : null, comments: r.comments || '' })), ...notes, recommendation: notes.recommendation || null })
      if (submit) {
        try { await actions.action(a.id, 'submit-evaluation', { version: saved.assessment.version }) }
        catch (err) { toast.error('Draft saved; submission failed', err.message); onSaved(); return }
      }
      toast.success(submit ? 'Evaluation submitted to HR' : 'Evaluation draft saved'); onSaved()
    } catch { /* Keep draft values visible after a failed save. */ }
  }
  return <Card><CardHeader title="Manager evaluation" subtitle="Use observed evidence for each criterion. The overall score is calculated when saved." />
    <CardBody><form onSubmit={(e) => { e.preventDefault(); save(false) }} noValidate>
      <FormErrors errors={errors} message={actions.error} />
      {criteria.error && <ErrorAlert message={criteria.error} onRetry={criteria.refresh} />}
      <fieldset disabled={actions.busy || criteria.loading || !!criteria.error} className="probation-fieldset">
        {ratings.map((rating, index) => <section className="probation-criterion" key={rating.criterionCode} aria-labelledby={`criterion-${rating.criterionCode}`}>
          <h3 id={`criterion-${rating.criterionCode}`}>{rating.criterionName}</h3>
          <div className="probation-rating-grid">
            <Field label={`Score: ${rating.criterionName}`} htmlFor={`score-${rating.criterionCode}`} error={errors[`score-${rating.criterionCode}`]} required>
              <select id={`score-${rating.criterionCode}`} value={rating.score || ''} onChange={(e) => updateRating(index, 'score', e.target.value)}><option value="">Not rated</option>
                {Object.entries(criteria.data?.scoreLabels || {}).sort(([a], [b]) => Number(a) - Number(b)).map(([score, label]) => <option key={score} value={score}>{score} — {label}</option>)}
              </select>
            </Field>
            <Field label={`Evidence: ${rating.criterionName}`} htmlFor={`comments-${rating.criterionCode}`} error={errors[`comments-${rating.criterionCode}`]} required><textarea id={`comments-${rating.criterionCode}`} rows={3} maxLength={2000} value={rating.comments || ''} onChange={(e) => updateRating(index, 'comments', e.target.value)} /></Field>
          </div>
        </section>)}
        <div className="form-grid">
          {[['strengths', 'Strengths'], ['areasForImprovement', 'Areas for improvement'], ['developmentRecommendations', 'Development recommendations']].map(([key, label]) => <Field key={key} label={label} htmlFor={key} full error={errors[key]} required><textarea id={key} rows={3} maxLength={4000} value={notes[key]} onChange={(e) => setNotes((n) => ({ ...n, [key]: e.target.value }))} /></Field>)}
          <Field label="Manager recommendation" htmlFor="recommendation" error={errors.recommendation} required><select id="recommendation" value={notes.recommendation} onChange={(e) => setNotes((n) => ({ ...n, recommendation: e.target.value }))}>
            <option value="">Choose recommendation…</option>{['CONFIRMED', 'EXTENDED', 'NOT_CONFIRMED'].map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}
          </select></Field>
        </div>
      </fieldset>
      <p className="text-muted">A recommendation informs HR and ADMIN review. It does not issue a final decision.</p>
      <div className="form-actions"><Button type="submit" loading={actions.busy} disabled={criteria.loading || !!criteria.error}>Save draft</Button><Button variant="primary" disabled={actions.busy || criteria.loading || !!criteria.error} onClick={() => save(true)}>Submit evaluation</Button></div>
    </form></CardBody>
  </Card>
}
