import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, BadgeCheck, Eye, Pencil, Search, Trash2, Wallet } from 'lucide-react'

import usePayrolls from '../hooks/usePayrolls'
import { deletePayroll, markPayrollPaid } from '../api/payrollApi'
import { useAuth } from '../context/AuthContext'
import { EmptyState, ErrorAlert, Loading } from '../components/common/Loading'
import Card, { CardBody, CardFooter, CardHeader } from '../components/common/Card'
import PageHeader from '../components/common/PageHeader'
import Button from '../components/common/Button'
import Badge from '../components/common/Badge'
import { useConfirm } from '../components/common/ConfirmProvider'
import { useToast } from '../components/common/Toast'
import { formatAmount, formatMonth, initials } from '../utils/format'

// =============================================================================
// PayrollList = GET /api/payroll rendered as a filterable table.
// =============================================================================
// Each row's "employee" column comes from the NESTED object the backend
// composed via Feign (payroll_db row + live HTTP call to employee-service).
//
// Extra microservice moment: "Mark PAID" calls PATCH /api/payroll/{id}/paid
// - a partial lifecycle update, not a full PUT. The backend stamps the
// payment date and refuses to pay an already-paid payslip.
//
// NEW: money columns are right-aligned with tabular figures so digits line up,
// and the footer totals the rows you can actually see. Reading a payroll table
// usually ends with "so what is the total?" - now it is just there.

const FILTERS = [
  { key: 'ALL', label: 'All' },
  { key: 'PENDING', label: 'Pending' },
  { key: 'PAID', label: 'Paid' },
]

