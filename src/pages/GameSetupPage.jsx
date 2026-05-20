import { useState, useMemo, useEffect } from 'react'
import { CheckCircle, Circle, AlertCircle, ChevronLeft, GripVertical } from 'lucide-react'
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getRoster, getTeams, getDivision, getTournaments, rememberTournament, getSetupDraft, saveSetupDraft, clearSetupDraft } from '../storage'

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

export default function GameSetupPage({ onStart, onBack }) {
  const roster = useMemo(() => getRoster().filter(p => p.active), [])
  const rosterMap = useMemo(() => Object.fromEntries(roster.map(p => [p.name, p.type])), [roster])
  const teams = useMemo(() => [...getTeams(), 'Other'], [])
  const division = useMemo(() => getDivision(), [])
  const pastTournaments = useMemo(() => getTournaments(), [])

  // Load draft on first render if one exists
  const draft = useMemo(() => getSetupDraft(), [])

  // Step 1
  const [date,           setDate]           = useState(() => draft?.date           ?? new Date().toISOString().split('T')[0])
  const [gameType,       setGameType]       = useState(() => draft?.gameType       ?? '')
  const [homeTeam,       setHomeTeam]       = useState(() => draft?.homeTeam       ?? '')
  const [homeOther,      setHomeOther]      = useState(() => draft?.homeOther      ?? '')
  const [awayTeam,       setAwayTeam]       = useState(() => draft?.awayTeam       ?? '')
  const [awayOther,      setAwayOther]      = useState(() => draft?.awayOther      ?? '')
  const [homeFree,       setHomeFree]       = useState(() => draft?.homeFree       ?? '')
  const [awayFree,       setAwayFree]       = useState(() => draft?.awayFree       ?? '')
  const [tournamentName, setTournamentName] = useState(() => draft?.tournamentName ?? '')
  const [innings,        setInnings]        = useState(() => draft?.innings        ?? 7)
  const [detailsOk,      setDetailsOk]      = useState(() => draft?.detailsOk     ?? false)
  const [detailsErr,     setDetailsErr]     = useState('')

  // Step 2
  const [selected,   setSelected]   = useState(() => draft?.selected   ?? [])
  const [playersOk,  setPlayersOk]  = useState(() => draft?.playersOk  ?? false)
  const [playersErr, setPlayersErr] = useState('')

  // Step 3
  const [order,    setOrder]    = useState(() => draft?.order    ?? [])
  const [orderOk,  setOrderOk]  = useState(() => draft?.orderOk  ?? false)
  const [orderErr, setOrderErr] = useState('')

  // Step 4
  const [fieldingLineup, setFieldingLineup] = useState(() => draft?.fieldingLineup ?? {})
  const [fieldingOk,     setFieldingOk]     = useState(() => draft?.fieldingOk     ?? false)

  // Auto-save draft whenever anything changes
  useEffect(() => {
    saveSetupDraft({
      date, gameType, homeTeam, homeOther, awayTeam, awayOther,
      homeFree, awayFree, tournamentName, innings, detailsOk,
      selected, playersOk, order, orderOk, fieldingLineup, fieldingOk,
    })
  }, [date, gameType, homeTeam, homeOther, awayTeam, awayOther,
      homeFree, awayFree, tournamentName, innings, detailsOk,
      selected, playersOk, order, orderOk, fieldingLineup, fieldingOk])

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

  function handleDragEnd(event) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setOrder(prev => arrayMove(prev, prev.indexOf(active.id), prev.indexOf(over.id)))
      setOrderOk(false)
    }
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
      Object.keys(next).forEach(k => { if (next[k] === player) delete next[k] })
      if (player) next[pos] = player
      else delete next[pos]
      return next
    })
  }

  function confirmFielding() { setFieldingOk(true) }

  function startGame() {
    clearSetupDraft()
    const rosterFull = getRoster()
    const gameRoster = order.map(name => rosterFull.find(p => p.name === name)).filter(Boolean)
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
      fieldingLineup,
      playerPositions,
    })
  }

  // DnD sensors — PointerSensor for desktop/mouse, TouchSensor for iPhone
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  const bbh = roster.filter(p => p.type === 'BBH')
  const sbh = roster.filter(p => p.type === 'SBH')
  const assignedCount = Object.keys(fieldingLineup).length
  const hasDraft = !!draft

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

      {/* Header with back button */}
      <div className="flex items-center gap-2 mb-1">
        <button onClick={onBack} className="btn btn-ghost btn-sm p-1 -ml-1">
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-2xl font-bold">⚾ Game Setup</h1>
      </div>
      {division
        ? <p className="text-sm text-gray-500 mb-3 ml-7">{division}</p>
        : <div className="mb-3" />}

      {/* Draft restored banner */}
      {hasDraft && (
        <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-3 text-sm">
          <span className="text-amber-800">↩ Setup restored from last time</span>
          <button
            onClick={() => { clearSetupDraft(); window.location.reload() }}
            className="text-xs text-amber-600 underline ml-2 shrink-0"
          >
            Start fresh
          </button>
        </div>
      )}

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

          {/* Tournament name */}
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

          {/* Team inputs */}
          <div className="grid grid-cols-2 gap-2">
            {isLeague ? (
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
            <p className="text-xs text-gray-500 mb-3">
              Drag <GripVertical size={12} className="inline text-gray-400" /> to reorder. Must strictly alternate BBH ↔ SBH.
            </p>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext items={order} strategy={verticalListSortingStrategy}>
                <ul className="space-y-1 mb-3">
                  {order.map((name, i) => {
                    const type = rosterMap[name]
                    const clash = i > 0 && rosterMap[order[i-1]] === type
                    return (
                      <SortableOrderItem key={name} id={name} index={i} type={type} clash={clash} />
                    )
                  })}
                </ul>
              </SortableContext>
            </DndContext>
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

// Draggable row for the batting order list
function SortableOrderItem({ id, index, type, clash }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`flex items-center gap-2 p-2 rounded-lg border select-none ${
        isDragging
          ? 'shadow-lg opacity-80 bg-blue-50 border-blue-300'
          : clash
            ? 'border-red-300 bg-red-50'
            : 'border-gray-200 bg-white'
      }`}
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="touch-none text-gray-300 p-1 cursor-grab active:cursor-grabbing shrink-0"
        tabIndex={-1}
      >
        <GripVertical size={16} />
      </button>
      <span className="text-gray-400 font-mono text-sm w-5">{index + 1}.</span>
      <span className="flex-1 font-medium text-sm">{id}</span>
      <span className={type === 'BBH' ? 'badge-bbh' : 'badge-sbh'}>{type}</span>
      {clash && <span className="text-red-500 text-xs font-semibold">clash!</span>}
    </li>
  )
}
