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
              {['G','R','AB','H','2B','3B','HR','RBI','BB','K','AVG','OBP','SLG'].map(k => (
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

function getStreak(p) {
  const log = computePlayerGameLog(p.name)
  if (log.length < 3) return null
  const last3 = log.slice(-3)
  const last3AB = last3.reduce((s, g) => s + g.AB, 0)
  const last3H  = last3.reduce((s, g) => s + g.H,  0)
  const last3Avg = last3AB > 0 ? last3H / last3AB : 0
  const seasonAvg = p.AB > 0 ? p.H / p.AB : 0
  if (last3Avg >= seasonAvg + 0.080) return '🔥'
  if (last3Avg <= seasonAvg - 0.080) return '🥶'
  return null
}

export default function SeasonStatsPage({ onHome, onViewGame }) {
  const [games, setGames] = useState(getGames)
  const [activeTab, setActiveTab] = useState('batting')
  const [showGuide, setShowGuide] = useState(false)
  const [sortCol, setSortCol] = useState('AB')
  const [sortAsc, setSortAsc] = useState(false)
  const [selectedPlayer, setSelectedPlayer] = useState(null)

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
                onClick={() => setActiveTab('fielding')}
                className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${activeTab === 'fielding' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                🧤 Fielding
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
                    <tr key={p.name} className="border-b border-gray-100 hover:bg-gray-50">
                      <td
                        className="py-1.5 px-1 font-medium whitespace-nowrap cursor-pointer text-blue-700 hover:underline"
                        onClick={() => setSelectedPlayer(p.name)}
                      >
                        {p.name}
                        {getStreak(p) && <span className="ml-1 text-base leading-none">{getStreak(p)}</span>}
                      </td>
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
            </div>
          )}

          {/* Fielding tab */}
          {activeTab === 'fielding' && (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-gray-200">
                    {['Player','G','PO','A','E'].map(h => (
                      <th key={h} className={`py-1 font-semibold ${
                        h === 'Player' ? 'text-left px-1 text-gray-500' :
                        h === 'E' ? 'text-center px-2 text-red-400' :
                        'text-center px-2 text-blue-400'
                      }`}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {stats.map(p => (
                    <tr key={p.name} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-1.5 px-1 font-medium">{p.name}</td>
                      <td className="py-1.5 px-2 text-center">{p.G}</td>
                      <td className="py-1.5 px-2 text-center text-blue-600 font-medium">{p.PO || 0}</td>
                      <td className="py-1.5 px-2 text-center text-blue-500">{p.A  || 0}</td>
                      <td className="py-1.5 px-2 text-center text-red-500">{p.E  || 0}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="text-xs text-gray-400 mt-2">PO = putouts · A = assists · E = errors</p>
            </div>
          )}
        </div>
      )}

      {/* Runs per game chart */}
      {(() => {
        const runs = computeRunsPerGame()
        if (runs.length < 2) return null
        const maxRuns = Math.max(...runs.map(g => Math.max(g.ourRuns, g.theirRuns)), 1)
        return (
          <div className="card mb-4 p-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Runs Per Game</p>
            <div className="flex items-end gap-1 h-20 overflow-x-auto pb-1">
              {runs.map(g => {
                const heightPct = Math.round((g.ourRuns / maxRuns) * 100)
                const color = g.result === 'W' ? 'bg-green-500' : g.result === 'L' ? 'bg-red-400' : 'bg-gray-400'
                return (
                  <div key={g.gameId} className="flex flex-col items-center gap-0.5 shrink-0" style={{ minWidth: 24 }}>
                    <span className="text-xs font-bold text-gray-700 leading-none">{g.ourRuns}</span>
                    <div className={`w-5 rounded-sm ${color}`} style={{ height: `${Math.max(heightPct, 8)}%` }} title={`${g.opponent} · ${g.ourRuns}–${g.theirRuns}`} />
                    <span className="text-[9px] text-gray-400 leading-none truncate w-5 text-center">{g.date.slice(5)}</span>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-3 mt-1 text-[10px] text-gray-400">
              <span><span className="inline-block w-2 h-2 rounded-sm bg-green-500 mr-0.5" />W</span>
              <span><span className="inline-block w-2 h-2 rounded-sm bg-red-400 mr-0.5" />L</span>
              <span><span className="inline-block w-2 h-2 rounded-sm bg-gray-400 mr-0.5" />D</span>
            </div>
          </div>
        )
      })()}

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
