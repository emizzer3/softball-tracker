import { useState } from 'react'
import { Trophy, Calendar, Home, Trash2, BookOpen, X } from 'lucide-react'
import { getGames, computeSeasonStats, deleteGame, getSeasonRecord } from '../storage'

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

export default function SeasonStatsPage({ onHome, onViewGame }) {
  const [games, setGames] = useState(getGames)
  const [activeTab, setActiveTab] = useState('batting')
  const [showGuide, setShowGuide] = useState(false)
  const [sortCol, setSortCol] = useState('AB')
  const [sortAsc, setSortAsc] = useState(false)

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

      {showGuide && <StatGuideSheet onClose={() => setShowGuide(false)} />}
    </div>
  )
}
