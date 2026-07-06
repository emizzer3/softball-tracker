# Viewer Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let teammates follow along without PIN access. A shareable URL (`?view=REN-1234`) opens a read-only page showing the current game score (if any), upcoming schedule, and season record — all pulled live from Supabase by Short Team ID.

**Architecture:** On app load, `App.jsx` checks for a `?view=SHORT_ID` URL parameter. If found, it fetches the team's public data from Supabase (no PIN needed — Short ID is the public share token) and renders a new `ViewerPage` instead of the normal app. The manager's Admin page gains a "Copy viewer link" button. A new `loadViewerData(shortId)` function in `sync.js` fetches by short ID without PIN.

**Tech Stack:** Existing Supabase `team_data` table, `URLSearchParams`, `sync.js`, new `ViewerPage.jsx`.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/sync.js` | **Modify** | Add `loadViewerData(shortId)` — fetch team_data by short_id, no PIN |
| `src/pages/ViewerPage.jsx` | **Create** | Read-only UI: live score, schedule, season record |
| `src/App.jsx` | **Modify** | Detect `?view=` param on load, render ViewerPage instead of app |
| `src/pages/AdminPage.jsx` | **Modify** | Add "Copy viewer link" button to TeamIdSection |
| `src/tests/sync.viewer.test.js` | **Create** | Unit tests for `loadViewerData` |
| `src/tests/ViewerPage.test.jsx` | **Create** | Component tests for ViewerPage |

---

## Task 1: Add `loadViewerData` to sync.js

**Files:**
- Modify: `src/sync.js`
- Create: `src/tests/sync.viewer.test.js`

`loadViewerData` looks up a team by `short_id`, then fetches all `team_data` rows for that team and returns them as a plain object keyed by local storage key name. It does NOT write to localStorage — the caller decides what to do with the data.

- [ ] **Step 1.1: Write the failing tests**

Create `src/tests/sync.viewer.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { _setClientForTesting, loadViewerData } from '../sync'

beforeEach(() => {
  localStorage.clear()
  _setClientForTesting(undefined)
})

describe('loadViewerData', () => {
  it('throws when Supabase not configured', async () => {
    _setClientForTesting(null)
    await expect(loadViewerData('REN-1234')).rejects.toThrow('Cloud sync not configured')
  })

  it('throws when team not found', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      }),
    }
    _setClientForTesting(mockClient)
    await expect(loadViewerData('XXX-0000')).rejects.toThrow('Team not found')
  })

  it('returns parsed team data keyed by local storage key', async () => {
    const teamRow = { id: 'team-uuid', name: 'Renegades', short_id: 'REN-1234' }
    const dataRows = [
      { key: 'games',  value: [{ id: 'g1' }] },
      { key: 'roster', value: [{ id: 'p1', name: 'Alice' }] },
    ]

    const mockClient = {
      from: vi.fn().mockImplementation(table => {
        if (table === 'teams') {
          return {
            select: vi.fn().mockReturnThis(),
            eq:     vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: teamRow, error: null }),
          }
        }
        // team_data
        return {
          select: vi.fn().mockReturnThis(),
          eq:     vi.fn().mockResolvedValue({ data: dataRows, error: null }),
        }
      }),
    }
    _setClientForTesting(mockClient)

    const result = await loadViewerData('REN-1234')
    expect(result.teamName).toBe('Renegades')
    expect(result.sft_games).toEqual([{ id: 'g1' }])
    expect(result.sft_roster).toEqual([{ id: 'p1', name: 'Alice' }])
  })
})
```

- [ ] **Step 1.2: Run tests to verify they fail**

```bash
cd /Users/emilysewell/Documents/Github\ Projects/softball-tracker
npx vitest run src/tests/sync.viewer.test.js
```

Expected: FAIL — `loadViewerData` not exported

- [ ] **Step 1.3: Implement `loadViewerData` in `src/sync.js`**

Append at the end of `src/sync.js`:

```js
// ── Load team data for viewer mode (no PIN required) ──────────
// Returns { teamName, sft_games, sft_roster, sft_schedule, ... }
// Does NOT write to localStorage — ViewerPage uses this data directly.
export async function loadViewerData(shortId) {
  const client = getSupabase()
  if (!client) throw new Error('Cloud sync not configured')

  const { data: team, error: teamError } = await client
    .from('teams')
    .select('id, name, short_id')
    .eq('short_id', shortId.trim().toUpperCase())
    .single()
  if (teamError || !team) throw new Error('Team not found — check the link.')

  const { data: rows, error: dataError } = await client
    .from('team_data')
    .select('key, value')
    .eq('team_id', team.id)
  if (dataError) throw new Error('Failed to load team data.')

  const reverseKeys = Object.fromEntries(
    Object.entries(SYNC_KEYS).map(([localKey, remoteKey]) => [remoteKey, localKey])
  )

  const result = { teamName: team.name }
  for (const row of (rows || [])) {
    const localKey = reverseKeys[row.key]
    if (localKey) result[localKey] = row.value
  }
  return result
}
```

- [ ] **Step 1.4: Run tests to verify they pass**

```bash
npx vitest run src/tests/sync.viewer.test.js
```

Expected: all 3 tests PASS

- [ ] **Step 1.5: Commit**

```bash
git add src/sync.js src/tests/sync.viewer.test.js
git commit -m "feat: loadViewerData — fetch team data by short ID without PIN"
```

---

## Task 2: Create `ViewerPage.jsx`

**Files:**
- Create: `src/pages/ViewerPage.jsx`
- Create: `src/tests/ViewerPage.test.jsx`

ViewerPage receives `data` (the result of `loadViewerData`) and renders:
- Team name + "Viewer mode" badge
- Active game score (if `sft_active_game` is present in data)
- Upcoming schedule (next 3 fixtures from `sft_schedule`)
- Season record (W/L/D from `sft_games`)
- A "Refresh" button that triggers a callback to re-fetch

- [ ] **Step 2.1: Write the failing tests**

Create `src/tests/ViewerPage.test.jsx`:

```jsx
import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect } from 'vitest'
import ViewerPage from '../pages/ViewerPage'

