# Player Stats Drill-Down Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve SeasonStatsPage with a Runs (R) column, sortable column headers, and a per-player game-by-game drill-down modal.

**Architecture:** A new `computePlayerGameLog(playerName)` function in `storage.js` returns the per-game breakdown for one player. `SeasonStatsPage` gains sortable headers (click to toggle asc/desc) and a `PlayerDetailModal` that shows the per-game log. No backend changes needed — all derived from existing `sft_games` data.

**Tech Stack:** React (useState), existing Tailwind CSS, existing storage.js pattern.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/storage.js` | **Modify** | Add `computePlayerGameLog(playerName)` |
| `src/pages/SeasonStatsPage.jsx` | **Modify** | Add R column, sortable headers, click-player → modal |
| `src/tests/storage.stats.test.js` | **Create** | Unit tests for `computePlayerGameLog` |

---

## Task 1: Add `computePlayerGameLog` to storage.js

**Files:**
- Modify: `src/storage.js` (append after `computeSeasonStats`)
- Create: `src/tests/storage.stats.test.js`

- [ ] **Step 1.1: Write the failing test**

Create `src/tests/storage.stats.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { saveGame, computePlayerGameLog } from '../storage'

beforeEach(() => localStorage.clear())

describe('computePlayerGameLog', () => {
  it('returns empty array when player has no games', () => {
    expect(computePlayerGameLog('Alice')).toEqual([])
  })

  it('returns one row per game the player batted in', () => {
    saveGame({
      id: 'g1', date: '2024-05-01', gameType: 'League',
      home: 'Renegades', away: 'Bulls',
      homeScore: 5, awayScore: 3, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Alice', inning: 1, half: 'bottom', outcome: '1B', rbi: 1 },
        { id: 'ab2', batter: 'Alice', inning: 2, half: 'bottom', outcome: 'K',  rbi: 0 },
        { id: 'ab3', batter: 'Bob',   inning: 1, half: 'bottom', outcome: 'HR', rbi: 2 },
      ],
      playLog: [],
    })
    const log = computePlayerGameLog('Alice')
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({
      gameId: 'g1', date: '2024-05-01', matchup: 'Bulls @ Renegades', result: 'W',
      AB: 2, H: 1, '2B': 0, '3B': 0, HR: 0, RBI: 1, BB: 0, K: 1,
    })
    expect(log[0].AVG).toBe('.500')
  })

  it('excludes BB/HBP/SAC from AB count', () => {
    saveGame({
      id: 'g2', date: '2024-05-08', gameType: 'League',
      home: 'Renegades', away: 'Eagles',
      homeScore: 4, awayScore: 2, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Alice', inning: 1, half: 'bottom', outcome: 'BB',  rbi: 0 },
        { id: 'ab2', batter: 'Alice', inning: 2, half: 'bottom', outcome: '2B',  rbi: 1 },
        { id: 'ab3', batter: 'Alice', inning: 3, half: 'bottom', outcome: 'SAC', rbi: 1 },
      ],
      playLog: [],
    })
    const log = computePlayerGameLog('Alice')
    expect(log[0].AB).toBe(1)  // only 2B counts
    expect(log[0].BB).toBe(1)
    expect(log[0].H).toBe(1)
    expect(log[0].RBI).toBe(2)
  })

  it('returns games sorted by date ascending', () => {
    saveGame({ id: 'g1', date: '2024-05-08', gameType: 'League', home: 'Renegades', away: 'Eagles', homeScore: 1, awayScore: 0, result: 'W', atBats: [{ id: 'ab1', batter: 'Alice', inning: 1, half: 'bottom', outcome: '1B', rbi: 0 }], playLog: [] })
    saveGame({ id: 'g2', date: '2024-05-01', gameType: 'League', home: 'Renegades', away: 'Bulls',  homeScore: 2, awayScore: 1, result: 'W', atBats: [{ id: 'ab2', batter: 'Alice', inning: 1, half: 'bottom', outcome: '1B', rbi: 0 }], playLog: [] })
    const log = computePlayerGameLog('Alice')
    expect(log[0].date).toBe('2024-05-01')
    expect(log[1].date).toBe('2024-05-08')
  })
})
```

- [ ] **Step 1.2: Run test to verify it fails**

```bash
cd /Users/emilysewell/Documents/Github\ Projects/softball-tracker
npx vitest run src/tests/storage.stats.test.js
```

Expected: FAIL — `computePlayerGameLog is not a function`

- [ ] **Step 1.3: Implement `computePlayerGameLog` in `src/storage.js`**

Append after the closing brace of `computeSeasonStats` (around line 246):

```js
// ── Per-player game log (for drill-down in SeasonStatsPage) ───────────────
export function computePlayerGameLog(playerName) {
  const games = getGames()
  const rows = []

  for (const game of games) {
    const abs = (game.atBats || []).filter(ab => ab.batter === playerName)
    if (abs.length === 0) continue

    const AB  = abs.filter(ab => !['BB','HBP','SAC'].includes(ab.outcome)).length
    const H   = abs.filter(ab => ['1B','2B','3B','HR'].includes(ab.outcome)).length
    const twoB  = abs.filter(ab => ab.outcome === '2B').length
    const threeB = abs.filter(ab => ab.outcome === '3B').length
    const HR  = abs.filter(ab => ab.outcome === 'HR').length
    const RBI = abs.reduce((s, ab) => s + (ab.rbi || 0), 0)
    const BB  = abs.filter(ab => ab.outcome === 'BB').length
    const K   = abs.filter(ab => ab.outcome === 'K').length
    const AVG = AB > 0 ? (H / AB).toFixed(3).replace(/^0/, '') : '.000'

    // Determine opponent label from the player's perspective
    const opponent = game.away === 'The Renegades' || game.away === game.home
      ? game.away
      : game.away  // show the away team name — if we're home, they're the away team

    rows.push({
      gameId:   game.id,
      date:     game.date,
      opponent: game.home === game.home ? game.away : game.home, // simplified: always show away
      result:   game.result,
      AB, H, '2B': twoB, '3B': threeB, HR, RBI, BB, K, AVG,
    })
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date))
}
```

Wait — the opponent label logic above is wrong. The game has `home` and `away` team names. We want to show who the opponent was. Since we don't know which side "we" were on from the game object directly (weAreHome isn't stored on completed games), use: the opponent is whichever team is not the one with the player in the batting order. Simplest: just show `${game.away} @ ${game.home}` to avoid ambiguity.

Correct implementation:

```js
// ── Per-player game log (for drill-down in SeasonStatsPage) ───────────────
export function computePlayerGameLog(playerName) {
  const games = getGames()
  const rows = []

  for (const game of games) {
    const abs = (game.atBats || []).filter(ab => ab.batter === playerName)
    if (abs.length === 0) continue

    const AB    = abs.filter(ab => !['BB','HBP','SAC'].includes(ab.outcome)).length
    const H     = abs.filter(ab => ['1B','2B','3B','HR'].includes(ab.outcome)).length
    const twoB  = abs.filter(ab => ab.outcome === '2B').length
    const threeB = abs.filter(ab => ab.outcome === '3B').length
    const HR    = abs.filter(ab => ab.outcome === 'HR').length
    const RBI   = abs.reduce((s, ab) => s + (ab.rbi || 0), 0)
    const BB    = abs.filter(ab => ab.outcome === 'BB').length
    const K     = abs.filter(ab => ab.outcome === 'K').length
    const AVG   = AB > 0 ? (H / AB).toFixed(3).replace(/^0/, '') : '.000'

    rows.push({
      gameId:   game.id,
      date:     game.date,
      matchup:  `${game.away} @ ${game.home}`,
      result:   game.result || '—',
      AB, H, '2B': twoB, '3B': threeB, HR, RBI, BB, K, AVG,
    })
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date))
}
```

- [ ] **Step 1.4: Run tests to verify they pass**

```bash
npx vitest run src/tests/storage.stats.test.js
```

Expected: all 4 tests PASS

- [ ] **Step 1.5: Commit**

```bash
cd /Users/emilysewell/Documents/Github\ Projects/softball-tracker
git add src/storage.js src/tests/storage.stats.test.js
git commit -m "feat: add computePlayerGameLog for per-game player stats"
```

---

## Task 2: Add R column and sortable headers to SeasonStatsPage

**Files:**
- Modify: `src/pages/SeasonStatsPage.jsx`

The current batting table columns are `['Player','G','AB','H','2B','3B','HR','RBI','BB','K','AVG','OBP','SLG']`. We'll add `R` between `G` and `AB`. `R` is already computed in `computeSeasonStats()` (storage.js line 226 sums runs from playLog). Sortable headers: clicking a column header sorts the stats array by that field; clicking again reverses.

- [ ] **Step 2.1: Write the failing test**

Create `src/tests/SeasonStatsPage.sort.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import SeasonStatsPage from '../pages/SeasonStatsPage'
import * as storage from '../storage'

