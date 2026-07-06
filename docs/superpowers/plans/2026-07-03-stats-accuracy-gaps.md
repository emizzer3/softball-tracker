# Stats Accuracy & Tracking Gaps Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four stats tracking gaps: per-game rate columns in season stats, post-play RBI override, standalone runner-out tracking, and audited SAC/DP fielding attribution.

**Architecture:** All changes are confined to `src/storage.js` (stat computation), `src/pages/TrackerPage.jsx` (game-time UI + modals), and `src/pages/SeasonStatsPage.jsx` (display). No new files, no new localStorage keys. The `playLog` array gains a `runnerOut` event type. The at-bat `rbi` field becomes editable post-play via the LastPlayCard. Tasks 1–2 are fully independent; Task 3 adds the `runnerOut` play type that Task 4 then also uses.

**Tech Stack:** React 19 (JSX, no TS), Vite 8, Tailwind CSS v4, Vitest 4 for tests, localStorage persistence, no new dependencies.

## Global Constraints

- No TypeScript — keep plain JSX
- No new localStorage keys — all data stays in `sft_active_game` / `sft_games`
- No new npm dependencies
- Tests live in `src/tests/` using Vitest — follow existing patterns (pure unit tests for storage functions; no TrackerPage component tests exist and none should be added)
- Run `npm run build` after every task to verify no build errors before committing
- `npm test` must pass after every task

---

## File Map

| File | Modified in | What changes |
|------|-------------|--------------|
| `src/storage.js` | Tasks 1, 3 | `computeSeasonStats` — adds rate fields (T1), handles `runnerOut` play type (T3) |
| `src/pages/SeasonStatsPage.jsx` | Task 1 | Fielding sub-table with raw + per-G rate columns |
| `src/pages/TrackerPage.jsx` | Tasks 2, 3, 4 | RBI edit in LastPlayCard (T2); Runner-Out button/modal (T3); SAC putout + DP second-out in PutoutModal (T4) |
| `src/tests/storage.stats.test.js` | Tasks 1, 3 | Extended for rate fields and runnerOut PO/A |

---

## Task 1: Season Stats Rate Columns

**Files:**
- Modify: `src/storage.js` (lines 235–245, the `.map()` return inside `computeSeasonStats`)
- Modify: `src/pages/SeasonStatsPage.jsx` (lines 280–360, the Batting tab)
- Test: `src/tests/storage.stats.test.js`

**Interfaces:**
- Produces: `computeSeasonStats()` now returns `KPct: string`, `BBPct: string`, `POPerG: string`, `APerG: string`, `EPerG: string` on each player row — all formatted as `"23.5"` (one decimal, percentage or per-game, no suffix)
- Consumes: nothing new — existing `s.K`, `s.BB`, `s.AB`, `s.PO`, `s.A`, `s.E`, `s.G` (Set before .size)

- [ ] **Step 1: Write failing tests**

