import { useState } from 'react'
import { RotateCcw, ArrowRight, Users, MapPin, AlertTriangle, BookOpen, X, StopCircle } from 'lucide-react'
import BaseDiamond from '../components/BaseDiamond'
import { setActiveGame, getRoster } from '../storage'

const POSITIONS = ['P','C','1B','2B','3B','SS','LF','LC','RC','RF','EF']

const OUTCOMES = [
  { code: '1B', label: 'Single',            color: 'btn-success', hit: true },
  { code: '2B', label: 'Double',            color: 'btn-success', hit: true },
  { code: '3B', label: 'Triple',            color: 'btn-success', hit: true },
  { code: 'HR', label: 'Home Run',          color: 'btn-success', hit: true },
  { code: 'BB', label: 'Walk',              color: 'btn-primary', hit: false },
  { code: 'HBP',label: 'HBP',              color: 'btn-primary', hit: false },
  { code: 'K',  label: 'Strikeout',         color: 'btn-danger',  hit: false },
  { code: 'F',  label: 'Flyout',            color: 'btn-danger',  hit: false },
  { code: 'G',  label: 'Groundout',         color: 'btn-danger',  hit: false },
  { code: 'E',  label: 'On Error',          color: 'btn-warning', hit: false },
  { code: 'FC', label: "Fielder's Choice",  color: 'btn-warning', hit: false },
  { code: 'SAC',label: 'Sacrifice',         color: 'btn-ghost',   hit: false },
]

// Plain-English guide shown in the Outcome Guide sheet
const OUTCOME_GUIDE = [
  { code: '1B',  label: 'Single',           desc: 'Hit the ball and safely reached 1st base.' },
  { code: '2B',  label: 'Double',           desc: 'Hit the ball and safely reached 2nd base.' },
  { code: '3B',  label: 'Triple',           desc: 'Hit the ball and safely reached 3rd base.' },
  { code: 'HR',  label: 'Home Run',         desc: 'Hit over/to the fence — batter runs all bases and scores.' },
  { code: 'BB',  label: 'Walk',             desc: 'Pitcher threw 4 balls — batter walks to 1st. Doesn\'t count as an at-bat.' },
  { code: 'HBP', label: 'Hit By Pitch',     desc: 'Ball hit the batter — free base. Doesn\'t count as an at-bat.' },
  { code: 'K',   label: 'Strikeout',        desc: '3 strikes and the batter is out. Catcher auto-gets the putout (PO).' },
  { code: 'F',   label: 'Flyout',           desc: 'Batter hit the ball in the air and a fielder caught it before it bounced.' },
  { code: 'G',   label: 'Groundout',        desc: 'Batter hit a ground ball and was thrown out at first (or another base).' },
  { code: 'E',   label: 'On Error',         desc: 'Batter reached base because a fielder made a mistake. Doesn\'t count as a hit.' },
  { code: 'FC',  label: "Fielder's Choice", desc: 'Batter reached safely, but the fielder chose to put out a different runner instead.' },
  { code: 'SAC', label: 'Sacrifice',        desc: 'Batter was put out on a fly ball or bunt, but a runner scored or advanced.' },
]

const BASES_ON_OUTCOME = {
  '1B': 1, '2B': 2, '3B': 3, 'HR': 4, 'BB': 1, 'HBP': 1, 'E': 1, 'FC': 1,
}

function initState(setup) {
  return {
    inning: 1,
    half: 'top',      // top = away batting, bottom = home batting
    outs: 0,
    balls: 0,
    strikes: 0,
    bases: [false, false, false], // [1st, 2nd, 3rd]
    batterIndex: 0,
    homeScore: 0,
    awayScore: 0,
    atBats: [],
    playLog: [],
    fieldingLog: {}, // { "1-top": { position: playerName } }
    done: false,
    inningScores: Array.from({ length: setup.innings }, () => ({ home: 0, away: 0 })),
  }
}

function basesAdvanced(bases, by) {
  let runners = bases.flatMap((occ, i) => occ ? [i + 1] : [])
  let runs = 0
  runners = runners.map(b => b + by)
  const newBases = [false, false, false]
  for (const b of runners) {
    if (b >= 4) runs++
    else newBases[b - 1] = true
  }
  return [newBases, runs]
}

