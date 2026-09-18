// =============================================================================
// BarChart - a simple comparison chart built from flexbox, not a library.
// =============================================================================
// Each bar's height is a percentage of the largest value, so the chart always
// fills its box no matter the scale of the data.
//
// ACCESSIBILITY
//   The visual bars are aria-hidden. The numbers are real text (the <ul> below
//   the chart) so a screen reader gets the data, and the values are also
//   printed above each bar so nobody has to eyeball a height.

export default function BarChart({
  data = [],
  height = 170,
  formatValue = (v) => v,
  formatLabel = (v) => v,
  tone = 'primary',
}) {
  const values = data.map((d) => Number(d.value) || 0)
  const max = Math.max(...values, 0)

  return (
    <div>
      <div className="bars" style={{ height }} aria-hidden="true">
        {data.map((item) => {
          const value = Number(item.value) || 0
          // Keep a sliver visible for zero so the axis still reads correctly.
          const percent = max > 0 ? (value / max) * 100 : 0
          const barTone = item.tone || tone
          const toneClass =
            barTone === 'amber' ? ' bars__bar--amber' : barTone === 'muted' ? ' bars__bar--muted' : ''

          return (
            <div className="bars__col" key={item.label} title={`${formatLabel(item.label)}: ${formatValue(value)}`}>
              <div className="bars__track">
                <div
                  className={`bars__bar${toneClass}`}
                  style={{ height: `${value > 0 ? Math.max(percent, 2) : 0}%` }}
                />
                <span className="bars__value">{formatValue(value)}</span>
              </div>
              <span className="bars__label">{formatLabel(item.label)}</span>
            </div>
          )
        })}
      </div>

      {/* Text equivalent of the chart for assistive tech (and for eyeballs). */}
      <ul className="sr-only">
        {data.map((item) => (
          <li key={item.label}>
            {formatLabel(item.label)}: {formatValue(Number(item.value) || 0)}
          </li>
        ))}
      </ul>
    </div>
  )
}
