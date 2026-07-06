# Optimal Batting Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Given the players playing in a game, suggest a batting order that alternates BBH/SBH and ranks hitters by season performance, exposed as a new "Optimize Order" button next to Game Setup's existing "Auto-arrange" button.

**Architecture:** A pure function `computeOptimalBattingOrder(players, gamesInput)` in `storage.js` scores each player from `computeSeasonStats()`, splits into BBH/SBH streams, shapes each stream (OBP-based leadoff, blended-score-based ordering, weakest last), then interleaves the streams using the same algorithm `GameSetupPage.jsx`'s existing `autoArrangeOrder` already uses. A new button in Game Setup Step 3 calls it and replaces the visible order.

**Tech Stack:** Vite + React (plain JSX), Vitest + @testing-library/react, localStorage-backed `storage.js`.

## Global Constraints

- Batting order must strictly alternate BBH/SBH — this plan must never produce or accept an order that violates this rule any more than `autoArrangeOrder` already does today.
- No TypeScript — plain JSX/JS only.
- `AB >= 5` is the qualifying threshold for using a player's own season stats; below that (or no stats at all) they get the league-average blended score computed from the qualifying players in the same input list.
- Blended score = `(parseFloat(AVG) + parseFloat(OBP) + parseFloat(SLG)) / 3` using the strings `computeSeasonStats()` already returns.
- Leadoff (first in a stream) is chosen by raw OBP, not blended score. Last (final in a stream) is chosen by lowest blended score. Everyone else in between is sorted by blended score descending.
- Fielding lineup, bench, and DH recommendations are explicitly out of scope — batting order only.

---

### Task 1: `computeOptimalBattingOrder` in `storage.js`

**Files:**
- Modify: `src/storage.js` (insert after `computeSituationalStats`, which ends at line 436, before the `// ── BBH vs SBH aggregate batting stats` comment at line 438)
- Test: `src/tests/storage.optimalOrder.test.js` (new)

**Interfaces:**
- Consumes: `computeSeasonStats(gamesInput)` (already exported from `storage.js`) — returns `[{ name, AB, AVG, OBP, SLG, ... }]` where `AVG`/`OBP`/`SLG` are strings like `'.310'` or `'.000'`, `AB` is a number.
- Produces: `export function computeOptimalBattingOrder(players, gamesInput)` where `players` is `[{ name, type }]` (`type` is `'BBH'` or `'SBH'`) and the return value is `string[]` (an ordered list of names). This is the only symbol Task 2 needs from this task.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/storage.optimalOrder.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { saveGame, computeOptimalBattingOrder } from '../storage'

beforeEach(() => localStorage.clear())

// Generates `hits` batter at-bats with outcome '1B' followed by `outs` at-bats
// with outcome 'K', all for the same game/inning — enough for computeSeasonStats
// to derive AB/H/AVG/OBP/SLG. No walks, so AVG === OBP === SLG for these
// fixtures, which keeps the expected blended scores easy to hand-calculate.
function makeAtBats(batter, hits, outs) {
  const atBats = []
  for (let i = 0; i < hits; i++) {
    atBats.push({ id: `${batter}-h${i}`, batter, inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [false, false, false] })
  }
  for (let i = 0; i < outs; i++) {
    atBats.push({ id: `${batter}-o${i}`, batter, inning: 1, half: 'bottom', outcome: 'K', rbi: 0, bases: [false, false, false] })
  }
  return atBats
}

function seedGame(id, ...playerHitOutPairs) {
  const atBats = playerHitOutPairs.flatMap(([name, hits, outs]) => makeAtBats(name, hits, outs))
  saveGame({
    id, date: '2024-05-01', gameType: 'League',
    home: 'Renegades', away: 'Bulls', homeScore: 1, awayScore: 0, result: 'W',
    atBats, playLog: [],
  })
}

// Same alternation check GameSetupPage's validateOrder performs, including
// the wraparound from last batter back to first.
function alternatesFully(order, typeByName) {
  for (let i = 0; i < order.length; i++) {
    const curr = typeByName[order[i]]
    const next = typeByName[order[(i + 1) % order.length]]
    if (curr === next) return false
  }
  return true
}