export default function TrackerPage({ setup, savedState, onEnd }) {
  const [gs, setGs] = useState(() => savedState?.gameState || initState(setup))
  const [showFielding, setShowFielding] = useState(false)
  const [showSub, setShowSub] = useState(false)
  const [subFrom, setSubFrom] = useState('')
  const [subTo, setSubTo] = useState('')
  const [battingOrder, setBattingOrder] = useState(savedState?.battingOrder || setup.battingOrder)
  const [lastAction, setLastAction] = useState(null)
  const [showPutout, setShowPutout] = useState(false)
  const [pendingOutCode, setPendingOutCode] = useState(null)
  const [showGuide, setShowGuide] = useState(false)

  const batter = battingOrder[gs.batterIndex % battingOrder.length]
  const batterPosition = setup.playerPositions?.[batter]
  const batterType = setup.roster.find(p => p.name === batter)?.type

  function persist(newGs) {
    setActiveGame({ setup, gameState: newGs, battingOrder })
    setGs(newGs)
  }

  // Core outcome logic — separated so it can be called with optional playLog extras
  function finishOutcome(code, extraPlayLog = []) {
    const by = BASES_ON_OUTCOME[code] || 0
    const isOut = ['K','F','G'].includes(code)
    const scoringTeam = gs.half === 'top' ? 'away' : 'home'
    const g = { ...gs, balls: 0, strikes: 0 }

    let newBases = [...g.bases]
    let runs = 0

    if (by > 0) {
      const [advanced, r] = basesAdvanced(newBases, by)
      runs = r
      newBases = advanced
      if (by < 4) newBases[by - 1] = true  // batter stops on base
      else runs++                            // HR: batter scores too
    }

    const atBat = {
      id: Date.now(),
      batter,
      inning: g.inning,
      half: g.half,
      outcome: code,
      rbi: runs,
      bases: [...newBases],
    }
    g.atBats = [...g.atBats, atBat]

    if (extraPlayLog.length > 0) {
      g.playLog = [...g.playLog, ...extraPlayLog]
    }

    if (isOut) {
      g.outs++
      if (g.outs >= 3) {
        newBases = [false, false, false]
        g.outs = 0
        if (g.half === 'top') {
          g.half = 'bottom'
        } else {
          if (g.inning >= setup.innings) {
            g.done = true
          } else {
            g.inning++
            g.half = 'top'
          }
        }
      }
    } else {
      if (scoringTeam === 'home') g.homeScore += runs
      else g.awayScore += runs
      const scores = [...g.inningScores]
      scores[g.inning - 1] = {
        ...scores[g.inning - 1],
        [scoringTeam]: (scores[g.inning - 1][scoringTeam] || 0) + runs,
      }
      g.inningScores = scores
    }

    g.bases = newBases
    g.batterIndex = g.done ? g.batterIndex : (g.batterIndex + 1) % battingOrder.length

    setLastAction(prev => ({ ...prev, code, batter, rbi: runs }))
    persist(g)
  }

  function applyOutcome(code) {
    if (code === 'K') {
      const catcher = setup.fieldingLineup?.['C']
      const extraLog = catcher
        ? [{ type: 'putout', fielder: catcher, assister: null, inning: gs.inning, half: gs.half, outCode: code, batter }]
        : []
      setLastAction({ code, batter, rbi: 0, autoFielder: catcher || null, fielder: null, assister: null })
      finishOutcome(code, extraLog)
    } else if (code === 'G' || code === 'F') {
      setPendingOutCode(code)
      setShowPutout(true)
    } else {
      setLastAction({ code, batter, rbi: 0, fielder: null, assister: null, autoFielder: null })
      finishOutcome(code)
    }
  }

  function completePutout(fielder, assister) {
    const extraLog = fielder
      ? [{ type: 'putout', fielder, assister: assister || null, inning: gs.inning, half: gs.half, outCode: pendingOutCode, batter }]
      : []
    setLastAction({ code: pendingOutCode, batter, rbi: 0, fielder: fielder || null, assister: assister || null, autoFielder: null })
    finishOutcome(pendingOutCode, extraLog)
    setPendingOutCode(null)
    setShowPutout(false)
  }

  function addCount(type) {
    const g = { ...gs }
    if (type === 'ball') {
      if (g.balls === 3) { applyOutcome('BB'); return }
      g.balls++
    } else {
      if (g.strikes === 2) { applyOutcome('K'); return }
      g.strikes++
    }
    persist(g)
  }

  function addStolenBase(baseIndex) {
    const g = { ...gs }
    const newBases = [...g.bases]
    if (!newBases[baseIndex]) return
    newBases[baseIndex] = false
    let runs = 0
    if (baseIndex === 2) runs = 1 // scored from 3rd
    else newBases[baseIndex + 1] = true

    if (runs > 0) {
      const scoringTeam = g.half === 'top' ? 'away' : 'home'
      if (scoringTeam === 'home') g.homeScore += runs
      else g.awayScore += runs
    }

    // 'runner' key matches what computeSeasonStats expects
    g.playLog = [...g.playLog, { type: 'sb', runner: batter, inning: g.inning, half: g.half }]
    g.bases = newBases
    persist(g)
  }

  function addError(fielderName) {
    const g = { ...gs }
    g.playLog = [...g.playLog, { type: 'error', fielder: fielderName, inning: g.inning, half: g.half }]
    persist(g)
  }

  function undoLast() {
    if (!lastAction) return
    setGs(prev => {
      const g = { ...prev }
      g.atBats = g.atBats.slice(0, -1)
      // Also remove associated putout log entry if present
      if (
        g.playLog.length > 0 &&
        g.playLog[g.playLog.length - 1].type === 'putout' &&
        g.playLog[g.playLog.length - 1].batter === lastAction.batter
      ) {
        g.playLog = g.playLog.slice(0, -1)
      }
      g.batterIndex = Math.max(0, g.batterIndex - 1)
      g.balls = 0; g.strikes = 0
      return g
    })
    setLastAction(null)
  }

  function doSub() {
    if (!subFrom || !subTo || subFrom === subTo) return
    const newOrder = battingOrder.map(n => n === subFrom ? subTo : n)
    const g = {
      ...gs,
      playLog: [...gs.playLog, { type: 'sub', out: subFrom, in: subTo, inning: gs.inning, half: gs.half }],
    }
    // Persist directly with new battingOrder (can't use persist() as it captures old battingOrder)
    setActiveGame({ setup, gameState: g, battingOrder: newOrder })
    setGs(g)
    setBattingOrder(newOrder)
    setShowSub(false)
    setSubFrom('')
    setSubTo('')
  }

  function callGameEarly() {
    if (!confirm('Call game early? The current score will be saved as the final result.')) return
    const g = { ...gs, done: true }
    persist(g)
  }

  function saveFielding(inningKey, assignments) {
    const g = { ...gs, fieldingLog: { ...gs.fieldingLog, [inningKey]: assignments } }
    persist(g)
    setShowFielding(false)
  }

  const inningKey = `${gs.inning}-${gs.half}`
  const fieldingAssignments = gs.fieldingLog[inningKey] || {}

  // Full active roster for sub "player in" dropdown (supports late arrivals)
  const allActivePlayers = getRoster().filter(p => p.active)
  const benchPlayers = allActivePlayers.filter(p => !battingOrder.includes(p.name))

  // BBH/SBH type mismatch check for sub
  const allPlayerTypes = [...setup.roster, ...allActivePlayers]
  const subFromType = allPlayerTypes.find(p => p.name === subFrom)?.type
  const subToType   = allActivePlayers.find(p => p.name === subTo)?.type
  const typeMismatch = subFrom && subTo && subFromType && subToType && subFromType !== subToType

  if (gs.done) {
    return (
      <div className="max-w-lg mx-auto p-4 text-center">
        <div className="card mb-4">
          <p className="text-4xl mb-2">🎉</p>
          <h2 className="text-2xl font-bold mb-1">Game Over!</h2>
          <p className="text-3xl font-bold my-3">{setup.home} {gs.homeScore} – {gs.awayScore} {setup.away}</p>
        </div>
        <button
          onClick={() => onEnd({
            ...setup, battingOrder,
            atBats: gs.atBats,
            playLog: gs.playLog,
            fieldingLog: gs.fieldingLog,
            inningScores: gs.inningScores,
            homeScore: gs.homeScore,
            awayScore: gs.awayScore,
          })}
          className="btn btn-success btn-lg w-full"
        >
          View Scoresheet & Save
        </button>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto p-3 pb-24">

      {/* Score bar */}
      <div className="card mb-3 p-3">
        <div className="flex justify-between items-center text-sm font-semibold text-gray-500 mb-1">
          <span>{setup.away}</span>
          <span className="text-xs">Inning {gs.inning} {gs.half === 'top' ? '▲' : '▼'} of {setup.innings}</span>
          <span>{setup.home}</span>
        </div>
        <div className="flex justify-between items-center">
          <span className="text-4xl font-black">{gs.awayScore}</span>
          <div className="flex gap-3 justify-center text-xs font-bold text-gray-600">
            <span className={`px-2 py-0.5 rounded ${gs.outs >= 1 ? 'bg-red-500 text-white' : 'bg-gray-200'}`}>OUT</span>
            <span className={`px-2 py-0.5 rounded ${gs.outs >= 2 ? 'bg-red-500 text-white' : 'bg-gray-200'}`}>OUT</span>
            <span className={`px-2 py-0.5 rounded ${gs.outs >= 3 ? 'bg-red-500 text-white' : 'bg-gray-200'}`}>OUT</span>
          </div>
          <span className="text-4xl font-black">{gs.homeScore}</span>
        </div>
      </div>

      {/* Diamond + count */}
      <div className="card mb-3 flex items-center gap-4 justify-center p-4">
        <BaseDiamond bases={gs.bases} size={120} />
        <div className="space-y-2">
          <div>
            <p className="text-xs text-gray-500 font-semibold">BALLS</p>
            <div className="flex gap-1">
              {[0,1,2,3].map(i => (
                <div key={i} className={`w-5 h-5 rounded-full border-2 ${i < gs.balls ? 'bg-green-500 border-green-600' : 'border-gray-300'}`} />
              ))}
            </div>
          </div>
          <div>
            <p className="text-xs text-gray-500 font-semibold">STRIKES</p>
            <div className="flex gap-1">
              {[0,1,2].map(i => (
                <div key={i} className={`w-5 h-5 rounded-full border-2 ${i < gs.strikes ? 'bg-red-500 border-red-600' : 'border-gray-300'}`} />
              ))}
            </div>
          </div>
          <div className="text-center">
            <button onClick={() => addCount('ball')} className="btn btn-ghost btn-sm me-1">+Ball</button>
            <button onClick={() => addCount('strike')} className="btn btn-ghost btn-sm">+Strike</button>
          </div>
        </div>
      </div>

      {/* Current batter */}
      <div className="card mb-3 text-center">
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Now Batting</p>
        <p className="text-2xl font-black">{batter}</p>
        <div className="flex items-center justify-center gap-2 mt-1">
          <span className={`text-sm font-semibold ${batterType === 'BBH' ? 'text-blue-600' : 'text-amber-600'}`}>
            {batterType}
          </span>
          {batterPosition && (
            <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2 py-0.5 rounded">
              {batterPosition}
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 mt-1">#{(gs.batterIndex % battingOrder.length) + 1} in order</p>
      </div>

      {/* Outcome buttons + guide link */}
      <div className="mb-1 flex items-center justify-between">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">At-Bat Outcome</p>
        <button onClick={() => setShowGuide(true)} className="btn btn-ghost btn-sm text-xs gap-1 text-blue-500 py-0.5">
          <BookOpen size={12} /> What do these mean?
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        {OUTCOMES.map(o => (
          <button key={o.code} onClick={() => applyOutcome(o.code)}
            className={`btn ${o.color} btn-md`}>
            <span className="font-black mr-1">{o.code}</span>
            <span className="text-xs">{o.label}</span>
          </button>
        ))}
      </div>

      {/* Stolen base */}
      <div className="card mb-3 p-3">
        <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1">
          <ArrowRight size={12} /> STOLEN BASE — tap the base being stolen
        </p>
        <div className="flex gap-2">
          {['1st→2nd', '2nd→3rd', '3rd→Home'].map((label, i) => (
            <button key={i} onClick={() => addStolenBase(i)} disabled={!gs.bases[i]}
              className="btn btn-outline btn-sm flex-1 disabled:opacity-30">
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Secondary actions */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <button onClick={() => setShowFielding(true)} className="btn btn-ghost btn-sm gap-1">
          <MapPin size={14} /> Positions
        </button>
        <button onClick={() => setShowSub(true)} className="btn btn-ghost btn-sm gap-1">
          <Users size={14} /> Substitution
        </button>
      </div>

      {/* Call game early */}
      <div className="mb-3">
        <button onClick={callGameEarly} className="btn btn-ghost btn-sm w-full gap-1 text-red-500 border border-red-200">
          <StopCircle size={14} /> Call Game Early
        </button>
      </div>

      {lastAction && <LastPlayCard action={lastAction} onUndo={undoLast} />}

      {/* Error logging */}
      <div className="card mb-3 p-3">
        <p className="text-xs font-semibold text-gray-500 mb-1 flex items-center gap-1">
          <AlertTriangle size={12} /> LOG FIELDING ERROR — tap the player who made the error
        </p>
        <p className="text-xs text-gray-400 mb-2">Use this when a batter reaches base (or advances) due to a fielder's mistake.</p>
        <div className="flex flex-wrap gap-1">
          {battingOrder.map(name => (
            <button key={name} onClick={() => addError(name)}
              className="btn btn-ghost btn-sm text-xs">{name}</button>
          ))}
        </div>
      </div>

      {/* Putout modal — shown after G or F */}
      {showPutout && (
        <PutoutModal
          outCode={pendingOutCode}
          battingOrder={battingOrder}
          playerPositions={setup.playerPositions}
          onConfirm={completePutout}
          onSkip={() => completePutout(null, null)}
        />
      )}

      {/* Outcome guide sheet */}
      {showGuide && (
        <OutcomeGuideSheet onClose={() => setShowGuide(false)} />
      )}

      {/* Fielding positions modal */}
      {showFielding && (
        <FieldingModal
          battingOrder={battingOrder}
          setupLineup={setup.fieldingLineup || {}}
          existing={fieldingAssignments}
          inningKey={inningKey}
          positions={POSITIONS}
          onSave={saveFielding}
          onClose={() => setShowFielding(false)}
        />
      )}

      {/* Substitution modal */}
      {showSub && (
        <div className="fixed inset-0 bg-black/50 flex items-end z-50">
          <div className="bg-white rounded-t-2xl w-full p-4 max-h-[80vh] overflow-y-auto">
            <h3 className="font-bold mb-1">Substitution</h3>
            <p className="text-xs text-gray-500 mb-3">
              Replace a player in the batting order. Late arrivals from the full roster are available.
            </p>
            <div className="space-y-3">
              <div>
                <label className="label">Player OUT (currently in lineup)</label>
                <select className="input" value={subFrom} onChange={e => setSubFrom(e.target.value)}>
                  <option value="">Select…</option>
                  {battingOrder.map(n => {
                    const t = allActivePlayers.find(p => p.name === n)?.type || setup.roster.find(p => p.name === n)?.type
                    return <option key={n} value={n}>{n}{t ? ` (${t})` : ''}</option>
                  })}
                </select>
              </div>
              <div>
                <label className="label">Player IN (from bench / late arrivals)</label>
                <select className="input" value={subTo} onChange={e => setSubTo(e.target.value)}>
                  <option value="">Select…</option>
                  {benchPlayers.map(p => (
                    <option key={p.id} value={p.name}>{p.name} ({p.type})</option>
                  ))}
                </select>
              </div>
              {typeMismatch && (
                <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-2 text-xs text-amber-800">
                  <AlertTriangle size={14} className="text-amber-500 shrink-0 mt-0.5" />
                  <span>
                    <strong>Type mismatch:</strong> {subFrom} is {subFromType} but {subTo} is {subToType}.
                    This may break BBH/SBH batting order alternation. Proceed if intentional.
                  </span>
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button onClick={() => { setShowSub(false); setSubFrom(''); setSubTo('') }} className="btn btn-ghost btn-md flex-1">Cancel</button>
              <button onClick={doSub} className="btn btn-warning btn-md flex-1" disabled={!subFrom || !subTo || subFrom === subTo}>Confirm Sub</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Bottom sheet: record who made a groundout or flyout
function PutoutModal({ outCode, battingOrder, playerPositions, onConfirm, onSkip }) {
  const [putoutPlayer, setPutoutPlayer] = useState('')
  const [assistPlayer, setAssistPlayer] = useState('')

  const players = battingOrder.map(name => ({
    name,
    pos: playerPositions?.[name] || '?',
  }))

  const label = outCode === 'G' ? 'Groundout' : 'Flyout'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50">
      <div className="bg-white rounded-t-2xl w-full p-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🧤</span>
          <h3 className="font-bold">Record {label}</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          Tap the fielder who got the out. Tap a second player if there was an assist (they threw it to get the out). Skip if unsure.
        </p>

        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Who got the out?</span>
            <span className="text-xs bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded">PO</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {players.map(({ name, pos }) => (
              <button
                key={name}
                onClick={() => {
                  setPutoutPlayer(name)
                  if (assistPlayer === name) setAssistPlayer('')
                }}
                className={`btn btn-sm flex flex-col h-auto py-1.5 gap-0 ${putoutPlayer === name ? 'btn-primary' : 'btn-ghost'}`}
              >
                <span className="text-xs font-black leading-tight">{pos}</span>
                <span className="text-xs leading-tight">{name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {putoutPlayer && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Who threw/relayed? (optional)</span>
              <span className="text-xs bg-amber-100 text-amber-600 font-semibold px-1.5 py-0.5 rounded">A</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {players.filter(p => p.name !== putoutPlayer).map(({ name, pos }) => (
                <button
                  key={name}
                  onClick={() => setAssistPlayer(prev => prev === name ? '' : name)}
                  className={`btn btn-sm flex flex-col h-auto py-1.5 gap-0 ${assistPlayer === name ? 'btn-warning' : 'btn-ghost'}`}
                >
                  <span className="text-xs font-black leading-tight">{pos}</span>
                  <span className="text-xs leading-tight">{name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <button onClick={onSkip} className="btn btn-ghost btn-md flex-1">Skip</button>
          <button
            onClick={() => onConfirm(putoutPlayer, assistPlayer)}
            disabled={!putoutPlayer}
            className="btn btn-success btn-md flex-1"
          >
            ✓ Log Play
          </button>
        </div>
      </div>
    </div>
  )
}

// Outcome colour map for the last-play card
const OUTCOME_META = {
  '1B':  { label: 'Single',           bg: 'bg-green-50',  border: 'border-green-400', text: 'text-green-700' },
  '2B':  { label: 'Double',           bg: 'bg-green-50',  border: 'border-green-400', text: 'text-green-700' },
  '3B':  { label: 'Triple',           bg: 'bg-green-50',  border: 'border-green-400', text: 'text-green-700' },
  'HR':  { label: 'Home Run',         bg: 'bg-green-50',  border: 'border-green-600', text: 'text-green-800' },
  'BB':  { label: 'Walk',             bg: 'bg-blue-50',   border: 'border-blue-300',  text: 'text-blue-700'  },
  'HBP': { label: 'Hit By Pitch',     bg: 'bg-blue-50',   border: 'border-blue-300',  text: 'text-blue-700'  },
  'K':   { label: 'Strikeout',        bg: 'bg-red-50',    border: 'border-red-400',   text: 'text-red-700'   },
  'F':   { label: 'Flyout',           bg: 'bg-red-50',    border: 'border-red-400',   text: 'text-red-700'   },
  'G':   { label: 'Groundout',        bg: 'bg-red-50',    border: 'border-red-400',   text: 'text-red-700'   },
  'E':   { label: 'On Error',         bg: 'bg-amber-50',  border: 'border-amber-400', text: 'text-amber-700' },
  'FC':  { label: "Fielder's Choice", bg: 'bg-amber-50',  border: 'border-amber-400', text: 'text-amber-700' },
  'SAC': { label: 'Sacrifice',        bg: 'bg-gray-50',   border: 'border-gray-300',  text: 'text-gray-600'  },
}

function LastPlayCard({ action, onUndo }) {
  const meta = OUTCOME_META[action.code] || { label: action.code, bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' }
  const isOut = ['K','F','G'].includes(action.code)

  return (
    <div className={`rounded-lg border-l-4 ${meta.border} ${meta.bg} p-3 mb-3 flex gap-3 items-start`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`font-black text-lg ${meta.text}`}>{action.code}</span>
          <span className="text-sm font-semibold text-gray-700">{action.batter}</span>
          <span className="text-xs text-gray-500">{meta.label}</span>
          {action.rbi > 0 && (
            <span className="text-xs bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded">
              {action.rbi} RBI
            </span>
          )}
        </div>

        {/* Fielding line */}
        {isOut && (
          <div className="mt-1 text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">
            {action.autoFielder ? (
              <>
                <span className="bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded">PO</span>
                <span>{action.autoFielder}</span>
                <span className="text-gray-400 italic">(auto — catcher)</span>
              </>
            ) : action.fielder ? (
              <>
                <span className="bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded">PO</span>
                <span>{action.fielder}</span>
                {action.assister && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="bg-amber-100 text-amber-600 font-semibold px-1.5 py-0.5 rounded">A</span>
                    <span>{action.assister}</span>
                  </>
                )}
              </>
            ) : (
              <span className="italic text-gray-400">Fielding not recorded</span>
            )}
          </div>
        )}
      </div>

      <button onClick={onUndo} className="btn btn-ghost btn-sm p-1 text-gray-400 shrink-0" title="Undo">
        <RotateCcw size={15} />
      </button>
    </div>
  )
}

// Plain-English guide for all outcome codes
function OutcomeGuideSheet({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50">
      <div className="bg-white rounded-t-2xl w-full p-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold flex items-center gap-2"><BookOpen size={18} /> Outcome Guide</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm p-1"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Not sure which outcome to pick? Here's what each one means.
        </p>
        <div className="space-y-2.5">
          {OUTCOME_GUIDE.map(({ code, label, desc }) => (
            <div key={code} className="flex gap-3 items-start">
              <span className="shrink-0 w-10 text-center font-black text-sm bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                {code}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800">{label}</p>
                <p className="text-xs text-gray-500 leading-snug">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            <strong>Tip:</strong> When in doubt, use 1B/2B/3B/HR for hits, K for strikeouts, and BB for walks. You can always log G/F for groundouts and flyouts to track fielding stats too.
          </p>
        </div>
        <button onClick={onClose} className="btn btn-primary btn-md w-full mt-3">Got it!</button>
      </div>
    </div>
  )
}

// Fielding positions modal — defaults to game setup lineup, lets you update mid-game
function FieldingModal({ battingOrder, setupLineup, existing, inningKey, positions, onSave, onClose }) {
  // Use this inning's saved positions if any, otherwise fall back to the game setup lineup
  const defaults = Object.keys(existing).length > 0 ? existing : setupLineup
  const [assignments, setAssignments] = useState({ ...defaults })

  function assign(pos, player) {
    setAssignments(prev => {
      const next = { ...prev }
      // Remove player from any previous position
      Object.keys(next).forEach(k => { if (next[k] === player) delete next[k] })
      if (player) next[pos] = player
      else delete next[pos]
      return next
    })
  }

  const inningNum  = inningKey.split('-')[0]
  const inningHalf = inningKey.includes('top') ? '▲' : '▼'
  const assignedCount = Object.keys(assignments).length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50">
      <div className="bg-white rounded-t-2xl w-full p-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold mb-0.5">Fielding Positions</h3>
        <p className="text-xs text-gray-500 mb-3">
          Inning {inningNum} {inningHalf} — update only if positions changed mid-game
        </p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-3">
          {positions.map(pos => (
            <div key={pos} className="flex items-center gap-2">
              <span className="w-8 text-xs font-bold text-gray-500 shrink-0">{pos}</span>
              <select
                className="input text-sm py-1 flex-1"
                value={assignments[pos] || ''}
                onChange={e => assign(pos, e.target.value)}
              >
                <option value="">—</option>
                {battingOrder.map(name => (
                  <option key={name} value={name}>
                    {name}{assignments[pos] !== name && Object.values(assignments).includes(name) ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mb-3">{assignedCount} of {positions.length} positions assigned</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn btn-ghost btn-md flex-1">Cancel</button>
          <button onClick={() => onSave(inningKey, assignments)} className="btn btn-success btn-md flex-1">
            Save Positions
          </button>
        </div>
      </div>
    </div>
  )
}
