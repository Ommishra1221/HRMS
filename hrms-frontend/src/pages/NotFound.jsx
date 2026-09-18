import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import PageHeader from '../components/common/PageHeader'
import { EmptyState } from '../components/common/Loading'
import Button from '../components/common/Button'

// =============================================================================
// NotFound - the in-app 404.
// =============================================================================
// It lives inside the app shell, so a mistyped URL still shows the sidebar and
// the user can navigate out without touching the browser's back button.

export default function NotFound() {
  return (
    <div className="page">
      <PageHeader title="Page not found" subtitle="That address does not match any page in this app." />

      <EmptyState
        icon={Compass}
        title="Nothing lives at this address"
        message="The link may be out of date, or the page may have been renamed. Try the dashboard to get your bearings."
      >
        <Button as={Link} to="/dashboard" variant="primary">
          Go to dashboard
        </Button>
      </EmptyState>
    </div>
  )
}
