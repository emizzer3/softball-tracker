# Team Tactics Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add team-level situational hitting stats (RISP AVG, runners left on base, GIDP count) to Season Stats, and reorganize the Season Stats tabs from `Batting / Trends / Insights` into `Batting / Team / Players / Trends` so the new content has a clear home.

**Architecture:** One new pure function in `storage.js` (`computeSituationalStats`) computes everything from data already recorded on `game.atBats` and `game.playLog` — no changes to game-tracking logic in `TrackerPage.jsx`. `SeasonStatsPage.jsx` gets a new `team` tab (absorbing two chart sections moved out of `trends`) and the existing `insights` tab is renamed to `players` with no content changes.

**Tech Stack:** React (JSX), Vitest + Testing Library, no new dependencies.

## Global Constraints

- No changes to `TrackerPage.jsx` or any game-tracking logic — this is a stats/display-only feature built entirely on data already recorded.
- No GIDP rate/denominator, no fielding-errors-by-position — out of scope per the spec.
- The pre-existing gap where caught-stealing/pickoff doesn't clear the specific runner from `bases` is a documented known limitation, not fixed here.
- Follow the existing code style in `storage.js` (plain functions, `.toFixed(3).replace(/^0/, '')` for AVG-style formatting) and `SeasonStatsPage.jsx` (Tailwind utility classes, existing color/spacing conventions).

Full design reference: `docs/superpowers/specs/2026-07-06-team-tactics-insights-design.md`

---

### Task 1: `computeSituationalStats()` in storage.js

**Files:**
- Modify: `src/storage.js` (add function after `computeRunsPerGame`, currently ending at line 358)
- Test: Create `src/tests/storage.situational.test.js`

**Interfaces:**
- Produces: `computeSituationalStats(gamesInput?)` → `{ team: { rispAB, rispH, rispAvg, overallAvg, lobTotal, lobPerGame, gidpCount }, players: [{ name, rispAB, rispH, rispAvg }] }`. `players` is sorted by `rispAvg` descending. `gamesInput` is optional, same convention as `computeRunsPerGame`/`computeSeasonStats` (defaults to `getGames()`).

- [ ] **Step 1: Write the failing tests**

Create `src/tests/storage.situational.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { saveGame, computeSituationalStats } from '../storage'

beforeEach(() => localStorage.clear())

describe('computeSituationalStats — RISP', () => {
  it('counts an at-bat as RISP when 2nd or 3rd was occupied before the play', () => {
    saveGame({
      id: 'g1', date: '2024-05-01', gameType: 'League',
      home: 'Renegades', away: 'Bulls', homeScore: 2, awayScore: 0, result: 'W',
      atBats: [
        // bases empty before Alice — not RISP
        { id: 'ab1', batter: 'Alice', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [true, false, false] },
        // 1st occupied only before Bob — not RISP. Bob's own after-play bases (2nd+3rd
        // occupied) is what makes Carol's at-bat RISP-eligible next, since `bases` always
        // records post-play state.
        { id: 'ab2', batter: 'Bob', inning: 1, half: 'bottom', outcome: 'G', rbi: 0, bases: [false, true, true] },
        // 2nd+3rd occupied before Carol — RISP, out (no hit)
        { id: 'ab3', batter: 'Carol', inning: 1, half: 'bottom', outcome: 'K', rbi: 0, bases: [false, true, true] },
        // 2nd+3rd still occupied before Dave — RISP, hit
        { id: 'ab4', batter: 'Dave', inning: 1, half: 'bottom', outcome: '1B', rbi: 1, bases: [true, true, false] },
      ],
      playLog: [],
    })
    const { team, players } = computeSituationalStats()
    expect(team.rispAB).toBe(2)
    expect(team.rispH).toBe(1)
    expect(team.rispAvg).toBe('.500')
    expect(players).toEqual([
      { name: 'Dave', rispAB: 1, rispH: 1, rispAvg: '1.000' },
      { name: 'Carol', rispAB: 1, rispH: 0, rispAvg: '.000' },
    ])
  })

  it('excludes opponent at-bats from RISP', () => {
    saveGame({
      id: 'g2', date: '2024-05-08', gameType: 'League',
      home: 'Renegades', away: 'Eagles', homeScore: 1, awayScore: 0, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Eagles', inning: 1, half: 'top', outcome: '1B', rbi: 0, bases: [true, false, false], isOpponent: true },
        { id: 'ab2', batter: 'Eagles', inning: 1, half: 'top', outcome: '1B', rbi: 0, bases: [false, true, true], isOpponent: true },
      ],
      playLog: [],
    })
    const { team } = computeSituationalStats()
    expect(team.rispAB).toBe(0)
  })

  it('resets bases to empty across a half-inning boundary', () => {
    saveGame({
      id: 'g3', date: '2024-05-15', gameType: 'League',
      home: 'Renegades', away: 'Bulls', homeScore: 1, awayScore: 0, result: 'W',
      atBats: [
        // bottom of inning 1 ends with runners on — would look like RISP-before for the next at-bat if not reset
        { id: 'ab1', batter: 'Alice', inning: 1, half: 'bottom', outcome: '2B', rbi: 0, bases: [false, true, true] },
        // bottom of inning 2 — new half-inning, bases must be treated as empty even though ab1.bases had runners
        { id: 'ab2', batter: 'Bob', inning: 2, half: 'bottom', outcome: '1B', rbi: 0, bases: [true, false, false] },
      ],
      playLog: [],
    })
    const { team } = computeSituationalStats()
    expect(team.rispAB).toBe(0) // Bob's at-bat is not RISP — bases reset between innings
  })

  it('excludes BB/HBP/SAC from RISP AB count', () => {
    saveGame({
      id: 'g4', date: '2024-05-22', gameType: 'League',
      home: 'Renegades', away: 'Bulls', homeScore: 1, awayScore: 0, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Alice', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [false, true, false] },
        { id: 'ab2', batter: 'Bob', inning: 1, half: 'bottom', outcome: 'BB', rbi: 0, bases: [true, true, false] },
      ],
      playLog: [],
    })
    const { team } = computeSituationalStats()
    expect(team.rispAB).toBe(0) // Alice: bases empty before her. Bob: BB excluded from AB.
  })
})

describe('computeSituationalStats — LOB', () => {
  it('counts runners on base at the last at-bat of each of our half-innings', () => {
    saveGame({
      id: 'g5', date: '2024-06-01', gameType: 'League',
      home: 'Renegades', away: 'Bulls', homeScore: 3, awayScore: 0, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Alice', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [true, false, false] },
        { id: 'ab2', batter: 'Bob', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [true, true, false] },
        { id: 'ab3', batter: 'Carol', inning: 1, half: 'bottom', outcome: 'K', rbi: 0, bases: [true, true, false] },
        // inning 2: nobody left on
        { id: 'ab4', batter: 'Dave', inning: 2, half: 'bottom', outcome: 'K', rbi: 0, bases: [false, false, false] },
      ],
      playLog: [],
    })
    const { team } = computeSituationalStats()
    expect(team.lobTotal).toBe(2) // 1st + 2nd left on base at end of inning 1
    expect(team.lobPerGame).toBe(2)
  })
})

describe('computeSituationalStats — GIDP', () => {
  it('counts a double play once from the tagged playLog entry', () => {
    saveGame({
      id: 'g6', date: '2024-06-08', gameType: 'League',
      home: 'Renegades', away: 'Bulls', homeScore: 1, awayScore: 0, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Alice', inning: 1, half: 'bottom', outcome: 'G', rbi: 0, bases: [false, false, false] },
      ],
      playLog: [
        { type: 'putout', fielder: 'SS', assister: '2B', inning: 1, half: 'bottom', outCode: 'G', batter: 'Alice', doublePlay: true },
        { type: 'putout', fielder: '1B', assister: null, inning: 1, half: 'bottom', outCode: 'G', batter: null },
      ],
    })
    const { team } = computeSituationalStats()
    expect(team.gidpCount).toBe(1)
  })

  it('counts a triple play the same way', () => {
    saveGame({
      id: 'g7', date: '2024-06-15', gameType: 'League',
      home: 'Renegades', away: 'Bulls', homeScore: 1, awayScore: 0, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Bob', inning: 1, half: 'bottom', outcome: 'G', rbi: 0, bases: [false, false, false] },
      ],
      playLog: [
        { type: 'putout', fielder: 'SS', assister: '2B', inning: 1, half: 'bottom', outCode: 'G', batter: 'Bob', triplePlay: true },
        { type: 'putout', fielder: '1B', assister: null, inning: 1, half: 'bottom', outCode: 'G', batter: null },
        { type: 'putout', fielder: '3B', assister: null, inning: 1, half: 'bottom', outCode: 'G', batter: null },
      ],
    })
    const { team } = computeSituationalStats()
    expect(team.gidpCount).toBe(1)
  })
})

describe('computeSituationalStats — empty state', () => {
  it('returns zeroed team stats and empty players array with no games', () => {
    const { team, players } = computeSituationalStats()
    expect(team).toEqual({
      rispAB: 0, rispH: 0, rispAvg: '.000', overallAvg: '.000',
      lobTotal: 0, lobPerGame: 0, gidpCount: 0,
    })
    expect(players).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/storage.situational.test.js`
