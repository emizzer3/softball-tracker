import { useState } from 'react'
import { FIELD_W, FIELD_H, FIELD_HOME, FIELD_FIRST, FIELD_SECOND, FIELD_THIRD, FIELD_LF, FIELD_RF, HIT_COLORS } from './softballFieldConstants'

export function SoftballField({ atBats = [], onLocationSelect, size = 280 }) {
  const [loc, setLoc] = useState(null)

  function handleClick(e) {
    if (!onLocationSelect) return
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    // Convert screen coords → SVG viewBox coords
    const svgX = ((e.clientX - rect.left)  / rect.width)  * FIELD_W
    const svgY = ((e.clientY - rect.top)   / rect.height) * FIELD_H
    const pt = { x: Math.round(svgX), y: Math.round(svgY) }
    setLoc(pt)
    onLocationSelect(pt)
  }

  const displayLoc = loc   // local preview dot while placing

  return (
    <svg
      viewBox={`0 0 ${FIELD_W} ${FIELD_H}`}
      width={size}
      className="w-full"
      style={{ cursor: onLocationSelect ? 'crosshair' : 'default', touchAction: 'none' }}
      onClick={handleClick}
    >
      {/* Outfield grass wedge */}
      <path
        d={`M ${FIELD_HOME[0]},${FIELD_HOME[1]} L ${FIELD_LF[0]},${FIELD_LF[1]} A 185,185 0 0,1 ${FIELD_RF[0]},${FIELD_RF[1]} Z`}
        fill="#86efac" opacity="0.35"
      />
      {/* Infield dirt */}
      <circle cx={140} cy={200} r={73} fill="#d4a264" opacity="0.3" />
      {/* Foul lines */}
      <line x1={FIELD_HOME[0]} y1={FIELD_HOME[1]} x2={FIELD_LF[0]} y2={FIELD_LF[1]} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3" />
      <line x1={FIELD_HOME[0]} y1={FIELD_HOME[1]} x2={FIELD_RF[0]} y2={FIELD_RF[1]} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3" />
      {/* Outfield fence arc */}
      <path d={`M ${FIELD_LF[0]},${FIELD_LF[1]} A 185,185 0 0,1 ${FIELD_RF[0]},${FIELD_RF[1]}`}
        fill="none" stroke="#94a3b8" strokeWidth={1.5} />
      {/* Base paths */}
      <line x1={FIELD_HOME[0]} y1={FIELD_HOME[1]} x2={FIELD_FIRST[0]}  y2={FIELD_FIRST[1]}  stroke="#475569" strokeWidth={1.5} />
      <line x1={FIELD_FIRST[0]}  y1={FIELD_FIRST[1]}  x2={FIELD_SECOND[0]} y2={FIELD_SECOND[1]} stroke="#475569" strokeWidth={1.5} />
      <line x1={FIELD_SECOND[0]} y1={FIELD_SECOND[1]} x2={FIELD_THIRD[0]}  y2={FIELD_THIRD[1]}  stroke="#475569" strokeWidth={1.5} />
      <line x1={FIELD_THIRD[0]}  y1={FIELD_THIRD[1]}  x2={FIELD_HOME[0]}   y2={FIELD_HOME[1]}   stroke="#475569" strokeWidth={1.5} />
      {/* Pitcher's mound */}
      <circle cx={140} cy={200} r={9} fill="#c9a87c" stroke="#a07840" strokeWidth={1} />
      {/* Bases */}
      {[FIELD_FIRST, FIELD_SECOND, FIELD_THIRD].map(([bx, by], i) => (
        <rect key={i} x={bx-6} y={by-6} width={12} height={12}
          transform={`rotate(45,${bx},${by})`}
          fill="white" stroke="#475569" strokeWidth={1.5} />
      ))}
      {/* Home plate */}
      <polygon
        points={`${FIELD_HOME[0]},${FIELD_HOME[1]-9} ${FIELD_HOME[0]-8},${FIELD_HOME[1]-3} ${FIELD_HOME[0]-6},${FIELD_HOME[1]+7} ${FIELD_HOME[0]+6},${FIELD_HOME[1]+7} ${FIELD_HOME[0]+8},${FIELD_HOME[1]-3}`}
        fill="#64748b"
      />
      {/* Saved hit location dots from previous at-bats */}
      {atBats.filter(ab => ab.hitLocation).map(ab => (
        <g key={ab.id}>
          <circle cx={ab.hitLocation.x} cy={ab.hitLocation.y} r={7}
            fill={HIT_COLORS[ab.outcome] || '#6b7280'} opacity={0.7} stroke="white" strokeWidth={1.5} />
        </g>
      ))}
      {/* Current placement preview */}
      {displayLoc && (
        <g>
          <circle cx={displayLoc.x} cy={displayLoc.y} r={10} fill="rgba(239,68,68,0.25)" />
          <circle cx={displayLoc.x} cy={displayLoc.y} r={5}  fill="#ef4444" stroke="white" strokeWidth={2} />
        </g>
      )}
    </svg>
  )
}
