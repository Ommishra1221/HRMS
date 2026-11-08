import test from 'node:test'
import assert from 'node:assert/strict'
import { navGroupsFor } from '../../src/config/navigation.js'
import { canAccess } from '../../src/config/access.js'

const paths = (role, capabilities) => navGroupsFor(role, capabilities).flatMap((g) => g.items.map((i) => i.to))
test('reviewer navigation requires a server-reported assignment', () => {
  assert.ok(paths('EMPLOYEE').includes('/my-probation'))
  assert.ok(!paths('EMPLOYEE').includes('/manager-evaluations'))
  assert.ok(paths('EMPLOYEE', { hasAssignments: true }).includes('/manager-evaluations'))
  assert.ok(!paths('EMPLOYEE', { hasAssignments: true }).includes('/users'))
})
test('HR probation writes leave original module permissions intact', () => {
  assert.ok(canAccess('/probation/assessments/new', 'HR'))
  for (const path of ['/employees/new', '/leaves/new', '/attendance/new', '/payrolls/new', '/users']) assert.equal(canAccess(path, 'HR'), false, path)
  assert.equal(canAccess('/probation/assessments/new', 'ADMIN'), false)
  assert.equal(canAccess('/probation', 'EMPLOYEE'), false)
  assert.ok(canAccess('/probation/assessments/42', 'EMPLOYEE'))
})