export default function PayrollList() {
  const { payrolls, loading, error, refresh } = usePayrolls()
  const confirm = useConfirm()
  const toast = useToast()

  // ROLE SHAPING: payroll is ADMIN-only to write (create/edit/delete/PAID).
  // HR is read-only, EMPLOYEE sees their own payslips (backend-scoped).
  // HR can NEVER see a "Mark paid" button - the backend would 403 it.
  const { isAdmin } = useAuth()

  const [filter, setFilter] = useState('ALL')
  const [query, setQuery] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [payingId, setPayingId] = useState(null)

  const counts = useMemo(() => {
    const base = { ALL: payrolls.length, PENDING: 0, PAID: 0 }
    payrolls.forEach((p) => {
      if (base[p.status] != null) base[p.status] += 1
    })
    return base
  }, [payrolls])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return payrolls
      .filter((p) => filter === 'ALL' || p.status === filter)
      .filter((p) => {
        if (!q) return true
        const name = p.employee?.name || ''
        return [name, p.month, p.status].filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
      })
      .sort((a, b) => (a.month === b.month ? b.id - a.id : b.month.localeCompare(a.month)))
  }, [payrolls, filter, query])

  // Totals for exactly the rows on screen.
  const totals = useMemo(
    () =>
      filtered.reduce(
        (acc, p) => {
          acc.basic += Number(p.basicSalary || 0)
          acc.allowances += Number(p.allowances || 0)
          acc.deductions += Number(p.deductions || 0)
          acc.net += Number(p.netSalary || 0)
          return acc
        },
        { basic: 0, allowances: 0, deductions: 0, net: 0 },
      ),
    [filtered],
  )

  async function handleMarkPaid(payroll) {
    const ok = await confirm({
      title: 'Mark this payslip as paid?',
      message: `Payslip #${payroll.id} for ${formatMonth(payroll.month)} will be marked PAID and today's date will be stamped as the payment date. Paid payslips cannot be reverted from this screen.`,
      confirmLabel: 'Mark as paid',
    })
    if (!ok) return

    setPayingId(payroll.id)
    try {
      await markPayrollPaid(payroll.id) // no date -> backend uses today
      await refresh()
      toast.success('Payslip marked paid')
    } catch (err) {
      // e.g. "Payroll 3 is already paid (month 2026-09)"
      toast.error('Could not mark as paid', err.message)
    } finally {
      setPayingId(null)
    }
  }

  async function handleDelete(payroll) {
    const ok = await confirm({
      title: 'Delete this payslip?',
      message: `Payslip #${payroll.id} (${formatMonth(payroll.month)}, net ${formatAmount(payroll.netSalary)}) will be permanently removed. This cannot be undone.`,
      confirmLabel: 'Delete payslip',
      tone: 'danger',
    })
    if (!ok) return

    setDeletingId(payroll.id)
    try {
      await deletePayroll(payroll.id)
      await refresh()
      toast.success('Payslip deleted')
    } catch (err) {
      toast.error('Could not delete payslip', err.message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="page">
      <PageHeader
        icon={Banknote}
        title="Payroll"
        subtitle="Payslips from payroll_db. Net salary is always computed by the service, never sent from the browser."
        actions={
          isAdmin ? (
            <Button as={Link} to="/payrolls/new" variant="primary" icon={Wallet}>
              Create payslip
            </Button>
          ) : undefined
        }
      />

      {loading ? <Loading /> : null}

      {!loading && error ? (
        <ErrorAlert title="Could not load payroll" message={error} onRetry={refresh} />
      ) : null}

      {!loading && !error && payrolls.length === 0 ? (
        <EmptyState
          icon={Banknote}
          title="No payslips yet"
          message="Create the first payslip to start tracking payroll."
        >
          {isAdmin ? (
            <Button as={Link} to="/payrolls/new" variant="primary" icon={Wallet}>
              Create payslip
            </Button>
          ) : null}
        </EmptyState>
      ) : null}

      {!loading && !error && payrolls.length > 0 ? (
        <Card>
          <CardHeader
            title="Payslips"
            subtitle={`${filtered.length} of ${payrolls.length} shown`}
            actions={
              <div className="input-icon">
                <Search size={16} aria-hidden="true" />
                <label className="sr-only" htmlFor="payroll-search">
                  Search payslips
                </label>
                <input
                  id="payroll-search"
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search employee, month…"
                  style={{
                    minHeight: 36,
                    padding: '8px 12px 8px 36px',
                    border: '1px solid var(--color-border-strong)',
                    borderRadius: 'var(--radius-sm)',
                    font: 'inherit',
                    background: 'var(--color-card)',
                    color: 'var(--color-fg)',
                  }}
                />
              </div>
            }
          />

          <div style={{ padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--color-border)' }}>
            <div className="segmented" role="group" aria-label="Filter payslips">
              {FILTERS.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  className="segmented__item"
                  aria-pressed={filter === f.key}
                  onClick={() => setFilter(f.key)}
                >
                  {f.label} ({counts[f.key] ?? 0})
                </button>
              ))}
            </div>
          </div>

          <CardBody flush>
            {filtered.length === 0 ? (
              <div style={{ padding: 'var(--space-6)' }}>
                <EmptyState
                  icon={Search}
                  title="No matching payslips"
                  message="Nothing matches the current filter and search."
                >
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setFilter('ALL')
                      setQuery('')
                    }}
                  >
                    Clear filters
                  </Button>
                </EmptyState>
              </div>
            ) : (
              <div className="table-wrap">
                <table className="table--stack">
                  <thead>
                    <tr>
                      <th>Employee</th>
                      <th>Month</th>
                      <th className="num">Basic</th>
                      <th className="num">Allowances</th>
                      <th className="num">Deductions</th>
                      <th className="num">Net</th>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((payroll) => (
                      <tr key={payroll.id}>
                        <td data-label="">
                          <div className="row">
                            <span className="avatar" aria-hidden="true">
                              {initials(payroll.employee?.name || `ID ${payroll.employeeId}`)}
                            </span>
                            <div className="grow">
                              <Link to={`/payrolls/${payroll.id}`} className="cell-primary">
                                {payroll.employee ? payroll.employee.name : `Unknown (id ${payroll.employeeId})`}
                              </Link>
                              <span className="cell-sub">
                                {payroll.employee ? payroll.employee.department : `Payslip #${payroll.id}`}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td data-label="Month" className="nowrap">
                          {formatMonth(payroll.month)}
                        </td>
                        <td data-label="Basic" className="num">
                          {formatAmount(payroll.basicSalary)}
                        </td>
                        <td data-label="Allowances" className="num">
                          {formatAmount(payroll.allowances)}
                        </td>
                        <td data-label="Deductions" className="num">
                          −{formatAmount(payroll.deductions)}
                        </td>
                        <td data-label="Net" className="num">
                          <span className="amount">{formatAmount(payroll.netSalary)}</span>
                        </td>
                        <td data-label="Status">
                          <Badge status={payroll.status} />
                        </td>
                        <td data-label="Actions">
                          <div className="cell-actions">
                            {isAdmin && payroll.status !== 'PAID' ? (
                              <Button
                                variant="success"
                                size="sm"
                                icon={BadgeCheck}
                                loading={payingId === payroll.id}
                                onClick={() => handleMarkPaid(payroll)}
                              >
                                Mark paid
                              </Button>
                            ) : null}
                            <Button
                              as={Link}
                              to={`/payrolls/${payroll.id}`}
                              variant="ghost"
                              size="sm"
                              iconOnly
                              icon={Eye}
                              title="View payslip"
                              aria-label={`View payslip ${payroll.id}`}
                            />
                            {isAdmin ? (
                              <>
                                <Button
                                  as={Link}
                                  to={`/payrolls/${payroll.id}/edit`}
                                  variant="ghost"
                                  size="sm"
                                  iconOnly
                                  icon={Pencil}
                                  title="Edit"
                                  aria-label={`Edit payslip ${payroll.id}`}
                                />
                                <Button
                                  variant="danger-ghost"
                                  size="sm"
                                  iconOnly
                                  icon={Trash2}
                                  loading={deletingId === payroll.id}
                                  onClick={() => handleDelete(payroll)}
                                  title="Delete"
                                  aria-label={`Delete payslip ${payroll.id}`}
                                />
                              </>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>

                  {/* Totals for the visible rows. */}
                  <tfoot>
                    <tr style={{ background: 'var(--color-card-alt)' }}>
                      <td colSpan={2} style={{ fontWeight: 600 }}>
                        Totals ({filtered.length} {filtered.length === 1 ? 'payslip' : 'payslips'})
                      </td>
                      <td className="num">{formatAmount(totals.basic)}</td>
                      <td className="num">{formatAmount(totals.allowances)}</td>
                      <td className="num">−{formatAmount(totals.deductions)}</td>
                      <td className="num">
                        <span className="amount">{formatAmount(totals.net)}</span>
                      </td>
                      <td colSpan={2} />
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </CardBody>

          <CardFooter>
            <span className="text-subtle">
              Net salary is computed server-side as basic + allowances − deductions.
            </span>
          </CardFooter>
        </Card>
      ) : null}
    </div>
  )
}
