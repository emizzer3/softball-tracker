// Renders the baseball diamond SVG with bases highlighted
export default function BaseDiamond({ bases, size = 100 }) {
  // bases: [first, second, third] booleans
  const cx = size / 2
  const r = size * 0.38
  // Diamond corners: home(bottom), first(right), second(top), third(left)
  const pts = {
    home:  [cx,       cx + r],
    first: [cx + r,   cx],
    second:[cx,       cx - r],
    third: [cx - r,   cx],
  }

  function BaseSquare({ from, to, filled, label }) {
    const mx = (from[0] + to[0]) / 2
    const my = (from[1] + to[1]) / 2
    const angle = Math.atan2(to[1] - from[1], to[0] - from[0]) * 180 / Math.PI
    const s = size * 0.14
    return (
      <rect
        x={mx - s / 2} y={my - s / 2}
        width={s} height={s}
        rx={2}
        transform={`rotate(${angle + 45}, ${mx}, ${my})`}
        fill={filled ? '#f59e0b' : '#e2e8f0'}
        stroke={filled ? '#d97706' : '#94a3b8'}
        strokeWidth={1.5}
      />
    )
  }

  function BaselinePath({ from, to, active }) {
    return (
      <line
        x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]}
        stroke={active ? '#f59e0b' : '#cbd5e1'} strokeWidth={active ? 3 : 2}
        strokeDasharray={active ? '' : '4 3'}
      />
    )
  }

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Baselines */}
      <BaselinePath from={pts.home} to={pts.first} active={bases[0]} />
      <BaselinePath from={pts.first} to={pts.second} active={bases[0] && bases[1]} />
      <BaselinePath from={pts.second} to={pts.third} active={bases[1] && bases[2]} />
      <BaselinePath from={pts.third} to={pts.home} active={bases[2]} />
      {/* Bases */}
      <BaseSquare from={pts.home} to={pts.first} filled={bases[0]} />
      <BaseSquare from={pts.first} to={pts.second} filled={bases[1]} />
      <BaseSquare from={pts.second} to={pts.third} filled={bases[2]} />
      {/* Home plate */}
      <polygon
        points={`${pts.home[0]},${pts.home[1]-size*0.07} ${pts.home[0]-size*0.06},${pts.home[1]-size*0.02} ${pts.home[0]-size*0.04},${pts.home[1]+size*0.06} ${pts.home[0]+size*0.04},${pts.home[1]+size*0.06} ${pts.home[0]+size*0.06},${pts.home[1]-size*0.02}`}
        fill="#64748b"
      />
    </svg>
  )
}
