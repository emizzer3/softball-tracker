import { useState } from 'react'
import { CalendarDays, RefreshCw } from 'lucide-react'
import { computeSeasonStats, computePlayerGameLog, computeRunsPerGame } from '../storage'

// ── Spray chart geometry (shared with SeasonStatsPage) ──────────────────
const SPRAY_COLORS = {
  '1B': '#22c55e', '2B': '#16a34a', '3B': '#15803d', 'HR': '#052e16',
  'F':  '#ef4444', 'G':  '#dc2626', 'SAC': '#f97316',
  'E':  '#f59e0b', 'FC': '#d97706',
}
const FW = 280, FH = 260
const FH_PT = [140, 250]
const F1B = [210, 180], F2B = [140, 151], F3B = [70, 180]
const FLF = [9, 119], FRF = [271, 119]

function SprayDiamond({ dots, highlightBatter, onDotTap, selectedIdx }) {
  return (
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
                <text x={d.x + r + 8} y={d.y + 9} fontSize={9} fill="#64748b">{{'1B':'Single','2B':'Double','3B':'Triple','HR':'Home Run','F':'Flyout','G':'Groundout','E':'Error','FC':'FC','SAC':'Sacrifice'}[d.outcome] || d.outcome}</text>
              </>
            )}
          </g>
        )
      })}
    </svg>
  )
}

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

