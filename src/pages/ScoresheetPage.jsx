import { Printer, Home } from 'lucide-react'

const POSITIONS = ['P','C','1B','2B','3B','SS','LF','LC','RC','RF','EF']

// Outcome codes → how many bases the batter reached (for diamond fill)
const BASES_REACHED = { '1B': 1, '2B': 2, '3B': 3, 'HR': 4, 'BB': 1, 'HBP': 1, 'E': 1, 'FC': 1 }
const OUT_CODES = new Set(['K','F','G','SAC'])

// Colours for outcome labels on the scoresheet
const CODE_COLOR = {
  '1B': '#16a34a', '2B': '#16a34a', '3B': '#16a34a', 'HR': '#15803d',
  'BB': '#2563eb', 'HBP': '#2563eb',
  'K': '#dc2626', 'F': '#dc2626', 'G': '#dc2626',
  'E': '#d97706', 'FC': '#d97706', 'SAC': '#6b7280',
}

// Small SVG diamond showing which bases were reached
function DiamondCell({ outcome, rbi }) {
  const bases = BASES_REACHED[outcome] || 0
  const isOut = OUT_CODES.has(outcome)
  const s = 36
  const cx = s / 2, cy = s / 2, r = s * 0.38
  const pts = {
    home:  [cx, cy + r],
    first: [cx + r, cy],
    second:[cx, cy - r],
    third: [cx - r, cy],
  }
  const segments = [
    [pts.home,  pts.first,  bases >= 1],
    [pts.first, pts.second, bases >= 2],
    [pts.second,pts.third,  bases >= 3],
    [pts.third, pts.home,   bases >= 4],
  ]

  return (
    <div className="flex flex-col items-center">
      <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
        {segments.map(([from, to, filled], i) => (
          <line key={i}
            x1={from[0]} y1={from[1]} x2={to[0]} y2={to[1]}
            stroke={filled ? '#f59e0b' : '#cbd5e1'}
            strokeWidth={filled ? 2.5 : 1.5}
          />
        ))}
        {/* Home plate dot */}
        <circle cx={pts.home[0]} cy={pts.home[1]} r={3} fill="#64748b" />
        {/* Outcome code */}
        <text x={cx} y={cy + 4} textAnchor="middle"
          fontSize={bases === 0 ? 9 : 7}
          fontWeight="700"
          fill={CODE_COLOR[outcome] || '#374151'}>
          {outcome}
        </text>
        {/* RBI dot */}
        {rbi > 0 && <circle cx={pts.second[0]} cy={pts.second[1]} r={4} fill="#f59e0b" />}
      </svg>
      {rbi > 0 && <span className="text-xs font-bold text-amber-600" style={{ lineHeight: 1 }}>{rbi}</span>}
    </div>
  )
}

