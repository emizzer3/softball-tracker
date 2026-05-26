import { useState, useMemo, useEffect } from 'react'
import { CheckCircle, Circle, AlertCircle, ChevronLeft, GripVertical, X } from 'lucide-react'
import { DndContext, PointerSensor, TouchSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { getRoster, getTeams, getDivision, getTournaments, rememberTournament, getSetupDraft, saveSetupDraft, clearSetupDraft } from '../storage'

// Defined OUTSIDE GameSetupPage so React doesn't treat it as a new component
// type on every render (which causes unmount/remount and scroll-to-top on iOS).
function Step({ n, done, label, children }) {
  return (
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
}

const GAME_TYPES = ['Friendly','League','Tournament']
export const POSITIONS = ['P','C','1B','2B','3B','SS','LF','LC','RC','RF','EF']

function validateOrder(order, rosterMap) {
  if (order.length < 2) return null
  // Check every consecutive pair including the wrap-around (last → first)
  for (let i = 0; i < order.length; i++) {
    const curr = rosterMap[order[i]]
    const next = rosterMap[order[(i + 1) % order.length]]
    if (curr && next && curr === next) {
      return `${order[i]} and ${order[(i + 1) % order.length]} are both ${curr} — must alternate BBH/SBH`
    }
  }
  return null
}

export default function GameSetupPage({ onStart, onBack }) {
  const roster = useMemo(() => getRoster().filter(p => p.active), [])
  const teams = useMemo(() => [...getTeams(), 'Other'], [])
  const division = useMemo(() => getDivision(), [])
  const pastTournaments = useMemo(() => getTournaments(), [])

  // Load draft on first render if one exists
  const draft = useMemo(() => getSetupDraft(), [])

  const OUR_TEAM = 'The Renegades'

  // Step 1
  const [date,           setDate]           = useState(() => draft?.date           ?? new Date().toISOString().split('T')[0])
  const [gameType,       setGameType]       = useState(() => draft?.gameType       ?? '')
  const [weAreHome,      setWeAreHome]      = useState(() => draft?.weAreHome      ?? true)
  const [oppTeam,        setOppTeam]        = useState(() => draft?.oppTeam        ?? '')
  const [oppOther,       setOppOther]       = useState(() => draft?.oppOther       ?? '')
  const [oppFree,        setOppFree]        = useState(() => draft?.oppFree        ?? '')
  const [tournamentName, setTournamentName] = useState(() => draft?.tournamentName ?? '')
  const [pitch,          setPitch]          = useState(() => draft?.pitch          ?? null)
  const [innings]        = useState(7) // always 7 for league/friendly; tournaments use 99
  const [detailsOk,      setDetailsOk]      = useState(() => draft?.detailsOk     ?? false)
  const [detailsErr,     setDetailsErr]     = useState('')

  // Step 2 — players + ringers
  const [selected,    setSelected]    = useState(() => draft?.selected    ?? [])
  const [ringers,     setRingers]     = useState(() => draft?.ringers     ?? [])
  const [ringerName,  setRingerName]  = useState('')
  const [ringerType,  setRingerType]  = useState('BBH')
  const [playersOk,   setPlayersOk]   = useState(() => draft?.playersOk   ?? false)
  const [playersErr,  setPlayersErr]  = useState('')

  // Step 3
  const [order,    setOrder]    = useState(() => draft?.order    ?? [])
  const [orderOk,  setOrderOk]  = useState(() => draft?.orderOk  ?? false)
  const [orderErr, setOrderErr] = useState('')

  // DH designation (only relevant when 12+ players)
  const [dhBBH, setDhBBH] = useState(() => draft?.dhBBH ?? '')
  const [dhSBH, setDhSBH] = useState(() => draft?.dhSBH ?? '')

  // Step 4
  const [fieldingLineup, setFieldingLineup] = useState(() => draft?.fieldingLineup ?? {})
  const [fieldingOk,     setFieldingOk]     = useState(() => draft?.fieldingOk     ?? false)

  // rosterMap includes temporary ringers for type lookups
  const rosterMap = useMemo(
    () => Object.fromEntries([...roster, ...ringers].map(p => [p.name, p.type])),
    [roster, ringers]
  )

  // Auto-save draft whenever anything changes
  useEffect(() => {
    saveSetupDraft({
      date, gameType, weAreHome, oppTeam, oppOther, oppFree,
      tournamentName, pitch, innings, detailsOk,
      selected, ringers, playersOk, order, orderOk,
      dhBBH, dhSBH, fieldingLineup, fieldingOk,
    })
  }, [date, gameType, weAreHome, oppTeam, oppOther, oppFree,
      tournamentName, pitch, innings, detailsOk,
      selected, ringers, playersOk, order, orderOk,
      dhBBH, dhSBH, fieldingLineup, fieldingOk])

  const isLeague     = gameType === 'League'
  const isTournament = gameType === 'Tournament'
  const opponent = isLeague ? (oppTeam === 'Other' ? oppOther : oppTeam) : oppFree
  const home = weAreHome ? OUR_TEAM : opponent
  const away = weAreHome ? opponent : OUR_TEAM

  function confirmDetails() {
    if (!gameType) { setDetailsErr('Select a game type'); return }
    if (!opponent.trim()) { setDetailsErr('Enter opponent team'); return }
    if (opponent.trim() === OUR_TEAM) { setDetailsErr("Opponent can't also be The Renegades"); return }
    if (gameType === 'Tournament' && !tournamentName.trim()) { setDetailsErr('Enter a tournament name'); return }
    if (gameType === 'Tournament') rememberTournament(tournamentName.trim())
    setDetailsErr(''); setDetailsOk(true)
  }

  function resetTeamFields() {
    setOppTeam(''); setOppOther('')
    setOppFree(''); setTournamentName('')
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

  function addRinger() {
    const name = ringerName.trim()
    if (!name) return
    if (rosterMap[name]) { setPlayersErr(`"${name}" already exists on the roster`); return }
    const id = 'ringer_' + Date.now()
    setRingers(prev => [...prev, { id, name, type: ringerType, isRinger: true }])
    setRingerName('')
    setPlayersOk(false); setOrder([]); setOrderOk(false)
  }

  function removeRinger(id) {
    const r = ringers.find(r => r.id === id)
    if (r) {
      setSelected(prev => prev.filter(n => n !== r.name))
      setOrder(prev => prev.filter(n => n !== r.name))
      if (dhBBH === r.name) setDhBBH('')
      if (dhSBH === r.name) setDhSBH('')
    }
    setRingers(prev => prev.filter(r => r.id !== id))
    setPlayersOk(false); setOrderOk(false)
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
    const rosterFull = [...getRoster(), ...ringers]
    const gameRoster = order.map(name => rosterFull.find(p => p.name === name)).filter(Boolean)
    const playerPositions = Object.fromEntries(
      Object.entries(fieldingLineup).map(([pos, name]) => [name, pos])
    )
    onStart({
      id: Date.now().toString(),
      date, gameType,
      tournamentName: isTournament ? tournamentName.trim() : '',
      pitch:    pitch || null,
      home, away, weAreHome,
      innings:  isTournament ? 99 : 7,
      timed:    isTournament,
      battingOrder: order,
      roster: gameRoster,
      ringers,
      dhBBH: dhBBH || null,
      dhSBH: dhSBH || null,
      fieldingLineup,
      playerPositions,
    })
  }

  // DnD sensors — PointerSensor for desktop/mouse, TouchSensor for iPhone
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  const allPlayers = [...roster, ...ringers]
  const bbh = allPlayers.filter(p => p.type === 'BBH')
  const sbh = allPlayers.filter(p => p.type === 'SBH')
  const assignedCount = Object.keys(fieldingLineup).length
  const hasDraft = !!draft

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

          {/* Home/Away toggle */}
          <div>
            <label className="label">Are The Renegades home or away?</label>
            <div className="flex gap-2">
              <button type="button"
                onClick={() => { setWeAreHome(true); setDetailsOk(false) }}
                className={`btn btn-sm flex-1 ${weAreHome ? 'btn-primary' : 'btn-ghost'}`}>
                🏠 Home
              </button>
              <button type="button"
                onClick={() => { setWeAreHome(false); setDetailsOk(false) }}
                className={`btn btn-sm flex-1 ${!weAreHome ? 'btn-primary' : 'btn-ghost'}`}>
                ✈️ Away
              </button>
            </div>
          </div>

          {/* Opponent input */}
          <div>
            <label className="label">Opponent</label>
            {isLeague ? (
              <>
                <select className="input" value={oppTeam}
                  onChange={e => { setOppTeam(e.target.value); setDetailsOk(false) }}>
                  <option value="">Select…</option>
                  {teams.filter(t => t !== OUR_TEAM).map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                {oppTeam === 'Other' && (
                  <input className="input mt-1" placeholder="Team name…" value={oppOther}
                    onChange={e => { setOppOther(e.target.value); setDetailsOk(false) }} />
                )}
              </>
            ) : (
              <input className="input" placeholder="Opponent name…" value={oppFree}
                onChange={e => { setOppFree(e.target.value); setDetailsOk(false) }} />
            )}
          </div>

          {/* Pitch picker */}
          <div>
            <label className="label">Pitch</label>
            <div className="flex gap-2">
              {[1,2,3,4].map(n => (
                <button key={n} type="button"
                  onClick={() => { setPitch(n); setDetailsOk(false) }}
                  className={`btn btn-sm px-4 ${pitch === n ? 'btn-primary' : 'btn-ghost'}`}>
                  {n}
                </button>
              ))}
              {pitch && (
                <button type="button"
                  onClick={() => { setPitch(null); setDetailsOk(false) }}
                  className="btn btn-sm btn-ghost text-xs text-gray-400">
                  clear
                </button>
              )}
            </div>
          </div>

          {isTournament && (
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2">
              <span className="text-lg">⏱</span>
              <p className="text-sm text-indigo-700 font-medium">Timed game — call it early when time runs out</p>
            </div>
          )}
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
                <div key={p.id} className="relative inline-flex items-center">
                  <button type="button" onClick={() => togglePlayer(p.name)}
                    className={`btn btn-sm ${selected.includes(p.name) ? 'btn-primary' : 'btn-ghost'} ${p.isRinger ? 'pr-6' : ''}`}>
                    {p.name}{p.isRinger ? ' ★' : ''}
                  </button>
                  {p.isRinger && (
                    <button
                      type="button"
                      onClick={() => removeRinger(p.id)}
                      className="absolute right-1 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500"
                    >
                      <X size={10} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* Add a ringer */}
        <div className="border-t border-dashed border-gray-200 pt-3 mt-1 mb-3">
          <p className="text-xs font-semibold text-gray-500 mb-2">⭐ Add a Ringer (one game only)</p>
          <div className="flex gap-2">
            <input
              className="input flex-1 text-sm"
              placeholder="Ringer name…"
              value={ringerName}
              onChange={e => setRingerName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addRinger()}
            />
            <button
              type="button"
              onClick={() => setRingerType(t => t === 'BBH' ? 'SBH' : 'BBH')}
              className={`btn btn-sm shrink-0 w-12 ${ringerType === 'BBH' ? 'btn-primary' : 'bg-pink-500 text-white'}`}
            >
              {ringerType}
            </button>
            <button
              type="button"
              onClick={addRinger}
              disabled={!ringerName.trim()}
              className="btn btn-sm btn-success shrink-0"
            >
              Add
            </button>
          </div>
        </div>

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
              autoScroll={false}
            >
              <SortableContext items={order} strategy={verticalListSortingStrategy}>
                <ul className="space-y-1 mb-3">
                  {order.map((name, i) => {
                    const type = rosterMap[name]
                    const prevIdx = (i + order.length - 1) % order.length
                    const clash = order.length > 1 && rosterMap[order[prevIdx]] === type
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

      {/* Step 4 — DH Designation (only when 12+ players in lineup) */}
      {orderOk && order.length >= 12 && (
        <Step n={4} done={!!(dhBBH || dhSBH)} label="DH Designation (12-player game)">
          <p className="text-xs text-gray-500 mb-3">
            With 12+ players you may designate one BBH and one SBH as Designated Hitters — they bat in the order but don't take a fielding position.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label text-blue-600">BBH DH</label>
              <select className="input text-sm" value={dhBBH} onChange={e => setDhBBH(e.target.value)}>
                <option value="">None</option>
                {order.filter(name => rosterMap[name] === 'BBH').map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label text-pink-600">SBH DH</label>
              <select className="input text-sm" value={dhSBH} onChange={e => setDhSBH(e.target.value)}>
                <option value="">None</option>
                {order.filter(name => rosterMap[name] === 'SBH').map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>
          </div>
          {(dhBBH || dhSBH) && (
            <p className="text-xs text-indigo-600 mt-2">
              {[dhBBH, dhSBH].filter(Boolean).join(' & ')} will bat but won't appear in fielding positions.
            </p>
          )}
        </Step>
      )}

      {/* Step 5 (or 4 if no DH step) — Fielding Lineup */}
      <Step n={orderOk && order.length >= 12 ? 5 : 4} done={fieldingOk} label="Fielding Lineup">
        {!orderOk
          ? <p className="text-sm text-gray-400">Confirm batting order first</p>
          : <>
            <p className="text-xs text-gray-500 mb-3">
              Assign positions for your fielders. Each player can only hold one position.
              {(dhBBH || dhSBH) && <span className="text-indigo-600"> DH players are excluded.</span>}
            </p>
            <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-3">
              {POSITIONS.map(pos => {
                const fielders = order.filter(name => name !== dhBBH && name !== dhSBH)
                return (
                  <div key={pos} className="flex items-center gap-2">
                    <span className="w-8 text-xs font-bold text-gray-500 shrink-0">{pos}</span>
                    <select
                      className="input text-sm py-1 flex-1"
                      value={fieldingLineup[pos] || ''}
                      onChange={e => setPosition(pos, e.target.value)}
                    >
                      <option value="">—</option>
                      {fielders.map(name => (
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
                )
              })}
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
    touchAction: 'none', // prevents iOS from stealing the touch during drag
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
