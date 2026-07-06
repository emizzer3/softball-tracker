import { useState } from 'react'
import { Trophy, Calendar, Home, Trash2, BookOpen, X } from 'lucide-react'
import { getGames, computeSeasonStats, computePlayerGameLog, deleteGame, getSeasonRecord, computeRunsPerGame, computeGroupStats } from '../storage'

const STAT_TIPS = {
  G:    { label: 'Games',           desc: 'Number of games this player batted in.' },
  R:    { label: 'Runs',             desc: 'Times this player crossed home plate and scored a run.' },
  AB:   { label: 'At Bats',         desc: 'Plate appearances that count as official at-bats. Walks, hit-by-pitch, and sacrifices are excluded.' },
  H:    { label: 'Hits',            desc: 'Total hits — singles + doubles + triples + home runs.' },
  '2B': { label: 'Doubles',         desc: 'Times the batter reached 2nd base on a hit.' },
  '3B': { label: 'Triples',         desc: 'Times the batter reached 3rd base on a hit.' },
  HR:   { label: 'Home Runs',       desc: 'Times the batter hit the ball over/to the fence and ran all bases.' },
  RBI:  { label: 'Runs Batted In',  desc: 'Runs that scored because of this batter\'s hit. Includes runners on base when you hit.' },
  BB:   { label: 'Walks',           desc: 'Times the pitcher threw 4 balls — batter walked to first base.' },
  K:    { label: 'Strikeouts',      desc: 'Times the batter got 3 strikes and was called out.' },
  AVG:  { label: 'Batting Average', desc: 'Hits ÷ At Bats. A .300 average means getting a hit 30% of the time. League average is typically .250.' },
  OBP:  { label: 'On-Base %',       desc: 'Hits + Walks ÷ (At Bats + Walks). How often the batter gets on base. .350+ is great.' },
  SLG:  { label: 'Slugging %',      desc: 'Total bases ÷ At Bats. Measures hitting power. A single = 1 base, double = 2, triple = 3, HR = 4.' },
  KPct:  { label: 'K%',    desc: 'Strikeout rate — Ks per at-bat as a percentage. Lower is better.' },
  BBPct: { label: 'BB%',   desc: 'Walk rate — walks per plate appearance (AB + BB) as a percentage. Higher is better.' },
  PO:   { label: 'Putouts',         desc: 'Outs the fielder directly recorded — catching a fly ball, tagging a runner, or receiving a throw at base.' },
  A:    { label: 'Assists',         desc: 'Times the fielder threw the ball to help get a runner out.' },
  E:    { label: 'Errors',          desc: 'Times the fielder made a mistake that let a batter or runner advance when they should have been out.' },
}

