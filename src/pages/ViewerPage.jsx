import { CalendarDays, RefreshCw } from 'lucide-react'

export default function ViewerPage({ data, onRefresh }) {
  const { teamName, sft_games = [], sft_schedule = [], sft_active_game: activeGame } = data
  const today = new Date().toISOString().split('T')[0]

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
