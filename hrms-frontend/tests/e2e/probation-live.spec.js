import { test, expect } from '@playwright/test'
import { criteria } from './probation-fixture.js'

// Run against scripts/Test-Probation.ps1's isolated stack. No intercepted requests.
test('real gateway, auth, employee, Feign and probation workflow publishes only the authorized outcome', async ({ page, request }) => {
  const base = 'http://localhost:18080/api'
  async function login(username, password) {
    const res = await request.post(`${base}/auth/login`, { data: { username, password } })
    expect(res.ok(), await res.text()).toBeTruthy(); return res.json()
  }
  const admin = await login('admin', 'admin123')
  const headers = { Authorization: `Bearer ${admin.token}` }
  async function create(path, data) { const res = await request.post(`${base}${path}`, { headers, data }); expect(res.ok(), await res.text()).toBeTruthy(); return res.json() }
  const suffix = Date.now()
  const employee = await create('/employees', { name: `Aditi Rao ${suffix}`, email: `aditi-${suffix}@example.invalid`, department: 'Engineering' })
  const managerEmployee = await create('/employees', { name: `Kiran Shah ${suffix}`, email: `kiran-${suffix}@example.invalid`, department: 'Engineering' })
  const managerName = `manager${suffix}`
  const subjectName = `subject${suffix}`
  const manager = await create('/auth/users', { username: managerName, email: `${managerName}@example.invalid`, password: 'IsolatedTest123', fullName: 'Kiran Shah', role: 'EMPLOYEE', employeeId: managerEmployee.id })
  // Employee id 1 is reserved by auth's demo seeder; use its existing login when applicable.
  if (employee.id !== 1) await create('/auth/users', { username: subjectName, email: `${subjectName}@example.invalid`, password: 'IsolatedTest123', role: 'EMPLOYEE', employeeId: employee.id })
  const hr = await login('hr', 'hr123')
  const managerLogin = await login(managerName, 'IsolatedTest123')
  const employeeLogin = await login(employee.id === 1 ? 'employee' : subjectName, employee.id === 1 ? 'employee123' : 'IsolatedTest123')
  async function session(auth, path) {
    await page.goto('/login')
    await page.evaluate((u) => { localStorage.setItem('hrms_token', u.token); localStorage.setItem('hrms_user', JSON.stringify({ ...u, roles: u.roles.map((r) => r.replace('ROLE_', '')) })) }, auth)
    await page.goto(path)
  }
  await session(hr, '/probation/assessments/new')
  await page.getByLabel('Employee').selectOption(String(employee.id))
  await page.getByLabel('Probation start date').fill('2026-01-01')
  await page.getByLabel('Probation end date').fill('2026-06-30')
  await page.getByLabel('Review due date').fill('2026-06-15')
  await page.getByLabel('Assigned manager').selectOption(String(manager.id))
  await page.getByLabel('Initial remarks').fill('Confidential preparation for manager.')
  await page.getByRole('button', { name: 'Save draft', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Send to manager' })).toBeVisible()
  const detailPath = new URL(page.url()).pathname
  await page.getByRole('button', { name: 'Send to manager' }).click()
  await expect(page.getByText('Pending manager evaluation', { exact: true })).toBeVisible()
  await session(managerLogin, detailPath)
  for (const name of criteria) {
    await page.getByLabel(`Score: ${name}`).selectOption('4')
    await page.getByLabel(`Evidence: ${name}`).fill('Demonstrated consistent performance in observed work.')
  }
  await page.getByLabel('Strengths').fill('Reliable delivery')
  await page.getByLabel('Areas for improvement').fill('Planning')
  await page.getByLabel('Development recommendations').fill('Mentoring')
  await page.getByLabel('Manager recommendation').selectOption('CONFIRMED')
  await page.getByRole('button', { name: 'Submit evaluation', exact: true }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Submit evaluation', exact: true }).click()
  await expect(page.getByText('Pending HR review', { exact: true })).toBeVisible()
  await session(hr, detailPath)
  await page.getByLabel('HR review remarks').fill('Private HR deliberation after checking evidence.')
  await page.getByRole('button', { name: 'Forward to ADMIN' }).click()
  await expect(page.getByText('Pending ADMIN approval', { exact: true })).toBeVisible()
  await session(admin, detailPath)
  await page.getByLabel('Final decision').selectOption('CONFIRMED')
  await page.getByLabel('Internal decision remarks').fill('Private administrative reasoning.')
  await page.getByLabel('Approved comments for employee').fill('Your probation has been confirmed.')
  await page.getByRole('button', { name: 'Publish final decision' }).click()
  await page.getByRole('dialog').getByRole('button', { name: 'Publish decision' }).click()
  await expect(page.getByText('Your probation has been confirmed.')).toBeVisible()
  await session(employeeLogin, detailPath)
  await expect(page.getByRole('heading', { name: 'My probation assessment' })).toBeVisible()
  await expect(page.getByText('Your probation has been confirmed.')).toBeVisible()
  await expect(page.getByText('Private administrative reasoning.')).toHaveCount(0)
  await expect(page.getByText('Evaluation evidence', { exact: true })).toHaveCount(0)
  const own = await request.get(`${base}/probation/me`, { headers: { Authorization: `Bearer ${employeeLogin.token}` } })
  expect(own.ok()).toBeTruthy(); const outcome = await own.text()
  expect(outcome).not.toContain('ratings'); expect(outcome).not.toContain('Private HR'); expect(outcome).not.toContain('managerName')
  // Original HR module writes remain forbidden through the real gateway.
  for (const path of ['/employees', '/leaves', '/attendance', '/payroll']) {
    const res = await request.post(`${base}${path}`, { headers: { Authorization: `Bearer ${hr.token}` }, data: {} })
    expect(res.status()).toBe(403)
  }
})