describe('computeOptimalBattingOrder — ranking within a stream', () => {
  it('ranks qualifying players by blended score, weakest last, all-BBH stream', () => {
    // AB=10 each (qualifies, threshold is AB >= 5). No walks, so AVG=OBP=SLG=blended score.
    seedGame('g1',
      ['Amy', 8, 2],   // AVG/OBP/SLG = .800
      ['Beth', 6, 4],  // .600
      ['Cora', 4, 6],  // .400
      ['Dana', 2, 8],  // .200
    )
    const players = [
      { name: 'Amy', type: 'BBH' }, { name: 'Beth', type: 'BBH' },
      { name: 'Cora', type: 'BBH' }, { name: 'Dana', type: 'BBH' },
    ]
    const order = computeOptimalBattingOrder(players)
    expect(order).toEqual(['Amy', 'Beth', 'Cora', 'Dana'])
  })

  it('picks leadoff by OBP even when another player has a higher blended score', () => {
    // Angela: few AB, many walks → high OBP, low power. AB=5 (qualifies), H=1, BB=10.
    // AVG = 1/5 = .200, OBP = (1+10)/(5+10) = .733, SLG = 1/5 = .200 → blended = .378
    saveGame({
      id: 'g2', date: '2024-05-01', gameType: 'League',
      home: 'Renegades', away: 'Bulls', homeScore: 1, awayScore: 0, result: 'W',
      atBats: [
        { id: 'a-h0', batter: 'Angela', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [false, false, false] },
        ...Array.from({ length: 4 }, (_, i) => ({ id: `a-o${i}`, batter: 'Angela', inning: 1, half: 'bottom', outcome: 'K', rbi: 0, bases: [false, false, false] })),
        ...Array.from({ length: 10 }, (_, i) => ({ id: `a-bb${i}`, batter: 'Angela', inning: 1, half: 'bottom', outcome: 'BB', rbi: 0, bases: [false, false, false] })),
        // Brenda: AB=10, H=5 (3 singles + 2 doubles), no walks.
        // AVG = 5/10 = .500, OBP = 5/10 = .500, SLG = (3 + 2*2)/10 = .700 → blended = .567
        { id: 'b-2b0', batter: 'Brenda', inning: 1, half: 'bottom', outcome: '2B', rbi: 0, bases: [false, false, false] },
        { id: 'b-2b1', batter: 'Brenda', inning: 1, half: 'bottom', outcome: '2B', rbi: 0, bases: [false, false, false] },
        { id: 'b-1b0', batter: 'Brenda', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [false, false, false] },
        { id: 'b-1b1', batter: 'Brenda', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [false, false, false] },
        { id: 'b-1b2', batter: 'Brenda', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [false, false, false] },
        ...Array.from({ length: 5 }, (_, i) => ({ id: `b-o${i}`, batter: 'Brenda', inning: 1, half: 'bottom', outcome: 'K', rbi: 0, bases: [false, false, false] })),
      ],
      playLog: [],
    })
    const players = [{ name: 'Angela', type: 'BBH' }, { name: 'Brenda', type: 'BBH' }]
    const order = computeOptimalBattingOrder(players)
    // Angela has the lower blended score (.378 vs .567) but the higher OBP (.733 vs .500) —
    // she must still be picked leadoff.
    expect(order).toEqual(['Angela', 'Brenda'])
  })
})

