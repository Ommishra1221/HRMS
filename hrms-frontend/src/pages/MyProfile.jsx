import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Building2, IdCard, Mail, UserRound } from 'lucide-react'

import { getMyProfile } from '../api/employeeApi'
import { ErrorAlert, Loading } from '../components/common/Loading'
import Card, { CardBody, CardHeader } from '../components/common/Card'
import PageHeader from '../components/common/PageHeader'
import Button from '../components/common/Button'
import { useAuth } from '../context/AuthContext'
import { initials } from '../utils/format'

// =============================================================================
// MyProfile = GET /api/employees/me, the EMPLOYEE self-service profile.
// =============================================================================
// The id is NOT in the URL: the backend resolves "me" from the JWT's
// employeeId claim, so there is nothing in the address bar to tamper with.
// An ADMIN/HR account has no employee link and the backend 403s /me - which
// is exactly why the route itself is EMPLOYEE-only.
//
// This page is deliberately read-only: employee master data is ADMIN's to
// change (HR may view it), so no edit/delete actions appear here.

export default function MyProfile() {
  const { user } = useAuth()
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await getMyProfile()
        if (!cancelled) setProfile(data)
      } catch (err) {
        if (!cancelled) setError(err.message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <Loading />

  if (error) {
    return (
      <div className="page">
        <PageHeader title="My profile" />
        <ErrorAlert title="Could not load your profile" message={error}>
          <Button as={Link} to="/dashboard" variant="secondary" icon={ArrowLeft}>
            Back to dashboard
          </Button>
        </ErrorAlert>
      </div>
    )
  }

  const displayName = profile.name || 'Unnamed employee'

  return (
    <div className="page">
      <PageHeader
        icon={IdCard}
        title="My profile"
        subtitle="Resolved from your sign-in on the server - the id is never taken from the URL."
        actions={
          <Button as={Link} to="/dashboard" variant="secondary" icon={ArrowLeft}>
            Back
          </Button>
        }
      />

      <div className="detail-grid">
        {/* ---- Identity summary ---- */}
        <Card>
          <CardBody>
            <div className="row" style={{ gap: 'var(--space-4)' }}>
              <span className="avatar avatar--lg" aria-hidden="true">
                {initials(displayName)}
              </span>
              <div className="grow">
                <h2 style={{ fontSize: 'var(--fs-lg)' }}>{displayName}</h2>
                <p className="text-muted" style={{ margin: 0 }}>
                  Signed in as {user?.username}
                </p>
              </div>
            </div>

            <div className="stack stack-2" style={{ marginTop: 'var(--space-5)' }}>
              <a href={`mailto:${profile.email}`} className="row">
                <Mail size={16} aria-hidden="true" className="text-subtle" />
                {profile.email}
              </a>
              <span className="row">
                <Building2 size={16} aria-hidden="true" className="text-subtle" />
                {profile.department}
              </span>
            </div>
          </CardBody>
        </Card>

        {/* ---- The record itself ---- */}
        <Card>
          <CardHeader
            title="Employee record"
            subtitle="Owned by employee-service; changes are made by an administrator"
            icon={UserRound}
          />
          <CardBody>
            <dl className="detail-list">
              <div className="detail-row">
                <dt>Employee ID</dt>
                <dd className="mono">{profile.id}</dd>
              </div>
              <div className="detail-row">
                <dt>Name</dt>
                <dd>{displayName}</dd>
              </div>
              <div className="detail-row">
                <dt>Email</dt>
                <dd>{profile.email}</dd>
              </div>
              <div className="detail-row">
                <dt>Department</dt>
                <dd>{profile.department}</dd>
              </div>
            </dl>

            <p className="text-subtle" style={{ marginTop: 'var(--space-4)' }}>
              If any detail is wrong, ask an administrator to update it - accounts and master data are managed by
              ADMIN.
            </p>
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