Expected: FAIL — `computeSituationalStats is not a function` (or similar import error), since it doesn't exist yet.

- [ ] **Step 3: Implement `computeSituationalStats` in storage.js**

Add after `computeRunsPerGame` (after line 358, which currently ends the file):

```js

// ── Situational team hitting: RISP / LOB / GIDP (for Team tab) ───────────
export function computeSituationalStats(gamesInput) {
  const games = gamesInput || getGames()

  let totalAB = 0, totalH = 0
  let rispAB = 0, rispH = 0
  let lobTotal = 0, lobGames = 0
  let gidpCount = 0
  const playerRisp = {}

  function ensurePlayer(name) {
    if (!playerRisp[name]) playerRisp[name] = { AB: 0, H: 0 }
    return playerRisp[name]
  }

  for (const game of games) {
    const atBats = game.atBats || []
    const lastOurAtBatByHalf = {}
    let gameHasOurAtBat = false

    atBats.forEach((ab, i) => {
      if (ab.isOpponent) return
      gameHasOurAtBat = true

      const prev = atBats[i - 1]
      const basesBefore = (prev && prev.inning === ab.inning && prev.half === ab.half)
        ? prev.bases
        : [false, false, false]

      const isAB = !['BB', 'HBP', 'SAC'].includes(ab.outcome)
      const isHit = ['1B', '2B', '3B', 'HR'].includes(ab.outcome)

      if (isAB) {
        totalAB++
        if (isHit) totalH++

        if (basesBefore[1] || basesBefore[2]) {
          rispAB++
          const p = ensurePlayer(ab.batter)
          p.AB++
          if (isHit) { rispH++; p.H++ }
        }
      }

      lastOurAtBatByHalf[`${ab.inning}-${ab.half}`] = ab
    })

    if (gameHasOurAtBat) lobGames++
    for (const key in lastOurAtBatByHalf) {
      lobTotal += lastOurAtBatByHalf[key].bases.filter(Boolean).length
    }

    for (const play of (game.playLog || [])) {
      if (play.type === 'putout' && (play.doublePlay || play.triplePlay) && play.batter) {
        gidpCount++
      }
    }
  }

  const fmtAvg = n => n.toFixed(3).replace(/^0/, '')

  const players = Object.entries(playerRisp)
    .map(([name, s]) => ({ name, rispAB: s.AB, rispH: s.H, rispAvg: fmtAvg(s.H / s.AB) }))
    .sort((a, b) => parseFloat(b.rispAvg) - parseFloat(a.rispAvg))

  return {
    team: {
      rispAB, rispH,
      rispAvg: rispAB > 0 ? fmtAvg(rispH / rispAB) : '.000',
      overallAvg: totalAB > 0 ? fmtAvg(totalH / totalAB) : '.000',
      lobTotal,
      lobPerGame: lobGames > 0 ? +(lobTotal / lobGames).toFixed(1) : 0,
      gidpCount,
    },
    players,
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/tests/storage.situational.test.js`
Expected: PASS — all tests in the new file green.

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `npm test`
Expected: All existing test files still pass (this is a pure addition, nothing else imports or calls this function yet).

