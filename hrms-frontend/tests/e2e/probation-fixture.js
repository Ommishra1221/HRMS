export const criteria = ['Work quality', 'Technical or job knowledge', 'Productivity', 'Communication', 'Teamwork', 'Reliability', 'Adaptability', 'Professional conduct']
export const codes = ['WORK_QUALITY', 'JOB_KNOWLEDGE', 'PRODUCTIVITY', 'COMMUNICATION', 'TEAMWORK', 'RELIABILITY', 'ADAPTABILITY', 'PROFESSIONAL_CONDUCT']
export function assessment(status = 'DRAFT') {
  return { assessment: { id: 42, employeeId: 1, employeeName: 'Aditi Rao', employeeDepartment: 'Engineering', reportingManagerUserId: 20, managerName: 'Kiran Shah', probationStartDate: '2026-01-01', probationEndDate: '2026-06-30', reviewDueDate: '2026-06-15', status, overallScore: status === 'DRAFT' ? null : 4, version: 0 }, criteriaVersion: '1', initialRemarks: 'Review delivery and collaboration.', ratings: criteria.map((name, i) => ({ criterionCode: codes[i], criterionName: name, weight: 1, score: status === 'DRAFT' || status === 'PENDING_MANAGER_EVALUATION' ? null : 4, comments: 'Observed delivery evidence.' })), strengths: 'Reliable delivery', areasForImprovement: 'Planning', developmentRecommendations: 'Mentoring', recommendation: 'CONFIRMED', hrReviewRemarks: 'Confidential HR deliberation', finalDecision: null, decisionRemarks: null, history: [], canEvaluate: false }
}
export function outcome(detail) {
  const a = detail.assessment
  return { id: a.id, employeeId: a.employeeId, probationStartDate: a.probationStartDate, probationEndDate: a.probationEndDate, reviewDueDate: a.reviewDueDate, status: a.status, finalDecision: detail.finalDecision, revisedEndDate: detail.revisedEndDate, publishedComments: detail.publishedComments, publishedAt: detail.publishedAt }
}
export async function setup(page, role = 'HR', status = 'DRAFT', options = {}) {
  let detail = assessment(status)
  const requests = []
  const user = { id: role === 'EMPLOYEE' && options.manager ? 20 : role === 'EMPLOYEE' ? 30 : role === 'HR' ? 10 : 1, username: role.toLowerCase(), fullName: role === 'EMPLOYEE' && options.manager ? 'Kiran Shah' : 'Aditi Rao', roles: [`ROLE_${role}`], employeeId: role === 'EMPLOYEE' ? options.manager ? 2 : 1 : null }
  await page.addInitScript((u) => { localStorage.setItem('hrms_token', 'isolated-ui-test'); localStorage.setItem('hrms_user', JSON.stringify({ ...u, roles: u.roles.map((r) => r.replace('ROLE_', '')) })) }, user)
  const paged = (rows) => ({ content: rows, totalElements: rows.length, totalPages: rows.length ? 1 : 0, page: 0, size: 20 })
  await page.route('**/api/**', async (route) => {
    const request = route.request(); const url = new URL(request.url()); const path = url.pathname
    if (!path.startsWith('/api/')) return route.continue()
    const body = request.postData() ? request.postDataJSON() : null
    requests.push({ path, method: request.method(), body })
    const reply = (data, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(data) })
    if (path === '/api/auth/me') return reply(user)
    if (path.endsWith('/capabilities')) return reply({ hasAssignments: !!options.manager })
    if (options.error && path.startsWith('/api/probation/')) return reply({ message: 'Probation service unavailable' }, 503)
    if (options.delay && path.endsWith('/assessments')) await new Promise((r) => setTimeout(r, options.delay))
    if (path.endsWith('/statistics')) return reply({ active: 1, pendingManager: 1, pendingHr: 0, pendingAdmin: 0, completed: 0, recentlyCompleted: [] })
    if (path.endsWith('/criteria')) return reply({ scoreLabels: { 1: 'Needs significant improvement', 2: 'Developing', 3: 'Meets expectations', 4: 'Exceeds expectations', 5: 'Outstanding' } })
    if (path.endsWith('/employees')) return reply([{ id: 1, name: 'Aditi Rao', department: 'Engineering' }, { id: 2, name: 'Kiran Shah', department: 'Engineering' }])
    if (path.endsWith('/reviewers')) return reply(paged([{ id: 20, username: 'kiran', fullName: 'Kiran Shah', employeeId: 2 }]))
    if (path.endsWith('/me') || path.endsWith('/manager/assignments') || (path.endsWith('/assessments') && request.method() === 'GET')) return reply(paged(options.empty ? [] : [role === 'EMPLOYEE' && !options.manager ? outcome(detail) : detail.assessment]))
    if (path.endsWith('/assessments') && request.method() === 'POST') { detail = { ...detail, assessment: { ...detail.assessment, ...body }, initialRemarks: body.initialRemarks }; return reply(detail, 201) }
    if (path === '/api/probation/assessments/999') return reply({ message: 'You are not authorized to access this assessment or action' }, 403)
    if (request.method() === 'PUT' && path.endsWith('/evaluation')) {
      detail = { ...detail, ...body, ratings: detail.ratings.map((r) => ({ ...r, ...body.ratings.find((x) => x.criterionCode === r.criterionCode) })), assessment: { ...detail.assessment, status: 'MANAGER_EVALUATION_IN_PROGRESS', overallScore: 4, version: detail.assessment.version + 1 } }
      return reply(detail)
    }
    if (request.method() === 'POST') {
      const action = path.split('/').pop()
      const statuses = { 'send-for-evaluation': 'PENDING_MANAGER_EVALUATION', 'submit-evaluation': 'PENDING_HR_REVIEW', 'return-to-manager': 'RETURNED_TO_MANAGER', 'forward-for-approval': 'PENDING_ADMIN_APPROVAL', decision: body.decision }
      detail.assessment = { ...detail.assessment, status: statuses[action] || detail.assessment.status, version: detail.assessment.version + 1 }
      if (action === 'decision') detail = { ...detail, finalDecision: body.decision, decisionRemarks: body.remarks, revisedEndDate: body.revisedEndDate, publishedComments: body.publishedComments, publishedAt: '2026-07-01T12:00:00Z' }
      return reply(detail)
    }
    if (path.match(/\/assessments\/\d+$/)) {
      detail.canEvaluate = !!options.manager && ['PENDING_MANAGER_EVALUATION', 'MANAGER_EVALUATION_IN_PROGRESS', 'RETURNED_TO_MANAGER'].includes(detail.assessment.status)
      return reply(role === 'EMPLOYEE' && !options.manager ? outcome(detail) : detail)
    }
    return reply([])
  })
  return { requests, setDetail: (next) => { detail = next } }
}
