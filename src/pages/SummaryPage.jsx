import { BarChart2, TrendingUp, Home, Shield } from 'lucide-react'
import { computeGameStats } from '../storage'

function StatBar({ label, value, max, color = '#2563eb' }) {
  const pct = max > 0 ? (value / max) * 100 : 0
  return (
    <div className="mb-2">
      <div className="flex justify-between text-xs mb-0.5">
        <span className="font-medium">{label}</span>
        <span className="font-bold">{value}</span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

export default function SummaryPage({ game, onHome }) {
  const { home, away, homeScore, awayScore, date, gameType, tournamentName } = game

  const {
    hitTypes, outTypes, totalHits, totalOuts, totalAB, totalBB,
    teamAVG, teamOBP, playerStats, fieldingStats, hasFieldingData,
  } = computeGameStats(game)

  return (
    <div className="max-w-lg mx-auto p-4 pb-24">
      <div className="flex items-center gap-2 mb-4">
        <button onClick={onHome} className="btn btn-ghost btn-sm"><Home size={14} /> Home</button>
        <h1 className="text-xl font-bold">📊 Summary</h1>
      </div>

      {/* Final score */}
      <div className="card mb-4 text-center">
        <p className="text-sm text-gray-500 mb-1">{date} · {gameType}{tournamentName ? ` · ${tournamentName}` : ''}</p>
        <div className="flex items-center justify-center gap-4">
          <div>
            <p className="text-sm font-semibold text-gray-600">{away}</p>
            <p className="text-5xl font-black">{awayScore}</p>
          </div>
          <span className="text-2xl font-light text-gray-300">–</span>
          <div>
            <p className="text-sm font-semibold text-gray-600">{home}</p>
            <p className="text-5xl font-black">{homeScore}</p>
          </div>
        </div>
        <p className="text-sm font-semibold mt-2 text-gray-500">
          {homeScore > awayScore ? `${home} wins` : homeScore < awayScore ? `${away} wins` : 'Draw'}
        </p>
      </div>

      {/* Team batting */}
      <div className="card mb-4">
        <h2 className="font-bold mb-3 flex items-center gap-2"><BarChart2 size={16} /> Team Batting</h2>
        <div className="grid grid-cols-3 gap-3 text-center mb-4">
          {[['AVG', teamAVG], ['OBP', teamOBP], ['Hits', totalHits], ['AB', totalAB], ['BB', totalBB], ['Outs', totalOuts]].map(([l, v]) => (
            <div key={l} className="bg-gray-50 rounded-lg p-2">
              <p className="text-xs text-gray-500">{l}</p>
              <p className="font-bold text-lg">{v}</p>
            </div>
          ))}
        </div>

        <h3 className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Hits by Type</h3>
        {Object.entries(hitTypes).map(([t, n]) => (
          <StatBar key={t} label={t} value={n} max={totalAB} color={{ '1B': '#16a34a', '2B': '#2563eb', '3B': '#7c3aed', 'HR': '#dc2626' }[t]} />
        ))}

        <h3 className="text-xs font-semibold text-gray-500 mb-2 mt-3 uppercase tracking-wide">Outs by Type</h3>
        {Object.entries(outTypes).filter(([,v]) => v > 0).map(([t, n]) => (
          <StatBar key={t} label={t} value={n} max={totalAB} color="#94a3b8" />
        ))}
      </div>

      {/* Player breakdown */}
      <div className="card mb-4">
        <h2 className="font-bold mb-3 flex items-center gap-2"><TrendingUp size={16} /> Player Stats</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="border-b border-gray-200">
                {['Player','AB','H','BB','K','RBI','HR','AVG'].map(h => (
                  <th key={h} className={`py-1 font-semibold text-gray-500 ${h === 'Player' ? 'text-left px-1' : 'text-center px-0.5'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {playerStats.map(p => (
                <tr key={p.name} className="border-b border-gray-100">
                  <td className="py-1.5 px-1 font-medium">
                    {p.name}
                    <span className={`ml-1 ${p.type === 'BBH' ? 'badge-bbh' : 'badge-sbh'}`}>{p.type}</span>
                  </td>
                  {[p.AB, p.H, p.BB, p.K, p.RBI, p.HR, p.AVG].map((v, i) => (
                    <td key={i} className="py-1.5 px-0.5 text-center">{v}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fielding breakdown */}
      {hasFieldingData && (
        <div className="card mb-4">
          <h2 className="font-bold mb-3 flex items-center gap-2"><Shield size={16} /> Fielding</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200">
                  {['Player','Pos','PO','A','E'].map(h => (
                    <th key={h} className={`py-1 font-semibold text-gray-500 ${h === 'Player' ? 'text-left px-1' : 'text-center px-1'}`}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {fieldingStats.filter(f => f.PO + f.A + f.E > 0).map(f => (
                  <tr key={f.name} className="border-b border-gray-100">
                    <td className="py-1.5 px-1 font-medium">{f.name}</td>
                    <td className="py-1.5 px-1 text-center text-gray-500 font-bold">{f.pos || '—'}</td>
                    <td className="py-1.5 px-1 text-center font-medium">{f.PO}</td>
                    <td className="py-1.5 px-1 text-center">{f.A}</td>
                    <td className="py-1.5 px-1 text-center text-red-600">{f.E}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold text-xs">
                  <td className="py-1 px-1">TOTALS</td>
                  <td className="py-1 px-1 text-center text-gray-400">—</td>
                  <td className="py-1 px-1 text-center">{fieldingStats.reduce((s, f) => s + f.PO, 0)}</td>
                  <td className="py-1 px-1 text-center">{fieldingStats.reduce((s, f) => s + f.A, 0)}</td>
                  <td className="py-1 px-1 text-center text-red-600">{fieldingStats.reduce((s, f) => s + f.E, 0)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="text-xs text-gray-400 mt-2">PO = Putout · A = Assist · E = Error</p>
        </div>
      )}
    </div>
  )
}
