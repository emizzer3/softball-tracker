import { useState } from 'react'
import { RotateCcw, RotateCw, Users, MapPin, AlertTriangle, BookOpen, StopCircle, ChevronLeft } from 'lucide-react'
import BaseDiamond from '../components/BaseDiamond'
import SacRunsModal from '../components/SacRunsModal'
import RunnerOutModal from '../components/RunnerOutModal'
import PutoutModal from '../components/PutoutModal'
import LastPlayCard from '../components/LastPlayCard'
import OutcomeGuideSheet from '../components/OutcomeGuideSheet'
import FieldingModal from '../components/FieldingModal'
import HitLocationModal from '../components/HitLocationModal'
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
  const [pendingSacRuns, setPendingSacRuns] = useState(0)
  const [showRunnerOut, setShowRunnerOut] = useState(false)
  const [runnerOutMode, setRunnerOutMode] = useState('batting') // 'batting' | 'fielding'

  // weAreHome defaults true for any games saved before this field existed
  const weAreHome = setup.weAreHome !== false
  const isOurBatting = weAreHome ? gs.half === 'bottom' : gs.half === 'top'

  const batter = battingOrder[gs.batterIndex % battingOrder.length]
  const batterPosition = setup.playerPositions?.[batter]
  const batterType = setup.roster.find(p => p.name === batter)?.type
  // When the opponent is batting, `batter` above is just our own upcoming hitter
  // (batting order doesn't advance for opponent at-bats) — use the opponent's
  // team name instead for anything display/log related.
  const opponentName = weAreHome ? setup.away : setup.home
  const displayBatter = isOurBatting ? batter : opponentName

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
    const finalBalls = gs.balls
    const finalStrikes = gs.strikes
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
      batter: displayBatter,
      inning: g.inning,
      half: g.half,
      outcome: code,
      rbi: runs,
      bases: [...newBases],
      hitLocation: hitLocation || null,
      ...(isOurBatting ? { finalBalls, finalStrikes } : { isOpponent: true }),
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
    // Only advance our batting order when WE are batting — opponent at-bats must not skip our lineup
    if (isOurBatting) {
      g.batterIndex = g.done ? g.batterIndex : (g.batterIndex + 1) % battingOrder.length
    }

    setLastAction(prev => ({ ...prev, code, batter: displayBatter, rbi: runs }))
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
        ? [{ type: 'putout', fielder: catcher, assister: null, inning: gs.inning, half: gs.half, outCode: code, batter: displayBatter }]
        : []
      setLastAction({ code, batter: displayBatter, rbi: 0, autoFielder: catcher || null, fielder: null, assister: null })
      finishOutcome(code, extraLog)
    } else if ((code === 'G' || code === 'F') && !isOurBatting) {
      // Putout modal only when WE are fielding — credit our fielder.
      setPendingOutCode(code)
      setShowPutout(true)
    } else if (code === 'SAC' && !isOurBatting) {
      // Need to capture who caught the fly ball for PO credit.
      // Opponent runs scored separately via recordOpponentRun, so pendingSacRuns stays 0.
      setPendingOutCode('SAC')
      setShowPutout(true)
    } else {
      setLastAction({ code, batter: displayBatter, rbi: 0, fielder: null, assister: null, autoFielder: null })
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
      setLastAction({ code, batter: displayBatter, rbi: 0, fielder: null, assister: null, autoFielder: null })
      finishOutcome(code, [], location)
      setPendingHitLoc(null)
    }
  }

  function confirmSacRuns(n) {
    setShowSacRuns(false)
    setLastAction({ code: 'SAC', batter: displayBatter, rbi: n, fielder: null, assister: null, autoFielder: null })
    finishOutcome('SAC', [], pendingSacLoc, n)
    setPendingSacLoc(null)
  }

  function completePutout(fielder, assister, doublePlay = false, triplePlay = false, fielder2 = null, assister2 = null) {
    // SAC fly when fielding: run count was captured before PutoutModal was shown
    if (pendingOutCode === 'SAC') {
      const extraLog = fielder
        ? [{ type: 'putout', fielder, assister: assister || null, inning: gs.inning, half: gs.half, outCode: 'SAC', batter: displayBatter }]
        : []
      setLastAction({ code: 'SAC', batter: displayBatter, rbi: pendingSacRuns, fielder: fielder || null, assister: assister || null, autoFielder: null })
      finishOutcome('SAC', extraLog, pendingSacLoc, pendingSacRuns, false, false)
      setPendingOutCode(null)
      setPendingSacLoc(null)
      setPendingSacRuns(0)
      setShowPutout(false)
      return
    }

    const extraLog = fielder
      ? [{ type: 'putout', fielder, assister: assister || null, inning: gs.inning, half: gs.half, outCode: pendingOutCode, batter: displayBatter, doublePlay, triplePlay }]
      : []

    // Second out (DP/TP) — a runner was thrown out; batter is null since this is a separate out
    if ((doublePlay || triplePlay) && fielder2) {
      extraLog.push({ type: 'putout', fielder: fielder2, assister: assister2 || null, inning: gs.inning, half: gs.half, outCode: pendingOutCode, batter: null })
    }

    setLastAction({ code: pendingOutCode, batter: displayBatter, rbi: 0, fielder: fielder || null, assister: assister || null, autoFielder: null, doublePlay, triplePlay })
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
    const runDelta = newRbi - (last.rbi || 0)
    newAtBats[newAtBats.length - 1] = { ...last, rbi: newRbi }
    const newGs = { ...gs, atBats: newAtBats }
    if (runDelta !== 0) {
      const scoringTeam = last.half === 'top' ? 'away' : 'home'
      if (scoringTeam === 'home') newGs.homeScore = Math.max(0, newGs.homeScore + runDelta)
      else newGs.awayScore = Math.max(0, newGs.awayScore + runDelta)
      const scores = [...newGs.inningScores]
      const idx = last.inning - 1
      scores[idx] = { ...scores[idx], [scoringTeam]: Math.max(0, (scores[idx]?.[scoringTeam] || 0) + runDelta) }
      newGs.inningScores = scores
    }
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

        {/* Line score — runs per inning so far, plus running total */}
        <div className="mt-2 pt-2 border-t border-gray-100 overflow-x-auto">
          <table className="w-full text-[11px] text-center border-collapse">
            <thead>
              <tr className="text-gray-400">
                <th className="text-left font-semibold pr-1 whitespace-nowrap">Inning</th>
                {Array.from({ length: gs.inning }, (_, i) => (
                  <th key={i} className={`px-1 font-semibold ${i + 1 === gs.inning ? 'text-gray-600' : ''}`}>{i + 1}</th>
                ))}
                <th className="px-1 font-bold border-l border-gray-200 text-gray-600">R</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="text-left font-semibold text-gray-500 pr-1 whitespace-nowrap">{setup.away}</td>
                {Array.from({ length: gs.inning }, (_, i) => (
                  <td key={i} className="px-1 text-gray-600">{gs.inningScores[i]?.away || 0}</td>
                ))}
                <td className="px-1 font-bold border-l border-gray-200">{gs.awayScore}</td>
              </tr>
              <tr>
                <td className="text-left font-semibold text-gray-500 pr-1 whitespace-nowrap">{setup.home}</td>
                {Array.from({ length: gs.inning }, (_, i) => (
                  <td key={i} className="px-1 text-gray-600">{gs.inningScores[i]?.home || 0}</td>
                ))}
                <td className="px-1 font-bold border-l border-gray-200">{gs.homeScore}</td>
              </tr>
            </tbody>
          </table>
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
          <div className="flex items-center gap-2 my-2">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[10px] text-gray-400 uppercase tracking-wide">or runner out — batter stays up</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
          <button
            onClick={() => { setRunnerOutMode('fielding'); setShowRunnerOut(true) }}
            className="btn btn-sm w-full flex items-center justify-center gap-2 bg-violet-50 border border-violet-300 text-violet-700 hover:bg-violet-100"
          >
            <span className="text-base">⚡</span>
            <div className="text-left">
              <div className="font-semibold text-sm">CS / Picked Off</div>
              <div className="text-[10px] opacity-70">caught stealing or pickoff · records fielder PO</div>
            </div>
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
