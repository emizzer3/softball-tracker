import { useState } from 'react'
import { RotateCcw, RotateCw, Users, MapPin, AlertTriangle, BookOpen, X, StopCircle, ChevronLeft, ChevronDown, ChevronUp } from 'lucide-react'
import BaseDiamond from '../components/BaseDiamond'
import { setActiveGame, getRoster } from '../storage'

const POSITIONS = ['P','C','1B','2B','3B','SS','LF','LC','RC','RF','EF']

const OUTCOMES = [
  { code: '1B', label: 'Single',            color: 'btn-success', hit: true },
  { code: '2B', label: 'Double',            color: 'btn-success', hit: true },
  { code: '3B', label: 'Triple',            color: 'btn-success', hit: true },
  { code: 'HR', label: 'Home Run',          color: 'btn-success', hit: true },
  { code: 'BB', label: 'Walk',              color: 'btn-primary', hit: false },
  { code: 'K',  label: 'Strikeout',         color: 'btn-danger',  hit: false },
  { code: 'F',  label: 'Flyout',            color: 'btn-danger',  hit: false },
  { code: 'G',  label: 'Groundout',         color: 'btn-danger',  hit: false },
  { code: 'E',  label: 'On Error',          color: 'btn-warning', hit: false },
  { code: 'FC', label: "Fielder's Choice",  color: 'btn-warning', hit: false },
  { code: 'SAC',label: 'Sac Fly',           color: 'btn-ghost',   hit: false },
]

// Plain-English guide shown in the Outcome Guide sheet
const OUTCOME_GUIDE = [
  { code: '1B',  label: 'Single',           desc: 'Hit the ball and safely reached 1st base.' },
  { code: '2B',  label: 'Double',           desc: 'Hit the ball and safely reached 2nd base.' },
  { code: '3B',  label: 'Triple',           desc: 'Hit the ball and safely reached 3rd base.' },
  { code: 'HR',  label: 'Home Run',         desc: 'Hit over/to the fence — batter runs all bases and scores.' },
  { code: 'BB',  label: 'Walk',             desc: '4 balls — co-ed rule: SBH walks to 1st, BBH walks straight to 2nd (deters pitchers from intentionally walking the male). Doesn\'t count as an at-bat.' },
  { code: 'K',   label: 'Strikeout',        desc: '3 strikes and the batter is out. Catcher auto-gets the putout (PO).' },
  { code: 'F',   label: 'Flyout',           desc: 'Batter hit the ball in the air and a fielder caught it before it bounced.' },
  { code: 'G',   label: 'Groundout',        desc: 'Batter hit a ground ball and was thrown out at first (or another base).' },
  { code: 'E',   label: 'On Error',         desc: 'Batter reached base because a fielder made a mistake. Doesn\'t count as a hit.' },
  { code: 'FC',  label: "Fielder's Choice", desc: 'Batter reached safely, but the fielder chose to put out a different runner instead.' },
  { code: 'SAC', label: 'Sacrifice Fly',    desc: 'Batter hits a fly ball and is caught (out), but a runner tags up and scores. Doesn\'t count as an at-bat.' },
]