beforeEach(() => localStorage.clear())

describe('SeasonStatsPage batting table', () => {
  it('shows R column header', () => {
    vi.spyOn(storage, 'computeSeasonStats').mockReturnValue([
      { name: 'Alice', G: 3, AB: 9, H: 3, '2B': 1, '3B': 0, HR: 0, R: 2, RBI: 2, BB: 1, K: 2, PO: 0, A: 0, E: 0, AVG: '.333', OBP: '.364', SLG: '.444', W: 2, L: 1, D: 0 },
    ])
    vi.spyOn(storage, 'getSeasonRecord').mockReturnValue({ W: 2, L: 1, D: 0 })
    vi.spyOn(storage, 'getGames').mockReturnValue([])
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    expect(screen.getByRole('columnheader', { name: 'R' })).toBeInTheDocument()
  })

  it('sorts by AB descending when AB header clicked', () => {
    vi.spyOn(storage, 'computeSeasonStats').mockReturnValue([
      { name: 'Alice', G: 3, AB: 9, H: 3, '2B': 0, '3B': 0, HR: 0, R: 2, RBI: 2, BB: 1, K: 2, PO: 0, A: 0, E: 0, AVG: '.333', OBP: '.364', SLG: '.333', W: 2, L: 1, D: 0 },
      { name: 'Bob',   G: 2, AB: 5, H: 2, '2B': 0, '3B': 0, HR: 0, R: 1, RBI: 1, BB: 0, K: 1, PO: 0, A: 0, E: 0, AVG: '.400', OBP: '.400', SLG: '.400', W: 2, L: 0, D: 0 },
    ])
    vi.spyOn(storage, 'getSeasonRecord').mockReturnValue({ W: 2, L: 1, D: 0 })
    vi.spyOn(storage, 'getGames').mockReturnValue([])
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    // Default: sorted by AB desc (Alice first)
    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('Alice')
    // Click AB header → ascending
    fireEvent.click(screen.getByRole('columnheader', { name: /^AB/ }))
    const rowsAfter = screen.getAllByRole('row')
    expect(rowsAfter[1]).toHaveTextContent('Bob')
  })
})
```

- [ ] **Step 2.2: Run test to verify it fails**

```bash
npx vitest run src/tests/SeasonStatsPage.sort.test.jsx
```

Expected: FAIL — R column not found, sort not implemented

- [ ] **Step 2.3: Update SeasonStatsPage**

Open `src/pages/SeasonStatsPage.jsx`. Make these changes:

**a) Add sort state** — add after `const [showGuide, setShowGuide] = useState(false)`:

```jsx
const [sortCol, setSortCol] = useState('AB')
const [sortAsc, setSortAsc] = useState(false)
```

**b) Sort the stats array** — replace `const stats = computeSeasonStats()` with:

```jsx
const rawStats = computeSeasonStats()
const stats = [...rawStats].sort((a, b) => {
  const av = a[sortCol], bv = b[sortCol]
  if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av)
  return sortAsc ? av - bv : bv - av
})
```

**c) Add sort handler** — add after the sort state:

```jsx
function handleSort(col) {
  if (sortCol === col) setSortAsc(a => !a)
  else { setSortCol(col); setSortAsc(false) }
}
```

**d) Replace the batting table `<thead>` row** — find the line with `['Player','G','AB','H','2B','3B','HR','RBI','BB','K','AVG','OBP','SLG'].map(h => (` and replace the whole thead:

```jsx
<thead>
  <tr className="border-b border-gray-200">
    {['Player','G','R','AB','H','2B','3B','HR','RBI','BB','K','AVG','OBP','SLG'].map(h => (
      <th
        key={h}
        onClick={h !== 'Player' ? () => handleSort(h) : undefined}
        className={`py-1 font-semibold whitespace-nowrap select-none ${
          h === 'Player' ? 'text-left px-1 text-gray-500' :
          ['AVG','OBP','SLG'].includes(h) ? 'text-center px-0.5 text-indigo-500 cursor-pointer hover:text-indigo-700' :
          'text-center px-0.5 text-gray-500 cursor-pointer hover:text-gray-700'
        }`}
      >
        {h}{sortCol === h ? (sortAsc ? ' ▲' : ' ▼') : ''}
      </th>
    ))}
  </tr>
</thead>
```

**e) Add R value to the batting tbody row** — find the line with `{[p.G, p.AB, p.H, ...` and replace it:

```jsx
{[p.G, p.R || 0, p.AB, p.H, p['2B'], p['3B'], p.HR, p.RBI, p.BB, p.K].map((v, i) => (
  <td key={i} className="py-1.5 px-0.5 text-center">{v}</td>
))}
```

**f) Update the STAT_TIPS object** — add after the existing `G` entry:

```jsx
R:    { label: 'Runs',             desc: 'Times this player crossed home plate and scored a run.' },
```

**g) Update the guide sheet batting columns list** — find `{['G','AB','H','2B','3B','HR','RBI','BB','K','AVG','OBP','SLG'].map(k => (` and add `'R'` after `'G'`:

```jsx
{['G','R','AB','H','2B','3B','HR','RBI','BB','K','AVG','OBP','SLG'].map(k => (
```

- [ ] **Step 2.4: Run tests to verify they pass**

```bash
npx vitest run src/tests/SeasonStatsPage.sort.test.jsx
```

Expected: both tests PASS

- [ ] **Step 2.5: Commit**

```bash
git add src/pages/SeasonStatsPage.jsx src/tests/SeasonStatsPage.sort.test.jsx
git commit -m "feat: add R column and sortable headers to batting stats table"
```

---

## Task 3: Per-player drill-down modal

**Files:**
- Modify: `src/pages/SeasonStatsPage.jsx` — add `PlayerDetailModal`, make player names clickable

- [ ] **Step 3.1: Write the failing test**

Create `src/tests/SeasonStatsPage.drilldown.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import SeasonStatsPage from '../pages/SeasonStatsPage'
import * as storage from '../storage'

beforeEach(() => localStorage.clear())

const mockStats = [
  { name: 'Alice', G: 3, AB: 9, H: 3, '2B': 1, '3B': 0, HR: 0, R: 2, RBI: 2, BB: 1, K: 2, PO: 0, A: 0, E: 0, AVG: '.333', OBP: '.364', SLG: '.444', W: 2, L: 1, D: 0 },
]

const mockLog = [
  { gameId: 'g1', date: '2024-05-01', matchup: 'Eagles @ Renegades', result: 'W', AB: 3, H: 1, '2B': 0, '3B': 0, HR: 0, RBI: 1, BB: 0, K: 1, AVG: '.333' },
  { gameId: 'g2', date: '2024-05-08', matchup: 'Bulls @ Renegades',  result: 'L', AB: 3, H: 1, '2B': 1, '3B': 0, HR: 0, RBI: 0, BB: 1, K: 1, AVG: '.333' },
]

describe('PlayerDetailModal', () => {
  beforeEach(() => {
    vi.spyOn(storage, 'computeSeasonStats').mockReturnValue(mockStats)
    vi.spyOn(storage, 'getSeasonRecord').mockReturnValue({ W: 2, L: 1, D: 0 })
    vi.spyOn(storage, 'getGames').mockReturnValue([])
    vi.spyOn(storage, 'computePlayerGameLog').mockReturnValue(mockLog)
  })

  it('shows player detail modal when player name is clicked', () => {
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    fireEvent.click(screen.getByText('Alice'))
    expect(screen.getByText("Alice's Stats")).toBeInTheDocument()
  })

  it('shows game-by-game rows in the modal', () => {
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    fireEvent.click(screen.getByText('Alice'))
    expect(screen.getByText('Eagles @ Renegades')).toBeInTheDocument()
    expect(screen.getByText('Bulls @ Renegades')).toBeInTheDocument()
  })

  it('closes modal when close button clicked', () => {
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    fireEvent.click(screen.getByText('Alice'))
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(screen.queryByText("Alice's Stats")).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 3.2: Run test to verify it fails**

```bash
npx vitest run src/tests/SeasonStatsPage.drilldown.test.jsx
```

Expected: FAIL — clicking Alice does nothing, no modal

- [ ] **Step 3.3: Add `PlayerDetailModal` and wire it up**

Open `src/pages/SeasonStatsPage.jsx`.

**a) Add import** — add `computePlayerGameLog` to the import from `'../storage'`:

```jsx
import { getGames, computeSeasonStats, computePlayerGameLog, deleteGame, getSeasonRecord } from '../storage'
```

**b) Add `PlayerDetailModal` component** — add this before `export default function SeasonStatsPage`:

```jsx
function PlayerDetailModal({ name, onClose }) {
  const log = computePlayerGameLog(name)
  const totals = log.reduce(
    (acc, g) => ({ AB: acc.AB + g.AB, H: acc.H + g.H, HR: acc.HR + g.HR, RBI: acc.RBI + g.RBI, BB: acc.BB + g.BB, K: acc.K + g.K }),
    { AB: 0, H: 0, HR: 0, RBI: 0, BB: 0, K: 0 }
  )
  const seasonAvg = totals.AB > 0 ? (totals.H / totals.AB).toFixed(3).replace(/^0/, '') : '.000'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full p-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-base">{name}'s Stats</h3>
          <button onClick={onClose} aria-label="Close" className="btn btn-ghost btn-sm p-1"><X size={18} /></button>
        </div>

        {/* Season totals bar */}
        <div className="flex gap-4 bg-blue-50 rounded-lg p-3 mb-4 text-sm">
          <div className="text-center"><p className="text-xs text-gray-500">G</p><p className="font-bold">{log.length}</p></div>
          <div className="text-center"><p className="text-xs text-gray-500">AB</p><p className="font-bold">{totals.AB}</p></div>
          <div className="text-center"><p className="text-xs text-gray-500">H</p><p className="font-bold">{totals.H}</p></div>
          <div className="text-center"><p className="text-xs text-gray-500">HR</p><p className="font-bold">{totals.HR}</p></div>
          <div className="text-center"><p className="text-xs text-gray-500">RBI</p><p className="font-bold">{totals.RBI}</p></div>
          <div className="text-center"><p className="text-xs text-gray-500">AVG</p><p className="font-bold text-indigo-600">{seasonAvg}</p></div>
        </div>

        {/* Per-game table */}
        {log.length === 0 ? (
          <p className="text-gray-400 text-sm text-center py-4">No games recorded</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-gray-200 text-gray-500">
                  <th className="text-left py-1 px-1">Date</th>
                  <th className="text-left py-1 px-1">Game</th>
                  <th className="text-center py-1 px-1">Res</th>
                  <th className="text-center py-1 px-1">AB</th>
                  <th className="text-center py-1 px-1">H</th>
                  <th className="text-center py-1 px-1">HR</th>
                  <th className="text-center py-1 px-1">RBI</th>
                  <th className="text-center py-1 px-1">BB</th>
                  <th className="text-center py-1 px-1">K</th>
                  <th className="text-center py-1 px-1 text-indigo-500">AVG</th>
                </tr>
              </thead>
              <tbody>
                {log.map(g => (
                  <tr key={g.gameId} className="border-b border-gray-100">
                    <td className="py-1.5 px-1 whitespace-nowrap">{g.date}</td>
                    <td className="py-1.5 px-1 text-gray-600 max-w-28 truncate">{g.matchup}</td>
                    <td className={`py-1.5 px-1 text-center font-bold ${g.result === 'W' ? 'text-green-600' : g.result === 'L' ? 'text-red-500' : 'text-gray-500'}`}>{g.result}</td>
                    <td className="py-1.5 px-1 text-center">{g.AB}</td>
                    <td className="py-1.5 px-1 text-center">{g.H}</td>
                    <td className="py-1.5 px-1 text-center">{g.HR || '—'}</td>
                    <td className="py-1.5 px-1 text-center">{g.RBI}</td>
                    <td className="py-1.5 px-1 text-center">{g.BB}</td>
                    <td className="py-1.5 px-1 text-center">{g.K}</td>
                    <td className="py-1.5 px-1 text-center text-indigo-600 font-medium">{g.AVG}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <button onClick={onClose} className="btn btn-primary btn-md w-full mt-4">Close</button>
      </div>
    </div>
  )
}
```

**c) Add modal state** — inside `SeasonStatsPage`, add after existing useState declarations:

```jsx
const [selectedPlayer, setSelectedPlayer] = useState(null)
```

**d) Make player names clickable** — in the batting tbody, find the player name `<td>`:

```jsx
<td className="py-1.5 px-1 font-medium whitespace-nowrap">{p.name}</td>
```

Replace with:

```jsx
<td
  className="py-1.5 px-1 font-medium whitespace-nowrap cursor-pointer text-blue-700 hover:underline"
  onClick={() => setSelectedPlayer(p.name)}
>
  {p.name}
</td>
```

**e) Render modal** — just before the `{showGuide && ...}` line at the bottom of the return, add:

```jsx
{selectedPlayer && <PlayerDetailModal name={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
```

- [ ] **Step 3.4: Run tests to verify they pass**

```bash
npx vitest run src/tests/SeasonStatsPage.drilldown.test.jsx
```

Expected: all 3 tests PASS

- [ ] **Step 3.5: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS (no regressions)

- [ ] **Step 3.6: Commit**

```bash
git add src/pages/SeasonStatsPage.jsx src/tests/SeasonStatsPage.drilldown.test.jsx
git commit -m "feat: per-player game-by-game drill-down modal in Season Stats"
```

---

## Self-Review Checklist

- [x] R column added to batting table (Task 2)
- [x] Sortable headers for all numeric columns (Task 2)
- [x] `computePlayerGameLog` tested and exported (Task 1)
- [x] `PlayerDetailModal` shows season totals + per-game log (Task 3)
- [x] Modal closes on backdrop click and Close button (Task 3)
- [x] All new code has tests before implementation (TDD followed)
- [x] No placeholders or TODOs in plan
- [x] `computePlayerGameLog` imported in SeasonStatsPage (Task 3, step a)