- [ ] **Step 6: Commit**

```bash
git add src/storage.js src/tests/storage.situational.test.js
git commit -m "feat: add computeSituationalStats for RISP/LOB/GIDP team stats"
```

---

### Task 2: Rename "Insights" tab to "Players"

Pure rename, no content change. Sets up for Task 3 to insert the new "Team" tab without also renaming things in the same diff.

**Files:**
- Modify: `src/pages/SeasonStatsPage.jsx:271-276` (tab button), `src/pages/SeasonStatsPage.jsx:620-621` (section comment + condition)
- Modify: `src/tests/SeasonStatsPage.coaching.test.jsx:36,52` (test button-click targets)

**Interfaces:**
- Consumes: nothing new
- Produces: `activeTab` state now uses `'players'` instead of `'insights'` as the third tab's value; button label reads "💡 Players"

- [ ] **Step 1: Rename the tab button**

In `src/pages/SeasonStatsPage.jsx`, find:

```jsx
              <button
                onClick={() => setActiveTab('insights')}
                className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${activeTab === 'insights' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                💡 Insights
              </button>
```

Replace with:

```jsx
              <button
                onClick={() => setActiveTab('players')}
                className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${activeTab === 'players' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                💡 Players
              </button>
```

- [ ] **Step 2: Rename the tab body condition**

In the same file, find:

```jsx
          {/* Insights tab */}
          {activeTab === 'insights' && (() => {
```

Replace with:

```jsx
          {/* Players tab */}
          {activeTab === 'players' && (() => {
```

- [ ] **Step 3: Update the existing test file's button-click targets**

In `src/tests/SeasonStatsPage.coaching.test.jsx`, there are two occurrences of:

```js
    fireEvent.click(screen.getByText('💡 Insights'))
```

Replace both with:

```js
    fireEvent.click(screen.getByText('💡 Players'))
```

(These are inside the `'shows 🔥 for a player on a hot streak'`, `'shows 🥶 for a player in a cold streak'`, and `'shows no badge when fewer than 3 games played'` tests in the `hot/cold streak badge` describe block.)

- [ ] **Step 4: Run the test suite to verify the rename didn't break anything**

Run: `npm test`
Expected: All tests pass, including the three streak-badge tests which now click "💡 Players" instead of "💡 Insights".

- [ ] **Step 5: Commit**

```bash
git add src/pages/SeasonStatsPage.jsx src/tests/SeasonStatsPage.coaching.test.jsx
git commit -m "refactor: rename Insights tab to Players in Season Stats"
```

---

### Task 3: Add "Team" tab shell, move Runs/Hits-by-Type charts from Trends

**Files:**
- Modify: `src/pages/SeasonStatsPage.jsx` (tab button bar, ~lines 258-277 after Task 2; whole Trends block, lines 439-618)
- Modify: `src/tests/SeasonStatsPage.coaching.test.jsx` (the `runs per game chart` describe block)

**Interfaces:**
- Consumes: `computeRunsPerGame()` (existing, from `storage.js`)
- Produces: new `activeTab === 'team'` tab containing the "Runs Scored vs Allowed" and "Hits by Type per Game" charts (moved as-is). Trends tab keeps only the spray charts. Task 4 will append the new RISP/LOB/GIDP content to the end of this Team tab's returned JSX.

- [ ] **Step 1: Reorder and add the tab button**

Find the button group (state after Task 2 — order is Batting, Trends, Players):

```jsx
              <button
                onClick={() => setActiveTab('batting')}
                className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${activeTab === 'batting' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                ⚾ Batting
              </button>
              <button
                onClick={() => setActiveTab('trends')}
                className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${activeTab === 'trends' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                📈 Trends
              </button>
              <button
                onClick={() => setActiveTab('players')}
                className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${activeTab === 'players' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                💡 Players
              </button>
```

Replace with (reordered to Batting, Team, Players, Trends):

```jsx
              <button
                onClick={() => setActiveTab('batting')}
                className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${activeTab === 'batting' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                ⚾ Batting
              </button>
              <button
                onClick={() => setActiveTab('team')}
                className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${activeTab === 'team' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                🎯 Team
              </button>
              <button
                onClick={() => setActiveTab('players')}
                className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${activeTab === 'players' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                💡 Players
              </button>
              <button
                onClick={() => setActiveTab('trends')}
                className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${activeTab === 'trends' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                📈 Trends
              </button>
```

- [ ] **Step 2: Replace the whole Trends block with a new Team block + slimmed Trends block**

Find the entire block starting at `{/* Trends tab */}` through its closing `})()}`  (currently lines 438-618 — the whole `activeTab === 'trends'` IIFE, including the "Runs per game" and "Batting spread" sections):

