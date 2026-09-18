// =============================================================================
// DonutChart - a part-of-whole chart built from plain SVG.
// =============================================================================
// No charting library: the whole thing is a few <circle> elements whose
// stroke-dasharray draws an arc. That keeps the bundle small and the markup
// inspectable, which matters more here than exotic interactions.
//
// HOW IT WORKS
//   A circle of radius r has circumference C = 2*pi*r.
//   Setting stroke-dasharray = "segmentLength restOfCircle" draws exactly
//   segmentLength of that circle, and stroke-dashoffset positions where the
//   arc starts. Walking the offset around the ring lays the segments end to
//   end and produces the donut.
//
// ACCESSIBILITY
//   The graphic is role="img" with a summary label, and the same numbers are
//   repeated as real text in the legend. Nothing is conveyed by colour alone:
//   every swatch has its label and value beside it.

const DEFAULT_COLORS = ['#1e40af', '#3b82f6', '#d97706', '#059669', '#dc2626', '#7c3aed']

export default function DonutChart({
  data = [],
  size = 148,
  thickness = 18,
  caption = 'total',
  centerValue,
  centerLabel,
  formatValue = (v) => v,
}) {
  const total = data.reduce((sum, d) => sum + (Number(d.value) || 0), 0)
  const radius = (size - thickness) / 2
  const circumference = 2 * Math.PI * radius

  // Turn values into arcs, accumulating the offset as we go.
  let offset = 0
  const segments = data.map((item, index) => {
    const value = Number(item.value) || 0
    const fraction = total > 0 ? value / total : 0
    const length = fraction * circumference
    const segment = {
      ...item,
      value,
      fraction,
      length,
      offset,
      color: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
    }
    offset += length
    return segment
  })

  // Spoken summary: "Present 12, Absent 2". This is what a screen reader reads
  // instead of the raw paths.
  const summary = segments.map((s) => `${s.label} ${s.value}`).join(', ')

  return (
    <div className="chart">
      <div className="donut" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={`${caption}: ${summary || 'no data'}`}
        >
          {/* Track ring - shows through wherever there is no data. */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            style={{ stroke: 'var(--color-muted)' }}
            strokeWidth={thickness}
          />

          {total > 0 &&
            segments.map((segment) =>
              segment.length > 0 ? (
                <circle
                  key={segment.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  style={{ stroke: segment.color }}
                  strokeWidth={thickness}
                  strokeDasharray={`${segment.length} ${circumference - segment.length}`}
                  strokeDashoffset={-segment.offset}
                >
                  {/* Native tooltip - keyboard users get the legend instead. */}
                  <title>{`${segment.label}: ${formatValue(segment.value)}`}</title>
                </circle>
              ) : null,
            )}
        </svg>

        <div className="donut__center">
          <div className="donut__total">{centerValue ?? formatValue(total)}</div>
          <div className="donut__caption">{centerLabel || caption}</div>
        </div>
      </div>

      {/* The legend IS the data table for this chart - text, not just colour. */}
      <ul className="legend">
        {segments.map((segment) => (
          <li className="legend__row" key={segment.label}>
            <span className="legend__swatch" style={{ background: segment.color }} aria-hidden="true" />
            <span className="legend__label">{segment.label}</span>
            <span className="legend__value">{formatValue(segment.value)}</span>
          </li>
        ))}
        {segments.length === 0 ? <li className="text-subtle">No data yet</li> : null}
      </ul>
    </div>
  )
}