describe('computeOptimalBattingOrder — cold-start substitution', () => {
  it('gives a non-qualifying player the league-average score instead of their own', () => {
    // Vet1: AB=10, H=8 → blended .800 (qualifies)
    // Vet2: AB=10, H=2 → blended .200 (qualifies)
    // Rookie: AB=1, H=1 → would be 1.000 on their own numbers, but AB < 5 so they
    // get the average of the qualifying players instead: (.800 + .200) / 2 = .500
    seedGame('g3', ['Vet1', 8, 2], ['Vet2', 2, 8], ['Rookie', 1, 0])
    const players = [
      { name: 'Vet1', type: 'BBH' }, { name: 'Vet2', type: 'BBH' }, { name: 'Rookie', type: 'BBH' },
    ]
    const order = computeOptimalBattingOrder(players)
    // Vet1 leads off (highest OBP, .800, no walks so OBP=AVG here).
    // Vet2 is last (own blended .200 is lower than Rookie's substituted .500).
    // Rookie lands in the middle — not first (their real 1.000 would have topped
    // everyone) and not last (their real 1-for-1 sample is too small to trust).
    expect(order).toEqual(['Vet1', 'Rookie', 'Vet2'])
  })

  it('falls back to a fully deterministic pass-through order when nobody qualifies', () => {
    // No saveGame calls at all — every player has zero season history.
    const players = [
      { name: 'B1', type: 'BBH' }, { name: 'B2', type: 'BBH' },
      { name: 'S1', type: 'SBH' }, { name: 'S2', type: 'SBH' },
    ]
    const order = computeOptimalBattingOrder(players)
    expect(order).toEqual(['B1', 'S1', 'B2', 'S2'])
  })
})

describe('computeOptimalBattingOrder — stream edge cases', () => {
  it('handles a single-player BBH stream with no SBH players at all', () => {
    const order = computeOptimalBattingOrder([{ name: 'Solo', type: 'BBH' }])
    expect(order).toEqual(['Solo'])
  })

  it('handles a single-player SBH stream with no BBH players at all', () => {
    const order = computeOptimalBattingOrder([{ name: 'Solo', type: 'SBH' }])
    expect(order).toEqual(['Solo'])
  })
})