export default function ViewerPage({ data, onRefresh }) {
  const { teamName, sft_games = [], sft_schedule = [], sft_active_game: activeGame } = data
  const today = new Date().toISOString().split('T')[0]
  const [sortCol, setSortCol] = useState('AB')
  const [sortAsc, setSortAsc] = useState(false)
  const [activeTab, setActiveTab] = useState('batting')
  const [sprayFilter, setSprayFilter] = useState(null)
  const [selectedDot, setSelectedDot] = useState(null)
  const [tappedBar, setTappedBar] = useState(null)

  // Season record
  const record = sft_games.reduce(
    (r, g) => { if (g.result === 'W') r.W++; else if (g.result === 'L') r.L++; else if (g.result === 'D') r.D++; return r },
    { W: 0, L: 0, D: 0 }
  )
  const gamesPlayed = record.W + record.L + record.D

  // Upcoming fixtures
  const upcoming = sft_schedule
    .filter(g => g.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)

  // Season stats computed from fetched games
  const rawStats = computeSeasonStats(sft_games)
  const stats = [...rawStats].sort((a, b) => {
    const av = a[sortCol], bv = b[sortCol]
    if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
    return sortAsc ? av - bv : bv - av
  })

  function handleSort(col) {
    if (sortCol === col) setSortAsc(a => !a)
    else { setSortCol(col); setSortAsc(false) }
  }

  function fmtAvg(v) { return v.toFixed(3).replace(/^0/, '') }
  function fmtDelta(v) { return (v >= 0 ? '+' : '') + v.toFixed(3).replace(/^0/, '').replace(/^-0/, '-') }

  return (
    <div className="max-w-lg mx-auto p-4 pb-16">
      {/* Header */}
      <div className="text-center py-6">
        <h1 className="text-2xl font-black tracking-tight text-gray-800">{teamName}</h1>
        <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
          Viewer mode
        </span>
      </div>

      <div className="space-y-3">
        {/* Active game */}
        {activeGame && (
          <div className="card border-2 border-amber-400 bg-amber-50 p-4">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2 flex items-center gap-1">
              Game in progress
            </p>
            <p className="text-center text-sm font-semibold text-gray-700 mb-2">
              {activeGame.setup?.away} @ {activeGame.setup?.home}
            </p>
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <p className="text-xs text-gray-500 font-semibold">{activeGame.setup?.away}</p>
                <p className="text-4xl font-black text-gray-800">{activeGame.awayScore ?? 0}</p>
              </div>
              <div className="text-xl text-gray-300 font-light">–</div>
              <div className="text-center">
                <p className="text-xs text-gray-500 font-semibold">{activeGame.setup?.home}</p>
                <p className="text-4xl font-black text-gray-800">{activeGame.homeScore ?? 0}</p>
              </div>
            </div>
            <p className="text-center text-xs text-amber-700 mt-2">
              Inning {activeGame.inning} · {activeGame.half === 'top' ? 'Top' : 'Bottom'}
            </p>
          </div>
        )}

        {/* Season record */}
        {gamesPlayed > 0 && (
          <div className="card p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">Season Record</p>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black text-green-600">{record.W}W</span>
              <span className="text-2xl font-black text-red-500">{record.L}L</span>
              {record.D > 0 && <span className="text-2xl font-black text-gray-500">{record.D}D</span>}
              <span className="text-sm text-gray-400 ml-auto">{gamesPlayed} game{gamesPlayed !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}

        {/* Upcoming fixtures */}
        {upcoming.length > 0 && (
          <div className="card p-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <CalendarDays size={12} /> Upcoming
            </p>
            <ul className="space-y-2">
              {upcoming.map(g => (
                <li key={g.id} className="flex items-center gap-2">
                  <div className="text-center bg-blue-50 rounded px-2 py-1 min-w-10 shrink-0">
                    <p className="text-xs font-bold text-blue-700">
                      {new Date(g.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">vs <span>{g.opponent}</span></p>
                    <p className="text-xs text-gray-500">
                      {g.location === 'Home' ? 'Home' : g.location === 'Away' ? 'Away' : ''}
                      {g.time ? ' · ' + g.time : ''}
                    </p>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded shrink-0">
                    {g.gameType || 'Game'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Stats card with tabs */}
        {stats.length > 0 && (
          <div className="card p-3">
            {/* Tab header */}
            <div className="flex gap-1 mb-2">
              {[['batting', '⚾ Batting'], ['trends', '📈 Trends'], ['insights', '💡 Insights']].map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${activeTab === key ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Batting tab */}
            {activeTab === 'batting' && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-gray-200">
                      {['Player','G','R','AB','H','2B','3B','HR','RBI','BB','K','AVG','OBP','SLG'].map(h => (
                        <th
                          key={h}
                          onClick={h !== 'Player' ? () => handleSort(h) : undefined}
                          className={`py-1 font-semibold whitespace-nowrap select-none ${
                            h === 'Player' ? 'text-left px-1 text-gray-500' :
                            ['AVG','OBP','SLG'].includes(h) ? 'text-center px-0.5 text-indigo-500 cursor-pointer hover:text-indigo-700' :
                            'text-center px-0.5 text-gray-500 cursor-pointer hover:text-gray-700'
                          }`}
                        >
                          {h}{sortCol === h ? (sortAsc ? ' ▲' : ' ▼') : ''}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map(p => (
                      <tr key={p.name} className="border-b border-gray-100">
                        <td className="py-1.5 px-1 font-medium whitespace-nowrap">{p.name}</td>
                        {[p.G, p.R || 0, p.AB, p.H, p['2B'], p['3B'], p.HR, p.RBI, p.BB, p.K].map((v, i) => (
                          <td key={i} className="py-1.5 px-0.5 text-center">{v}</td>
                        ))}
                        <td className="py-1.5 px-0.5 text-center text-indigo-600 font-medium">{p.AVG}</td>
                        <td className="py-1.5 px-0.5 text-center text-indigo-500">{p.OBP}</td>
                        <td className="py-1.5 px-0.5 text-center text-indigo-500">{p.SLG}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="text-xs text-gray-400 mt-2">AVG = H/AB · OBP = (H+BB)/(AB+BB) · SLG = total bases/AB</p>
              </div>
            )}

            {/* Trends tab */}
            {activeTab === 'trends' && (() => {
              const runs = computeRunsPerGame(sft_games)
              const sortedGames = sft_games.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''))
              const battingByGame = sortedGames
                .filter(g => g.atBats?.length > 0)
                .map(g => {
                  const abs = g.atBats || []
                  const singles = abs.filter(ab => ab.outcome === '1B').length
                  const doubles = abs.filter(ab => ab.outcome === '2B').length
                  const triples = abs.filter(ab => ab.outcome === '3B').length
                  const hrs     = abs.filter(ab => ab.outcome === 'HR').length
                  return { gameId: g.id, date: g.date, singles, doubles, triples, hrs, total: singles + doubles + triples + hrs, result: g.result }
                })

              const allDots = sortedGames.flatMap(g =>
                (g.atBats || []).filter(ab => ab.hitLocation).map(ab => ({ x: ab.hitLocation.x, y: ab.hitLocation.y, outcome: ab.outcome, batter: ab.batter }))
              )
              const sprayBatters = [...new Set(allDots.map(d => d.batter).filter(Boolean))]
              const perGameSpray = sortedGames
                .filter(g => (g.atBats || []).some(ab => ab.hitLocation))
                .map(g => ({
                  gameId: g.id, date: g.date,
                  opponent: g.setup?.weAreHome !== false ? g.away : g.home,
                  result: g.result,
                  dots: (g.atBats || []).filter(ab => ab.hitLocation).map(ab => ({ x: ab.hitLocation.x, y: ab.hitLocation.y, outcome: ab.outcome, batter: ab.batter })),
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
                            <div key={g.gameId} className="flex flex-col items-center cursor-pointer self-end" onClick={() => setTappedBar(active ? null : g.gameId)}>
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

                  {/* Batting spread */}
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
                            <div key={g.gameId} className="flex flex-col items-center cursor-pointer self-end" onClick={() => setTappedBar(active ? null : g.gameId)}>
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

                  {/* Season spray chart */}
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
                            <SprayDiamond dots={g.dots} highlightBatter={sprayFilter} />
                            <p className="text-[10px] text-gray-500 text-center mt-0.5 truncate">{g.date.slice(5)} vs {g.opponent}</p>
                            <p className={`text-[10px] text-center font-bold ${g.result === 'W' ? 'text-green-500' : g.result === 'L' ? 'text-red-400' : 'text-gray-400'}`}>
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

              const insights = rawStats.filter(p => p.G >= 1).map(p => {
                const log = computePlayerGameLog(p.name, sft_games)
                const seasonAvg = p.AB > 0 ? p.H / p.AB : 0

                const last3 = log.slice(-3)
                const last3AB = last3.reduce((s, g) => s + g.AB, 0)
                const last3H  = last3.reduce((s, g) => s + g.H,  0)
                const last3Avg = last3AB > 0 ? last3H / last3AB : 0
                const delta = last3Avg - seasonAvg
                const streak = log.length >= 3
                  ? (delta >= 0.080 ? 'hot' : delta <= -0.080 ? 'cold' : 'steady')
                  : null

                let cumAB = 0, cumH = 0
                const avgByGame = log.map(g => {
                  cumAB += g.AB; cumH += g.H
                  return cumAB > 0 ? cumH / cumAB : 0
                })

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

                const allAbs = sft_games.flatMap(g => (g.atBats || []).filter(ab => ab.batter === p.name))
                const outs = {}
                let totalOuts = 0
                for (const t of OUT_TYPES) {
                  outs[t] = allAbs.filter(ab => ab.outcome === t).length
                  totalOuts += outs[t]
                }

                return { name: p.name, seasonAvg, last3Avg, delta, streak, avgByGame, improving, outs, totalOuts, G: log.length, AB: p.AB }
              })

              const hotPlayers = insights.filter(p => p.streak === 'hot').sort((a, b) => b.delta - a.delta)
              const coldPlayers = insights.filter(p => p.streak === 'cold').sort((a, b) => a.delta - b.delta)
              const improving = insights.filter(p => p.improving !== null && p.improving > 0.030).sort((a, b) => b.improving - a.improving)
              const declining = insights.filter(p => p.improving !== null && p.improving < -0.030).sort((a, b) => a.improving - b.improving)
              const playersWithOuts = insights.filter(p => p.totalOuts > 0).sort((a, b) => b.totalOuts - a.totalOuts)
              const maxOuts = Math.max(...playersWithOuts.map(p => p.totalOuts), 1)

              const mostKs = playersWithOuts.length > 0 ? [...playersWithOuts].sort((a, b) => b.outs.K - a.outs.K)[0] : null
              const mostFCs = playersWithOuts.length > 0 ? [...playersWithOuts].sort((a, b) => b.outs.FC - a.outs.FC)[0] : null
              const mostGrounders = playersWithOuts.length > 0 ? [...playersWithOuts].sort((a, b) => b.outs.G - a.outs.G)[0] : null

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
                      <div className="space-y-2">
                        {playersWithOuts.map(p => {
                          const barW = (p.totalOuts / maxOuts) * 100
                          return (
                            <div key={p.name}>
                              <div className="flex items-center justify-between mb-0.5">
                                <span className="text-xs font-semibold text-gray-700 truncate">{p.name}</span>
                                <span className="text-[10px] text-gray-400">{p.totalOuts} out{p.totalOuts !== 1 ? 's' : ''}</span>
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
                    <p className="text-gray-400 text-sm text-center py-6">Play some games to see insights</p>
                  )}
                </div>
              )
            })()}
          </div>
        )}

        {/* No data yet */}
        {!activeGame && gamesPlayed === 0 && upcoming.length === 0 && (
          <div className="card text-center py-8 text-gray-400">
            <p>No data yet for this team.</p>
          </div>
        )}

        {/* Refresh */}
        <button
          onClick={onRefresh}
          className="btn btn-ghost btn-md w-full gap-2 border border-gray-200"
        >
          <RefreshCw size={16} /> Refresh
        </button>

        <p className="text-center text-xs text-gray-400 pt-2">
          Read-only view · <a href={window.location.origin + window.location.pathname} className="underline">Manage team</a>
        </p>
      </div>
    </div>
  )
}