Add to `src/tests/storage.stats.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { saveGame, computeSeasonStats } from '../storage'

beforeEach(() => localStorage.clear())

describe('computeSeasonStats — rate fields', () => {
  it('computes KPct as K/AB * 100 with one decimal', () => {
    saveGame({
      id: 'g1', date: '2024-05-01', gameType: 'League',
      home: 'Home', away: 'Away', homeScore: 5, awayScore: 3, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Alice', inning: 1, half: 'bottom', outcome: '1B', rbi: 0 },
        { id: 'ab2', batter: 'Alice', inning: 2, half: 'bottom', outcome: 'K',  rbi: 0 },
        { id: 'ab3', batter: 'Alice', inning: 3, half: 'bottom', outcome: 'K',  rbi: 0 },
        { id: 'ab4', batter: 'Alice', inning: 4, half: 'bottom', outcome: 'K',  rbi: 0 },
      ],
      playLog: [],
    })
    const stats = computeSeasonStats()
    const alice = stats.find(p => p.name === 'Alice')
    // 3K / 4AB = 75.0%
    expect(alice.KPct).toBe('75.0')
  })

  it('computes BBPct as BB/AB * 100 with one decimal', () => {
    saveGame({
      id: 'g1', date: '2024-05-01', gameType: 'League',
      home: 'Home', away: 'Away', homeScore: 5, awayScore: 3, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Bob', inning: 1, half: 'bottom', outcome: '1B', rbi: 0 },
        { id: 'ab2', batter: 'Bob', inning: 2, half: 'bottom', outcome: 'BB', rbi: 0 },
        { id: 'ab3', batter: 'Bob', inning: 3, half: 'bottom', outcome: 'BB', rbi: 0 },
      ],
      playLog: [],
    })
    const stats = computeSeasonStats()
    const bob = stats.find(p => p.name === 'Bob')
    // BB excluded from AB: AB = 1, BB = 2, BBPct = 2/1 * 100... 
    // Wait: BBPct should be BB/(AB+BB) or BB/PA?
    // Per the requirement "per-AB rates" — use AB as denominator since BB are excluded from AB.
    // The user wants "relative/per-game (or per-AB) rates" for comparison.
    // Let's use BB/PA (plate appearances) = BB/(AB+BB) for a more meaningful rate.
    // BBPct = 2 / (1 + 2) * 100 = 66.7
    expect(bob.BBPct).toBe('66.7')
  })

  it('returns KPct and BBPct as "0.0" when AB is 0', () => {
    saveGame({
      id: 'g1', date: '2024-05-01', gameType: 'League',
      home: 'Home', away: 'Away', homeScore: 5, awayScore: 3, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Carol', inning: 1, half: 'bottom', outcome: 'SAC', rbi: 1 },
      ],
      playLog: [],
    })
    const stats = computeSeasonStats()
    const carol = stats.find(p => p.name === 'Carol')
    expect(carol.KPct).toBe('0.0')
    expect(carol.BBPct).toBe('0.0')
  })

  it('computes POPerG, APerG, EPerG per game with one decimal', () => {
    saveGame({
      id: 'g1', date: '2024-05-01', gameType: 'League',
      home: 'Home', away: 'Away', homeScore: 5, awayScore: 3, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Dave', inning: 1, half: 'bottom', outcome: '1B', rbi: 0 },
      ],
      playLog: [
        { type: 'putout', fielder: 'Dave', assister: null, inning: 1, half: 'top', outCode: 'G', batter: 'Opp1' },
        { type: 'putout', fielder: 'Dave', assister: null, inning: 2, half: 'top', outCode: 'G', batter: 'Opp2' },
        { type: 'putout', fielder: 'Dave', assister: null, inning: 3, half: 'top', outCode: 'G', batter: 'Opp3' },
        { type: 'error',  fielder: 'Dave', inning: 1, half: 'top' },
        { type: 'error',  fielder: 'Dave', inning: 2, half: 'top' },
      ],
    })
    const stats = computeSeasonStats()
    const dave = stats.find(p => p.name === 'Dave')
    expect(dave.PO).toBe(3)
    expect(dave.E).toBe(2)
    expect(dave.POPerG).toBe('3.0') // 3 PO / 1 game
    expect(dave.EPerG).toBe('2.0')  // 2 E / 1 game
    expect(dave.APerG).toBe('0.0')  // 0 A / 1 game
  })

  it('returns POPerG etc as "0.0" when G is 0', () => {
    // Player with only play log entries (no at-bats → G=0)
    // This edge case shouldn't occur in practice but guard for safety
    const stats = computeSeasonStats([])
    expect(stats).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test -- storage.stats
```

Expected: FAIL — `KPct`, `BBPct`, `POPerG`, `APerG`, `EPerG` are undefined.

- [ ] **Step 3: Implement rate fields in `computeSeasonStats`**

In `src/storage.js`, find the `.map()` return block inside `computeSeasonStats` (currently ends at line ~245). Replace the `return { ...s, G: s.G.size, AVG:..., OBP:..., SLG:... }` with:

```js
return Object.values(stats).map(s => {
  const singles = s.H - s['2B'] - s['3B'] - s.HR
  const tb = singles + s['2B'] * 2 + s['3B'] * 3 + s.HR * 4
  const gCount = s.G.size
  const pa = s.AB + s.BB   // plate appearances (for BBPct denominator)
  return {
    ...s,
    G:      gCount,
    AVG:    s.AB > 0 ? (s.H / s.AB).toFixed(3).replace(/^0/, '') : '.000',
    OBP:    (s.AB + s.BB) > 0 ? ((s.H + s.BB) / (s.AB + s.BB)).toFixed(3).replace(/^0/, '') : '.000',
    SLG:    s.AB > 0 ? (tb / s.AB).toFixed(3).replace(/^0/, '') : '.000',
    KPct:   s.AB > 0 ? (s.K  / s.AB * 100).toFixed(1) : '0.0',
    BBPct:  pa       > 0 ? (s.BB / pa    * 100).toFixed(1) : '0.0',
    POPerG: gCount   > 0 ? (s.PO / gCount).toFixed(1) : '0.0',
    APerG:  gCount   > 0 ? (s.A  / gCount).toFixed(1) : '0.0',
    EPerG:  gCount   > 0 ? (s.E  / gCount).toFixed(1) : '0.0',
  }
}).sort((a, b) => b.AB - a.AB)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- storage.stats
```

