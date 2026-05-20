import { useState, useMemo } from 'react'
import { CheckCircle, Circle, ChevronUp, ChevronDown, AlertCircle } from 'lucide-react'
import { getRoster, getTeams, getDivision, getTournaments, rememberTournament } from '../storage'

const GAME_TYPES = ['Friendly','League','Tournament']
export const POSITIONS = ['P','C','1B','2B','3B','SS','LF','LC','RC','RF','EF']

function validateOrder(order, rosterMap) {
  if (order.length < 2) return null
  for (let i = 1; i < order.length; i++) {
    if (rosterMap[order[i]] === rosterMap[order[i - 1]]) {
      return `${order[i - 1]} and ${order[i]} are both ${rosterMap[order[i]]} — must alternate BBH/SBH`
    }
  }
  return null
}

export default function GameSetupPage({ onStart }) {
  const roster = useMemo(() => getRoster().filter(p => p.active), [])
  const rosterMap = useMemo(() => Object.fromEntries(roster.map(p => [p.name, p.type])), [roster])
  const teams = useMemo(() => [...getTeams(), 'Other'], [])
  const division = useMemo(() => getDivision(), [])
  const pastTournaments = useMemo(() => getTournaments(), [])

  // Step 1
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [gameType, setGameType] = useState('')
  // League mode: dropdown value + "Other" free text
  const [homeTeam, setHomeTeam] = useState('')
  const [homeOther, setHomeOther] = useState('')
  const [awayTeam, setAwayTeam] = useState('')
  const [awayOther, setAwayOther] = useState('')
  // Friendly/Tournament mode: direct free-text team names
  const [homeFree, setHomeFree] = useState('')
  const [awayFree, setAwayFree] = useState('')
  // Tournament name
  const [tournamentName, setTournamentName] = useState('')
  const [innings, setInnings] = useState(7)
  const [detailsOk, setDetailsOk] = useState(false)
  const [detailsErr, setDetailsErr] = useState('')

  // Step 2
  const [selected, setSelected] = useState([])
  const [playersOk, setPlayersOk] = useState(false)
  const [playersErr, setPlayersErr] = useState('')

  // Step 3
  const [order, setOrder] = useState([])
  const [orderOk, setOrderOk] = useState(false)
  const [orderErr, setOrderErr] = useState('')

  // Step 4: fielding lineup { position: playerName }
  const [fieldingLineup, setFieldingLineup] = useState({})
  const [fieldingOk, setFieldingOk] = useState(false)

  const isLeague = gameType === 'League'
  const home = isLeague ? (homeTeam === 'Other' ? homeOther : homeTeam) : homeFree
  const away = isLeague ? (awayTeam === 'Other' ? awayOther : awayTeam) : awayFree

  function confirmDetails() {
    if (!gameType) { setDetailsErr('Select a game type'); return }
    if (!home.trim()) { setDetailsErr('Enter home team'); return }
    if (!away.trim()) { setDetailsErr('Enter away team'); return }
    if (home.trim() === away.trim()) { setDetailsErr('Home and away must differ'); return }
    if (gameType === 'Tournament' && !tournamentName.trim()) { setDetailsErr('Enter a tournament name'); return }
    if (gameType === 'Tournament') rememberTournament(tournamentName.trim())
    setDetailsErr(''); setDetailsOk(true)
  }

  function resetTeamFields() {
    setHomeTeam(''); setHomeOther(''); setAwayTeam(''); setAwayOther('')
    setHomeFree(''); setAwayFree(''); setTournamentName('')
    setDetailsOk(false)
  }

  function togglePlayer(name) {
    setPlayersOk(false); setOrder([]); setOrderOk(false)
    setSelected(prev => prev.includes(name) ? prev.filter(n => n !== name) : [...prev, name])
  }

  function confirmPlayers() {
    if (selected.length < 2) { setPlayersErr('Select at least 2 players'); return }
    setPlayersErr(''); setPlayersOk(true)
    setOrder(selected.slice())
  }

  function moveUp(i) {
    if (i === 0) return
    const o = [...order]; [o[i], o[i-1]] = [o[i-1], o[i]]
    setOrder(o); setOrderOk(false)
  }

  function moveDown(i) {
    if (i === order.length - 1) return
    const o = [...order]; [o[i], o[i+1]] = [o[i+1], o[i]]
    setOrder(o); setOrderOk(false)
  }

  function confirmOrder() {
    const err = validateOrder(order, rosterMap)
    if (err) { setOrderErr(err); return }
    setOrderErr(''); setOrderOk(true)
  }

  function setPosition(pos, player) {
    setFieldingOk(false)
    setFieldingLineup(prev => {
      const next = { ...prev }
      // remove this player from any previous position
      Object.keys(next).forEach(k => { if (next[k] === player) delete next[k] })
      if (player) next[pos] = player
      else delete next[pos]
      return next
    })
  }

  function confirmFielding() {
    setFieldingOk(true)
  }

  function startGame() {
    const rosterFull = getRoster()
    const gameRoster = order.map(name => rosterFull.find(p => p.name === name)).filter(Boolean)
    // Build reverse map: player → position
    const playerPositions = Object.fromEntries(
      Object.entries(fieldingLineup).map(([pos, name]) => [name, pos])
    )
    onStart({
      id: Date.now().toString(),
      date, gameType,
      tournamentName: gameType === 'Tournament' ? tournamentName.trim() : '',
      home, away, innings,
      battingOrder: order,
      roster: gameRoster,
      fieldingLineup,    // { position: playerName }
      playerPositions,   // { playerName: position } — reverse for quick lookup
    })
  }

  const bbh = roster.filter(p => p.type === 'BBH')
  const sbh = roster.filter(p => p.type === 'SBH')
  const assignedCount = Object.keys(fieldingLineup).length

  const Step = ({ n, done, label, children }) => (
    <div className="card mb-3">
      <div className="flex items-center gap-2 mb-3">
        {done
          ? <CheckCircle size={20} className="text-green-500 shrink-0" />
          : <Circle size={20} className="text-gray-300 shrink-0" />}
        <h2 className="font-bold text-base">{n}. {label}</h2>
      </div>
      {children}
    </div>
  )

  return (
    <div className="max-w-lg mx-auto p-4 pb-24">
      <h1 className="text-2xl font-bold mb-1">⚾ Game Setup</h1>
      {division && <p className="text-sm text-gray-500 mb-4">{division}</p>}
      {!division && <div className="mb-4" />}

      {/* Step 1 */}
      <Step n={1} done={detailsOk} label="Game Details">
        <div className="space-y-3">
          <div>
            <label className="label">Date</label>
            <input className="input" type="date" value={date} onChange={e => { setDate(e.target.value); setDetailsOk(false) }} />
          </div>
          <div>
            <label className="label">Game Type</label>
            <div className="flex gap-2">
              {GAME_TYPES.map(t => (
                <button key={t}
                  onClick={() => { setGameType(t); resetTeamFields() }}
                  className={`btn btn-sm flex-1 ${gameType === t ? 'btn-primary' : 'btn-ghost'}`}>{t}</button>
              ))}
            </div>
          </div>

          {/* Tournament name — only for Tournament */}
          {gameType === 'Tournament' && (
            <div>
              <label className="label">Tournament Name</label>
              <input
                className="input"
                placeholder="e.g. Bristol Summer Cup 2026"
                value={tournamentName}
                onChange={e => { setTournamentName(e.target.value); setDetailsOk(false) }}
              />
              {pastTournaments.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1">
                  {pastTournaments.map(t => (
                    <button key={t} type="button"
                      onClick={() => { setTournamentName(t); setDetailsOk(false) }}
                      className={`btn btn-sm text-xs ${tournamentName === t ? 'btn-primary' : 'btn-ghost'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Team inputs: League → dropdown, Friendly/Tournament → free text */}
          <div className="grid grid-cols-2 gap-2">
            {isLeague ? (
              // League: pick from managed teams list
              [['Home Team', homeTeam, setHomeTeam, homeOther, setHomeOther],
               ['Away Team', awayTeam, setAwayTeam, awayOther, setAwayOther]].map(([lbl, val, fn, otherVal, otherFn]) => (
                <div key={lbl}>
                  <label className="label">{lbl}</label>
                  <select className="input" value={val} onChange={e => { fn(e.target.value); setDetailsOk(false) }}>
                    <option value="">Select…</option>
                    {teams.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                  {val === 'Other' && (
                    <input className="input mt-1" placeholder="Team name…" value={otherVal}
                      onChange={e => { otherFn(e.target.value); setDetailsOk(false) }} />
                  )}
                </div>
              ))
            ) : (
              // Friendly / Tournament: free text
              [['Home Team', homeFree, setHomeFree], ['Away Team', awayFree, setAwayFree]].map(([lbl, val, fn]) => (
                <div key={lbl}>
                  <label className="label">{lbl}</label>
                  <input className="input" placeholder="Team name…" value={val}
                    onChange={e => { fn(e.target.value); setDetailsOk(false) }} />
                </div>
              ))
            )}
          </div>
          <div>
            <label className="label">Innings</label>
            <div className="flex gap-2">
              {[5,6,7,9].map(n => (
                <button key={n} onClick={() => setInnings(n)}
                  className={`btn btn-sm px-4 ${innings === n ? 'btn-primary' : 'btn-ghost'}`}>{n}</button>
              ))}
            </div>
          </div>
          {detailsErr && <p className="text-red-600 text-sm flex gap-1"><AlertCircle size={14} className="shrink-0 mt-0.5" />{detailsErr}</p>}
          <button onClick={confirmDetails} className="btn btn-warning btn-md w-full">
            {detailsOk ? '✅ Details Confirmed' : 'Confirm Details'}
          </button>
        </div>
      </Step>

      {/* Step 2 */}
      <Step n={2} done={playersOk} label="Select Players">
        {[['BBH', bbh], ['SBH', sbh]].map(([type, players]) => (
          <div key={type} className="mb-3">
            <p className="text-xs font-semibold text-gray-500 mb-1">{type}</p>
            <div className="flex flex-wrap gap-2">
              {players.map(p => (
                <button key={p.id} onClick={() => togglePlayer(p.name)}
                  className={`btn btn-sm ${selected.includes(p.name) ? 'btn-primary' : 'btn-ghost'}`}>
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        ))}
        <p className="text-xs text-gray-500 mb-2">{selected.length} selected</p>
        {playersErr && <p className="text-red-600 text-sm mb-2 flex gap-1"><AlertCircle size={14} className="shrink-0 mt-0.5" />{playersErr}</p>}
        <button onClick={confirmPlayers} disabled={!detailsOk} className="btn btn-warning btn-md w-full">
          {playersOk ? '✅ Players Locked' : '🔒 Lock Players'}
        </button>
      </Step>

      {/* Step 3 */}
      <Step n={3} done={orderOk} label="Batting Order (must alternate BBH/SBH)">
        {!playersOk
          ? <p className="text-sm text-gray-400">Lock players first</p>
          : <>
            <p className="text-xs text-gray-500 mb-3">Tap the arrows to reorder. Must strictly alternate BBH ↔ SBH.</p>
            <ul className="space-y-1 mb-3">
              {order.map((name, i) => {
                const type = rosterMap[name]
                const clash = i > 0 && rosterMap[order[i-1]] === type
                return (
                  <li key={name} className={`flex items-center gap-2 p-2 rounded-lg border ${clash ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-white'}`}>
                    <span className="text-gray-400 font-mono text-sm w-5">{i+1}.</span>
                    <span className="flex-1 font-medium text-sm">{name}</span>
                    <span className={type === 'BBH' ? 'badge-bbh' : 'badge-sbh'}>{type}</span>
                    {clash && <span className="text-red-500 text-xs">clash!</span>}
                    <div className="flex flex-col">
                      <button onClick={() => moveUp(i)} disabled={i === 0} className="p-0.5 text-gray-400 disabled:opacity-20"><ChevronUp size={14} /></button>
                      <button onClick={() => moveDown(i)} disabled={i === order.length-1} className="p-0.5 text-gray-400 disabled:opacity-20"><ChevronDown size={14} /></button>
                    </div>
                  </li>
                )
              })}
            </ul>
            {orderErr && <p className="text-red-600 text-sm mb-2 flex gap-1"><AlertCircle size={14} className="shrink-0 mt-0.5" />{orderErr}</p>}
            <button onClick={confirmOrder} className="btn btn-warning btn-md w-full">
              {orderOk ? '✅ Order Confirmed' : 'Confirm Order'}
            </button>
          </>
        }
      </Step>

      {/* Step 4 — Fielding Lineup */}
      <Step n={4} done={fieldingOk} label="Fielding Lineup">
        {!orderOk
          ? <p className="text-sm text-gray-400">Confirm batting order first</p>
          : <>
            <p className="text-xs text-gray-500 mb-3">
              Assign positions for your fielders. Each player can only hold one position.
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-3">
              {POSITIONS.map(pos => (
                <div key={pos} className="flex items-center gap-2">
                  <span className="w-8 text-xs font-bold text-gray-500 shrink-0">{pos}</span>
                  <select
                    className="input text-sm py-1 flex-1"
                    value={fieldingLineup[pos] || ''}
                    onChange={e => setPosition(pos, e.target.value)}
                  >
                    <option value="">—</option>
                    {order.map(name => (
                      <option
                        key={name}
                        value={name}
                        disabled={!!fieldingLineup[pos] === false && Object.values(fieldingLineup).includes(name) && fieldingLineup[pos] !== name}
                      >
                        {name}{Object.values(fieldingLineup).includes(name) && fieldingLineup[pos] !== name ? ' ✓' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 mb-3">{assignedCount} of {POSITIONS.length} positions assigned</p>
            <button onClick={confirmFielding} className="btn btn-warning btn-md w-full">
              {fieldingOk ? '✅ Lineup Confirmed' : 'Confirm Fielding Lineup'}
            </button>
          </>
        }
      </Step>

      {/* Start */}
      <button
        onClick={startGame}
        disabled={!(detailsOk && playersOk && orderOk && fieldingOk)}
        className="btn btn-success btn-xl w-full shadow-lg"
      >
        🥎 Start Game!
      </button>
    </div>
  )
}
