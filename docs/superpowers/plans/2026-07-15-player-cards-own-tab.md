# Player Cards: Own Tab in Season Stats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move mid-season player cards out of the 🃏 icon-button buried in Season Stats' Batting tab table, into their own **🃏 Cards** tab — a 2-column gallery of every player's card front, tap a card to open the existing flip-card modal.

**Architecture:** `SeasonStatsPage.jsx` gains a 5th tab (`activeTab === 'cards'`) rendering a grid of scaled-down `CardFront` previews (a component promoted from private to named-exported in `PlayerCardModal.jsx`), reusing the existing `viewCardPlayer` state and `PlayerCardModal` render unchanged. The old per-row 🃏 button in the Batting tab is then deleted.

**Tech Stack:** Vite + React (JSX), Tailwind CSS v4, Vitest + Testing Library for tests.

## Global Constraints

- No TypeScript — plain JSX only.
- `computePlayerCard` (storage.js), `PlayerCardModal`'s flip/download/print behavior, and `CardBack` are not modified by this plan.
- Spec: `docs/superpowers/specs/2026-07-15-player-cards-own-tab-design.md` (read for full rationale; this plan's task code is authoritative for exact implementation).

---

### Task 1: Add the Cards tab — grid of player-card previews

**Files:**
- Modify: `src/components/PlayerCardModal.jsx:34` (promote `CardFront` to a named export)
- Modify: `src/pages/SeasonStatsPage.jsx` (import, tab button, tab content)
- Test: `src/tests/SeasonStatsPage.cards.test.jsx` (create)

**Interfaces:**
- Consumes: `CardFront({ card })` (from `PlayerCardModal.jsx`, currently private — this task exports it. Renders a 280×400 card front from a `card` object shaped like `computePlayerCard`'s return value), `computePlayerCard(playerName)` (from `storage.js`, already exported), `viewCardPlayer` / `setViewCardPlayer` (existing state in `SeasonStatsPage.jsx`), `stats` (existing sorted array of `computeSeasonStats()` rows, each with a `.name`).
- Produces: A `🃏 Cards` tab in `SeasonStatsPage.jsx`'s tab bar and its content block. Nothing outside this file depends on it.

- [ ] **Step 1: Write the failing tests**

Create `src/tests/SeasonStatsPage.cards.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import SeasonStatsPage from '../pages/SeasonStatsPage'
import * as storage from '../storage'

beforeEach(() => localStorage.clear())

const mockStats = [
  { name: 'Bob',   G: 2, AB: 5, H: 2, '2B': 0, '3B': 0, HR: 0, R: 1, RBI: 1, BB: 0, K: 1, PO: 0, A: 0, E: 0, AVG: '.400', OBP: '.400', SLG: '.400', KPct: '20.0', BBPct: '0.0', W: 2, L: 0, D: 0 },
  { name: 'Alice', G: 3, AB: 9, H: 3, '2B': 1, '3B': 0, HR: 0, R: 2, RBI: 2, BB: 1, K: 2, PO: 0, A: 0, E: 0, AVG: '.333', OBP: '.364', SLG: '.444', KPct: '22.2', BBPct: '10.0', W: 2, L: 1, D: 0 },
]

function mockCardFor(name) {
  return {
    name, type: 'BBH', qualifies: true,
    G: 3, AB: 9, AVG: '.333', OBP: '.364', SLG: '.444', KPct: '22.2', BBPct: '10.0',
    pose: 'contact',
    headlineStat: { key: 'AVG', value: '.333' },
    strengths: [], needsWork: [], neutral: true,
    spray: { dots: [], bestZone: null, worstZone: null },
    outBreakdown: { counts: {}, total: 0, mostCommon: null },
  }
}

describe('SeasonStatsPage — Cards tab', () => {
  beforeEach(() => {
    vi.spyOn(storage, 'computeSeasonStats').mockReturnValue(mockStats)
    vi.spyOn(storage, 'getSeasonRecord').mockReturnValue({ W: 2, L: 1, D: 0 })
    vi.spyOn(storage, 'getGames').mockReturnValue([])
    vi.spyOn(storage, 'computePlayerCard').mockImplementation(mockCardFor)
  })

  it('renders one card preview per player, alphabetically, when Cards tab is selected', () => {
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    fireEvent.click(screen.getByText('🃏 Cards'))
    const cardButtons = screen.getAllByRole('button', { name: /^View .*'s card$/ })
    expect(cardButtons).toHaveLength(2)
    expect(cardButtons[0]).toHaveAccessibleName("View Alice's card")
    expect(cardButtons[1]).toHaveAccessibleName("View Bob's card")
  })

  it('opens PlayerCardModal for the tapped player', () => {
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    fireEvent.click(screen.getByText('🃏 Cards'))
    fireEvent.click(screen.getByRole('button', { name: "View Bob's card" }))
    expect(screen.getByText("Bob's Card")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test -- SeasonStatsPage.cards`
Expected: FAIL — `screen.getByText('🃏 Cards')` cannot find the element (tab doesn't exist yet).

- [ ] **Step 3: Export `CardFront` from `PlayerCardModal.jsx`**

In `src/components/PlayerCardModal.jsx`, change line 34 from:

```jsx
function CardFront({ card }) {
```

to:

```jsx
export function CardFront({ card }) {
```

- [ ] **Step 4: Wire the Cards tab into `SeasonStatsPage.jsx`**

Change the import on line 3 from:

```jsx
import PlayerCardModal from '../components/PlayerCardModal'
```

to:

```jsx
import PlayerCardModal, { CardFront } from '../components/PlayerCardModal'
```

Change the `storage` import on line 4 from:

```jsx
import { getGames, computeSeasonStats, computePlayerGameLog, deleteGame, getSeasonRecord, computeRunsPerGame, computeGroupStats, computeSituationalStats } from '../storage'
```

to:

```jsx
import { getGames, computeSeasonStats, computePlayerGameLog, deleteGame, getSeasonRecord, computeRunsPerGame, computeGroupStats, computeSituationalStats, computePlayerCard } from '../storage'
```

Add a `Cards` tab button right after the `Players` button and before the `Trends` button (in the tab-header `<div className="flex gap-1">` block):

```jsx
              <button
                onClick={() => setActiveTab('players')}
                className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${activeTab === 'players' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                💡 Players
              </button>
              <button
                onClick={() => setActiveTab('cards')}
                className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${activeTab === 'cards' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                🃏 Cards
              </button>
              <button
                onClick={() => setActiveTab('trends')}
                className={`px-3 py-1 rounded text-sm font-semibold transition-colors ${activeTab === 'trends' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-700'}`}
              >
                📈 Trends
              </button>
```

Add the Cards tab content block immediately after the Players tab block's closing `})()}` (the Players tab is the last content block, right before the `</div>` that closes the `card mb-4` wrapper and the `{/* Game history */}` comment):

```jsx
          {/* Cards tab */}
          {activeTab === 'cards' && (
            <div className="grid grid-cols-2 gap-3">
              {[...stats].sort((a, b) => a.name.localeCompare(b.name)).map(p => {
                const card = computePlayerCard(p.name)
                return (
                  <button
                    key={p.name}
                    onClick={() => setViewCardPlayer(p.name)}
                    aria-label={`View ${p.name}'s card`}
                    className="text-left"
                  >
                    <div style={{ width: 140, height: 200, overflow: 'hidden' }}>
                      <div style={{
                        width: 280, height: 400, transform: 'scale(0.5)', transformOrigin: 'top left',
                        border: '5px solid #1c2b4a', borderRadius: 10, background: '#f3ead9',
                        fontFamily: 'Georgia, serif', overflow: 'hidden', position: 'relative',
                      }}>
                        <CardFront card={card} />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm test -- SeasonStatsPage.cards`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/components/PlayerCardModal.jsx src/pages/SeasonStatsPage.jsx src/tests/SeasonStatsPage.cards.test.jsx
git commit -m "feat: add Cards tab to Season Stats with player card gallery"
```

---

### Task 2: Remove the old 🃏 entry point from the Batting tab

**Files:**
- Modify: `src/pages/SeasonStatsPage.jsx`
- Test: `src/tests/SeasonStatsPage.cards.test.jsx`

**Interfaces:**
- Consumes: Nothing new — this task only deletes JSX.
- Produces: Nothing new — the Batting tab table's `Player` cell reverts to just the clickable name.

- [ ] **Step 1: Write the failing test**

Append to `src/tests/SeasonStatsPage.cards.test.jsx`:

```jsx
describe('SeasonStatsPage — Batting tab', () => {
  beforeEach(() => {
    vi.spyOn(storage, 'computeSeasonStats').mockReturnValue(mockStats)
    vi.spyOn(storage, 'getSeasonRecord').mockReturnValue({ W: 2, L: 1, D: 0 })
    vi.spyOn(storage, 'getGames').mockReturnValue([])
  })

  it('no longer renders a card-view control (Batting is the default tab)', () => {
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    expect(screen.queryByLabelText(/^View .*'s card$/)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- SeasonStatsPage.cards`
Expected: FAIL — the 🃏 button in the Batting tab still matches `/^View .*'s card$/`.

- [ ] **Step 3: Delete the button from the Batting tab table**

In `src/pages/SeasonStatsPage.jsx`, in the `activeTab === 'batting'` block's `stats.map(p => (...))` loop, change:

```jsx
                      <td className="py-1.5 px-1 font-medium whitespace-nowrap">
                        <span
                          className="cursor-pointer text-blue-700 hover:underline"
                          onClick={() => setSelectedPlayer(p.name)}
                        >
                          {p.name}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setViewCardPlayer(p.name) }}
                          className="ml-1 align-middle"
                          aria-label={`View ${p.name}'s card`}
                          title="View Card"
                        >
                          🃏
                        </button>
                      </td>
```

to:

```jsx
                      <td className="py-1.5 px-1 font-medium whitespace-nowrap">
                        <span
                          className="cursor-pointer text-blue-700 hover:underline"
                          onClick={() => setSelectedPlayer(p.name)}
                        >
                          {p.name}
                        </span>
                      </td>
```

- [ ] **Step 4: Run the full test suite**

Run: `npm test`
Expected: PASS — all tests, including the two new files from Task 1 and Task 2, and the pre-existing `PlayerCardModal.test.jsx` (unaffected, since `PlayerCardModal`'s default export and behavior are untouched).

- [ ] **Step 5: Commit**

```bash
git add src/pages/SeasonStatsPage.jsx src/tests/SeasonStatsPage.cards.test.jsx
git commit -m "refactor: remove View Card button from Batting tab now that Cards has its own tab"
```