function StatGuideSheet({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50">
      <div className="bg-white rounded-t-2xl w-full p-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold flex items-center gap-2"><BookOpen size={18} /> Stats Guide</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm p-1"><X size={18} /></button>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1.5">Batting</p>
            <div className="space-y-2">
              {['G','R','AB','H','2B','3B','HR','RBI','BB','K','AVG','OBP','SLG','KPct','BBPct'].map(k => (
                <div key={k} className="flex gap-3 items-start">
                  <span className="shrink-0 w-10 text-center font-black text-xs bg-gray-100 text-gray-700 px-1 py-0.5 rounded">{k}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{STAT_TIPS[k].label}</p>
                    <p className="text-xs text-gray-500 leading-snug">{STAT_TIPS[k].desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="pt-2 border-t border-gray-100">
            <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-1.5">Fielding</p>
            <div className="space-y-2">
              {['PO','A','E'].map(k => (
                <div key={k} className="flex gap-3 items-start">
                  <span className="shrink-0 w-10 text-center font-black text-xs bg-gray-100 text-gray-700 px-1 py-0.5 rounded">{k}</span>
                  <div>
                    <p className="text-sm font-semibold text-gray-800">{STAT_TIPS[k].label}</p>
                    <p className="text-xs text-gray-500 leading-snug">{STAT_TIPS[k].desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <button onClick={onClose} className="btn btn-primary btn-md w-full mt-4">Got it!</button>
      </div>
    </div>
  )
}

function PlayerDetailModal({ name, onClose }) {
  const log = computePlayerGameLog(name)
  const totals = log.reduce(
    (acc, g) => ({ AB: acc.AB + g.AB, H: acc.H + g.H, HR: acc.HR + g.HR, RBI: acc.RBI + g.RBI, BB: acc.BB + g.BB, K: acc.K + g.K }),
    { AB: 0, H: 0, HR: 0, RBI: 0, BB: 0, K: 0 }
  )
  const seasonAvg = totals.AB > 0 ? (totals.H / totals.AB).toFixed(3).replace(/^0/, '') : '.000'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full p-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-base">{name}'s Stats</h3>
          <button onClick={onClose} aria-label="Close" className="btn btn-ghost btn-sm p-1"><X size={18} /></button>
        </div>

        {/* Season totals bar */}
        <div className="flex gap-4 bg-blue-50 rounded-lg p-3 mb-4 text-sm">
          <div className="text-center"><p className="text-xs text-gray-500">G</p><p className="font-bold">{log.length}</p></div>
          <div className="text-center"><p className="text-xs text-gray-500">AB</p><p className="font-bold">{totals.AB}</p></div>
          <div className="text-center"><p className="text-xs text-gray-500">H</p><p className="font-bold">{totals.H}</p></div>
          <div className="text-center"><p className="text-xs text-gray-500">HR</p><p className="font-bold">{totals.HR}</p></div>
          <div className="text-center"><p className="text-xs text-gray-500">RBI</p><p className="font-bold">{totals.RBI}</p></div>
          <div className="text-center"><p className="text-xs text-gray-500">AVG</p><p className="font-bold text-indigo-600">{seasonAvg}</p></div>
        </div>

        {/* Per-game table */}
        {log.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">No games recorded</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="text-left py-1 px-1">Date</th>
                  <th className="text-left py-1 px-1">Game</th>
                  <th className="text-center py-1 px-1">Res</th>
                  <th className="text-center py-1 px-1">AB</th>
                  <th className="text-center py-1 px-1">H</th>
                  <th className="text-center py-1 px-1">HR</th>
                  <th className="text-center py-1 px-1">RBI</th>
                  <th className="text-center py-1 px-1">BB</th>
                  <th className="text-center py-1 px-1">K</th>
                  <th className="text-center py-1 px-1 text-indigo-500">AVG</th>
                </tr>
              </thead>
              <tbody>
                {log.map(g => (
                  <tr key={g.gameId} className="border-b border-gray-100">
                    <td className="py-1.5 px-1 whitespace-nowrap">{g.date}</td>
                    <td className="py-1.5 px-1 text-gray-600 max-w-28 truncate">{g.matchup}</td>
                    <td className={`py-1.5 px-1 text-center font-bold ${g.result === 'W' ? 'text-green-600' : g.result === 'L' ? 'text-red-500' : 'text-gray-500'}`}>{g.result}</td>
                    <td className="py-1.5 px-1 text-center">{g.AB}</td>
                    <td className="py-1.5 px-1 text-center">{g.H}</td>
                    <td className="py-1.5 px-1 text-center">{g.HR || '—'}</td>
                    <td className="py-1.5 px-1 text-center">{g.RBI}</td>
                    <td className="py-1.5 px-1 text-center">{g.BB}</td>
                    <td className="py-1.5 px-1 text-center">{g.K}</td>
                    <td className="py-1.5 px-1 text-center text-indigo-600 font-medium">{g.AVG}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button onClick={onClose} aria-label="Close" className="btn btn-primary btn-md w-full mt-4">Close</button>
      </div>
    </div>
  )
}

// ── Spray chart (same geometry as ScoresheetPage) ────────────────────────────
const SPRAY_COLORS = {
  '1B': '#22c55e', '2B': '#16a34a', '3B': '#15803d', 'HR': '#052e16',
  'F':  '#ef4444', 'G':  '#dc2626', 'SAC': '#f97316',
  'E':  '#f59e0b', 'FC': '#d97706',
}
const FW = 280, FH = 260
const FH_PT = [140, 250]
const F1B = [210, 180], F2B = [140, 151], F3B = [70, 180]
const FLF = [9, 119], FRF = [271, 119]

const OUTCOME_LABELS = { '1B': 'Single', '2B': 'Double', '3B': 'Triple', 'HR': 'Home Run', 'F': 'Flyout', 'G': 'Groundout', 'E': 'Error', 'FC': "FC", 'SAC': 'Sacrifice' }

function SprayDiamond({ dots, label, highlightBatter, onDotTap, selectedIdx }) {
  return (
    <div>
      {label && <p className="text-[10px] text-gray-500 text-center mb-0.5 font-medium truncate">{label}</p>}
      <svg viewBox={`0 0 ${FW} ${FH}`} className="w-full">
        <path d={`M ${FH_PT[0]},${FH_PT[1]} L ${FLF[0]},${FLF[1]} A 185,185 0 0,1 ${FRF[0]},${FRF[1]} Z`} fill="#86efac" opacity="0.35" />
        <circle cx={140} cy={200} r={73} fill="#d4a264" opacity="0.3" />
        <line x1={FH_PT[0]} y1={FH_PT[1]} x2={FLF[0]} y2={FLF[1]} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3" />
        <line x1={FH_PT[0]} y1={FH_PT[1]} x2={FRF[0]} y2={FRF[1]} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3" />
        <path d={`M ${FLF[0]},${FLF[1]} A 185,185 0 0,1 ${FRF[0]},${FRF[1]}`} fill="none" stroke="#94a3b8" strokeWidth={1.5} />
        <line x1={FH_PT[0]} y1={FH_PT[1]} x2={F1B[0]} y2={F1B[1]} stroke="#475569" strokeWidth={1.5} />
        <line x1={F1B[0]} y1={F1B[1]} x2={F2B[0]} y2={F2B[1]} stroke="#475569" strokeWidth={1.5} />
        <line x1={F2B[0]} y1={F2B[1]} x2={F3B[0]} y2={F3B[1]} stroke="#475569" strokeWidth={1.5} />
        <line x1={F3B[0]} y1={F3B[1]} x2={FH_PT[0]} y2={FH_PT[1]} stroke="#475569" strokeWidth={1.5} />
        <circle cx={140} cy={200} r={9} fill="#c9a87c" stroke="#a07840" strokeWidth={1} />
        {[F1B, F2B, F3B].map(([bx, by], i) => (
          <rect key={i} x={bx-6} y={by-6} width={12} height={12} transform={`rotate(45,${bx},${by})`} fill="white" stroke="#475569" strokeWidth={1.5} />
        ))}
        <polygon points={`${FH_PT[0]},${FH_PT[1]-9} ${FH_PT[0]-8},${FH_PT[1]-3} ${FH_PT[0]-6},${FH_PT[1]+7} ${FH_PT[0]+6},${FH_PT[1]+7} ${FH_PT[0]+8},${FH_PT[1]-3}`} fill="#64748b" />
        {dots.map((d, i) => {
          const dimmed = highlightBatter && d.batter !== highlightBatter
          const isSelected = selectedIdx === i
          const r = dots.length > 50 ? 5 : 7
          return (
            <g key={i} style={{ cursor: onDotTap ? 'pointer' : 'default' }} onClick={onDotTap ? () => onDotTap(i) : undefined}>
              <circle cx={d.x} cy={d.y} r={r} fill={SPRAY_COLORS[d.outcome] || '#6b7280'} stroke={isSelected ? '#000' : 'white'} strokeWidth={isSelected ? 2.5 : 1} opacity={dimmed ? 0.15 : 0.85} />
              {isSelected && (
                <>
                  <rect x={d.x + r + 3} y={d.y - 18} width={Math.max((d.batter || '').length * 7, 50) + 10} height={32} rx={5} fill="white" stroke="#94a3b8" strokeWidth={1} />
                  <text x={d.x + r + 8} y={d.y - 4} fontSize={10} fontWeight="bold" fill="#1e293b">{d.batter}</text>
                  <text x={d.x + r + 8} y={d.y + 9} fontSize={9} fill="#64748b">{OUTCOME_LABELS[d.outcome] || d.outcome}</text>
                </>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export default function SeasonStatsPage({ onHome, onViewGame }) {
  const [games, setGames] = useState(getGames)
  const [activeTab, setActiveTab] = useState('batting')
  const [showGuide, setShowGuide] = useState(false)
  const [sortCol, setSortCol] = useState('AB')
  const [sortAsc, setSortAsc] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState(null)
  const [sprayFilter, setSprayFilter] = useState(null)   // batter name or null
  const [selectedDot, setSelectedDot] = useState(null)    // dot index or null
  const [tappedBar, setTappedBar] = useState(null)        // gameId or null

  function handleSort(col) {
    if (sortCol === col) setSortAsc(a => !a)
    else { setSortCol(col); setSortAsc(false) }
  }

  const rawStats = computeSeasonStats()
  const stats = [...rawStats].sort((a, b) => {
    const av = a[sortCol], bv = b[sortCol]
    if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
    return sortAsc ? av - bv : bv - av
  })
  const record = getSeasonRecord()

  function handleDelete(id) {
    if (!confirm('Delete this game record?')) return
    deleteGame(id)
    setGames(getGames())
  }

  const gamesPlayed = record.W + record.L + record.D

  return (
    <div className="max-w-lg mx-auto p-4 pb-24">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onHome} className="btn btn-ghost btn-sm"><Home size={14} /> Home</button>
        <h1 className="text-xl font-bold">📁 Season Stats</h1>
      </div>

      {/* Season record banner */}
      {gamesPlayed > 0 && (
        <div className="card mb-4 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
          <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">Season Record</p>
          <div className="flex items-center gap-3">
            <span className="text-2xl font-black text-green-600">{record.W}W</span>
            <span className="text-2xl font-black text-red-500">{record.L}L</span>
            {record.D > 0 && <span className="text-2xl font-black text-gray-500">{record.D}D</span>}
            <span className="text-sm text-gray-400 ml-auto">{gamesPlayed} game{gamesPlayed !== 1 ? 's' : ''}</span>
          </div>
        </div>
      )}

      {stats.length === 0 && (
        <div className="card text-center py-8 text-gray-400">
          <Trophy size={32} className="mx-auto mb-2" />
          <p>No games saved yet</p>
        </div>
      )}

      {stats.length > 0 && (
        <div className="card mb-4">
          {/* Tab header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-1">
              <button
                onClick={() => setActiveTab('batting')}
                className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${activeTab === 'batting' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                ⚾ Batting
              </button>
              <button
                onClick={() => setActiveTab('trends')}
                className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${activeTab === 'trends' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                📈 Trends
              </button>
              <button
                onClick={() => setActiveTab('insights')}
                className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${activeTab === 'insights' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                💡 Insights
              </button>
            </div>
            <button onClick={() => setShowGuide(true)} className="btn btn-ghost btn-sm text-xs gap-1 text-blue-500 py-0.5">
              <BookOpen size={12} /> Guide
            </button>
          </div>

          {/* Batting tab */}
          {activeTab === 'batting' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    {['Player','G','R','AB','H','2B','3B','HR','RBI','BB','K','AVG','OBP','SLG','KPct','BBPct'].map(h => (
                      <th
                        key={h}
                        onClick={h !== 'Player' ? () => handleSort(h) : undefined}
                        className={`py-1 font-semibold whitespace-nowrap select-none ${
                          h === 'Player' ? 'text-left px-1 text-gray-500' :
                          ['AVG','OBP','SLG','KPct','BBPct'].includes(h) ? 'text-center px-0.5 text-indigo-500 cursor-pointer hover:text-indigo-700' :
                          'text-center px-0.5 text-gray-500 cursor-pointer hover:text-gray-700'
                        }`}
                      >
                        {h === 'KPct' ? 'K%' : h === 'BBPct' ? 'BB%' : h}{sortCol === h ? (sortAsc ? ' ▲' : ' ▼') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.map(p => (
                    <tr key={p.name} className="border-b border-gray-100 hover:bg-gray-50">
                      <td
                        className="py-1.5 px-1 font-medium whitespace-nowrap cursor-pointer text-blue-700 hover:underline"
                        onClick={() => setSelectedPlayer(p.name)}
                      >
                        {p.name}
                      </td>
                      {[p.G, p.R || 0, p.AB, p.H, p['2B'], p['3B'], p.HR, p.RBI, p.BB, p.K].map((v, i) => (
                        <td key={i} className="py-1.5 px-0.5 text-center">{v}</td>
                      ))}
                      <td className="py-1.5 px-0.5 text-center text-indigo-600 font-medium">{p.AVG}</td>
                      <td className="py-1.5 px-0.5 text-center text-indigo-500">{p.OBP}</td>
                      <td className="py-1.5 px-0.5 text-center text-indigo-500">{p.SLG}</td>
                      <td className="py-1.5 px-0.5 text-center text-indigo-500">{p.KPct}%</td>
                      <td className="py-1.5 px-0.5 text-center text-indigo-500">{p.BBPct}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-2">AVG = H/AB · OBP = (H+BB)/(AB+BB) · SLG = total bases/AB · K% = K/AB · BB% = BB/(AB+BB)</p>

              {/* BBH vs SBH comparison */}
              {(() => {
                const groups = computeGroupStats()
                if (groups.every(g => g.players === 0)) return null
                return (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">BBH vs SBH</p>
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-gray-200 text-gray-500">
                          {['Group','AB','H','HR','RBI','BB','K','AVG','OBP'].map(h => (
                            <th key={h} className={`py-1 font-semibold ${h === 'Group' ? 'text-left px-1' : 'text-center px-0.5'}`}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {groups.map(g => (
                          <tr key={g.type} className="border-b border-gray-100">
                            <td className="py-1.5 px-1 font-semibold">
                              <span className={g.type === 'BBH' ? 'badge-bbh' : 'badge-sbh'}>{g.type}</span>
                              <span className="text-gray-400 ml-1 font-normal">({g.players})</span>
                            </td>
                            <td className="py-1.5 px-0.5 text-center">{g.AB}</td>
                            <td className="py-1.5 px-0.5 text-center">{g.H}</td>
                            <td className="py-1.5 px-0.5 text-center">{g.HR}</td>
                            <td className="py-1.5 px-0.5 text-center">{g.RBI}</td>
                            <td className="py-1.5 px-0.5 text-center">{g.BB}</td>
                            <td className="py-1.5 px-0.5 text-center">{g.K}</td>
                            <td className="py-1.5 px-0.5 text-center text-indigo-600 font-medium">{g.AVG}</td>
                            <td className="py-1.5 px-0.5 text-center text-indigo-500">{g.OBP}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })()}

              {/* Fielding stats sub-table */}
              {(() => {
                const fieldingPlayers = stats.filter(p => p.PO + p.A + p.E > 0)
                if (fieldingPlayers.length === 0) return null
                return (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Fielding</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200 text-gray-500">
                            {['Player','G','PO','PO/G','A','A/G','E','E/G'].map(h => (
                              <th key={h} className={`py-1 font-semibold whitespace-nowrap ${h === 'Player' ? 'text-left px-1' : 'text-center px-0.5'}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {fieldingPlayers.map(p => (
                            <tr key={p.name} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-1.5 px-1 font-medium whitespace-nowrap">{p.name}</td>
                              <td className="py-1.5 px-0.5 text-center">{p.G}</td>
                              <td className="py-1.5 px-0.5 text-center">{p.PO}</td>
                              <td className="py-1.5 px-0.5 text-center text-indigo-500">{p.POPerG}</td>
                              <td className="py-1.5 px-0.5 text-center">{p.A}</td>
                              <td className="py-1.5 px-0.5 text-center text-indigo-500">{p.APerG}</td>
                              <td className="py-1.5 px-0.5 text-center">{p.E}</td>
                              <td className={`py-1.5 px-0.5 text-center font-medium ${p.E > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{p.EPerG}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">PO/G · A/G · E/G = per game averages</p>
                  </div>
                )
              })()}

              {/* Pitch patience sub-table */}
              {(() => {
                const pitchPlayers = stats.filter(p => p.PPerPA != null)
                if (pitchPlayers.length === 0) return null
                const sorted = [...pitchPlayers].sort((a, b) => parseFloat(b.PPerPA) - parseFloat(a.PPerPA))
                return (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Pitch Patience</p>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs border-collapse">
                        <thead>
                          <tr className="border-b border-gray-200 text-gray-500">
                            {['Player','PAs tracked','P/PA','Deep count %'].map(h => (
                              <th key={h} className={`py-1 font-semibold whitespace-nowrap ${h === 'Player' ? 'text-left px-1' : 'text-center px-1'}`}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {sorted.map(p => (
                            <tr key={p.name} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-1.5 px-1 font-medium whitespace-nowrap">{p.name}</td>
                              <td className="py-1.5 px-1 text-center text-gray-500">{p.pitchPA}</td>
                              <td className="py-1.5 px-1 text-center font-semibold text-indigo-600">{p.PPerPA}</td>
                              <td className="py-1.5 px-1 text-center">{p.DeepPct}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-gray-400 mt-2">P/PA = avg pitches per plate appearance · Deep count = 4+ pitches</p>
                  </div>
                )
              })()}
            </div>
          )}

          {/* Trends tab */}
          {activeTab === 'trends' && (() => {
            const runs = computeRunsPerGame()
            const sortedGames = games.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''))
            const battingByGame = sortedGames
              .filter(g => g.atBats?.length > 0)
              .map(g => {
                const abs = (g.atBats || []).filter(ab => !ab.isOpponent)
                const singles = abs.filter(ab => ab.outcome === '1B').length
                const doubles = abs.filter(ab => ab.outcome === '2B').length
                const triples = abs.filter(ab => ab.outcome === '3B').length
                const hrs     = abs.filter(ab => ab.outcome === 'HR').length
                return { gameId: g.id, date: g.date, singles, doubles, triples, hrs, total: singles + doubles + triples + hrs, result: g.result }
              })

            // Spray chart data: collect all hit dots across all games (include batter for interactivity)
            const allDots = sortedGames.flatMap(g =>
              (g.atBats || []).filter(ab => ab.hitLocation && !ab.isOpponent).map(ab => ({ x: ab.hitLocation.x, y: ab.hitLocation.y, outcome: ab.outcome, batter: ab.batter }))
            )
            const sprayBatters = [...new Set(allDots.map(d => d.batter).filter(Boolean))]
            const perGameSpray = sortedGames
              .filter(g => (g.atBats || []).some(ab => ab.hitLocation && !ab.isOpponent))
              .map(g => ({
                gameId: g.id,
                date: g.date,
                opponent: g.setup?.weAreHome !== false ? g.away : g.home,
                result: g.result,
                dots: (g.atBats || []).filter(ab => ab.hitLocation && !ab.isOpponent).map(ab => ({ x: ab.hitLocation.x, y: ab.hitLocation.y, outcome: ab.outcome, batter: ab.batter })),
              }))

            const maxRuns = runs.length > 0 ? Math.max(...runs.map(g => Math.max(g.ourRuns, g.theirRuns)), 1) : 1
            const maxHits = battingByGame.length > 0 ? Math.max(...battingByGame.map(g => g.total), 1) : 1
            const BAR_H = 100

            return (
              <div className="space-y-6">
                {/* Runs per game */}
                {runs.length >= 2 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Runs Scored vs Allowed</p>
                    <div className="grid items-end gap-1" style={{ height: BAR_H + 44, gridTemplateColumns: `repeat(${runs.length}, 1fr)` }}>
                      {runs.map(g => {
                        const ourH    = Math.max(Math.round((g.ourRuns   / maxRuns) * BAR_H), 4)
                        const theirH  = Math.max(Math.round((g.theirRuns / maxRuns) * BAR_H), 4)
                        const barColor = g.result === 'W' ? '#22c55e' : g.result === 'L' ? '#f87171' : '#9ca3af'
                        const active = tappedBar === g.gameId
                        return (
                          <div
                            key={g.gameId}
                            className="flex flex-col items-center cursor-pointer self-end"
                            onClick={() => setTappedBar(active ? null : g.gameId)}
                          >
                            <span className="text-[10px] font-bold text-gray-600 leading-none mb-1">{g.ourRuns}–{g.theirRuns}</span>
                            <div className="flex items-end gap-px w-full justify-center" style={{ height: BAR_H }}>
                              <div className="flex-1 rounded-t-sm transition-all" style={{ height: ourH, backgroundColor: barColor, opacity: active ? 1 : 0.8 }} />
                              <div className="flex-1 rounded-t-sm bg-gray-200 transition-all" style={{ height: theirH, opacity: active ? 1 : 0.6 }} />
                            </div>
                            <span className="text-[10px] text-gray-400 leading-tight mt-1 text-center w-full truncate">{g.date.slice(5)}</span>
                            <span className="text-[9px] text-gray-300 leading-none text-center w-full truncate">{g.opponent}</span>
                            {active && (
                              <span className={`text-[9px] font-bold mt-0.5 ${g.result === 'W' ? 'text-green-600' : g.result === 'L' ? 'text-red-500' : 'text-gray-500'}`}>
                                {g.result === 'W' ? 'Win' : g.result === 'L' ? 'Loss' : 'Draw'}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex gap-4 mt-1.5 text-[10px] text-gray-400">
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm bg-green-500" />Us (W)</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm bg-red-400" />Us (L)</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm bg-gray-200" />Them</span>
                    </div>
                  </div>
                )}

                {/* Batting spread — hit type breakdown per game */}
                {battingByGame.length >= 2 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Hits by Type per Game</p>
                    <div className="grid items-end gap-1" style={{ height: BAR_H + 44, gridTemplateColumns: `repeat(${battingByGame.length}, 1fr)` }}>
                      {battingByGame.map(g => {
                        const totalH  = Math.max(Math.round((g.total / maxHits) * BAR_H), 4)
                        const hrsH    = g.total > 0 ? Math.round((g.hrs     / g.total) * totalH) : 0
                        const triH    = g.total > 0 ? Math.round((g.triples / g.total) * totalH) : 0
                        const dblH    = g.total > 0 ? Math.round((g.doubles / g.total) * totalH) : 0
                        const sngH    = Math.max(totalH - hrsH - triH - dblH, 0)
                        const active = tappedBar === g.gameId
                        return (
                          <div
                            key={g.gameId}
                            className="flex flex-col items-center cursor-pointer self-end"
                            onClick={() => setTappedBar(active ? null : g.gameId)}
                          >
                            <span className="text-[10px] font-bold text-gray-600 leading-none mb-1">{g.total}</span>
                            <div className="flex flex-col-reverse rounded-t-sm overflow-hidden w-full transition-all" style={{ height: Math.max(totalH, 4), opacity: active ? 1 : 0.8 }}>
                              {sngH > 0 && <div style={{ height: sngH, backgroundColor: '#bae6fd' }} />}
                              {dblH > 0 && <div style={{ height: dblH, backgroundColor: '#3b82f6' }} />}
                              {triH > 0 && <div style={{ height: triH, backgroundColor: '#7c3aed' }} />}
                              {hrsH > 0 && <div style={{ height: hrsH, backgroundColor: '#f59e0b' }} />}
                            </div>
                            <span className="text-[10px] text-gray-400 leading-tight mt-1 text-center w-full truncate">{g.date.slice(5)}</span>
                            <span className={`text-[9px] font-bold leading-none ${g.result === 'W' ? 'text-green-500' : g.result === 'L' ? 'text-red-400' : 'text-gray-400'}`}>{g.result}</span>
                            {active && (
                              <span className="text-[9px] text-gray-500 mt-0.5">{g.singles}×1B {g.doubles}×2B {g.triples}×3B {g.hrs}×HR</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex gap-4 mt-1.5 text-[10px] text-gray-400">
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm" style={{ backgroundColor: '#bae6fd' }} />1B</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm" style={{ backgroundColor: '#3b82f6' }} />2B</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm" style={{ backgroundColor: '#7c3aed' }} />3B</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm" style={{ backgroundColor: '#f59e0b' }} />HR</span>
                    </div>
                  </div>
                )}

                {/* Season spray chart — aggregate with player filter */}
                {allDots.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Season Spray Chart</p>
                    {sprayBatters.length > 1 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        <button
                          onClick={() => { setSprayFilter(null); setSelectedDot(null) }}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${!sprayFilter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >All</button>
                        {sprayBatters.sort().map(name => (
                          <button
                            key={name}
                            onClick={() => { setSprayFilter(sprayFilter === name ? null : name); setSelectedDot(null) }}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${sprayFilter === name ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                          >{name}</button>
                        ))}
                      </div>
                    )}
                    <div className="max-w-sm mx-auto">
                      <SprayDiamond
                        dots={allDots}
                        highlightBatter={sprayFilter}
                        onDotTap={(i) => setSelectedDot(selectedDot === i ? null : i)}
                        selectedIdx={selectedDot}
                      />
                    </div>
                    <div className="flex flex-wrap justify-center gap-3 mt-2 text-[10px] text-gray-400">
                      {[['#22c55e','1B'],['#16a34a','2B'],['#15803d','3B'],['#052e16','HR'],['#ef4444','Flyout'],['#dc2626','Ground'],['#f59e0b','E/FC']].map(([c,l]) => (
                        <span key={l} className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm" style={{ backgroundColor: c }} />{l}</span>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-300 text-center mt-1">
                      {sprayFilter ? `${allDots.filter(d => d.batter === sprayFilter).length} hits by ${sprayFilter}` : `${allDots.length} hit${allDots.length !== 1 ? 's' : ''} across ${perGameSpray.length} game${perGameSpray.length !== 1 ? 's' : ''}`}
                      {' · tap a dot for details'}
                    </p>
                  </div>
                )}

                {/* Per-game spray chart grid */}
                {perGameSpray.length >= 2 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Spray Chart by Game</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {perGameSpray.map(g => (
                        <div key={g.gameId} className="border border-gray-100 rounded-lg p-1.5">
                          <SprayDiamond dots={g.dots} highlightBatter={sprayFilter} label={`${g.date.slice(5)} vs ${g.opponent}`} />
                          <p className={`text-[10px] text-center font-bold mt-0.5 ${g.result === 'W' ? 'text-green-500' : g.result === 'L' ? 'text-red-400' : 'text-gray-400'}`}>
                            {g.result} · {sprayFilter ? `${g.dots.filter(d => d.batter === sprayFilter).length}/${g.dots.length}` : `${g.dots.length} hit${g.dots.length !== 1 ? 's' : ''}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {runs.length < 2 && allDots.length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-6">Play at least 2 games to see trends</p>
                )}
              </div>
            )
          })()}

          {/* Insights tab */}
          {activeTab === 'insights' && (() => {
            const OUT_TYPES = ['K', 'F', 'G', 'FC', 'SAC']
            const OUT_LABELS = { K: 'Strikeout', F: 'Flyout', G: 'Groundout', FC: "Fielder's Choice", SAC: 'Sacrifice' }
            const OUT_COLORS = { K: '#ef4444', F: '#f97316', G: '#eab308', FC: '#a855f7', SAC: '#6b7280' }

            // Build per-player insights from game log
            const insights = rawStats.filter(p => p.G >= 1).map(p => {
              const log = computePlayerGameLog(p.name)
              const seasonAvg = p.AB > 0 ? p.H / p.AB : 0

              // Streak: last 3 games vs season
              const last3 = log.slice(-3)
              const last3AB = last3.reduce((s, g) => s + g.AB, 0)
              const last3H  = last3.reduce((s, g) => s + g.H,  0)
              const last3Avg = last3AB > 0 ? last3H / last3AB : 0
              const delta = last3Avg - seasonAvg
              const streak = log.length >= 3
                ? (delta >= 0.080 ? 'hot' : delta <= -0.080 ? 'cold' : 'steady')
                : null

              // Trend: per-game rolling AVG for sparkline
              let cumAB = 0, cumH = 0
              const avgByGame = log.map(g => {
                cumAB += g.AB; cumH += g.H
                return cumAB > 0 ? cumH / cumAB : 0
              })

              // Improvement: compare first half vs second half of games
              const mid = Math.floor(log.length / 2)
              const firstHalf = log.slice(0, mid)
              const secondHalf = log.slice(mid)
              const firstAB = firstHalf.reduce((s, g) => s + g.AB, 0)
              const firstH  = firstHalf.reduce((s, g) => s + g.H,  0)
              const secondAB = secondHalf.reduce((s, g) => s + g.AB, 0)
              const secondH  = secondHalf.reduce((s, g) => s + g.H,  0)
              const firstAvg = firstAB > 0 ? firstH / firstAB : 0
              const secondAvg = secondAB > 0 ? secondH / secondAB : 0
              const improving = log.length >= 4 ? secondAvg - firstAvg : null

              // Outs breakdown
              const allAbs = games.flatMap(g => (g.atBats || []).filter(ab => ab.batter === p.name))
              const outs = {}
              let totalOuts = 0
              for (const t of OUT_TYPES) {
                outs[t] = allAbs.filter(ab => ab.outcome === t).length
                totalOuts += outs[t]
              }

              const outsPerGame = log.length > 0 ? totalOuts / log.length : 0
              return { name: p.name, seasonAvg, last3Avg, delta, streak, avgByGame, improving, outs, totalOuts, outsPerGame, G: log.length, AB: p.AB }
            })

            const hotPlayers = insights.filter(p => p.streak === 'hot').sort((a, b) => b.delta - a.delta)
            const coldPlayers = insights.filter(p => p.streak === 'cold').sort((a, b) => a.delta - b.delta)
            const improving = insights.filter(p => p.improving !== null && p.improving > 0.030).sort((a, b) => b.improving - a.improving)
            const declining = insights.filter(p => p.improving !== null && p.improving < -0.030).sort((a, b) => a.improving - b.improving)
            const playersWithOuts = insights.filter(p => p.totalOuts > 0).sort((a, b) => b.outsPerGame - a.outsPerGame)
            const maxOuts = Math.max(...playersWithOuts.map(p => p.outsPerGame), 1)

            // Headlines
            const mostKs = playersWithOuts.length > 0 ? [...playersWithOuts].sort((a, b) => b.outs.K - a.outs.K)[0] : null
            const mostFCs = playersWithOuts.length > 0 ? [...playersWithOuts].sort((a, b) => b.outs.FC - a.outs.FC)[0] : null
            const mostGrounders = playersWithOuts.length > 0 ? [...playersWithOuts].sort((a, b) => b.outs.G - a.outs.G)[0] : null

            function fmtAvg(v) { return v.toFixed(3).replace(/^0/, '') }
            function fmtDelta(v) { return (v >= 0 ? '+' : '') + v.toFixed(3).replace(/^0/, '').replace(/^-0/, '-') }

            // Sparkline SVG
            function Sparkline({ data, width = 80, height = 24 }) {
              if (data.length < 2) return null
              const max = Math.max(...data, 0.001)
              const pts = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - (v / max) * (height - 2)}`).join(' ')
              const lastY = height - (data[data.length - 1] / max) * (height - 2)
              const trending = data[data.length - 1] >= data[Math.max(0, data.length - 3)]
              return (
                <svg width={width} height={height} className="inline-block align-middle">
                  <polyline points={pts} fill="none" stroke={trending ? '#22c55e' : '#ef4444'} strokeWidth={1.5} strokeLinejoin="round" />
                  <circle cx={width} cy={lastY} r={2.5} fill={trending ? '#22c55e' : '#ef4444'} />
                </svg>
              )
            }

            return (
              <div className="space-y-6">
                {/* Hot & Cold streaks */}
                {(hotPlayers.length > 0 || coldPlayers.length > 0) && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Streaks (Last 3 Games)</p>
                    {hotPlayers.length > 0 && (
                      <div className="space-y-2 mb-3">
                        {hotPlayers.map(p => (
                          <div key={p.name} className="flex items-center gap-2 bg-orange-50 border border-orange-100 rounded-lg p-2">
                            <span className="text-lg">🔥</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-gray-800">{p.name}</p>
                              <p className="text-xs text-gray-500">
                                Last 3: <span className="font-bold text-orange-600">{fmtAvg(p.last3Avg)}</span>
                                {' vs season '}
                                <span className="font-medium">{fmtAvg(p.seasonAvg)}</span>
                                <span className="text-orange-600 font-bold ml-1">({fmtDelta(p.delta)})</span>
                              </p>
                            </div>
                            <Sparkline data={p.avgByGame} />
                          </div>
                        ))}
                      </div>
                    )}
                    {coldPlayers.length > 0 && (
                      <div className="space-y-2">
                        {coldPlayers.map(p => (
                          <div key={p.name} className="flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg p-2">
                            <span className="text-lg">🥶</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-bold text-gray-800">{p.name}</p>
                              <p className="text-xs text-gray-500">
                                Last 3: <span className="font-bold text-blue-600">{fmtAvg(p.last3Avg)}</span>
                                {' vs season '}
                                <span className="font-medium">{fmtAvg(p.seasonAvg)}</span>
                                <span className="text-blue-600 font-bold ml-1">({fmtDelta(p.delta)})</span>
                              </p>
                            </div>
                            <Sparkline data={p.avgByGame} />
                          </div>
                        ))}
                      </div>
                    )}
                    {hotPlayers.length === 0 && coldPlayers.length === 0 && (
                      <p className="text-gray-400 text-sm text-center py-3">No streaks — everyone is steady</p>
                    )}
                  </div>
                )}

                {/* Improvement / Decline */}
                {(improving.length > 0 || declining.length > 0) && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Season Trajectory</p>
                    <p className="text-[10px] text-gray-400 mb-2">Comparing first half of games to second half</p>
                    {improving.length > 0 && (
                      <div className="mb-3">
                        <p className="text-[10px] font-semibold text-green-600 uppercase mb-1">Improving</p>
                        <div className="space-y-1.5">
                          {improving.map(p => (
                            <div key={p.name} className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-700 w-20 truncate">{p.name}</span>
                              <div className="flex-1 flex items-center gap-1.5">
                                <div className="h-3 rounded-full bg-green-100 flex-1 relative overflow-hidden">
                                  <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${Math.min(Math.abs(p.improving) / 0.15 * 100, 100)}%` }} />
                                </div>
                                <span className="text-[10px] font-bold text-green-600 w-10 text-right">{fmtDelta(p.improving)}</span>
                              </div>
                              <Sparkline data={p.avgByGame} width={60} height={18} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    {declining.length > 0 && (
                      <div>
                        <p className="text-[10px] font-semibold text-red-500 uppercase mb-1">Declining</p>
                        <div className="space-y-1.5">
                          {declining.map(p => (
                            <div key={p.name} className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-gray-700 w-20 truncate">{p.name}</span>
                              <div className="flex-1 flex items-center gap-1.5">
                                <div className="h-3 rounded-full bg-red-100 flex-1 relative overflow-hidden">
                                  <div className="h-full rounded-full bg-red-400 transition-all" style={{ width: `${Math.min(Math.abs(p.improving) / 0.15 * 100, 100)}%` }} />
                                </div>
                                <span className="text-[10px] font-bold text-red-500 w-10 text-right">{fmtDelta(p.improving)}</span>
                              </div>
                              <Sparkline data={p.avgByGame} width={60} height={18} />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Outs Breakdown */}
                {playersWithOuts.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">How Players Get Out</p>
                    {/* Headlines */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {mostKs && mostKs.outs.K > 0 && (
                        <span className="text-[10px] bg-red-50 text-red-600 font-semibold px-2 py-0.5 rounded-full">Most Ks: {mostKs.name} ({mostKs.outs.K})</span>
                      )}
                      {mostFCs && mostFCs.outs.FC > 0 && (
                        <span className="text-[10px] bg-purple-50 text-purple-600 font-semibold px-2 py-0.5 rounded-full">Most FCs: {mostFCs.name} ({mostFCs.outs.FC})</span>
                      )}
                      {mostGrounders && mostGrounders.outs.G > 0 && (
                        <span className="text-[10px] bg-yellow-50 text-yellow-700 font-semibold px-2 py-0.5 rounded-full">Most Groundouts: {mostGrounders.name} ({mostGrounders.outs.G})</span>
                      )}
                    </div>
                    {/* Visual bars per player */}
                    <div className="space-y-2">
                      {playersWithOuts.map(p => {
                        const barW = (p.outsPerGame / maxOuts) * 100
                        return (
                          <div key={p.name}>
                            <div className="flex items-center justify-between mb-0.5">
                              <span className="text-xs font-semibold text-gray-700 truncate">{p.name}</span>
                              <span className="text-[10px] text-gray-400">{p.outsPerGame.toFixed(1)}/game ({p.totalOuts} total)</span>
                            </div>
                            <div className="flex h-4 rounded-sm overflow-hidden bg-gray-100" style={{ width: `${Math.max(barW, 15)}%` }}>
                              {OUT_TYPES.map(t => {
                                if (p.outs[t] === 0) return null
                                const pct = (p.outs[t] / p.totalOuts) * 100
                                return (
                                  <div
                                    key={t}
                                    className="h-full flex items-center justify-center text-white text-[8px] font-bold"
                                    style={{ width: `${pct}%`, backgroundColor: OUT_COLORS[t], minWidth: p.outs[t] > 0 ? 14 : 0 }}
                                    title={`${OUT_LABELS[t]}: ${p.outs[t]}`}
                                  >
                                    {pct >= 15 ? t : ''}
                                  </div>
                                )
                              })}
                            </div>
                            <div className="flex flex-wrap gap-x-2 mt-0.5">
                              {OUT_TYPES.filter(t => p.outs[t] > 0).map(t => {
                                const pct = Math.round((p.outs[t] / p.totalOuts) * 100)
                                return (
                                  <span key={t} className="text-[9px] font-medium" style={{ color: OUT_COLORS[t] }}>
                                    {t} {pct}%
                                  </span>
                                )
                              })}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex flex-wrap gap-3 mt-2 text-[10px] text-gray-400">
                      {OUT_TYPES.map(t => (
                        <span key={t} className="flex items-center gap-1">
                          <span className="inline-block w-3 h-2.5 rounded-sm" style={{ backgroundColor: OUT_COLORS[t] }} />{OUT_LABELS[t]}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {insights.length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-6">Play some games to see coaching insights</p>
                )}
              </div>
            )
          })()}

        </div>
      )}

      {/* Game history */}
      <div className="card">
        <h2 className="font-bold mb-3 flex items-center gap-2"><Calendar size={16} /> Game History</h2>
        {games.length === 0
          ? <p className="text-gray-400 text-sm text-center py-4">No games saved</p>
          : (
            <ul className="space-y-2">
              {games.slice().reverse().map(g => {
                const resultColor = g.result === 'W' ? 'text-green-600' : g.result === 'L' ? 'text-red-500' : 'text-gray-500'
                return (
                  <li key={g.id} className="flex items-center gap-2 border border-gray-100 rounded-lg p-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm truncate">{g.away} @ {g.home}</p>
                        {g.result && (
                          <span className={`text-xs font-bold ${resultColor}`}>{g.result}</span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500">{g.date} · {g.gameType} · {g.homeScore ?? '?'}–{g.awayScore ?? '?'}</p>
                    </div>
                    <button onClick={() => onViewGame(g)} className="btn btn-ghost btn-sm text-xs">View</button>
                    <button onClick={() => handleDelete(g.id)} className="btn btn-ghost btn-sm p-1 text-red-400"><Trash2 size={14} /></button>
                  </li>
                )
              })}
            </ul>
          )
        }
      </div>

      {selectedPlayer && <PlayerDetailModal name={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
      {showGuide && <StatGuideSheet onClose={() => setShowGuide(false)} />}
    </div>
  )
}