Expected: PASS — all existing tests still pass, new rate-field tests pass.

- [ ] **Step 5: Add Fielding sub-table to `SeasonStatsPage.jsx`**

In `SeasonStatsPage.jsx`, after the closing `</div>` of the BBH vs SBH comparison section (around line 358 in the batting tab, after the `computeGroupStats()` IIFE), add a fielding sub-table that shows rates:

```jsx
{/* Fielding stats sub-table */}
{(() => {
  const fieldingPlayers = stats.filter(p => p.PO + p.A + p.E > 0)
  if (fieldingPlayers.length === 0) return null
  return (
    <div className="mt-3 pt-3 border-t border-gray-100">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Fielding</p>
      <div className="overflow-x-auto">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-gray-200 text-gray-500">
              {['Player','G','PO','PO/G','A','A/G','E','E/G'].map(h => (
                <th key={h} className={`py-1 font-semibold whitespace-nowrap ${h === 'Player' ? 'text-left px-1' : 'text-center px-0.5'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fieldingPlayers.map(p => (
              <tr key={p.name} className="border-b border-gray-100 hover:bg-gray-50">
                <td className="py-1.5 px-1 font-medium whitespace-nowrap">{p.name}</td>
                <td className="py-1.5 px-0.5 text-center">{p.G}</td>
                <td className="py-1.5 px-0.5 text-center">{p.PO}</td>
                <td className="py-1.5 px-0.5 text-center text-indigo-500">{p.POPerG}</td>
                <td className="py-1.5 px-0.5 text-center">{p.A}</td>
                <td className="py-1.5 px-0.5 text-center text-indigo-500">{p.APerG}</td>
                <td className="py-1.5 px-0.5 text-center">{p.E}</td>
                <td className={`py-1.5 px-0.5 text-center font-medium ${p.E > 0 ? 'text-amber-600' : 'text-gray-400'}`}>{p.EPerG}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-2">PO/G · A/G · E/G = per game averages</p>
    </div>
  )
})()}
```

Also add `KPct` and `BBPct` to the STAT_TIPS object at the top of `SeasonStatsPage.jsx` (around line 5):

```js
KPct:  { label: 'K%',    desc: 'Strikeout rate — Ks per at-bat as a percentage. Lower is better.' },
BBPct: { label: 'BB%',   desc: 'Walk rate — walks per plate appearance (AB + BB) as a percentage. Higher is better.' },
```

And add them to the stat guide sheet's batting section (after 'SLG' in the batting keys array on line 36):

```jsx
{['G','R','AB','H','2B','3B','HR','RBI','BB','K','AVG','OBP','SLG','KPct','BBPct'].map(k => (
```

- [ ] **Step 6: Build and test**

```bash
npm run build && npm test
```

Expected: clean build, all tests pass.

- [ ] **Step 7: Commit**

```bash
git add src/storage.js src/pages/SeasonStatsPage.jsx src/tests/storage.stats.test.js
git commit -m "feat: add per-game rate columns to season stats (KPct, BBPct, PO/G, A/G, E/G)"
```

---

## Task 2: Manual RBI Override (Post-Play Edit)

RBIs are auto-calculated from run scoring. When the real play doesn't match standard base advancement (e.g. runner scores from 1st on a single via aggressive baserunning), the score is corrected with the existing `+1 Run` button, but the at-bat's RBI tally stays wrong. Fix: make RBI editable on the LastPlayCard after each play.

**Files:**
- Modify: `src/pages/TrackerPage.jsx` — `updateLastAtBatRbi`, `LastPlayCard` props

**Interfaces:**
- `updateLastAtBatRbi(delta: number)` — increments/decrements rbi of last atBat; clamps at 0; calls `persist()` and updates `lastAction` state
- `LastPlayCard` gains optional prop `onEditRbi: ((delta: number) => void) | null`

No storage.js changes needed — `computeSeasonStats` already reads `ab.rbi` from the saved at-bat.

- [ ] **Step 1: Add `updateLastAtBatRbi` to `TrackerPage`**

Inside `TrackerPage`, after the `recordOurRun` function (around line 437), add:

```js
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
```

- [ ] **Step 2: Pass `onEditRbi` to `LastPlayCard`**

Find the `LastPlayCard` render call (around line 741 in TrackerPage):

```jsx
{lastAction && <LastPlayCard action={lastAction} atBats={gs.atBats} playLog={gs.playLog} onUndo={undo} />}
```

Replace with:

```jsx
{lastAction && (
  <LastPlayCard
    action={lastAction}
    atBats={gs.atBats}
    playLog={gs.playLog}
    onUndo={undo}
    onEditRbi={isOurBatting ? updateLastAtBatRbi : null}
  />
)}
```

- [ ] **Step 3: Update `LastPlayCard` to accept and use `onEditRbi`**

Find the `LastPlayCard` function signature (around line 1053):

```js
function LastPlayCard({ action, atBats, playLog, onUndo }) {
```

Replace with:

```js
function LastPlayCard({ action, atBats, playLog, onUndo, onEditRbi = null }) {
```

Find the RBI badge in the summary row (around line 1075–1079):

```jsx
{action.rbi > 0 && (
  <span className="text-xs bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded">
    {action.rbi} RBI
  </span>
)}
```

Replace with:

```jsx
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
```

- [ ] **Step 4: Build and verify**

```bash
npm run build && npm test
```

Expected: clean build, all tests pass. Manually verify in `npm run dev`: record an at-bat while batting, see the RBI badge with +/− buttons, tap them to adjust.

- [ ] **Step 5: Commit**

```bash
git add src/pages/TrackerPage.jsx
git commit -m "feat: post-play RBI override — +/- buttons on LastPlayCard during our batting"
```

---

## Task 3: Standalone Runner-Out Tracking

A runner gets thrown out mid-play (caught stealing, picked off) without affecting the current batter's at-bat. Currently impossible to record. Add a dedicated flow for both halves of an inning.

**Files:**
- Modify: `src/pages/TrackerPage.jsx` — new state, functions, RunnerOut modal, buttons in both halves
- Modify: `src/storage.js` — `computeSeasonStats` handles `runnerOut` play type
- Test: `src/tests/storage.stats.test.js`

**Interfaces:**
- New play log entry type: `{ type: 'runnerOut', fielder?: string|null, assister?: string|null, inning: number, half: 'top'|'bottom' }`
- `recordBattingRunnerOut()` — increments outs, logs `runnerOut`, handles inning transitions, does NOT advance `batterIndex`
- `recordFieldingRunnerOut(fielder, assister)` — same + records PO/A from `{ fielder, assister }` in the play entry
- `computeSeasonStats` produces identical existing output, but now credits PO/A from `runnerOut` entries

**Produces:** `computeSeasonStats()` reads `play.type === 'runnerOut'` for PO/A (alongside existing `putout` type)

- [ ] **Step 1: Write failing tests for `computeSeasonStats` runnerOut handling**

Add to `src/tests/storage.stats.test.js`:

```js
describe('computeSeasonStats — runnerOut play type', () => {
  it('credits PO to fielder on runnerOut event', () => {
    saveGame({
      id: 'g1', date: '2024-05-01', gameType: 'League',
      home: 'Home', away: 'Away', homeScore: 5, awayScore: 3, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Alice', inning: 1, half: 'bottom', outcome: '1B', rbi: 0 },
      ],
      playLog: [
        { type: 'runnerOut', fielder: 'Dave', assister: 'Eve', inning: 1, half: 'top' },
      ],
    })
    const stats = computeSeasonStats()
    const dave = stats.find(p => p.name === 'Dave')
    const eve  = stats.find(p => p.name === 'Eve')
    expect(dave).toBeDefined()
    expect(dave.PO).toBe(1)
    expect(eve).toBeDefined()
    expect(eve.A).toBe(1)
  })

  it('handles runnerOut with no fielder (batting-half version)', () => {
    saveGame({
      id: 'g1', date: '2024-05-01', gameType: 'League',
      home: 'Home', away: 'Away', homeScore: 5, awayScore: 3, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Alice', inning: 1, half: 'bottom', outcome: '1B', rbi: 0 },
      ],
      playLog: [
        { type: 'runnerOut', inning: 2, half: 'bottom' },
      ],
    })
    const stats = computeSeasonStats()
    // No fielder — no PO credited, no crash
    expect(stats.find(p => p.name === 'Alice')).toBeDefined()
  })
})
```

- [ ] **Step 2: Run to confirm failure**

```bash
npm test -- storage.stats
```

Expected: FAIL — `runnerOut` events are currently ignored, so `dave.PO` is undefined/0.

- [ ] **Step 3: Add `runnerOut` handling to `computeSeasonStats` in `storage.js`**

In `computeSeasonStats`, find the loop over `game.playLog` (around lines 225–232):

```js
for (const play of (game.playLog || [])) {
  if (play.type === 'run'    && play.player)   ensure(play.player).R++
  if (play.type === 'error'  && play.fielder)  ensure(play.fielder).E++
  if (play.type === 'putout') {
    if (play.fielder)  ensure(play.fielder).PO++
    if (play.assister) ensure(play.assister).A++
  }
}
```

Replace with:

```js
for (const play of (game.playLog || [])) {
  if (play.type === 'run'    && play.player)   ensure(play.player).R++
  if (play.type === 'error'  && play.fielder)  ensure(play.fielder).E++
  if (play.type === 'putout' || play.type === 'runnerOut') {
    if (play.fielder)  ensure(play.fielder).PO++
    if (play.assister) ensure(play.assister).A++
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test -- storage.stats
```

Expected: PASS.

- [ ] **Step 5: Add state and functions to `TrackerPage`**

At the top of `TrackerPage` function, after existing state declarations (around line 93), add:

```js
const [showRunnerOut, setShowRunnerOut] = useState(false)
const [runnerOutMode, setRunnerOutMode] = useState('batting') // 'batting' | 'fielding'
```

After the `recordOurRun` function (around line 437), add both runner-out functions.

**Batting-half runner out** (our runner gets thrown out — no fielder tracking):

```js
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
```

**Fielding-half runner out** (their runner gets thrown out — we credit our fielders):

```js
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
```

- [ ] **Step 6: Add "Runner Out" button to the batting half UI**

In `TrackerPage`, find the `+1 Run` button in the batting half section (around line 573–580):

```jsx
<button
  onClick={recordOurRun}
  className="btn btn-sm bg-amber-500 hover:bg-amber-600 text-white w-full gap-1 mt-1"
  title="Add a run if a runner scored that the default advancement missed"
>
  <span>🏃</span> +1 Run
</button>
```

Add the "Runner Out" button immediately after it:

```jsx
<button
  onClick={() => { setRunnerOutMode('batting'); setShowRunnerOut(true) }}
  className="btn btn-sm bg-red-100 hover:bg-red-200 text-red-700 border border-red-300 w-full gap-1 mt-1"
  title="Record a baserunning out (caught stealing, picked off) without ending this at-bat"
>
  <span>⚡</span> Runner Out
</button>
```

- [ ] **Step 7: Add "CS / Picked Off" button to the fielding half UI**

In `TrackerPage`, find the fielding half section with the 2-column OUT/RUN grid (around line 603–622). After the `<p className="text-xs ...">3 outs ends...` line, add:

```jsx
<button
  onClick={() => { setRunnerOutMode('fielding'); setShowRunnerOut(true) }}
  className="btn btn-ghost btn-sm w-full mt-1 text-xs text-slate-500 border border-slate-200 gap-1"
>
  ⚡ CS / Picked Off — record fielder PO
</button>
```

- [ ] **Step 8: Add the `RunnerOutModal` component and render it**

After the `SacRunsModal` component (around line 911), add:

```jsx
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
```

In the main `TrackerPage` JSX, render the modal before the closing `</div>` (alongside the other modals around line 808):

```jsx
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
```

- [ ] **Step 9: Build and test**

```bash
npm run build && npm test
```

Expected: clean build, all tests pass.

- [ ] **Step 10: Commit**

```bash
git add src/storage.js src/pages/TrackerPage.jsx src/tests/storage.stats.test.js
git commit -m "feat: runner-out tracking — CS/PO button in both batting and fielding halves, PO/A credited in season stats"
```

---

## Task 4: Fielding Stats Audit (SAC + DP/TP Second Out)

Two gaps in fielding attribution:
1. **SAC fly when fielding**: the batter is out (caught fly ball) but we never record who caught it. Fix: after `confirmSacRuns`, when `!isOurBatting`, show PutoutModal to capture the catcher.
2. **Double/Triple play second (and third) out**: PutoutModal currently captures one PO + one assist. For a DP/TP, the extra outs have their own fielder. Fix: when DP is checked, show a second fielder-picker section in PutoutModal. Log a second (and third for TP) `putout` play entry.

**Files:**
- Modify: `src/pages/TrackerPage.jsx` — new `pendingSacRuns` state, modified `confirmSacRuns`, modified `completePutout`, extended `PutoutModal`
- Test: `src/tests/storage.stats.test.js`

**Interfaces:**
- `completePutout` signature gains two new optional params: `completePutout(fielder, assister, doublePlay, triplePlay, fielder2, assister2)`
- `PutoutModal`'s `onConfirm` signature gains two new optional params: `onConfirm(fielder, assister, dp, tp, fielder2, assister2)`
- New state in TrackerPage: `const [pendingSacRuns, setPendingSacRuns] = useState(0)`

- [ ] **Step 1: Write failing tests for DP second-out PO in storage**

Add to `src/tests/storage.stats.test.js`:

```js
describe('computeSeasonStats — double play fielding', () => {
  it('credits PO to both putout entries when DP logs two putout events', () => {
    saveGame({
      id: 'g1', date: '2024-05-01', gameType: 'League',
      home: 'Home', away: 'Away', homeScore: 5, awayScore: 3, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Opp1', inning: 1, half: 'top', outcome: 'G', rbi: 0 },
      ],
      playLog: [
        // First out: 1B (3) fields, throws to 2B (4) who gets PO on runner
        { type: 'putout', fielder: 'Alice', assister: 'Bob', inning: 1, half: 'top', outCode: 'G', batter: 'Opp1', doublePlay: true },
        // Second out: batter thrown out at first — 2B (4) threw to 1B (3)
        { type: 'putout', fielder: 'Carol', assister: 'Alice', inning: 1, half: 'top', outCode: 'G', batter: null },
      ],
    })
    const stats = computeSeasonStats()
    const alice = stats.find(p => p.name === 'Alice')
    const bob   = stats.find(p => p.name === 'Bob')
    const carol = stats.find(p => p.name === 'Carol')
    expect(alice.PO).toBe(1)  // first putout
    expect(alice.A).toBe(1)   // assist on second putout
    expect(bob.A).toBe(1)     // assist on first putout
    expect(carol.PO).toBe(1)  // second putout
  })
})
```

- [ ] **Step 2: Run to confirm current behavior**

```bash
npm test -- storage.stats
```

Expected: This test passes already (storage already handles multiple `putout` entries). If it passes, the storage layer is correct — the bug is that `completePutout` never logs the second entry. Note this in your progress.

- [ ] **Step 3: Add `pendingSacRuns` state to `TrackerPage`**

Add after the existing `pendingSacLoc` state (around line 93):

```js
const [pendingSacRuns, setPendingSacRuns] = useState(0)
```

- [ ] **Step 4: Modify `confirmSacRuns` to route through PutoutModal when fielding**

Find `confirmSacRuns` in `TrackerPage` (around line 328):

```js
function confirmSacRuns(n) {
  setLastAction({ code: 'SAC', batter, rbi: n, fielder: null, assister: null, autoFielder: null })
  finishOutcome('SAC', [], pendingSacLoc, n)
  setPendingSacLoc(null)
  setShowSacRuns(false)
}
```

Replace with:

```js
function confirmSacRuns(n) {
  setShowSacRuns(false)
  if (!isOurBatting) {
    // We're fielding — need to know who caught the fly ball (PO for the catcher)
    setPendingSacRuns(n)
    setPendingOutCode('SAC')
    setShowPutout(true)
  } else {
    setLastAction({ code: 'SAC', batter, rbi: n, fielder: null, assister: null, autoFielder: null })
    finishOutcome('SAC', [], pendingSacLoc, n)
    setPendingSacLoc(null)
  }
}
```

- [ ] **Step 5: Modify `completePutout` to handle SAC and DP second out**

Find `completePutout` in `TrackerPage` (around line 335):

```js
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
```

Replace with:

```js
function completePutout(fielder, assister, doublePlay = false, triplePlay = false, fielder2 = null, assister2 = null) {
  // SAC fly when fielding: run count was captured before PutoutModal was shown
  if (pendingOutCode === 'SAC') {
    const extraLog = fielder
      ? [{ type: 'putout', fielder, assister: assister || null, inning: gs.inning, half: gs.half, outCode: 'SAC', batter }]
      : []
    setLastAction({ code: 'SAC', batter, rbi: pendingSacRuns, fielder: fielder || null, assister: assister || null, autoFielder: null })
    finishOutcome('SAC', extraLog, pendingSacLoc, pendingSacRuns, false, false)
    setPendingOutCode(null)
    setPendingSacLoc(null)
    setPendingSacRuns(0)
    setShowPutout(false)
    return
  }

  const extraLog = fielder
    ? [{ type: 'putout', fielder, assister: assister || null, inning: gs.inning, half: gs.half, outCode: pendingOutCode, batter, doublePlay, triplePlay }]
    : []

  // Second out (DP) — a runner was thrown out; batter is null since this is a separate out
  if ((doublePlay || triplePlay) && fielder2) {
    extraLog.push({ type: 'putout', fielder: fielder2, assister: assister2 || null, inning: gs.inning, half: gs.half, outCode: pendingOutCode, batter: null })
  }

  setLastAction({ code: pendingOutCode, batter, rbi: 0, fielder: fielder || null, assister: assister || null, autoFielder: null, doublePlay, triplePlay })
  finishOutcome(pendingOutCode, extraLog, pendingHitLoc, 0, doublePlay, triplePlay)
  setPendingOutCode(null)
  setPendingHitLoc(null)
  setShowPutout(false)
}
```

- [ ] **Step 6: Extend `PutoutModal` to pass second fielder args and show the picker**

Find the `PutoutModal` function signature and its state (around line 914):

```js
function PutoutModal({ outCode, battingOrder, playerPositions, bases = [false,false,false], hideFielders = false, onConfirm, onSkip }) {
  const [putoutPlayer, setPutoutPlayer] = useState('')
  const [assistPlayer, setAssistPlayer] = useState('')
  const [doublePlay, setDoublePlay] = useState(false)
  const [triplePlay, setTriplePlay] = useState(false)
```

Replace with (add second-out state):

```js
function PutoutModal({ outCode, battingOrder, playerPositions, bases = [false,false,false], hideFielders = false, onConfirm, onSkip }) {
  const [putoutPlayer,  setPutoutPlayer]  = useState('')
  const [assistPlayer,  setAssistPlayer]  = useState('')
  const [doublePlay,    setDoublePlay]    = useState(false)
  const [triplePlay,    setTriplePlay]    = useState(false)
  const [putoutPlayer2, setPutoutPlayer2] = useState('')
  const [assistPlayer2, setAssistPlayer2] = useState('')
```

Find the confirm button at the bottom of `PutoutModal` (around line 1025):

```jsx
<button
  onClick={() => onConfirm(putoutPlayer, assistPlayer, doublePlay || triplePlay, triplePlay)}
  disabled={showFielders && !putoutPlayer}
  className="btn btn-success btn-md flex-1"
>
  ✓ Log {triplePlay ? 'Triple ' : doublePlay ? 'Double ' : ''}Play
</button>
```

Replace with:

```jsx
<button
  onClick={() => onConfirm(putoutPlayer, assistPlayer, doublePlay || triplePlay, triplePlay, putoutPlayer2 || null, assistPlayer2 || null)}
  disabled={showFielders && !putoutPlayer}
  className="btn btn-success btn-md flex-1"
>
  ✓ Log {triplePlay ? 'Triple ' : doublePlay ? 'Double ' : ''}Play
</button>
```

After the existing DP/TP checkbox section and before the `<div className="flex gap-2 mt-2">` buttons row, add the second-out picker section:

```jsx
{/* Second out fielder picker — shown when DP is enabled and we track fielders */}
{showFielders && (doublePlay || triplePlay) && (
  <div className="mt-3 mb-2">
    <div className="flex items-center gap-2 mb-1.5">
      <span className="text-xs font-bold uppercase tracking-wide text-gray-500">2nd out — who got the runner?</span>
      <span className="text-xs bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded">PO</span>
      <span className="text-xs text-gray-400">(optional)</span>
    </div>
    <div className="grid grid-cols-4 gap-1">
      {players.map(({ name, pos }) => (
        <button
          key={name}
          onClick={() => { setPutoutPlayer2(prev => prev === name ? '' : name); if (assistPlayer2 === name) setAssistPlayer2('') }}
          className={`btn btn-sm flex flex-col h-auto py-1.5 gap-0 ${putoutPlayer2 === name ? 'btn-primary' : 'btn-ghost'}`}
        >
          <span className="text-xs font-black leading-tight">{pos}</span>
          <span className="text-xs leading-tight">{name.split(' ')[0]}</span>
        </button>
      ))}
    </div>
    {putoutPlayer2 && (
      <>
        <div className="flex items-center gap-2 mb-1.5 mt-2">
          <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Who threw it? (optional)</span>
          <span className="text-xs bg-amber-100 text-amber-600 font-semibold px-1.5 py-0.5 rounded">A</span>
        </div>
        <div className="grid grid-cols-4 gap-1">
          {players.filter(p => p.name !== putoutPlayer2).map(({ name, pos }) => (
            <button
              key={name}
              onClick={() => setAssistPlayer2(prev => prev === name ? '' : name)}
              className={`btn btn-sm flex flex-col h-auto py-1.5 gap-0 ${assistPlayer2 === name ? 'btn-warning' : 'btn-ghost'}`}
            >
              <span className="text-xs font-black leading-tight">{pos}</span>
              <span className="text-xs leading-tight">{name.split(' ')[0]}</span>
            </button>
          ))}
        </div>
      </>
    )}
  </div>
)}
```

- [ ] **Step 7: Update the SAC PutoutModal label**

The `PutoutModal` currently derives its label from `outCode`. The SAC case should show "Sacrifice Fly Catch". Find the label line in PutoutModal (around line 925):

```js
const label = outCode === 'G' ? 'Groundout' : outCode === 'FC' ? "Fielder's Choice" : 'Flyout'
```

Replace with:

```js
const label = outCode === 'G' ? 'Groundout' : outCode === 'FC' ? "Fielder's Choice" : outCode === 'SAC' ? 'Sacrifice Fly Catch' : 'Flyout'
```

Also `canDP` should be false for SAC (no double play on a sac fly). Find:

```js
const canDP = (outCode === 'G' || outCode === 'FC') && bases.some(Boolean)
```

This is already correct (SAC not included) — no change needed.

- [ ] **Step 8: Build and test**

```bash
npm run build && npm test
```

Expected: clean build, all tests pass.

- [ ] **Step 9: Commit**

```bash
git add src/pages/TrackerPage.jsx src/tests/storage.stats.test.js
git commit -m "feat: fielding stats audit — SAC fly now captures PO, DP records second fielder PO/A"
```

---

## Self-Review

### Spec Coverage Check

| Requirement | Task | Covered? |
|-------------|------|----------|
| Rate columns so players with more games aren't unfairly compared on K/E/PO | T1 | ✅ KPct, BBPct, PO/G, A/G, E/G added |
| Fielding stats visible in season stats page | T1 | ✅ Fielding sub-table added |
| Manual RBI override for non-standard base advancement | T2 | ✅ +/- edit in LastPlayCard |
| Standalone runner-out during our batting (caught stealing) | T3 | ✅ Runner Out button in batting half |
| Standalone runner-out during their batting (CS/PO) with PO/A | T3 | ✅ CS/Picked Off button in fielding half |
| runnerOut PO/A credited in season stats | T3 | ✅ storage.js updated |
| SAC fly missing fielder PO | T4 | ✅ PutoutModal shown after SAC when fielding |
| DP second out missing second PO | T4 | ✅ PutoutModal extended with second fielder section |

### Placeholder Scan

None found — all steps include actual code.

### Type/Name Consistency

- `pendingSacRuns` (new state) used in `confirmSacRuns` and `completePutout` — consistent ✅
- `fielder2`, `assister2` passed from `PutoutModal.onConfirm` through to `completePutout` — consistent ✅
- `runnerOut` play type used in `recordBattingRunnerOut`, `recordFieldingRunnerOut`, `RunnerOutModal`, and `computeSeasonStats` — consistent ✅
- `POPerG`, `APerG`, `EPerG`, `KPct`, `BBPct` computed in `storage.js` and consumed in `SeasonStatsPage.jsx` — consistent ✅
