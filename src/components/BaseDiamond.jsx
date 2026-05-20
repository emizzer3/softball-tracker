// Renders the baseball diamond SVG with bases highlighted
export default function BaseDiamond({ bases, size = 100 }) {
  // bases: [first, second, third] booleans
  const cx = size / 2
  const r  = size * 0.38

  // Diamond corners
  const home   = [cx,     cx + r]
  const first  = [cx + r, cx    ]
  const second = [cx,     cx - r]
  const third  = [cx - r, cx    ]

  const s = size * 0.13 // base square side length

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      {/* Baselines */}
      <line x1={home[0]}   y1={home[1]}   x2={first[0]}  y2={first[1]}
        stroke={bases[0] ? '#f59e0b' : '#cbd5e1'} strokeWidth={bases[0] ? 3 : 2}
        strokeDasharray={bases[0] ? '' : '4 3'} />
      <line x1={first[0]}  y1={first[1]}  x2={second[0]} y2={second[1]}
        stroke={bases[1] ? '#f59e0b' : '#cbd5e1'} strokeWidth={bases[1] ? 3 : 2}
        strokeDasharray={bases[1] ? '' : '4 3'} />
      <line x1={second[0]} y1={second[1]} x2={third[0]}  y2={third[1]}
        stroke={bases[2] ? '#f59e0b' : '#cbd5e1'} strokeWidth={bases[2] ? 3 : 2}
        strokeDasharray={bases[2] ? '' : '4 3'} />
      <line x1={third[0]}  y1={third[1]}  x2={home[0]}   y2={home[1]}
        stroke='#cbd5e1' strokeWidth={2} strokeDasharray='4 3' />

      {/* Bases — rotated squares at each corner */}
      {[first, second, third].map(([x, y], i) => (
        <rect
          key={i}
          x={x - s / 2} y={y - s / 2}
          width={s} height={s}
          rx={2}
          transform={`rotate(45, ${x}, ${y})`}
          fill={bases[i] ? '#f59e0b' : '#e2e8f0'}
          stroke={bases[i] ? '#d97706' : '#94a3b8'}
          strokeWidth={1.5}
        />
      ))}

      {/* Home plate */}
      <polygon
        points={[
          [home[0],            home[1] - size * 0.07],
          [home[0] - size*0.06, home[1] - size * 0.02],
          [home[0] - size*0.04, home[1] + size * 0.06],
          [home[0] + size*0.04, home[1] + size * 0.06],
          [home[0] + size*0.06, home[1] - size * 0.02],
        ].map(p => p.join(',')).join(' ')}
        fill="#64748b"
      />
    </svg>
  )
}
