// =============================================================================
// PageHeader - the title block that opens every page.
// =============================================================================
// Guarantees the same rhythm everywhere:
//   [icon]  Page title
//           One line explaining what this page is for
//                                                  [secondary] [primary action]
//
// It is also where the page's <h1> lives. The app previously used <h2> on
// every page, which left the document without a top-level heading - screen
// readers and search engines both rely on exactly one <h1> per view.

export default function PageHeader({ icon: Icon, title, subtitle, actions }) {
  return (
    <header className="page-header">
      <div className="page-header__text">
        <h1 className="page-header__title">
          {Icon ? <Icon size={22} aria-hidden="true" className="text-muted" /> : null}
          {title}
        </h1>
        {subtitle ? <p className="page-header__sub">{subtitle}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </header>
  )
}