const BASES_ON_OUTCOME = {
  '1B': 1, '2B': 2, '3B': 3, 'HR': 4, 'E': 1, 'FC': 1,
  // SAC handled separately — user picks how many runners tagged up and scored
  // BB handled separately — co-ed rule: BBH walks to 2B, SBH walks to 1B
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

export default function TrackerPage({ setup, savedState, onEnd, onBack }) {
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
  // Multi-step undo / redo — full state snapshots, capped at HISTORY_LIMIT
  const HISTORY_LIMIT = 30
  const [history,    setHistory]    = useState(() => savedState?.history    || [])
  const [redoStack,  setRedoStack]  = useState(() => savedState?.redoStack  || [])
  const [showHitLoc, setShowHitLoc] = useState(false)
  const [pendingHitCode, setPendingHitCode] = useState(null)
  const [pendingHitLoc, setPendingHitLoc] = useState(null)
  const [showSacRuns, setShowSacRuns] = useState(false)
  const [pendingSacLoc, setPendingSacLoc] = useState(null)
  const [showRunnerOut, setShowRunnerOut] = useState(false)
  const [runnerOutMode, setRunnerOutMode] = useState('batting') // 'batting' | 'fielding'

  // weAreHome defaults true for any games saved before this field existed
  const weAreHome = setup.weAreHome !== false
  const isOurBatting = weAreHome ? gs.half === 'bottom' : gs.half === 'top'

  const batter = battingOrder[gs.batterIndex % battingOrder.length]
  const batterPosition = setup.playerPositions?.[batter]
  const batterType = setup.roster.find(p => p.name === batter)?.type

  // Persist a new game state — pushes the OLD state to history and clears redo by default.
  // Pass { skipHistory: true } from undo/redo so they don't pollute their own stacks.
  function persist(newGs, { skipHistory = false } = {}) {
    if (skipHistory) {
      setActiveGame({ setup, gameState: newGs, battingOrder, history, redoStack })
      setGs(newGs)
      return
    }
    const newHistory   = [...history, gs].slice(-HISTORY_LIMIT)
    const newRedoStack = []
    setHistory(newHistory)
    setRedoStack(newRedoStack)
    setActiveGame({ setup, gameState: newGs, battingOrder, history: newHistory, redoStack: newRedoStack })
    setGs(newGs)
  }

  function undo() {
    if (history.length === 0) return
    const prev = history[history.length - 1]
    const newHistory   = history.slice(0, -1)
    const newRedoStack = [...redoStack, gs].slice(-HISTORY_LIMIT)
    setHistory(newHistory)
    setRedoStack(newRedoStack)
    setActiveGame({ setup, gameState: prev, battingOrder, history: newHistory, redoStack: newRedoStack })
    setGs(prev)
    setLastAction(null)
  }

  function redo() {
    if (redoStack.length === 0) return
    const next = redoStack[redoStack.length - 1]
    const newRedoStack = redoStack.slice(0, -1)
    const newHistory   = [...history, gs].slice(-HISTORY_LIMIT)
    setHistory(newHistory)
    setRedoStack(newRedoStack)
    setActiveGame({ setup, gameState: next, battingOrder, history: newHistory, redoStack: newRedoStack })
    setGs(next)
    setLastAction(null)
  }

  // Ball-in-play outcomes that prompt for a hit location
  const BALL_IN_PLAY = ['1B','2B','3B','HR','F','G','E','FC','SAC']

  // Core outcome logic — separated so it can be called with optional playLog extras
  function finishOutcome(code, extraPlayLog = [], hitLocation = null, sacRuns = 0, doublePlay = false, triplePlay = false) {
    const by = BASES_ON_OUTCOME[code] || 0
    const isOut = ['K','F','G','SAC','FC'].includes(code)
    const scoringTeam = gs.half === 'top' ? 'away' : 'home'
    const g = { ...gs, balls: 0, strikes: 0 }

    let newBases = [...g.bases]
    let runs = 0

    if (code === 'FC') {
      // Fielder's Choice: lead runner is forced out.
      // Normally batter is safe at 1B. On a double play, batter is also out.
      for (let i = 2; i >= 0; i--) {
        if (newBases[i]) { newBases[i] = false; break }
      }
      if (!doublePlay) newBases[0] = true
    } else if (code === 'G' && doublePlay) {
      // Ground-ball double play: batter is out (no base) + lead runner forced out
      for (let i = 2; i >= 0; i--) {
        if (newBases[i]) { newBases[i] = false; break }
      }
    } else if (code === 'BB') {
      // Walk: only forced runners advance (chain from 1B). Co-ed rule:
      // BBH walks to 2B, SBH walks to 1B.
      const walkBases = batterType === 'BBH' ? 2 : 1

      // Step 1: standard walk to 1B with chain force
      let chainEnd = 0
      while (chainEnd < 3 && newBases[chainEnd]) chainEnd++
      if (chainEnd === 3) {
        runs++ // bases-loaded walk → 1 run forced home
      } else {
        newBases[chainEnd] = true
      }

      // Step 2: BBH walk — batter advances from 1B to 2B with chain force
      if (walkBases >= 2) {
        let chainEnd2 = 1
        while (chainEnd2 < 3 && newBases[chainEnd2]) chainEnd2++
        if (chainEnd2 === 3) {
          runs++ // chain force from 1B→2B→3B→home scores another run
          newBases[0] = false
        } else {
          newBases[chainEnd2] = true
          newBases[0] = false
        }
      }
    } else if (code === 'SAC') {
      // Sacrifice fly: user has told us how many runners tagged up and scored.
      // Remove the N lead runners from the bases — they're the ones who scored.
      runs = sacRuns
      let removed = 0
      for (let i = 2; i >= 0 && removed < sacRuns; i--) {
        if (newBases[i]) { newBases[i] = false; removed++ }
      }
      // Batter is out — doesn't go on base.
    } else if (by > 0) {
      const [advanced, r] = basesAdvanced(newBases, by)
      runs = r
      newBases = advanced
      if (by === 4) runs++                        // HR: batter scores too
      else if (!isOut) newBases[by - 1] = true    // batter stops on base (not for outs)
    }

    const atBat = {
      id: Date.now(),
      batter,
      inning: g.inning,
      half: g.half,
      outcome: code,
      rbi: runs,
      bases: [...newBases],
      hitLocation: hitLocation || null,
    }
    g.atBats = [...g.atBats, atBat]

    if (extraPlayLog.length > 0) {
      g.playLog = [...g.playLog, ...extraPlayLog]
    }

    // Score runs regardless of whether the batter was out (covers SAC fly, etc.)
    if (runs > 0) {
      if (scoringTeam === 'home') g.homeScore += runs
      else g.awayScore += runs
      const scores = [...g.inningScores]
      scores[g.inning - 1] = {
        ...scores[g.inning - 1],
        [scoringTeam]: (scores[g.inning - 1][scoringTeam] || 0) + runs,
      }
      g.inningScores = scores
    }

    if (isOut) {
      g.outs++
      if (doublePlay || triplePlay) g.outs++ // second out from the DP/TP
      if (triplePlay) g.outs++              // third out from the TP
      if (g.outs >= 3) {
        newBases = [false, false, false]
        g.outs = 0
        if (g.half === 'top') {
          // Walk-off: if home team already leads at end of last top inning, skip bottom
          if (g.inning >= setup.innings && g.homeScore > g.awayScore) {
            g.done = true
          } else {
            g.half = 'bottom'
          }
        } else {
          if (g.inning >= setup.innings) {
            g.done = true
          } else {
            g.inning++
            g.half = 'top'
          }
        }
      }
    }

    // Walk-off mid-inning: home team takes the lead in the bottom of the last inning
    if (!g.done && g.half === 'bottom' && g.inning >= setup.innings && g.homeScore > g.awayScore) {
      g.done = true
    }

    g.bases = newBases
    g.batterIndex = g.done ? g.batterIndex : (g.batterIndex + 1) % battingOrder.length

    setLastAction(prev => ({ ...prev, code, batter, rbi: runs }))
    persist(g)
  }

  function applyOutcome(code) {
    if (isOurBatting && BALL_IN_PLAY.includes(code)) {
      // Show hit location first, then proceed to putout modal (G/F) or finish
      setPendingHitCode(code)
      setPendingHitLoc(null)
      setShowHitLoc(true)
    } else if (code === 'K') {
      // Only credit our catcher when we're fielding (opponent batting and K'd).
      // When WE bat and strike out, the opposing catcher made the out — we don't track them.
      const catcher = !isOurBatting ? setup.fieldingLineup?.['C'] : null
      const extraLog = catcher
        ? [{ type: 'putout', fielder: catcher, assister: null, inning: gs.inning, half: gs.half, outCode: code, batter }]
        : []
      setLastAction({ code, batter, rbi: 0, autoFielder: catcher || null, fielder: null, assister: null })
      finishOutcome(code, extraLog)
    } else if ((code === 'G' || code === 'F') && !isOurBatting) {
      // Putout modal only when WE are fielding — credit our fielder.
      setPendingOutCode(code)
      setShowPutout(true)
    } else {
      setLastAction({ code, batter, rbi: 0, fielder: null, assister: null, autoFielder: null })
      finishOutcome(code)
    }
  }

  // Called when user confirms (or skips) the hit location modal
  function confirmHitLocation(location) {
    setShowHitLoc(false)
    const code = pendingHitCode
    setPendingHitCode(null)
    setPendingHitLoc(location)

    if ((code === 'G' || code === 'F' || code === 'FC') && !isOurBatting) {
      // Still need fielder attribution after location — only when we're fielding
      setPendingOutCode(code)
      setShowPutout(true)
    } else if ((code === 'G' || code === 'FC') && isOurBatting && gs.bases.some(Boolean)) {
      // We're batting and there's at least one runner — could be a double play.
      // Show the putout modal but it'll hide the fielder grid (we don't track them).
      setPendingOutCode(code)
      setShowPutout(true)
    } else if (code === 'SAC') {
      // Always ask how many runners tagged up and scored
      setPendingSacLoc(location)
      setShowSacRuns(true)
    } else {
      setLastAction({ code, batter, rbi: 0, fielder: null, assister: null, autoFielder: null })
      finishOutcome(code, [], location)
      setPendingHitLoc(null)
    }
  }

  function confirmSacRuns(n) {
    setLastAction({ code: 'SAC', batter, rbi: n, fielder: null, assister: null, autoFielder: null })
    finishOutcome('SAC', [], pendingSacLoc, n)
    setPendingSacLoc(null)
    setShowSacRuns(false)
  }

  function completePutout(fielder, assister, doublePlay = false, triplePlay = false) {
    const extraLog = fielder
      ? [{ type: 'putout', fielder, assister: assister || null, inning: gs.inning, half: gs.half, outCode: pendingOutCode, batter, doublePlay, triplePlay }]
      : []
    setLastAction({ code: pendingOutCode, batter, rbi: 0, fielder: fielder || null, assister: assister || null, autoFielder: null, doublePlay, triplePlay })
    finishOutcome(pendingOutCode, extraLog, pendingHitLoc, 0, doublePlay, triplePlay)
    setPendingOutCode(null)
    setPendingHitLoc(null)
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

  function addError(fielderName) {
    const g = { ...gs }
    g.playLog = [...g.playLog, { type: 'error', fielder: fielderName, inning: g.inning, half: g.half }]
    persist(g)
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

  // Simplified fielding-half helpers — used when opponents are batting (top of inning)
  function recordOpponentOut() {
    const g = { ...gs, balls: 0, strikes: 0 }
    g.outs++
    if (g.outs >= 3) {
      g.bases = [false, false, false]
      g.outs = 0
      if (weAreHome) {
        // Walk-off: if we're home and leading at end of last top inning, no need to bat
        if (g.inning >= setup.innings && g.homeScore > g.awayScore) {
          g.done = true
        } else {
          g.half = 'bottom'
        }
      } else {
        // We're away, fielding bottom (home batting) — 3 outs ends inning
        if (g.inning >= setup.innings) {
          g.done = true
        } else {
          g.inning++
          g.half = 'top'
        }
      }
    }
    persist(g)
  }

  function recordOpponentRun() {
    const g = { ...gs }
    // Opponent is home if we're away, and vice versa
    const opponentSide = weAreHome ? 'away' : 'home'
    if (opponentSide === 'away') g.awayScore++
    else g.homeScore++
    const scores = [...g.inningScores]
    scores[g.inning - 1] = { ...scores[g.inning - 1], [opponentSide]: (scores[g.inning - 1][opponentSide] || 0) + 1 }
    g.inningScores = scores
    // Walk-off: home opponent takes the lead in the bottom of the last inning
    if (!weAreHome && g.half === 'bottom' && g.inning >= setup.innings && g.homeScore > g.awayScore) {
      g.done = true
    }
    persist(g)
  }

  function recordOurRun() {
    // Manually score a run for whichever side is currently batting
    const g = { ...gs }
    const battingSide = gs.half === 'top' ? 'away' : 'home'
    if (battingSide === 'away') g.awayScore++
    else g.homeScore++
    const scores = [...g.inningScores]
    scores[g.inning - 1] = { ...scores[g.inning - 1], [battingSide]: (scores[g.inning - 1][battingSide] || 0) + 1 }
    g.inningScores = scores
    // Walk-off check (home batting in bottom of last inning takes lead)
    if (g.half === 'bottom' && g.inning >= setup.innings && g.homeScore > g.awayScore) {
      g.done = true
    }
    persist(g)
  }

  function recordBattingRunnerOut() {
    const g = { ...gs, balls: 0, strikes: 0 }
    g.playLog = [...g.playLog, { type: 'runnerOut', inning: g.inning, half: g.half }]
    g.outs++
    if (g.outs >= 3) {
      g.bases = [false, false, false]
      g.outs = 0
      if (g.half === 'top') {
        if (g.inning >= setup.innings && g.homeScore > g.awayScore) {
          g.done = true
        } else {
          g.half = 'bottom'
        }
      } else {
        if (g.inning >= setup.innings) {
          g.done = true
        } else {
          g.inning++
          g.half = 'top'
        }
      }
    }
    persist(g)
  }

  function recordFieldingRunnerOut(fielder, assister) {
    const g = { ...gs, balls: 0, strikes: 0 }
    g.playLog = [...g.playLog, {
      type: 'runnerOut',
      fielder:  fielder  || null,
      assister: assister || null,
      inning: g.inning,
      half: g.half,
    }]
    g.outs++
    if (g.outs >= 3) {
      g.bases = [false, false, false]
      g.outs = 0
      if (weAreHome) {
        if (g.inning >= setup.innings && g.homeScore > g.awayScore) {
          g.done = true
        } else {
          g.half = 'bottom'
        }
      } else {
        if (g.inning >= setup.innings) {
          g.done = true
        } else {
          g.inning++
          g.half = 'top'
        }
      }
    }
    persist(g)
  }

  function updateLastAtBatRbi(delta) {
    if (gs.atBats.length === 0) return
    const newAtBats = [...gs.atBats]
    const last = newAtBats[newAtBats.length - 1]
    const newRbi = Math.max(0, (last.rbi || 0) + delta)
    newAtBats[newAtBats.length - 1] = { ...last, rbi: newRbi }
    const newGs = { ...gs, atBats: newAtBats }
    setLastAction(prev => prev ? { ...prev, rbi: newRbi } : prev)
    persist(newGs)
  }

  function toggleBase(i) {
    const g = { ...gs }
    const newBases = [...g.bases]
    newBases[i] = !newBases[i]
    g.bases = newBases
    persist(g)
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

      {/* Back to home */}
      {onBack && (
        <button onClick={onBack} className="btn btn-ghost btn-sm p-1 -ml-1 mb-2 gap-1 text-gray-500">
          <ChevronLeft size={18} /> Home
        </button>
      )}

      {/* Mode banner — makes it unmistakably clear who is batting */}
      <div className={`rounded-lg p-2 mb-3 text-center border ${
        isOurBatting
          ? 'bg-green-50 border-green-200'
          : 'bg-orange-100 border-orange-400'
      }`}>
        {isOurBatting ? (
          <p className="font-bold text-green-800 text-sm">⚾ {gs.half === 'top' ? setup.away : setup.home} batting</p>
        ) : (
          <>
            <p className="font-black text-orange-900">🛡️ FIELDING — {gs.half === 'top' ? setup.away : setup.home} batting</p>
            <p className="text-xs text-orange-700 mt-0.5">Tap OUT or RUN below to track their half-inning</p>
          </>
        )}
      </div>

      {/* Score bar */}
      <div className="card mb-3 p-3">
        <div className="flex justify-between items-center text-sm font-semibold text-gray-500 mb-1">
          <span className={gs.half === 'top' ? (isOurBatting ? 'text-green-700 font-bold' : 'text-orange-600 font-bold') : ''}>{setup.away}</span>
          <span className="text-xs">
            Inning {gs.inning} {gs.half === 'top' ? '▲' : '▼'}
            {setup.timed
              ? <span className="ml-1 bg-indigo-100 text-indigo-700 font-bold px-1.5 py-0.5 rounded text-xs">⏱ TIMED</span>
              : ` of ${setup.innings}`}
          </span>
          <span className={gs.half === 'bottom' ? (isOurBatting ? 'text-green-700 font-bold' : 'text-orange-600 font-bold') : ''}>{setup.home}</span>
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
      <div className="card mb-3 p-4">
        <div className="flex items-center gap-4 justify-center">
          <BaseDiamond bases={gs.bases} size={120} onToggle={toggleBase} />
        {isOurBatting ? (
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
            <button
              onClick={recordOurRun}
              className="btn btn-sm bg-amber-500 hover:bg-amber-600 text-white w-full gap-1 mt-1"
              title="Add a run if a runner scored that the default advancement missed"
            >
              <span>🏃</span> +1 Run
            </button>
            <button
              onClick={() => { setRunnerOutMode('batting'); setShowRunnerOut(true) }}
              className="btn btn-sm bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 w-full gap-1 mt-1"
              title="Record a baserunning out (caught stealing, picked off) without ending this at-bat"
            >
              <span>⚡</span> Runner Out
            </button>
          </div>
        ) : (
          <div className="space-y-1.5">
            <p className="text-xs text-gray-500 font-semibold text-center mb-2">RUNNERS ON BASE</p>
            {['1st', '2nd', '3rd'].map((label, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleBase(i)}
                className={`btn btn-sm w-full ${gs.bases[i] ? 'btn-warning' : 'btn-ghost'}`}
              >
                {gs.bases[i] ? '🟡' : '○'} {label}
              </button>
            ))}
          </div>
        )}
        </div>
        <p className="text-[11px] text-gray-400 text-center mt-2">Tap a base to manually add/remove a runner</p>
      </div>

      {/* ── FIELDING HALF (opponents batting) ───────────────────── */}
      {!isOurBatting && (
        <div className="card mb-3">
          <div className="grid grid-cols-2 gap-3 mb-2">
            <button
              onClick={recordOpponentOut}
              className="btn btn-danger btn-md flex flex-col items-center gap-1 py-5"
            >
              <span className="text-3xl">✋</span>
              <span className="font-black text-lg">OUT</span>
              <span className="text-xs opacity-80">K · G · F · SAC</span>
            </button>
            <button
              onClick={recordOpponentRun}
              className="btn btn-warning btn-md flex flex-col items-center gap-1 py-5"
            >
              <span className="text-3xl">🏃</span>
              <span className="font-black text-lg">RUN</span>
              <span className="text-xs opacity-80">+1 for {gs.half === 'top' ? setup.away : setup.home}</span>
            </button>
          </div>
          <p className="text-xs text-gray-400 text-center">3 outs ends the half-inning · use outcome buttons below for detail</p>
          <button
            onClick={() => { setRunnerOutMode('fielding'); setShowRunnerOut(true) }}
            className="btn btn-ghost btn-sm w-full mt-1 text-xs text-slate-500 border border-slate-200 gap-1"
          >
            ⚡ CS / Picked Off — record fielder PO
          </button>
        </div>
      )}

      {/* ── BATTING HALF (our team batting) ─────────────────────── */}
      {isOurBatting && (
        <>
          {/* Current batter + on-deck */}
          {(() => {
            const onDeck = battingOrder[(gs.batterIndex + 1) % battingOrder.length]
            const inHole = battingOrder[(gs.batterIndex + 2) % battingOrder.length]
            const onDeckType = setup.roster.find(p => p.name === onDeck)?.type
            const inHoleType = setup.roster.find(p => p.name === inHole)?.type
            return (
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

                {/* Up next — on deck + in the hole, dimmed */}
                <div className="flex justify-center gap-4 mt-3 pt-3 border-t border-gray-100">
                  <div className="text-left">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">On Deck</p>
                    <p className="text-sm font-semibold text-gray-500">{onDeck}</p>
                    <span className={`text-[10px] font-semibold ${onDeckType === 'BBH' ? 'text-blue-400' : 'text-amber-400'}`}>{onDeckType}</span>
                  </div>
                  <div className="text-left border-l border-gray-100 pl-4">
                    <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">In the Hole</p>
                    <p className="text-sm font-semibold text-gray-400">{inHole}</p>
                    <span className={`text-[10px] font-semibold ${inHoleType === 'BBH' ? 'text-blue-300' : 'text-amber-300'}`}>{inHoleType}</span>
                  </div>
                </div>
              </div>
            )
          })()}

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
        </>
      )}

      {/* Outcome buttons also available during fielding for detailed tracking */}
      {!isOurBatting && (
        <details className="mb-3">
          <summary className="text-xs text-gray-400 cursor-pointer select-none px-1">
            ▶ Track opponent at-bats in detail (optional)
          </summary>
          <div className="grid grid-cols-3 gap-2 mt-2">
            {OUTCOMES.map(o => (
              <button key={o.code} onClick={() => applyOutcome(o.code)}
                className={`btn ${o.color} btn-md`}>
                <span className="font-black mr-1">{o.code}</span>
                <span className="text-xs">{o.label}</span>
              </button>
            ))}
          </div>
        </details>
      )}

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

      {/* Undo/Redo toolbar — visible whenever there's something to undo or redo */}
      {(history.length > 0 || redoStack.length > 0) && (
        <div className="flex gap-2 mb-3">
          <button
            onClick={undo}
            disabled={history.length === 0}
            className="btn btn-ghost btn-sm flex-1 gap-1 border border-gray-200 disabled:opacity-40"
          >
            <RotateCcw size={14} /> Undo {history.length > 1 ? `(${history.length})` : ''}
          </button>
          <button
            onClick={redo}
            disabled={redoStack.length === 0}
            className="btn btn-ghost btn-sm flex-1 gap-1 border border-gray-200 disabled:opacity-40"
          >
            <RotateCw size={14} /> Redo {redoStack.length > 1 ? `(${redoStack.length})` : ''}
          </button>
        </div>
      )}

      {lastAction && (
        <LastPlayCard
          action={lastAction}
          atBats={gs.atBats}
          playLog={gs.playLog}
          onUndo={undo}
          onEditRbi={isOurBatting ? updateLastAtBatRbi : null}
        />
      )}

      {/* Error logging — only meaningful when WE are fielding */}
      {!isOurBatting && (
        <div className="card mb-3 p-3 border-2 border-amber-200 bg-amber-50">
          <p className="text-sm font-bold text-amber-800 mb-1 flex items-center gap-1">
            <AlertTriangle size={14} /> Did one of our fielders mess up?
          </p>
          <p className="text-xs text-amber-700 mb-2">
            Tap the fielder who made the error. This adds a fielding error (E) to their stats — use it independently of the OUT/RUN buttons above.
          </p>
          <div className="grid grid-cols-3 gap-1">
            {battingOrder.map(name => {
              const pos = setup.playerPositions?.[name] || '—'
              return (
                <button
                  key={name}
                  onClick={() => addError(name)}
                  className="btn btn-sm bg-white border border-amber-300 hover:bg-amber-100 active:bg-amber-200 text-amber-900 flex flex-col h-auto py-1.5 gap-0"
                >
                  <span className="text-xs font-black leading-tight">{pos}</span>
                  <span className="text-xs leading-tight">{name.split(' ')[0]}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Putout modal — shown after G or F */}
      {showPutout && (
        <PutoutModal
          outCode={pendingOutCode}
          battingOrder={battingOrder}
          playerPositions={setup.playerPositions}
          bases={gs.bases}
          hideFielders={isOurBatting}
          onConfirm={completePutout}
          onSkip={() => completePutout(null, null, false)}
        />
      )}

      {/* Hit location modal */}
      {showHitLoc && (
        <HitLocationModal
          batter={batter}
          outcomeCode={pendingHitCode}
          onConfirm={confirmHitLocation}
          onSkip={() => confirmHitLocation(null)}
        />
      )}

      {/* SAC fly runners-scored modal */}
      {showSacRuns && (
        <SacRunsModal
          batter={batter}
          bases={gs.bases}
          onConfirm={confirmSacRuns}
        />
      )}

      {/* Runner-out modal (caught stealing / picked off) */}
      {showRunnerOut && (
        <RunnerOutModal
          mode={runnerOutMode}
          battingOrder={battingOrder}
          playerPositions={setup.playerPositions}
          onConfirm={(fielder, assister) => {
            setShowRunnerOut(false)
            if (runnerOutMode === 'batting') {
              recordBattingRunnerOut()
            } else {
              recordFieldingRunnerOut(fielder, assister)
            }
          }}
          onCancel={() => setShowRunnerOut(false)}
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

// Bottom sheet: record how many runners tagged up and scored on a sac fly
function SacRunsModal({ batter, bases, onConfirm }) {
  const runnersOnBase = bases.filter(Boolean).length
  const baseLabels = ['1st','2nd','3rd']
  const runnersSummary = bases
    .map((occ, i) => occ ? baseLabels[i] : null)
    .filter(Boolean)
    .join(', ') || 'none'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50">
      <div className="bg-white rounded-t-2xl w-full p-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🛩️</span>
          <h3 className="font-bold">Sac Fly — {batter}</h3>
        </div>
        <p className="text-sm text-gray-600 mb-1">
          Runners on base: <span className="font-semibold">{runnersSummary}</span>
        </p>
        <p className="text-xs text-gray-500 mb-4">
          How many tagged up and scored? (Lead runners score first — e.g. tap "1" with runners on 2nd &amp; 3rd to score from 3rd, tap "2" to score from both.)
        </p>

        <div className="grid grid-cols-4 gap-2 mb-3">
          {[0, 1, 2, 3].map(n => (
            <button
              key={n}
              onClick={() => onConfirm(n)}
              disabled={n > runnersOnBase}
              className={`btn btn-md flex flex-col h-auto py-3 gap-0 ${
                n === 0 ? 'btn-ghost border border-gray-200' : 'btn-success'
              } disabled:opacity-30 disabled:bg-gray-100`}
            >
              <span className="text-2xl font-black leading-tight">{n}</span>
              <span className="text-xs leading-tight">{n === 1 ? 'run' : 'runs'}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 text-center">Batter is out either way — this just records the RBIs.</p>
      </div>
    </div>
  )
}

function RunnerOutModal({ mode, battingOrder, playerPositions, onConfirm, onCancel }) {
  const [fielder,  setFielder]  = useState('')
  const [assister, setAssister] = useState('')

  const players = battingOrder.map(name => ({
    name,
    pos: playerPositions?.[name] || '?',
  }))

  if (mode === 'batting') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-end z-50">
        <div className="bg-white rounded-t-2xl w-full p-4">
          <h3 className="font-bold mb-1">⚡ Runner Out</h3>
          <p className="text-sm text-gray-600 mb-4">
            Record a baserunning out (caught stealing, picked off). This adds 1 out without changing the current batter.
          </p>
          <div className="flex gap-2">
            <button onClick={onCancel} className="btn btn-ghost btn-md flex-1">Cancel</button>
            <button onClick={() => onConfirm(null, null)} className="btn btn-danger btn-md flex-1">
              ✓ Record Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50">
      <div className="bg-white rounded-t-2xl w-full p-4 max-h-[85vh] overflow-y-auto">
        <h3 className="font-bold mb-1">⚡ CS / Picked Off</h3>
        <p className="text-xs text-gray-500 mb-3">
          Their runner was thrown out. Tap who made the tag/catch (PO) and who threw it (A). Skip if unsure.
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
                onClick={() => { setFielder(name); if (assister === name) setAssister('') }}
                className={`btn btn-sm flex flex-col h-auto py-1.5 gap-0 ${fielder === name ? 'btn-primary' : 'btn-ghost'}`}
              >
                <span className="text-xs font-black leading-tight">{pos}</span>
                <span className="text-xs leading-tight">{name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {fielder && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Who threw it? (optional)</span>
              <span className="text-xs bg-amber-100 text-amber-600 font-semibold px-1.5 py-0.5 rounded">A</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {players.filter(p => p.name !== fielder).map(({ name, pos }) => (
                <button
                  key={name}
                  onClick={() => setAssister(prev => prev === name ? '' : name)}
                  className={`btn btn-sm flex flex-col h-auto py-1.5 gap-0 ${assister === name ? 'btn-warning' : 'btn-ghost'}`}
                >
                  <span className="text-xs font-black leading-tight">{pos}</span>
                  <span className="text-xs leading-tight">{name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <button onClick={onCancel} className="btn btn-ghost btn-md flex-1">Cancel</button>
          <button
            onClick={() => onConfirm(fielder || null, assister || null)}
            className="btn btn-danger btn-md flex-1"
          >
            ✓ Record Out
          </button>
        </div>
      </div>
    </div>
  )
}

// Bottom sheet: record who made a groundout or flyout
function PutoutModal({ outCode, battingOrder, playerPositions, bases = [false,false,false], hideFielders = false, onConfirm, onSkip }) {
  const [putoutPlayer, setPutoutPlayer] = useState('')
  const [assistPlayer, setAssistPlayer] = useState('')
  const [doublePlay, setDoublePlay] = useState(false)
  const [triplePlay, setTriplePlay] = useState(false)

  const players = battingOrder.map(name => ({
    name,
    pos: playerPositions?.[name] || '?',
  }))

  const label = outCode === 'G' ? 'Groundout' : outCode === 'FC' ? "Fielder's Choice" : 'Flyout'
  // DP only makes sense for ground balls / FC, and only when there's a runner who could be the 2nd out
  const canDP = (outCode === 'G' || outCode === 'FC') && bases.some(Boolean)
  // TP needs at least 2 runners on base
  const canTP = canDP && bases.filter(Boolean).length >= 2
  // When we're batting, hide the fielder selection (those would be opponent fielders we don't track)
  const showFielders = !hideFielders

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50">
      <div className="bg-white rounded-t-2xl w-full p-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🧤</span>
          <h3 className="font-bold">Record {label}</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {showFielders
            ? 'Tap the fielder who got the out. Tap a second player if there was an assist (they threw it to get the out). Skip if unsure.'
            : 'Toggle Double Play if the opposing team got a second out on this play.'}
        </p>

        {showFielders && (
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
        )}

        {showFielders && putoutPlayer && (
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

        {/* Double-play / Triple-play toggles — only for FC/G with runners on base */}
        {canDP && (
          <div className="mt-3 mb-3 p-2 border-2 border-dashed border-red-300 bg-red-50 rounded-lg space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={doublePlay || triplePlay}
                onChange={e => {
                  setDoublePlay(e.target.checked)
                  if (!e.target.checked) setTriplePlay(false)
                }}
                className="w-4 h-4 accent-red-600"
              />
              <span className="text-sm font-bold text-red-700">⚡ Double Play</span>
              <span className="text-xs text-red-600/80">— records a second out</span>
            </label>
            {canTP && (doublePlay || triplePlay) && (
              <label className="flex items-center gap-2 cursor-pointer pl-6">
                <input
                  type="checkbox"
                  checked={triplePlay}
                  onChange={e => setTriplePlay(e.target.checked)}
                  className="w-4 h-4 accent-red-800"
                />
                <span className="text-sm font-bold text-red-900">⚡⚡ Triple Play</span>
                <span className="text-xs text-red-800/80">— records a third out</span>
              </label>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <button onClick={onSkip} className="btn btn-ghost btn-md flex-1">Skip</button>
          <button
            onClick={() => onConfirm(putoutPlayer, assistPlayer, doublePlay || triplePlay, triplePlay)}
            disabled={showFielders && !putoutPlayer}
            className="btn btn-success btn-md flex-1"
          >
            ✓ Log {triplePlay ? 'Triple ' : doublePlay ? 'Double ' : ''}Play
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

function LastPlayCard({ action, atBats, playLog, onUndo, onEditRbi = null }) {
  const [expanded, setExpanded] = useState(false)
  const meta = OUTCOME_META[action.code] || { label: action.code, bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' }
  const isOut = ['K','F','G','FC','SAC'].includes(action.code)

  // Build the chronological history. At-bats are timestamped via id (Date.now).
  // Newest first.
  const history = [...(atBats || [])].sort((a, b) => b.id - a.id)
  // Build putout/error lookup keyed by batter+inning+half for fielding annotation
  const putoutFor = ab => (playLog || []).find(p =>
    p.type === 'putout' && p.batter === ab.batter && p.inning === ab.inning && p.half === ab.half
  )

  return (
    <div className={`rounded-lg border-l-4 ${meta.border} ${meta.bg} mb-3`}>
      {/* Summary row (latest play) */}
      <div className="p-3 flex gap-3 items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-black text-lg ${meta.text}`}>{action.code}</span>
            <span className="text-sm font-semibold text-gray-700">{action.batter}</span>
            <span className="text-xs text-gray-500">{meta.label}</span>
            {(action.rbi > 0 || onEditRbi) && (
              <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded">
                {action.rbi} RBI
                {onEditRbi && (
                  <>
                    <button
                      onClick={() => onEditRbi(-1)}
                      className="text-amber-500 hover:text-amber-800 font-black leading-none px-0.5"
                      title="Decrease RBI"
                    >−</button>
                    <button
                      onClick={() => onEditRbi(+1)}
                      className="text-amber-500 hover:text-amber-800 font-black leading-none px-0.5"
                      title="Increase RBI"
                    >+</button>
                  </>
                )}
              </span>
            )}
          </div>

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

      {/* Expand toggle */}
      {history.length > 1 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full border-t border-gray-200/60 px-3 py-1.5 text-xs text-gray-500 hover:bg-black/5 flex items-center justify-center gap-1"
        >
          {expanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
          {expanded ? 'Hide' : `Show all ${history.length} plays`}
        </button>
      )}

      {/* Expanded list */}
      {expanded && (
        <div className="border-t border-gray-200/60 max-h-60 overflow-y-auto bg-white/50">
          <ul className="divide-y divide-gray-100">
            {history.map(ab => {
              const m = OUTCOME_META[ab.outcome] || { text: 'text-gray-700' }
              const po = putoutFor(ab)
              return (
                <li key={ab.id} className="px-3 py-1.5 text-xs flex items-center gap-2">
                  <span className="text-gray-400 font-mono text-[10px] w-12 shrink-0">
                    {ab.inning}{ab.half === 'top' ? '▲' : '▼'}
                  </span>
                  <span className={`font-black ${m.text} w-8 shrink-0`}>{ab.outcome}</span>
                  <span className="font-medium text-gray-700 flex-1 truncate">{ab.batter}</span>
                  {ab.rbi > 0 && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1 py-0.5 rounded shrink-0">
                      {ab.rbi} RBI
                    </span>
                  )}
                  {po && (
                    <span className="text-[10px] text-gray-400 shrink-0">
                      {po.fielder}{po.assister ? `·${po.assister}` : ''}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
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

// ── Softball field SVG ────────────────────────────────────────────────────────
// viewBox 280×260  home plate at (140, 250)
const FIELD_W = 280, FIELD_H = 260
const FIELD_HOME = [140, 250]
const FIELD_FIRST  = [210, 180]
const FIELD_SECOND = [140, 151]
const FIELD_THIRD  = [70,  180]
const FIELD_LF = [9,   119]   // left foul line end  (r≈185 at 45° from home)
const FIELD_RF = [271, 119]   // right foul line end

const HIT_COLORS = {
  '1B': '#22c55e', '2B': '#16a34a', '3B': '#15803d', 'HR': '#14532d',
  'F': '#ef4444', 'G': '#dc2626', 'SAC': '#f97316',
  'E': '#f59e0b', 'FC': '#f59e0b',
}

export function SoftballField({ atBats = [], onLocationSelect, size = 280 }) {
  const [loc, setLoc] = useState(null)

  function handleClick(e) {
    if (!onLocationSelect) return
    const svg = e.currentTarget
    const rect = svg.getBoundingClientRect()
    // Convert screen coords → SVG viewBox coords
    const svgX = ((e.clientX - rect.left)  / rect.width)  * FIELD_W
    const svgY = ((e.clientY - rect.top)   / rect.height) * FIELD_H
    const pt = { x: Math.round(svgX), y: Math.round(svgY) }
    setLoc(pt)
    onLocationSelect(pt)
  }

  const displayLoc = loc   // local preview dot while placing

  return (
    <svg
      viewBox={`0 0 ${FIELD_W} ${FIELD_H}`}
      width={size}
      className="w-full"
      style={{ cursor: onLocationSelect ? 'crosshair' : 'default', touchAction: 'none' }}
      onClick={handleClick}
    >
      {/* Outfield grass wedge */}
      <path
        d={`M ${FIELD_HOME[0]},${FIELD_HOME[1]} L ${FIELD_LF[0]},${FIELD_LF[1]} A 185,185 0 0,1 ${FIELD_RF[0]},${FIELD_RF[1]} Z`}
        fill="#86efac" opacity="0.35"
      />
      {/* Infield dirt */}
      <circle cx={140} cy={200} r={73} fill="#d4a264" opacity="0.3" />
      {/* Foul lines */}
      <line x1={FIELD_HOME[0]} y1={FIELD_HOME[1]} x2={FIELD_LF[0]} y2={FIELD_LF[1]} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3" />
      <line x1={FIELD_HOME[0]} y1={FIELD_HOME[1]} x2={FIELD_RF[0]} y2={FIELD_RF[1]} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3" />
      {/* Outfield fence arc */}
      <path d={`M ${FIELD_LF[0]},${FIELD_LF[1]} A 185,185 0 0,1 ${FIELD_RF[0]},${FIELD_RF[1]}`}
        fill="none" stroke="#94a3b8" strokeWidth={1.5} />
      {/* Base paths */}
      <line x1={FIELD_HOME[0]} y1={FIELD_HOME[1]} x2={FIELD_FIRST[0]}  y2={FIELD_FIRST[1]}  stroke="#475569" strokeWidth={1.5} />
      <line x1={FIELD_FIRST[0]}  y1={FIELD_FIRST[1]}  x2={FIELD_SECOND[0]} y2={FIELD_SECOND[1]} stroke="#475569" strokeWidth={1.5} />
      <line x1={FIELD_SECOND[0]} y1={FIELD_SECOND[1]} x2={FIELD_THIRD[0]}  y2={FIELD_THIRD[1]}  stroke="#475569" strokeWidth={1.5} />
      <line x1={FIELD_THIRD[0]}  y1={FIELD_THIRD[1]}  x2={FIELD_HOME[0]}   y2={FIELD_HOME[1]}   stroke="#475569" strokeWidth={1.5} />
      {/* Pitcher's mound */}
      <circle cx={140} cy={200} r={9} fill="#c9a87c" stroke="#a07840" strokeWidth={1} />
      {/* Bases */}
      {[FIELD_FIRST, FIELD_SECOND, FIELD_THIRD].map(([bx, by], i) => (
        <rect key={i} x={bx-6} y={by-6} width={12} height={12}
          transform={`rotate(45,${bx},${by})`}
          fill="white" stroke="#475569" strokeWidth={1.5} />
      ))}
      {/* Home plate */}
      <polygon
        points={`${FIELD_HOME[0]},${FIELD_HOME[1]-9} ${FIELD_HOME[0]-8},${FIELD_HOME[1]-3} ${FIELD_HOME[0]-6},${FIELD_HOME[1]+7} ${FIELD_HOME[0]+6},${FIELD_HOME[1]+7} ${FIELD_HOME[0]+8},${FIELD_HOME[1]-3}`}
        fill="#64748b"
      />
      {/* Saved hit location dots from previous at-bats */}
      {atBats.filter(ab => ab.hitLocation).map(ab => (
        <g key={ab.id}>
          <circle cx={ab.hitLocation.x} cy={ab.hitLocation.y} r={7}
            fill={HIT_COLORS[ab.outcome] || '#6b7280'} opacity={0.7} stroke="white" strokeWidth={1.5} />
        </g>
      ))}
      {/* Current placement preview */}
      {displayLoc && (
        <g>
          <circle cx={displayLoc.x} cy={displayLoc.y} r={10} fill="rgba(239,68,68,0.25)" />
          <circle cx={displayLoc.x} cy={displayLoc.y} r={5}  fill="#ef4444" stroke="white" strokeWidth={2} />
        </g>
      )}
    </svg>
  )
}

// ── Hit location modal ────────────────────────────────────────────────────────
function HitLocationModal({ batter, outcomeCode, onConfirm, onSkip }) {
  const [location, setLocation] = useState(null)
  const isHit = ['1B','2B','3B','HR'].includes(outcomeCode)
  const label = isHit ? 'Where did the ball land?' : 'Where was the ball hit?'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50">
      <div className="bg-white rounded-t-2xl w-full p-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h3 className="font-bold">{label}</h3>
          <span className={`font-black text-sm px-2 py-0.5 rounded text-white`}
            style={{ background: HIT_COLORS[outcomeCode] || '#6b7280' }}>
            {outcomeCode}
          </span>
        </div>
        <p className="text-sm text-gray-600 mb-1 font-medium">{batter}</p>
        <p className="text-xs text-gray-400 mb-3">Tap the field to mark the location · tap again to move it</p>

        <div className="rounded-xl overflow-hidden border border-gray-200 bg-green-900/10 mb-4">
          <SoftballField onLocationSelect={setLocation} />
        </div>

        <div className="flex gap-2">
          <button type="button" onClick={onSkip} className="btn btn-ghost btn-md flex-1">Skip</button>
          <button
            type="button"
            onClick={() => onConfirm(location)}
            disabled={!location}
            className={`btn btn-md flex-1 ${location ? 'btn-success' : 'btn-ghost opacity-50'}`}
          >
            {location ? '✓ Save Location' : 'Tap field first'}
          </button>
        </div>
      </div>
    </div>
  )
}