const today = new Date().toISOString().split('T')[0]
const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

const baseData = {
  teamName: 'Renegades',
  sft_games: [],
  sft_schedule: [],
  sft_active_game: null,
}

describe('ViewerPage', () => {
  it('shows team name', () => {
    render(<ViewerPage data={baseData} onRefresh={() => {}} />)
    expect(screen.getByText('Renegades')).toBeInTheDocument()
  })

  it('shows viewer mode badge', () => {
    render(<ViewerPage data={baseData} onRefresh={() => {}} />)
    expect(screen.getByText(/viewer/i)).toBeInTheDocument()
  })

  it('shows active game score when a game is in progress', () => {
    const data = {
      ...baseData,
      sft_active_game: {
        setup: { home: 'Renegades', away: 'Bulls' },
        homeScore: 4,
        awayScore: 2,
        inning: 3,
        half: 'top',
      },
    }
    render(<ViewerPage data={data} onRefresh={() => {}} />)
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText(/in progress/i)).toBeInTheDocument()
  })

  it('shows upcoming fixtures', () => {
    const data = {
      ...baseData,
      sft_schedule: [
        { id: 'f1', date: tomorrow, opponent: 'Eagles', gameType: 'League', location: 'Home' },
      ],
    }
    render(<ViewerPage data={data} onRefresh={() => {}} />)
    expect(screen.getByText('Eagles')).toBeInTheDocument()
  })

  it('shows season record from completed games', () => {
    const data = {
      ...baseData,
      sft_games: [
        { id: 'g1', result: 'W' },
        { id: 'g2', result: 'W' },
        { id: 'g3', result: 'L' },
      ],
    }
    render(<ViewerPage data={data} onRefresh={() => {}} />)
    expect(screen.getByText('2W')).toBeInTheDocument()
    expect(screen.getByText('1L')).toBeInTheDocument()
  })

  it('calls onRefresh when Refresh button clicked', () => {
    const onRefresh = vi.fn()
    render(<ViewerPage data={baseData} onRefresh={onRefresh} />)
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
    expect(onRefresh).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2.2: Run tests to verify they fail**

```bash
npx vitest run src/tests/ViewerPage.test.jsx
```

Expected: FAIL — `ViewerPage` module not found

- [ ] **Step 2.3: Create `src/pages/ViewerPage.jsx`**

```jsx
import { CalendarDays, RefreshCw } from 'lucide-react'

export default function ViewerPage({ data, onRefresh }) {
  const { teamName, sft_games = [], sft_schedule = [], sft_active_game: activeGame } = data
  const today = new Date().toISOString().split('T')[0]

  // Season record
  const record = sft_games.reduce(
    (r, g) => { if (g.result === 'W') r.W++; else if (g.result === 'L') r.L++; else if (g.result === 'D') r.D++; return r },
    { W: 0, L: 0, D: 0 }
  )
  const gamesPlayed = record.W + record.L + record.D

  // Upcoming fixtures
  const upcoming = sft_schedule
    .filter(g => g.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 3)

  return (
    <div className="max-w-lg mx-auto p-4 pb-16">
      {/* Header */}
      <div className="text-center py-6">
        <h1 className="text-2xl font-black tracking-tight text-gray-800">{teamName}</h1>
        <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">
          👁 Viewer mode
        </span>
      </div>

      <div className="space-y-3">
        {/* Active game */}
        {activeGame && (
          <div className="card border-2 border-amber-400 bg-amber-50 p-4">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2 flex items-center gap-1">
              ▶ Game in progress
            </p>
            <p className="text-center text-sm font-semibold text-gray-700 mb-2">
              {activeGame.setup?.away} @ {activeGame.setup?.home}
            </p>
            <div className="flex items-center justify-center gap-6">
              <div className="text-center">
                <p className="text-xs text-gray-500 font-semibold">{activeGame.setup?.away}</p>
                <p className="text-4xl font-black text-gray-800">{activeGame.awayScore ?? 0}</p>
              </div>
              <div className="text-xl text-gray-300 font-light">–</div>
              <div className="text-center">
                <p className="text-xs text-gray-500 font-semibold">{activeGame.setup?.home}</p>
                <p className="text-4xl font-black text-gray-800">{activeGame.homeScore ?? 0}</p>
              </div>
            </div>
            <p className="text-center text-xs text-amber-700 mt-2">
              Inning {activeGame.inning} · {activeGame.half === 'top' ? 'Top' : 'Bottom'}
            </p>
          </div>
        )}

        {/* Season record */}
        {gamesPlayed > 0 && (
          <div className="card p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100">
            <p className="text-xs font-semibold text-blue-500 uppercase tracking-wide mb-1">Season Record</p>
            <div className="flex items-center gap-3">
              <span className="text-2xl font-black text-green-600">{record.W}W</span>
              <span className="text-2xl font-black text-red-500">{record.L}L</span>
              {record.D > 0 && <span className="text-2xl font-black text-gray-500">{record.D}D</span>}
              <span className="text-sm text-gray-400 ml-auto">{gamesPlayed} game{gamesPlayed !== 1 ? 's' : ''}</span>
            </div>
          </div>
        )}

        {/* Upcoming fixtures */}
        {upcoming.length > 0 && (
          <div className="card p-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <CalendarDays size={12} /> Upcoming
            </p>
            <ul className="space-y-2">
              {upcoming.map(g => (
                <li key={g.id} className="flex items-center gap-2">
                  <div className="text-center bg-blue-50 rounded px-2 py-1 min-w-10 shrink-0">
                    <p className="text-xs font-bold text-blue-700">
                      {new Date(g.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">vs {g.opponent}</p>
                    <p className="text-xs text-gray-500">
                      {g.location === 'Home' ? '🏠 Home' : g.location === 'Away' ? '✈️ Away' : ''}
                      {g.time ? ' · ' + g.time : ''}
                    </p>
                  </div>
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded shrink-0">
                    {g.gameType || 'Game'}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* No data yet */}
        {!activeGame && gamesPlayed === 0 && upcoming.length === 0 && (
          <div className="card text-center py-8 text-gray-400">
            <p className="text-4xl mb-2">⚾</p>
            <p>No data yet for this team.</p>
          </div>
        )}

        {/* Refresh */}
        <button
          onClick={onRefresh}
          className="btn btn-ghost btn-md w-full gap-2 border border-gray-200"
        >
          <RefreshCw size={16} /> Refresh
        </button>

        <p className="text-center text-xs text-gray-400 pt-2">
          Read-only view · <a href={window.location.origin + window.location.pathname} className="underline">Manage team</a>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2.4: Run tests to verify they pass**

```bash
npx vitest run src/tests/ViewerPage.test.jsx
```

Expected: all 6 tests PASS

- [ ] **Step 2.5: Commit**

```bash
git add src/pages/ViewerPage.jsx src/tests/ViewerPage.test.jsx
git commit -m "feat: ViewerPage — read-only team view for teammates"
```

---

## Task 3: Wire viewer mode into App.jsx

**Files:**
- Modify: `src/App.jsx`

On load, check `new URLSearchParams(window.location.search).get('view')`. If present, fetch data and render `ViewerPage` instead of the normal app flow.

- [ ] **Step 3.1: Write the failing test**

Create `src/tests/App.viewer.test.jsx`:

```jsx
import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import App from '../App'
import * as syncModule from '../sync'

beforeEach(() => {
  localStorage.clear()
})

describe('App viewer mode', () => {
  it('renders ViewerPage when ?view=REN-1234 is in URL', async () => {
    vi.stubGlobal('location', { ...window.location, search: '?view=REN-1234' })

    vi.spyOn(syncModule, 'loadViewerData').mockResolvedValue({
      teamName: 'Renegades',
      sft_games: [],
      sft_schedule: [],
      sft_active_game: null,
    })

    render(<App />)

    await waitFor(() => expect(screen.getByText('Renegades')).toBeInTheDocument())
    expect(screen.getByText(/viewer mode/i)).toBeInTheDocument()

    vi.unstubAllGlobals()
  })

  it('shows loading state while fetching viewer data', () => {
    vi.stubGlobal('location', { ...window.location, search: '?view=REN-1234' })

    vi.spyOn(syncModule, 'loadViewerData').mockReturnValue(new Promise(() => {})) // never resolves

    render(<App />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()

    vi.unstubAllGlobals()
  })

  it('shows error when team not found', async () => {
    vi.stubGlobal('location', { ...window.location, search: '?view=XXX-0000' })

    vi.spyOn(syncModule, 'loadViewerData').mockRejectedValue(new Error('Team not found — check the link.'))

    render(<App />)
    await waitFor(() => expect(screen.getByText(/team not found/i)).toBeInTheDocument())

    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 3.2: Run tests to verify they fail**

```bash
npx vitest run src/tests/App.viewer.test.jsx
```

Expected: FAIL — viewer mode not implemented

- [ ] **Step 3.3: Update `src/App.jsx`**

**a) Add imports** — add `ViewerPage` and `loadViewerData`:

```jsx
import ViewerPage from './pages/ViewerPage'
import { pushKey, pullAllData, flushQueue, loadViewerData } from './sync'
```

**b) Add viewer state** — add these `useState`/`useEffect` hooks BEFORE the `if (!onboarded)` early return (i.e., after the other hooks). Because viewer mode is independent from the normal app flow, use a lazy initializer to detect the URL param immediately:

```jsx
const [viewerShortId] = useState(() => new URLSearchParams(window.location.search).get('view'))
const [viewerData, setViewerData] = useState(null)
const [viewerError, setViewerError] = useState(null)
const [viewerLoading, setViewerLoading] = useState(!!viewerShortId)

useEffect(() => {
  if (!viewerShortId) return
  loadViewerData(viewerShortId)
    .then(d => { setViewerData(d); setViewerLoading(false) })
    .catch(e => { setViewerError(e.message); setViewerLoading(false) })
}, [viewerShortId])
```

**c) Add viewer mode gate** — add this block BEFORE the `if (!onboarded)` check:

```jsx
if (viewerShortId) {
  if (viewerLoading) return (
    <div className="max-w-lg mx-auto p-8 text-center text-gray-400 mt-16">
      <p className="text-4xl mb-4">⚾</p>
      <p className="font-semibold">Loading team…</p>
    </div>
  )
  if (viewerError) return (
    <div className="max-w-lg mx-auto p-8 text-center text-gray-400 mt-16">
      <p className="text-4xl mb-4">😕</p>
      <p className="font-semibold text-red-500">{viewerError}</p>
      <p className="text-sm mt-2">Check the link and try again.</p>
    </div>
  )
  if (viewerData) return (
    <ViewerPage
      data={viewerData}
      onRefresh={() => {
        setViewerLoading(true)
        loadViewerData(viewerShortId)
          .then(d => { setViewerData(d); setViewerLoading(false) })
          .catch(e => { setViewerError(e.message); setViewerLoading(false) })
      }}
    />
  )
}
```

- [ ] **Step 3.4: Run tests to verify they pass**

```bash
npx vitest run src/tests/App.viewer.test.jsx
```

Expected: all 3 tests PASS

- [ ] **Step 3.5: Commit**

```bash
git add src/App.jsx src/tests/App.viewer.test.jsx
git commit -m "feat: viewer mode gate in App — render ViewerPage for ?view=SHORT_ID URLs"
```

---

## Task 4: "Copy viewer link" button in AdminPage

**Files:**
- Modify: `src/pages/AdminPage.jsx`

The existing `TeamIdSection` already shows the Short Team ID and has a copy button. Add a second "Copy viewer link" button that copies the full URL with `?view=SHORT_ID`.

- [ ] **Step 4.1: Write the failing test**

Create `src/tests/AdminPage.viewerlink.test.jsx`:

```jsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import AdminPage from '../pages/AdminPage'
import * as storage from '../storage'

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('sft_pin', JSON.stringify('1234'))
  vi.spyOn(storage, 'getRoster').mockReturnValue([])
  vi.spyOn(storage, 'getDivision').mockReturnValue('Division 1')
  vi.spyOn(storage, 'getTeams').mockReturnValue([])
  vi.spyOn(storage, 'getSchedule').mockReturnValue([])
  vi.spyOn(storage, 'getTeamConfig').mockReturnValue({
    name: 'Renegades', division: 'Division 1', setupComplete: true,
    teamId: 'team-uuid', shortId: 'REN-1234',
  })
})

describe('AdminPage viewer link', () => {
  it('shows Copy viewer link button when shortId exists', async () => {
    render(<AdminPage onBack={() => {}} />)
    // Unlock with PIN
    fireEvent.change(screen.getByPlaceholderText(/pin/i), { target: { value: '1234' } })
    fireEvent.click(screen.getByRole('button', { name: /unlock/i }))
    await waitFor(() => expect(screen.getByText(/copy viewer link/i)).toBeInTheDocument())
  })
})
```

- [ ] **Step 4.2: Run test to verify it fails**

```bash
npx vitest run src/tests/AdminPage.viewerlink.test.jsx
```

Expected: FAIL — "Copy viewer link" not found

- [ ] **Step 4.3: Add viewer link button to `TeamIdSection` in `src/pages/AdminPage.jsx`**

Find the `TeamIdSection` component in AdminPage.jsx. It currently has a "Copy Team ID" button. Add a second button below it for the viewer link.

After the existing copy button (inside `TeamIdSection`), add:

```jsx
<button
  onClick={() => {
    const url = `${window.location.origin}${window.location.pathname}?view=${shortId}`
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url).then(() => {
        setLinkCopied(true)
        setTimeout(() => setLinkCopied(false), 1500)
      }).catch(() => {})
    }
  }}
  className="btn btn-ghost btn-sm text-xs mt-1"
>
  {linkCopied ? '✅ Copied!' : '🔗 Copy viewer link'}
</button>
```

And add the corresponding state at the top of `TeamIdSection`:

```jsx
const [linkCopied, setLinkCopied] = useState(false)
```

- [ ] **Step 4.4: Run test to verify it passes**

```bash
npx vitest run src/tests/AdminPage.viewerlink.test.jsx
```

Expected: PASS

- [ ] **Step 4.5: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 4.6: Commit**

```bash
git add src/pages/AdminPage.jsx src/tests/AdminPage.viewerlink.test.jsx
git commit -m "feat: copy viewer link button in Admin — share read-only team view with teammates"
```

---

## Self-Review Checklist

- [x] `loadViewerData` fetches by Short ID without PIN (Task 1)
- [x] `ViewerPage` shows: team name, active game score, upcoming fixtures, season record (Task 2)
- [x] Refresh button re-fetches from Supabase (Task 2)
- [x] App detects `?view=SHORT_ID` before onboarding/cloud gate (Task 3)
- [x] Loading and error states handled gracefully (Task 3)
- [x] "Copy viewer link" button in Admin copies full URL with `?view=` param (Task 4)
- [x] No PIN required for viewer mode
- [x] All behaviour tested before implementation
- [x] Viewer mode hooks declared before early returns in App.jsx (React Rules of Hooks)