function EmptyCell() {
  const s = 36, cx = s / 2, cy = s / 2, r = s * 0.38
  const pts = {
    home:  [cx, cy + r],
    first: [cx + r, cy],
    second:[cx, cy - r],
    third: [cx - r, cy],
  }
  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`}>
      <polygon points={`${pts.home[0]},${pts.home[1]} ${pts.first[0]},${pts.first[1]} ${pts.second[0]},${pts.second[1]} ${pts.third[0]},${pts.third[1]}`}
        fill="none" stroke="#e2e8f0" strokeWidth={1} />
    </svg>
  )
}

export default function ScoresheetPage({ game, onHome, onSummary }) {
  const { atBats = [], battingOrder = [], innings, home, away, homeScore, awayScore, inningScores = [], date, gameType, tournamentName } = game

  // Build grid: batters × innings
  // Each cell: the at-bat record for that batter in that inning (or null)
  const inningNums = Array.from({ length: innings }, (_, i) => i + 1)

  function getAtBat(batter, inning) {
    // Find the at-bat(s) for this batter in this inning
    return atBats.filter(ab => ab.batter === batter && ab.inning === inning)
  }

  // Per-batter totals
  function totals(batter) {
    const abs = atBats.filter(ab => ab.batter === batter)
    const AB  = abs.filter(ab => !['BB','HBP','SAC'].includes(ab.outcome)).length
    const H   = abs.filter(ab => ['1B','2B','3B','HR'].includes(ab.outcome)).length
    const BB  = abs.filter(ab => ab.outcome === 'BB').length
    const K   = abs.filter(ab => ab.outcome === 'K').length
    const RBI = abs.reduce((s, ab) => s + (ab.rbi || 0), 0)
    // Runs: count how many times this batter appeared in base advancement (approximate)
    const R = abs.filter(ab => (ab.rbi || 0) > 0 || ab.outcome === 'HR').length
    const AVG = AB > 0 ? (H / AB).toFixed(3).replace(/^0/, '') : '-'
    return { AB, H, R, RBI, BB, K, AVG }
  }

  // Score by inning
  const topScores = inningScores.map(s => s.away ?? 0)
  const botScores = inningScores.map(s => s.home ?? 0)

  return (
    <div className="p-2 pb-24 max-w-full overflow-x-auto">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 no-print">
        <button onClick={onHome} className="btn btn-ghost btn-sm"><Home size={14} /> Home</button>
        <h1 className="text-lg font-bold flex-1">Scoresheet</h1>
        {onSummary && (
          <button onClick={onSummary} className="btn btn-ghost btn-sm gap-1">📋 Summary</button>
        )}
        <button onClick={() => window.print()} className="btn btn-primary btn-sm gap-1">
          <Printer size={14} /> Print
        </button>
      </div>

      {/* Game info */}
      <div className="mb-3 text-sm">
        <p className="font-bold text-base">{away} @ {home}</p>
        <p className="text-gray-500">
          {date} · {gameType}{tournamentName ? ` · ${tournamentName}` : ''} · Final: {homeScore ?? 0}–{awayScore ?? 0}
        </p>
      </div>

      {/* Scoreboard by inning */}
      <div className="card mb-4 p-2 overflow-x-auto">
        <table className="w-full text-xs text-center border-collapse">
          <thead>
            <tr>
              <th className="text-left px-2 py-1 font-semibold text-gray-600 w-24">Team</th>
              {inningNums.map(i => <th key={i} className="px-2 py-1 font-semibold">{i}</th>)}
              <th className="px-2 py-1 font-bold border-l border-gray-300">R</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-200">
              <td className="text-left px-2 py-1 font-semibold text-gray-700">{away}</td>
              {topScores.map((s, i) => <td key={i} className="px-2 py-1">{s || '0'}</td>)}
              <td className="px-2 py-1 font-bold border-l border-gray-300">{awayScore}</td>
            </tr>
            <tr className="border-t border-gray-200">
              <td className="text-left px-2 py-1 font-semibold text-gray-700">{home}</td>
              {botScores.map((s, i) => <td key={i} className="px-2 py-1">{s || '0'}</td>)}
              <td className="px-2 py-1 font-bold border-l border-gray-300">{homeScore}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Main scoresheet grid */}
      <div className="card p-2 overflow-x-auto mb-4">
        <table className="text-xs border-collapse" style={{ minWidth: '100%' }}>
          <thead>
            <tr className="border-b border-gray-300">
              <th className="text-left px-2 py-1 font-semibold text-gray-600 sticky left-0 bg-white z-10 min-w-20">#  Batter</th>
              {inningNums.map(i => <th key={i} className="px-1 py-1 font-semibold text-center min-w-10">{i}</th>)}
              <th className="px-1 py-1 font-semibold border-l border-gray-300">AB</th>
              <th className="px-1 py-1 font-semibold">H</th>
              <th className="px-1 py-1 font-semibold">R</th>
              <th className="px-1 py-1 font-semibold">RBI</th>
              <th className="px-1 py-1 font-semibold">BB</th>
              <th className="px-1 py-1 font-semibold">K</th>
              <th className="px-1 py-1 font-semibold">AVG</th>
            </tr>
          </thead>
          <tbody>
            {battingOrder.map((batter, bi) => {
              const t = totals(batter)
              const playerType = game.roster?.find(p => p.name === batter)?.type
              return (
                <tr key={batter} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="px-2 py-1 sticky left-0 bg-white z-10">
                    <span className="text-gray-400 mr-1">{bi + 1}.</span>
                    <span className="font-semibold">{batter}</span>
                    {playerType && <span className={`ml-1 ${playerType === 'BBH' ? 'badge-bbh' : 'badge-sbh'}`}>{playerType}</span>}
                  </td>
                  {inningNums.map(inning => {
                    const abs = getAtBat(batter, inning)
                    return (
                      <td key={inning} className="px-0.5 py-1 text-center align-middle">
                        {abs.length > 0
                          ? abs.map(ab => <DiamondCell key={ab.id} outcome={ab.outcome} rbi={ab.rbi || 0} />)
                          : <EmptyCell />
                        }
                      </td>
                    )
                  })}
                  <td className="px-1 py-1 text-center border-l border-gray-300 font-medium">{t.AB}</td>
                  <td className="px-1 py-1 text-center font-medium">{t.H}</td>
                  <td className="px-1 py-1 text-center">{t.R}</td>
                  <td className="px-1 py-1 text-center">{t.RBI}</td>
                  <td className="px-1 py-1 text-center">{t.BB}</td>
                  <td className="px-1 py-1 text-center">{t.K}</td>
                  <td className="px-1 py-1 text-center font-mono text-xs">{t.AVG}</td>
                </tr>
              )
            })}
          </tbody>
          {/* Team totals row */}
          {(() => {
            const allAbs = atBats.filter(ab => !['BB','HBP','SAC'].includes(ab.outcome))
            const totalAB  = allAbs.length
            const totalH   = atBats.filter(ab => ['1B','2B','3B','HR'].includes(ab.outcome)).length
            const totalRBI = atBats.reduce((s, ab) => s + (ab.rbi || 0), 0)
            const totalBB  = atBats.filter(ab => ab.outcome === 'BB').length
            const totalK   = atBats.filter(ab => ab.outcome === 'K').length
            return (
              <tfoot>
                <tr className="border-t-2 border-gray-400 bg-gray-50 font-bold text-xs">
                  <td className="px-2 py-1 sticky left-0 bg-gray-50">TOTALS</td>
                  {inningNums.map(i => <td key={i} className="px-1 py-1 text-center text-gray-400">—</td>)}
                  <td className="px-1 py-1 text-center border-l border-gray-300">{totalAB}</td>
                  <td className="px-1 py-1 text-center">{totalH}</td>
                  <td className="px-1 py-1 text-center">{homeScore ?? 0}</td>
                  <td className="px-1 py-1 text-center">{totalRBI}</td>
                  <td className="px-1 py-1 text-center">{totalBB}</td>
                  <td className="px-1 py-1 text-center">{totalK}</td>
                  <td className="px-1 py-1 text-center font-mono">
                    {totalAB > 0 ? (totalH / totalAB).toFixed(3).replace(/^0/, '') : '-'}
                  </td>
                </tr>
              </tfoot>
            )
          })()}
        </table>
      </div>

      {/* Fielding card */}
      {game.fieldingLineup && Object.keys(game.fieldingLineup).length > 0 && (() => {
        const playLog = game.playLog || []
        const hasStats = battingOrder.some(name => {
          const po = playLog.filter(l => l.type === 'putout' && l.fielder === name).length
          const a  = playLog.filter(l => l.type === 'putout' && l.assister === name).length
          const e  = playLog.filter(l => l.type === 'error'  && l.fielder === name).length
          return po + a + e > 0
        })
        return (
          <div className="card p-3 mb-3">
            <h2 className="font-bold text-sm mb-3">Fielding</h2>
            <div className="grid grid-cols-2 gap-4">

              {/* Starting lineup */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Starting Lineup</p>
                <table className="text-xs w-full">
                  <tbody>
                    {POSITIONS.map(pos => {
                      const player = game.fieldingLineup[pos]
                      if (!player) return null
                      return (
                        <tr key={pos} className="border-b border-gray-100">
                          <td className="py-0.5 font-bold text-gray-500 w-8">{pos}</td>
                          <td className="py-0.5">{player}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {/* PO / A / E per player */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">PO · A · E</p>
                {hasStats ? (
                  <table className="text-xs w-full">
                    <thead>
                      <tr className="text-gray-400">
                        <th className="text-left font-medium pb-1">Player</th>
                        <th className="font-medium pb-1 text-center">PO</th>
                        <th className="font-medium pb-1 text-center">A</th>
                        <th className="font-medium pb-1 text-center text-red-400">E</th>
                      </tr>
                    </thead>
                    <tbody>
                      {battingOrder.map(name => {
                        const po = playLog.filter(l => l.type === 'putout' && l.fielder === name).length
                        const a  = playLog.filter(l => l.type === 'putout' && l.assister === name).length
                        const e  = playLog.filter(l => l.type === 'error'  && l.fielder === name).length
                        if (po + a + e === 0) return null
                        const pos = game.playerPositions?.[name] || ''
                        return (
                          <tr key={name} className="border-b border-gray-100">
                            <td className="py-0.5">
                              {name.split(' ')[0]}
                              {pos && <span className="ml-1 text-gray-400 text-xs">{pos}</span>}
                            </td>
                            <td className="py-0.5 text-center font-medium">{po || '–'}</td>
                            <td className="py-0.5 text-center">{a || '–'}</td>
                            <td className="py-0.5 text-center text-red-600">{e || '–'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-xs text-gray-400 italic">No putouts recorded</p>
                )}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Legend */}
      <div className="card p-3 mb-3 no-print">
        <p className="text-xs font-semibold text-gray-500 mb-2">Legend</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
          {[['1B','Single'],['2B','Double'],['3B','Triple'],['HR','Home Run'],['BB','Walk'],['HBP','Hit By Pitch'],['K','Strikeout'],['F','Flyout'],['G','Groundout'],['E','Error'],['FC',"Fielder's Choice"],['SAC','Sacrifice']].map(([c,l]) => (
            <span key={c}><b style={{ color: CODE_COLOR[c] }}>{c}</b> {l}</span>
          ))}
        </div>
        <p className="text-xs text-gray-500 mt-2">🟡 Dot on diamond = RBI scored that play</p>
      </div>
    </div>
  )
}
