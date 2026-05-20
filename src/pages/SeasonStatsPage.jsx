import { Trophy, Calendar, Home, Trash2 } from 'lucide-react'
import { getGames, computeSeasonStats, deleteGame } from '../storage'
import { useState } from 'react'

export default function SeasonStatsPage({ onHome, onViewGame }) {
  const [games, setGames] = useState(getGames)
  const stats = computeSeasonStats()

  function handleDelete(id) {
    if (!confirm('Delete this game record?')) return
    deleteGame(id)
    setGames(getGames())
  }

  return (
    <div className="max-w-lg mx-auto p-4 pb-24">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onHome} className="btn btn-ghost btn-sm"><Home size={14} /> Home</button>
        <h1 className="text-xl font-bold">📁 Season Stats</h1>
      </div>

      {stats.length === 0 && (
        <div className="card text-center py-8 text-gray-400">
          <Trophy size={32} className="mx-auto mb-2" />
          <p>No games saved yet</p>
        </div>
      )}

      {stats.length > 0 && (
        <div className="card mb-4 overflow-x-auto">
          <h2 className="font-bold mb-1">Player Season Stats</h2>
          <p className="text-xs text-gray-400 mb-3">Batting · Fielding</p>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                {['Player','G','AB','H','2B','3B','HR','RBI','BB','K','SB','AVG','OBP','PO','A','E'].map(h => (
                  <th key={h} className={`py-1 font-semibold ${
                    h === 'Player' ? 'text-left px-1 text-gray-500' :
                    ['PO','A','E'].includes(h) ? 'text-center px-0.5 text-blue-400' :
                    'text-center px-0.5 text-gray-500'
                  }`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.map(p => (
                <tr key={p.name} className="border-b border-gray-100 hover:bg-gray-50">
                  <td className="py-1.5 px-1 font-medium whitespace-nowrap">{p.name}</td>
                  {[p.G, p.AB, p.H, p['2B'], p['3B'], p.HR, p.RBI, p.BB, p.K, p.SB, p.AVG, p.OBP].map((v, i) => (
                    <td key={i} className="py-1.5 px-0.5 text-center">{v}</td>
                  ))}
                  <td className="py-1.5 px-0.5 text-center text-blue-600 font-medium">{p.PO || 0}</td>
                  <td className="py-1.5 px-0.5 text-center text-blue-500">{p.A  || 0}</td>
                  <td className="py-1.5 px-0.5 text-center text-red-500">{p.E  || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Game history */}
      <div className="card">
        <h2 className="font-bold mb-3 flex items-center gap-2"><Calendar size={16} /> Game History</h2>
        {games.length === 0
          ? <p className="text-gray-400 text-sm text-center py-4">No games saved</p>
          : (
            <ul className="space-y-2">
              {games.slice().reverse().map(g => (
                <li key={g.id} className="flex items-center gap-2 border border-gray-100 rounded-lg p-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{g.away} @ {g.home}</p>
                    <p className="text-xs text-gray-500">{g.date} · {g.gameType} · {g.homeScore ?? '?'}–{g.awayScore ?? '?'}</p>
                  </div>
                  <button onClick={() => onViewGame(g)} className="btn btn-ghost btn-sm text-xs">View</button>
                  <button onClick={() => handleDelete(g.id)} className="btn btn-ghost btn-sm p-1 text-red-400"><Trash2 size={14} /></button>
                </li>
              ))}
            </ul>
          )
        }
      </div>
    </div>
  )
}