```jsx
          {/* Trends tab */}
          {activeTab === 'trends' && (() => {
            const runs = computeRunsPerGame()
            const sortedGames = games.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''))
            const battingByGame = sortedGames
              .filter(g => g.atBats?.length > 0)
              .map(g => {
                const abs = (g.atBats || []).filter(ab => !ab.isOpponent)
                const singles = abs.filter(ab => ab.outcome === '1B').length
                const doubles = abs.filter(ab => ab.outcome === '2B').length
                const triples = abs.filter(ab => ab.outcome === '3B').length
                const hrs     = abs.filter(ab => ab.outcome === 'HR').length
                return { gameId: g.id, date: g.date, singles, doubles, triples, hrs, total: singles + doubles + triples + hrs, result: g.result }
              })

            // Spray chart data: collect all hit dots across all games (include batter for interactivity)
            const allDots = sortedGames.flatMap(g =>
              (g.atBats || []).filter(ab => ab.hitLocation && !ab.isOpponent).map(ab => ({ x: ab.hitLocation.x, y: ab.hitLocation.y, outcome: ab.outcome, batter: ab.batter }))
            )
            const sprayBatters = [...new Set(allDots.map(d => d.batter).filter(Boolean))]
            const perGameSpray = sortedGames
              .filter(g => (g.atBats || []).some(ab => ab.hitLocation && !ab.isOpponent))
              .map(g => ({
                gameId: g.id,
                date: g.date,
                opponent: g.setup?.weAreHome !== false ? g.away : g.home,
                result: g.result,
                dots: (g.atBats || []).filter(ab => ab.hitLocation && !ab.isOpponent).map(ab => ({ x: ab.hitLocation.x, y: ab.hitLocation.y, outcome: ab.outcome, batter: ab.batter })),
              }))

            const maxRuns = runs.length > 0 ? Math.max(...runs.map(g => Math.max(g.ourRuns, g.theirRuns)), 1) : 1
            const maxHits = battingByGame.length > 0 ? Math.max(...battingByGame.map(g => g.total), 1) : 1
            const BAR_H = 100

            return (
              <div className="space-y-6">
                {/* Runs per game */}
                {runs.length >= 2 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Runs Scored vs Allowed</p>
                    <div className="grid items-end gap-1" style={{ height: BAR_H + 44, gridTemplateColumns: `repeat(${runs.length}, 1fr)` }}>
                      {runs.map(g => {
                        const ourH    = Math.max(Math.round((g.ourRuns   / maxRuns) * BAR_H), 4)
                        const theirH  = Math.max(Math.round((g.theirRuns / maxRuns) * BAR_H), 4)
                        const barColor = g.result === 'W' ? '#22c55e' : g.result === 'L' ? '#f87171' : '#9ca3af'
                        const active = tappedBar === g.gameId
                        return (
                          <div
                            key={g.gameId}
                            className="flex flex-col items-center cursor-pointer self-end"
                            onClick={() => setTappedBar(active ? null : g.gameId)}
                          >
                            <span className="text-[10px] font-bold text-gray-600 leading-none mb-1">{g.ourRuns}–{g.theirRuns}</span>
                            <div className="flex items-end gap-px w-full justify-center" style={{ height: BAR_H }}>
                              <div className="flex-1 rounded-t-sm transition-all" style={{ height: ourH, backgroundColor: barColor, opacity: active ? 1 : 0.8 }} />
                              <div className="flex-1 rounded-t-sm bg-gray-200 transition-all" style={{ height: theirH, opacity: active ? 1 : 0.6 }} />
                            </div>
                            <span className="text-[10px] text-gray-400 leading-tight mt-1 text-center w-full truncate">{g.date.slice(5)}</span>
                            <span className="text-[9px] text-gray-300 leading-none text-center w-full truncate">{g.opponent}</span>
                            {active && (
                              <span className={`text-[9px] font-bold mt-0.5 ${g.result === 'W' ? 'text-green-600' : g.result === 'L' ? 'text-red-500' : 'text-gray-500'}`}>
                                {g.result === 'W' ? 'Win' : g.result === 'L' ? 'Loss' : 'Draw'}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex gap-4 mt-1.5 text-[10px] text-gray-400">
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm bg-green-500" />Us (W)</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm bg-red-400" />Us (L)</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm bg-gray-200" />Them</span>
                    </div>
                  </div>
                )}

                {/* Batting spread — hit type breakdown per game */}
                {battingByGame.length >= 2 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Hits by Type per Game</p>
                    <div className="grid items-end gap-1" style={{ height: BAR_H + 44, gridTemplateColumns: `repeat(${battingByGame.length}, 1fr)` }}>
                      {battingByGame.map(g => {
                        const totalH  = Math.max(Math.round((g.total / maxHits) * BAR_H), 4)
                        const hrsH    = g.total > 0 ? Math.round((g.hrs     / g.total) * totalH) : 0
                        const triH    = g.total > 0 ? Math.round((g.triples / g.total) * totalH) : 0
                        const dblH    = g.total > 0 ? Math.round((g.doubles / g.total) * totalH) : 0
                        const sngH    = Math.max(totalH - hrsH - triH - dblH, 0)
                        const active = tappedBar === g.gameId
                        return (
                          <div
                            key={g.gameId}
                            className="flex flex-col items-center cursor-pointer self-end"
                            onClick={() => setTappedBar(active ? null : g.gameId)}
                          >
                            <span className="text-[10px] font-bold text-gray-600 leading-none mb-1">{g.total}</span>
                            <div className="flex flex-col-reverse rounded-t-sm overflow-hidden w-full transition-all" style={{ height: Math.max(totalH, 4), opacity: active ? 1 : 0.8 }}>
                              {sngH > 0 && <div style={{ height: sngH, backgroundColor: '#bae6fd' }} />}
                              {dblH > 0 && <div style={{ height: dblH, backgroundColor: '#3b82f6' }} />}
                              {triH > 0 && <div style={{ height: triH, backgroundColor: '#7c3aed' }} />}
                              {hrsH > 0 && <div style={{ height: hrsH, backgroundColor: '#f59e0b' }} />}
                            </div>
                            <span className="text-[10px] text-gray-400 leading-tight mt-1 text-center w-full truncate">{g.date.slice(5)}</span>
                            <span className={`text-[9px] font-bold leading-none ${g.result === 'W' ? 'text-green-500' : g.result === 'L' ? 'text-red-400' : 'text-gray-400'}`}>{g.result}</span>
                            {active && (
                              <span className="text-[9px] text-gray-500 mt-0.5">{g.singles}×1B {g.doubles}×2B {g.triples}×3B {g.hrs}×HR</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex gap-4 mt-1.5 text-[10px] text-gray-400">
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm" style={{ backgroundColor: '#bae6fd' }} />1B</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm" style={{ backgroundColor: '#3b82f6' }} />2B</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm" style={{ backgroundColor: '#7c3aed' }} />3B</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm" style={{ backgroundColor: '#f59e0b' }} />HR</span>
                    </div>
                  </div>
                )}

                {/* Season spray chart — aggregate with player filter */}
                {allDots.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Season Spray Chart</p>
                    {sprayBatters.length > 1 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        <button
                          onClick={() => { setSprayFilter(null); setSelectedDot(null) }}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${!sprayFilter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >All</button>
                        {sprayBatters.sort().map(name => (
                          <button
                            key={name}
                            onClick={() => { setSprayFilter(sprayFilter === name ? null : name); setSelectedDot(null) }}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${sprayFilter === name ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                          >{name}</button>
                        ))}
                      </div>
                    )}
                    <div className="max-w-sm mx-auto">
                      <SprayDiamond
                        dots={allDots}
                        highlightBatter={sprayFilter}
                        onDotTap={(i) => setSelectedDot(selectedDot === i ? null : i)}
                        selectedIdx={selectedDot}
                      />
                    </div>
                    <div className="flex flex-wrap justify-center gap-3 mt-2 text-[10px] text-gray-400">
                      {[['#22c55e','1B'],['#16a34a','2B'],['#15803d','3B'],['#052e16','HR'],['#ef4444','Flyout'],['#dc2626','Ground'],['#f59e0b','E/FC']].map(([c,l]) => (
                        <span key={l} className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm" style={{ backgroundColor: c }} />{l}</span>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-300 text-center mt-1">
                      {sprayFilter ? `${allDots.filter(d => d.batter === sprayFilter).length} hits by ${sprayFilter}` : `${allDots.length} hit${allDots.length !== 1 ? 's' : ''} across ${perGameSpray.length} game${perGameSpray.length !== 1 ? 's' : ''}`}
                      {' · tap a dot for details'}
                    </p>
                  </div>
                )}

                {/* Per-game spray chart grid */}
                {perGameSpray.length >= 2 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Spray Chart by Game</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {perGameSpray.map(g => (
                        <div key={g.gameId} className="border border-gray-100 rounded-lg p-1.5">
                          <SprayDiamond dots={g.dots} highlightBatter={sprayFilter} label={`${g.date.slice(5)} vs ${g.opponent}`} />
                          <p className={`text-[10px] text-center font-bold mt-0.5 ${g.result === 'W' ? 'text-green-500' : g.result === 'L' ? 'text-red-400' : 'text-gray-400'}`}>
                            {g.result} · {sprayFilter ? `${g.dots.filter(d => d.batter === sprayFilter).length}/${g.dots.length}` : `${g.dots.length} hit${g.dots.length !== 1 ? 's' : ''}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {runs.length < 2 && allDots.length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-6">Play at least 2 games to see trends</p>
                )}
              </div>
            )
          })()}

          {/* Players tab */}