describe('computeOptimalBattingOrder — alternation', () => {
  it('strictly alternates BBH/SBH, including the wraparound, for equal-length streams', () => {
    seedGame('g4', ['Amy', 8, 2], ['Beth', 6, 4], ['Cora', 4, 6])
    seedGame('g5', ['Xena', 7, 3], ['Yara', 5, 5], ['Zoe', 3, 7])
    const players = [
      { name: 'Amy', type: 'BBH' }, { name: 'Beth', type: 'BBH' }, { name: 'Cora', type: 'BBH' },
      { name: 'Xena', type: 'SBH' }, { name: 'Yara', type: 'SBH' }, { name: 'Zoe', type: 'SBH' },
    ]
    const typeByName = Object.fromEntries(players.map(p => [p.name, p.type]))
    const order = computeOptimalBattingOrder(players)
    expect(order).toHaveLength(6)
    expect(alternatesFully(order, typeByName)).toBe(true)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run src/tests/storage.optimalOrder.test.js`
Expected: FAIL — `computeOptimalBattingOrder is not a function` (or similar import error), since it doesn't exist yet.

- [ ] **Step 3: Implement `computeOptimalBattingOrder`**

In `src/storage.js`, insert this immediately after `computeSituationalStats` ends (after the closing `}` on line 436, before the `// ── BBH vs SBH aggregate batting stats` comment):

```js
// ── Optimal batting order: rank players by season performance ────────────
const MIN_AB_FOR_OWN_STATS = 5

export function computeOptimalBattingOrder(players, gamesInput) {
  const seasonStats = computeSeasonStats(gamesInput)
  const statsByName = Object.fromEntries(seasonStats.map(s => [s.name, s]))

  function blendedScore(name) {
    const s = statsByName[name]
    return (parseFloat(s.AVG) + parseFloat(s.OBP) + parseFloat(s.SLG)) / 3
  }

  function qualifies(name) {
    const s = statsByName[name]
    return !!s && s.AB >= MIN_AB_FOR_OWN_STATS
  }

  const qualifying = players.map(p => p.name).filter(qualifies)
  const avgScore = qualifying.length > 0
    ? qualifying.reduce((sum, n) => sum + blendedScore(n), 0) / qualifying.length
    : 0
  const avgObp = qualifying.length > 0
    ? qualifying.reduce((sum, n) => sum + parseFloat(statsByName[n].OBP), 0) / qualifying.length
    : 0

  const scoreFor = name => (qualifies(name) ? blendedScore(name) : avgScore)
  const obpFor = name => (qualifies(name) ? parseFloat(statsByName[name].OBP) : avgObp)

  function shapeStream(stream) {
    if (stream.length <= 1) return stream.slice()

    const working = stream.slice()

    // Leadoff: highest OBP. Ties keep the earliest player (strict `>`), so an
    // all-tied stream (nobody qualifies) leaves the original first player in front.
    let leadoffIdx = 0
    for (let i = 1; i < working.length; i++) {
      if (obpFor(working[i].name) > obpFor(working[leadoffIdx].name)) leadoffIdx = i
    }
    const leadoff = working.splice(leadoffIdx, 1)[0]

    // Last: lowest blended score. Ties keep the latest player (`<=`, not `<`) so
    // that an all-tied remainder collapses back to the true original last player —
    // this is what makes the "nobody qualifies" case a clean pass-through instead
    // of swapping the 2nd and last original players.
    let lastIdx = 0
    for (let i = 1; i < working.length; i++) {
      if (scoreFor(working[i].name) <= scoreFor(working[lastIdx].name)) lastIdx = i
    }
    const last = working.splice(lastIdx, 1)[0]

    const middle = working.sort((a, b) => scoreFor(b.name) - scoreFor(a.name))
    return [leadoff, ...middle, last]
  }

  const bbhShaped = shapeStream(players.filter(p => p.type === 'BBH'))
  const sbhShaped = shapeStream(players.filter(p => p.type === 'SBH'))

  const [first, second] = bbhShaped.length >= sbhShaped.length
    ? [bbhShaped, sbhShaped]
    : [sbhShaped, bbhShaped]

  const result = []
  for (let i = 0; i < Math.max(first.length, second.length); i++) {
    if (first[i]) result.push(first[i].name)
    if (second[i]) result.push(second[i].name)
  }
  return result
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run src/tests/storage.optimalOrder.test.js`
Expected: PASS — 7 tests, 0 failures.

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `npx vitest run`
Expected: All existing tests still pass (no changes to any other function).

- [ ] **Step 6: Commit**

```bash
git add src/storage.js src/tests/storage.optimalOrder.test.js
git commit -m "feat: add computeOptimalBattingOrder for stats-based lineup ranking"
```

---

### Task 2: "Optimize Order" button in Game Setup Step 3

**Files:**
- Modify: `src/pages/GameSetupPage.jsx` (import line 6, new function after `autoArrangeOrder` at line 190, new button in Step 3 JSX around line 460-463)
- Test: `src/tests/GameSetupPage.optimizeOrder.test.jsx` (new)

**Interfaces:**
- Consumes: `computeOptimalBattingOrder(players, gamesInput)` from Task 1 — `players: [{ name, type }]`, returns `string[]`.
- Produces: nothing consumed by later tasks (this is the final task).

- [ ] **Step 1: Write the failing test**

Create `src/tests/GameSetupPage.optimizeOrder.test.jsx`:

```jsx
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GameSetupPage from '../pages/GameSetupPage'
import { saveRoster } from '../storage'

beforeEach(() => localStorage.clear())

function getVisibleOrder() {
  return Array.from(document.querySelectorAll('li')).map(
    li => li.querySelectorAll('span')[1].textContent
  )
}

function reachStep3(playersInClickOrder) {
  render(<GameSetupPage draftKey="test-optimize" onStart={() => {}} onBack={() => {}} />)
  fireEvent.click(screen.getByText('Friendly'))
  fireEvent.change(screen.getByPlaceholderText('Opponent name…'), { target: { value: 'Opponents' } })
  fireEvent.click(screen.getByText('Confirm Details'))
  playersInClickOrder.forEach(name => fireEvent.click(screen.getByText(name)))
  fireEvent.click(screen.getByText('🔒 Lock Players'))
}

describe('GameSetupPage — Optimize Order button', () => {
  it('replaces the visible batting order when clicked', () => {
    saveRoster([
      { id: '1', name: 'Amy', type: 'BBH', active: true },
      { id: '2', name: 'Zoe', type: 'SBH', active: true },
    ])
    // Select Zoe then Amy, so the initial order is ['Zoe', 'Amy'] — still a
    // valid alternation, but not the order computeOptimalBattingOrder produces
    // (which always puts the BBH stream first when stream lengths are equal).
    reachStep3(['Zoe', 'Amy'])
    expect(getVisibleOrder()).toEqual(['Zoe', 'Amy'])

    fireEvent.click(screen.getByText('🧠 Optimize Order'))

    expect(getVisibleOrder()).toEqual(['Amy', 'Zoe'])
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/tests/GameSetupPage.optimizeOrder.test.jsx`
Expected: FAIL — no element found with text "🧠 Optimize Order" (button doesn't exist yet).

- [ ] **Step 3: Add the import**

In `src/pages/GameSetupPage.jsx`, change line 6:

```js
import { getRoster, getTeams, getDivision, getTournaments, rememberTournament, getSetupDraft, saveSetupDraft, clearSetupDraft, getTeamConfig } from '../storage'
```

to:

```js
import { getRoster, getTeams, getDivision, getTournaments, rememberTournament, getSetupDraft, saveSetupDraft, clearSetupDraft, getTeamConfig, computeOptimalBattingOrder } from '../storage'
```

- [ ] **Step 4: Add the `optimizeOrder` function**

In `src/pages/GameSetupPage.jsx`, immediately after `autoArrangeOrder` ends (after the closing `}` on line 190, before `function setPosition(pos, player) {` on line 192), insert:

```js
function optimizeOrder() {
  const players = order.map(name => ({ name, type: rosterMap[name] }))
  setOrder(computeOptimalBattingOrder(players))
  setOrderErr('')
  setOrderOk(false)
}
```

- [ ] **Step 5: Add the button**

In `src/pages/GameSetupPage.jsx`, the Step 3 block currently reads (lines 456-463):

```jsx
            {order.some((name, i) => {
              const prevIdx = (i + order.length - 1) % order.length
              return order.length > 1 && rosterMap[order[prevIdx]] === rosterMap[name]
            }) && (
              <button onClick={autoArrangeOrder} className="btn btn-ghost btn-sm w-full mb-3 border border-gray-200 gap-1">
                🔀 Auto-arrange alternating
              </button>
            )}
```

Add the new button immediately after that closing `)}`, still before `<DndContext`:

```jsx
            {order.some((name, i) => {
              const prevIdx = (i + order.length - 1) % order.length
              return order.length > 1 && rosterMap[order[prevIdx]] === rosterMap[name]
            }) && (
              <button onClick={autoArrangeOrder} className="btn btn-ghost btn-sm w-full mb-3 border border-gray-200 gap-1">
                🔀 Auto-arrange alternating
              </button>
            )}
            <button onClick={optimizeOrder} className="btn btn-ghost btn-sm w-full mb-3 border border-gray-200 gap-1">
              🧠 Optimize Order
            </button>
```

Unlike "Auto-arrange" (only shown when the current order has a clash), "Optimize Order" is always visible once players are locked — it's a performance-based re-rank, not just a clash fix, so it's useful even on an already-valid order.

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/tests/GameSetupPage.optimizeOrder.test.jsx`
Expected: PASS — 1 test, 0 failures.

- [ ] **Step 7: Run the full test suite to check for regressions**

Run: `npx vitest run`
Expected: All tests pass, including the new ones from Task 1 and Task 2.

- [ ] **Step 8: Run the build to check for errors**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 9: Commit**

```bash
git add src/pages/GameSetupPage.jsx src/tests/GameSetupPage.optimizeOrder.test.jsx
git commit -m "feat: add Optimize Order button to Game Setup batting order step"
```