```

Replace with (Team tab, containing the moved charts, followed by the slimmed Trends tab; Task 4 will insert new content into the Team tab right before its closing `</div>`):

```jsx
          {/* Team tab */}
          {activeTab === 'team' && (() => {
            const runs = computeRunsPerGame()
            const sortedGames = games.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''))
            const battingByGame = sortedGames
              .filter(g => g.atBats?.length > 0)
              .map(g => {
                const abs = (g.atBats || []).filter(ab => !ab.isOpponent)
                const singles = abs.filter(ab => ab.outcome === '1B').length
                const doubles = abs.filter(ab => ab.outcome === '2B').length
                const triples = abs.filter(ab => ab.outcome === '3B').length
                const hrs     = abs.filter(ab => ab.outcome === 'HR').length
                return { gameId: g.id, date: g.date, singles, doubles, triples, hrs, total: singles + doubles + triples + hrs, result: g.result }
              })

            const maxRuns = runs.length > 0 ? Math.max(...runs.map(g => Math.max(g.ourRuns, g.theirRuns)), 1) : 1
            const maxHits = battingByGame.length > 0 ? Math.max(...battingByGame.map(g => g.total), 1) : 1
            const BAR_H = 100

            return (
              <div className="space-y-6">
                {/* Runs per game */}
                {runs.length >= 2 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Runs Scored vs Allowed</p>
                    <div className="grid items-end gap-1" style={{ height: BAR_H + 44, gridTemplateColumns: `repeat(${runs.length}, 1fr)` }}>
                      {runs.map(g => {
                        const ourH    = Math.max(Math.round((g.ourRuns   / maxRuns) * BAR_H), 4)
                        const theirH  = Math.max(Math.round((g.theirRuns / maxRuns) * BAR_H), 4)
                        const barColor = g.result === 'W' ? '#22c55e' : g.result === 'L' ? '#f87171' : '#9ca3af'
                        const active = tappedBar === g.gameId
                        return (
                          <div
                            key={g.gameId}
                            className="flex flex-col items-center cursor-pointer self-end"
                            onClick={() => setTappedBar(active ? null : g.gameId)}
                          >
                            <span className="text-[10px] font-bold text-gray-600 leading-none mb-1">{g.ourRuns}–{g.theirRuns}</span>
                            <div className="flex items-end gap-px w-full justify-center" style={{ height: BAR_H }}>
                              <div className="flex-1 rounded-t-sm transition-all" style={{ height: ourH, backgroundColor: barColor, opacity: active ? 1 : 0.8 }} />
                              <div className="flex-1 rounded-t-sm bg-gray-200 transition-all" style={{ height: theirH, opacity: active ? 1 : 0.6 }} />
                            </div>
                            <span className="text-[10px] text-gray-400 leading-tight mt-1 text-center w-full truncate">{g.date.slice(5)}</span>
                            <span className="text-[9px] text-gray-300 leading-none text-center w-full truncate">{g.opponent}</span>
                            {active && (
                              <span className={`text-[9px] font-bold mt-0.5 ${g.result === 'W' ? 'text-green-600' : g.result === 'L' ? 'text-red-500' : 'text-gray-500'}`}>
                                {g.result === 'W' ? 'Win' : g.result === 'L' ? 'Loss' : 'Draw'}
                              </span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex gap-4 mt-1.5 text-[10px] text-gray-400">
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm bg-green-500" />Us (W)</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm bg-red-400" />Us (L)</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm bg-gray-200" />Them</span>
                    </div>
                  </div>
                )}

                {/* Batting spread — hit type breakdown per game */}
                {battingByGame.length >= 2 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Hits by Type per Game</p>
                    <div className="grid items-end gap-1" style={{ height: BAR_H + 44, gridTemplateColumns: `repeat(${battingByGame.length}, 1fr)` }}>
                      {battingByGame.map(g => {
                        const totalH  = Math.max(Math.round((g.total / maxHits) * BAR_H), 4)
                        const hrsH    = g.total > 0 ? Math.round((g.hrs     / g.total) * totalH) : 0
                        const triH    = g.total > 0 ? Math.round((g.triples / g.total) * totalH) : 0
                        const dblH    = g.total > 0 ? Math.round((g.doubles / g.total) * totalH) : 0
                        const sngH    = Math.max(totalH - hrsH - triH - dblH, 0)
                        const active = tappedBar === g.gameId
                        return (
                          <div
                            key={g.gameId}
                            className="flex flex-col items-center cursor-pointer self-end"
                            onClick={() => setTappedBar(active ? null : g.gameId)}
                          >
                            <span className="text-[10px] font-bold text-gray-600 leading-none mb-1">{g.total}</span>
                            <div className="flex flex-col-reverse rounded-t-sm overflow-hidden w-full transition-all" style={{ height: Math.max(totalH, 4), opacity: active ? 1 : 0.8 }}>
                              {sngH > 0 && <div style={{ height: sngH, backgroundColor: '#bae6fd' }} />}
                              {dblH > 0 && <div style={{ height: dblH, backgroundColor: '#3b82f6' }} />}
                              {triH > 0 && <div style={{ height: triH, backgroundColor: '#7c3aed' }} />}
                              {hrsH > 0 && <div style={{ height: hrsH, backgroundColor: '#f59e0b' }} />}
                            </div>
                            <span className="text-[10px] text-gray-400 leading-tight mt-1 text-center w-full truncate">{g.date.slice(5)}</span>
                            <span className={`text-[9px] font-bold leading-none ${g.result === 'W' ? 'text-green-500' : g.result === 'L' ? 'text-red-400' : 'text-gray-400'}`}>{g.result}</span>
                            {active && (
                              <span className="text-[9px] text-gray-500 mt-0.5">{g.singles}×1B {g.doubles}×2B {g.triples}×3B {g.hrs}×HR</span>
                            )}
                          </div>
                        )
                      })}
                    </div>
                    <div className="flex gap-4 mt-1.5 text-[10px] text-gray-400">
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm" style={{ backgroundColor: '#bae6fd' }} />1B</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm" style={{ backgroundColor: '#3b82f6' }} />2B</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm" style={{ backgroundColor: '#7c3aed' }} />3B</span>
                      <span className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm" style={{ backgroundColor: '#f59e0b' }} />HR</span>
                    </div>
                  </div>
                )}

                {runs.length < 2 && battingByGame.length < 2 && (
                  <p className="text-gray-400 text-sm text-center py-3">Play at least 2 games to see team trend charts</p>
                )}
              </div>
            )
          })()}

          {/* Trends tab */}
          {activeTab === 'trends' && (() => {
            const sortedGames = games.slice().sort((a, b) => (a.date || '').localeCompare(b.date || ''))

            // Spray chart data: collect all hit dots across all games (include batter for interactivity)
            const allDots = sortedGames.flatMap(g =>
              (g.atBats || []).filter(ab => ab.hitLocation && !ab.isOpponent).map(ab => ({ x: ab.hitLocation.x, y: ab.hitLocation.y, outcome: ab.outcome, batter: ab.batter }))
            )
            const sprayBatters = [...new Set(allDots.map(d => d.batter).filter(Boolean))]
            const perGameSpray = sortedGames
              .filter(g => (g.atBats || []).some(ab => ab.hitLocation && !ab.isOpponent))
              .map(g => ({
                gameId: g.id,
                date: g.date,
                opponent: g.setup?.weAreHome !== false ? g.away : g.home,
                result: g.result,
                dots: (g.atBats || []).filter(ab => ab.hitLocation && !ab.isOpponent).map(ab => ({ x: ab.hitLocation.x, y: ab.hitLocation.y, outcome: ab.outcome, batter: ab.batter })),
              }))

            return (
              <div className="space-y-6">
                {/* Season spray chart — aggregate with player filter */}
                {allDots.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Season Spray Chart</p>
                    {sprayBatters.length > 1 && (
                      <div className="flex flex-wrap gap-1 mb-2">
                        <button
                          onClick={() => { setSprayFilter(null); setSelectedDot(null) }}
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${!sprayFilter ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >All</button>
                        {sprayBatters.sort().map(name => (
                          <button
                            key={name}
                            onClick={() => { setSprayFilter(sprayFilter === name ? null : name); setSelectedDot(null) }}
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${sprayFilter === name ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                          >{name}</button>
                        ))}
                      </div>
                    )}
                    <div className="max-w-sm mx-auto">
                      <SprayDiamond
                        dots={allDots}
                        highlightBatter={sprayFilter}
                        onDotTap={(i) => setSelectedDot(selectedDot === i ? null : i)}
                        selectedIdx={selectedDot}
                      />
                    </div>
                    <div className="flex flex-wrap justify-center gap-3 mt-2 text-[10px] text-gray-400">
                      {[['#22c55e','1B'],['#16a34a','2B'],['#15803d','3B'],['#052e16','HR'],['#ef4444','Flyout'],['#dc2626','Ground'],['#f59e0b','E/FC']].map(([c,l]) => (
                        <span key={l} className="flex items-center gap-1"><span className="inline-block w-3 h-2.5 rounded-sm" style={{ backgroundColor: c }} />{l}</span>
                      ))}
                    </div>
                    <p className="text-[10px] text-gray-300 text-center mt-1">
                      {sprayFilter ? `${allDots.filter(d => d.batter === sprayFilter).length} hits by ${sprayFilter}` : `${allDots.length} hit${allDots.length !== 1 ? 's' : ''} across ${perGameSpray.length} game${perGameSpray.length !== 1 ? 's' : ''}`}
                      {' · tap a dot for details'}
                    </p>
                  </div>
                )}

                {/* Per-game spray chart grid */}
                {perGameSpray.length >= 2 && (
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Spray Chart by Game</p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {perGameSpray.map(g => (
                        <div key={g.gameId} className="border border-gray-100 rounded-lg p-1.5">
                          <SprayDiamond dots={g.dots} highlightBatter={sprayFilter} label={`${g.date.slice(5)} vs ${g.opponent}`} />
                          <p className={`text-[10px] text-center font-bold mt-0.5 ${g.result === 'W' ? 'text-green-500' : g.result === 'L' ? 'text-red-400' : 'text-gray-400'}`}>
                            {g.result} · {sprayFilter ? `${g.dots.filter(d => d.batter === sprayFilter).length}/${g.dots.length}` : `${g.dots.length} hit${g.dots.length !== 1 ? 's' : ''}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {allDots.length === 0 && (
                  <p className="text-gray-400 text-sm text-center py-6">Play at least 2 games to see spray charts</p>
                )}
              </div>
            )
          })()}

          {/* Players tab */}
```

- [ ] **Step 3: Update the existing "runs per game chart" tests to target the Team tab**

In `src/tests/SeasonStatsPage.coaching.test.jsx`, find:

```js
describe('runs per game chart', () => {
  it('shows runs chart in Trends tab when 2+ games exist', () => {
    setupMocks({
      runs: [
        { gameId: 'g1', date: '2024-05-01', ourRuns: 7, theirRuns: 3, result: 'W', opponent: 'Bulls' },
        { gameId: 'g2', date: '2024-05-08', ourRuns: 4, theirRuns: 6, result: 'L', opponent: 'Eagles' },
      ],
    })
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    fireEvent.click(screen.getByText('📈 Trends'))
    expect(screen.getByText('Runs Scored vs Allowed')).toBeInTheDocument()
  })

  it('hides chart when fewer than 2 games', () => {
    setupMocks({ runs: [] })
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    fireEvent.click(screen.getByText('📈 Trends'))
    expect(screen.queryByText('Runs Scored vs Allowed')).not.toBeInTheDocument()
  })
})
```

Replace with:

```js
describe('runs per game chart', () => {
  it('shows runs chart in Team tab when 2+ games exist', () => {
    setupMocks({
      runs: [
        { gameId: 'g1', date: '2024-05-01', ourRuns: 7, theirRuns: 3, result: 'W', opponent: 'Bulls' },
        { gameId: 'g2', date: '2024-05-08', ourRuns: 4, theirRuns: 6, result: 'L', opponent: 'Eagles' },
      ],
    })
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    fireEvent.click(screen.getByText('🎯 Team'))
    expect(screen.getByText('Runs Scored vs Allowed')).toBeInTheDocument()
  })

  it('hides chart when fewer than 2 games', () => {
    setupMocks({ runs: [] })
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    fireEvent.click(screen.getByText('🎯 Team'))
    expect(screen.queryByText('Runs Scored vs Allowed')).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: All tests pass. The two updated tests now click "🎯 Team" and find the runs chart there instead of in Trends.

- [ ] **Step 5: Run the build**

Run: `npm run build`
Expected: Builds with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/pages/SeasonStatsPage.jsx src/tests/SeasonStatsPage.coaching.test.jsx
git commit -m "refactor: add Team tab, move runs/hits charts out of Trends"
```

---

### Task 4: Add RISP/LOB/GIDP content to the Team tab

**Files:**
- Modify: `src/pages/SeasonStatsPage.jsx:3` (import), and the Team tab's returned JSX (added in Task 3)
- Test: Create `src/tests/SeasonStatsPage.team.test.jsx`

**Interfaces:**
- Consumes: `computeSituationalStats()` from Task 1 — `{ team: { rispAB, rispH, rispAvg, overallAvg, lobTotal, lobPerGame, gidpCount }, players: [{ name, rispAB, rispH, rispAvg }] }`

- [ ] **Step 1: Write the failing tests**

Create `src/tests/SeasonStatsPage.team.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import SeasonStatsPage from '../pages/SeasonStatsPage'
import * as storage from '../storage'

beforeEach(() => localStorage.clear())

function setupMocks(overrides = {}) {
  vi.spyOn(storage, 'computeSeasonStats').mockReturnValue(overrides.stats ?? [])
  vi.spyOn(storage, 'getSeasonRecord').mockReturnValue({ W: 1, L: 0, D: 0 })
  vi.spyOn(storage, 'getGames').mockReturnValue([])
  vi.spyOn(storage, 'computePlayerGameLog').mockReturnValue([])
  vi.spyOn(storage, 'computeRunsPerGame').mockReturnValue(overrides.runs ?? [])
  vi.spyOn(storage, 'computeGroupStats').mockReturnValue([
    { type: 'BBH', players: 0, AB: 0, H: 0, HR: 0, RBI: 0, BB: 0, K: 0, AVG: '.000', OBP: '.000' },
    { type: 'SBH', players: 0, AB: 0, H: 0, HR: 0, RBI: 0, BB: 0, K: 0, AVG: '.000', OBP: '.000' },
  ])
  vi.spyOn(storage, 'computeSituationalStats').mockReturnValue(overrides.situational ?? {
    team: { rispAB: 0, rispH: 0, rispAvg: '.000', overallAvg: '.000', lobTotal: 0, lobPerGame: 0, gidpCount: 0 },
    players: [],
  })
}

describe('Team tab — situational hitting', () => {
  it('shows RISP AVG, LOB/game, and GIDP stat blocks', () => {
    setupMocks({
      situational: {
        team: { rispAB: 10, rispH: 4, rispAvg: '.400', overallAvg: '.275', lobTotal: 9, lobPerGame: 4.5, gidpCount: 3 },
        players: [],
      },
    })
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    fireEvent.click(screen.getByText('🎯 Team'))
    expect(screen.getByText('.400')).toBeInTheDocument()
    expect(screen.getByText('4.5')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows the clutch hitting table with per-player RISP rows', () => {
    setupMocks({
      situational: {
        team: { rispAB: 5, rispH: 2, rispAvg: '.400', overallAvg: '.300', lobTotal: 3, lobPerGame: 3, gidpCount: 1 },
        players: [
          { name: 'Alice', rispAB: 3, rispH: 2, rispAvg: '.667' },
          { name: 'Bob',   rispAB: 2, rispH: 0, rispAvg: '.000' },
        ],
      },
    })
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    fireEvent.click(screen.getByText('🎯 Team'))
    expect(screen.getByText('Clutch Hitting (RISP)')).toBeInTheDocument()
    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('Alice')
    expect(rows[2]).toHaveTextContent('Bob')
  })

  it('shows an empty state when no RISP at-bats have been recorded yet', () => {
    setupMocks()
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    fireEvent.click(screen.getByText('🎯 Team'))
    expect(screen.getByText('No runners in scoring position yet this season')).toBeInTheDocument()
  })

  it('shows the LOB caveat caption', () => {
    setupMocks()
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    fireEvent.click(screen.getByText('🎯 Team'))
    expect(screen.getByText(/caught-stealing\/pickoff/)).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/tests/SeasonStatsPage.team.test.jsx`
Expected: FAIL — the stat blocks, table, empty state, and caption don't exist in the Team tab yet.

- [ ] **Step 3: Add `computeSituationalStats` to the storage import**

In `src/pages/SeasonStatsPage.jsx`, find:

```jsx
import { getGames, computeSeasonStats, computePlayerGameLog, deleteGame, getSeasonRecord, computeRunsPerGame, computeGroupStats } from '../storage'
```

Replace with:

```jsx
import { getGames, computeSeasonStats, computePlayerGameLog, deleteGame, getSeasonRecord, computeRunsPerGame, computeGroupStats, computeSituationalStats } from '../storage'
```

- [ ] **Step 4: Insert the new content into the Team tab**

In the Team tab's returned JSX (added in Task 3), find the closing of the charts section:

```jsx
                {runs.length < 2 && battingByGame.length < 2 && (
                  <p className="text-gray-400 text-sm text-center py-3">Play at least 2 games to see team trend charts</p>
                )}
              </div>
            )
          })()}

          {/* Trends tab */}
```

Replace with (adds the situational-hitting section right before the Team tab's closing `</div>`):

```jsx
                {runs.length < 2 && battingByGame.length < 2 && (
                  <p className="text-gray-400 text-sm text-center py-3">Play at least 2 games to see team trend charts</p>
                )}

                {/* Situational hitting: RISP / LOB / GIDP */}
                {(() => {
                  const { team, players } = computeSituationalStats()
                  const delta = team.rispAB > 0 ? (parseFloat(team.rispAvg) - parseFloat(team.overallAvg)) : 0
                  const fmtDelta = v => (v >= 0 ? '+' : '') + v.toFixed(3).replace(/^0/, '').replace(/^-0/, '-')

                  return (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Situational Hitting</p>
                      <div className="grid grid-cols-3 gap-2 mb-3">
                        <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">RISP AVG</p>
                          <p className="text-lg font-black text-indigo-600">{team.rispAvg}</p>
                          {team.rispAB > 0 && (
                            <p className="text-[10px] text-gray-400">{fmtDelta(delta)} vs {team.overallAvg}</p>
                          )}
                        </div>
                        <div className="bg-amber-50 border border-amber-100 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">LOB / Game</p>
                          <p className="text-lg font-black text-amber-600">{team.lobPerGame}</p>
                        </div>
                        <div className="bg-gray-50 border border-gray-100 rounded-lg p-2 text-center">
                          <p className="text-[10px] text-gray-500 uppercase tracking-wide">GIDP</p>
                          <p className="text-lg font-black text-gray-600">{team.gidpCount}</p>
                        </div>
                      </div>

                      {players.length > 0 ? (
                        <div className="overflow-x-auto">
                          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Clutch Hitting (RISP)</p>
                          <table className="w-full text-xs border-collapse">
                            <thead>
                              <tr className="border-b border-gray-200 text-gray-500">
                                {['Player','RISP AB','RISP H','RISP AVG'].map(h => (
                                  <th key={h} className={`py-1 font-semibold whitespace-nowrap ${h === 'Player' ? 'text-left px-1' : 'text-center px-0.5'}`}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {players.map(p => (
                                <tr key={p.name} className="border-b border-gray-100 hover:bg-gray-50">
                                  <td className="py-1.5 px-1 font-medium whitespace-nowrap">{p.name}</td>
                                  <td className="py-1.5 px-0.5 text-center">{p.rispAB}</td>
                                  <td className="py-1.5 px-0.5 text-center">{p.rispH}</td>
                                  <td className="py-1.5 px-0.5 text-center text-indigo-600 font-medium">{p.rispAvg}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <p className="text-gray-400 text-sm text-center py-3">No runners in scoring position yet this season</p>
                      )}

                      <p className="text-[10px] text-gray-400 mt-2">LOB may be slightly overcounted on innings ending in a caught-stealing/pickoff rather than a batted out.</p>
                    </div>
                  )
                })()}
              </div>
            )
          })()}

          {/* Trends tab */}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run src/tests/SeasonStatsPage.team.test.jsx`
Expected: PASS — all 4 tests green.

- [ ] **Step 6: Run the full test suite**

Run: `npm test`
Expected: All tests pass, including the pre-existing Team-tab tests from Task 3 (they don't mock `computeSituationalStats`, so it now runs for real against `getGames()` returning `[]`, which returns zeroed output and renders the empty state — doesn't conflict with those tests' assertions about the runs chart).

- [ ] **Step 7: Run the build**

Run: `npm run build`
Expected: Builds with no errors.

- [ ] **Step 8: Commit**

```bash
git add src/pages/SeasonStatsPage.jsx src/tests/SeasonStatsPage.team.test.jsx
git commit -m "feat: show RISP/LOB/GIDP situational hitting in the Team tab"
```

---

### Task 5: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `npm test`
Expected: All test files pass (existing + the 2 new ones from Tasks 1 and 4).

- [ ] **Step 2: Run the production build**

Run: `npm run build`
Expected: Builds with no errors, no new warnings.

- [ ] **Step 3: Manual smoke test with real data**

Run: `npm run dev`, open the app, go to Season Stats. Click through all four tabs in order (Batting, Team, Players, Trends) and confirm:
- Batting tab is unchanged
- Team tab shows the Runs/Hits charts (if 2+ games exist) followed by RISP/LOB/GIDP stats and the clutch table (or empty state if no RISP at-bats yet)
- Players tab shows the same Streaks/Trajectory/How Players Get Out content that used to be under "Insights"
- Trends tab shows only the spray charts

If there's only 1 game in local history (per the app review's noted state), the Team/Trends chart sections will show their "play 2+ games" messages — confirm the situational stats section still renders on the Team tab regardless (no game-count gate).

- [ ] **Step 4: Push**

```bash
git push
```

Expected: Triggers the GitHub Actions auto-deploy to Pages, live in ~2 minutes.
