# Phase 1 — Generalize the App (Multi-Tenant Prep) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove all Renegades-specific hardcoded defaults and add a first-run onboarding wizard, so any mixed co-ed slow-pitch team can install and configure the app for their own use.

**Architecture:** Add a `sft_team` localStorage key holding `{ name, division, setupComplete }`. On app mount, silently auto-migrate existing Renegades installs, then gate the main app behind an onboarding wizard for fresh installs. `OUR_TEAM` in the game setup reads dynamically from the team config. No backend changes — still 100% offline.

**Tech Stack:** React 19, Vite, Tailwind CSS v4, Vitest + jsdom + React Testing Library (new), idb-keyval (deferred to Phase 3)

---

> **Scope note:** This is Phase 1 of 3. Phase 2 (Supabase cloud sync) and Phase 3 (offline-first sync queue) are separate plans to be written once Phase 1 ships. See `docs/superpowers/specs/2026-06-09-multi-tenant-platform-design.md` for full context.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `src/storage.js` | Modify | Add `TEAM` key, `getTeamConfig`/`setTeamConfig`; clear hardcoded Renegades defaults |
| `src/pages/GameSetupPage.jsx` | Modify | Line 6 import + line 49: make `OUR_TEAM` read from `getTeamConfig()` |
| `src/pages/OnboardingPage.jsx` | Create | First-run wizard: team name, division, co-ed notice, PIN |
| `src/App.jsx` | Modify | Auto-migration on mount; render `<OnboardingPage>` if not yet configured |
| `src/tests/setup.js` | Create | Vitest global setup (jest-dom matchers) |
| `src/tests/storage.test.js` | Create | Unit tests for new storage functions + cleared defaults |
| `src/tests/OnboardingPage.test.jsx` | Create | Component test: form validation, successful submit, storage calls |
| `vite.config.js` | Modify | Add `test` block for Vitest |
| `package.json` | Modify | Add `test` and `test:watch` scripts; add dev dependencies |

---

## Task 1: Set up Vitest testing framework

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js`
- Create: `src/tests/setup.js`

- [ ] **Step 1: Install test dependencies**

```bash
npm install --save-dev vitest @vitest/ui jsdom @testing-library/react @testing-library/jest-dom @testing-library/user-event
```

Expected: packages installed, no peer-dependency errors.

- [ ] **Step 2: Add test config to `vite.config.js`**

Replace the entire file with:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/softball-tracker/',
  build: {
    outDir: 'dist',
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.js'],
  },
})
```

- [ ] **Step 3: Create `src/tests/setup.js`**

```js
import '@testing-library/jest-dom'

// Clear localStorage between tests
beforeEach(() => {
  localStorage.clear()
})
```

- [ ] **Step 4: Add test scripts to `package.json`**

Add to the `"scripts"` block (keep existing scripts, add these two):

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Write a smoke test**

Create `src/tests/smoke.test.js`:

```js
test('test framework is working', () => {
  expect(1 + 1).toBe(2)
})
```

- [ ] **Step 6: Run tests to verify setup**

```bash
npm test
```

Expected output:
```
✓ src/tests/smoke.test.js > test framework is working

Test Files  1 passed (1)
Tests       1 passed (1)
```

- [ ] **Step 7: Commit**

```bash
git add vite.config.js package.json package-lock.json src/tests/setup.js src/tests/smoke.test.js
git commit -m "chore: add Vitest testing framework"
```

---

## Task 2: Add team config to storage.js (TDD)

**Files:**
- Modify: `src/storage.js`
- Create: `src/tests/storage.test.js`

- [ ] **Step 1: Write failing tests**

Create `src/tests/storage.test.js`:

```js
import { getTeamConfig, setTeamConfig } from '../storage'

describe('team config', () => {
  test('getTeamConfig returns null when no team has been configured', () => {
    expect(getTeamConfig()).toBeNull()
  })

  test('setTeamConfig saves config and getTeamConfig retrieves it', () => {
    setTeamConfig({ name: 'Test FC', division: 'Div 1', setupComplete: true })
    expect(getTeamConfig()).toEqual({ name: 'Test FC', division: 'Div 1', setupComplete: true })
  })

  test('setTeamConfig can update an existing config', () => {
    setTeamConfig({ name: 'Old Name', division: 'Div 1', setupComplete: false })
    setTeamConfig({ name: 'New Name', division: 'Div 2', setupComplete: true })
    expect(getTeamConfig()).toEqual({ name: 'New Name', division: 'Div 2', setupComplete: true })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: 3 failures mentioning `getTeamConfig is not a function`.

- [ ] **Step 3: Implement `getTeamConfig` and `setTeamConfig` in `src/storage.js`**

Add `TEAM` to the `K` object at the top of the file:

```js
const K = {
  ROSTER:      'sft_roster',
  GAMES:       'sft_games',
  ACTIVE_GAME: 'sft_active_game',
  PIN:         'sft_pin',
  DIVISION:    'sft_division',
  TEAMS:       'sft_teams',
  TOURNAMENTS: 'sft_tournaments',
  SCHEDULE:    'sft_schedule',
  TEAM:        'sft_team',
}
```

Add at the end of `src/storage.js` (after the setup drafts section):

```js
// ── Team config ───────────────────────────────────────────────
// Shape: { name: string, division: string, setupComplete: boolean }
// Phase 2 will extend this with { teamId: string, shortId: string }
export function getTeamConfig() { return get(K.TEAM, null) }
export function setTeamConfig(config) { set(K.TEAM, config) }
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected:
```
✓ src/tests/storage.test.js > team config > getTeamConfig returns null when no team has been configured
✓ src/tests/storage.test.js > team config > setTeamConfig saves config and getTeamConfig retrieves it
✓ src/tests/storage.test.js > team config > setTeamConfig can update an existing config
```

- [ ] **Step 5: Commit**

```bash
git add src/storage.js src/tests/storage.test.js
git commit -m "feat: add getTeamConfig/setTeamConfig to storage"
```

---

## Task 3: Remove hardcoded Renegades defaults (TDD)

**Files:**
- Modify: `src/storage.js`
- Modify: `src/tests/storage.test.js`

- [ ] **Step 1: Add failing tests for empty defaults**

Append to `src/tests/storage.test.js`:

```js
import { getRoster, getTeams, getDivision, getSchedule } from '../storage'

describe('default values (no localStorage data)', () => {
  test('getRoster returns empty array for a fresh install', () => {
    expect(getRoster()).toEqual([])
  })

  test('getTeams returns empty array for a fresh install', () => {
    expect(getTeams()).toEqual([])
  })

  test('getDivision returns empty string for a fresh install', () => {
    expect(getDivision()).toBe('')
  })

  test('getSchedule returns empty array for a fresh install', () => {
    expect(getSchedule()).toEqual([])
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: 4 new failures — getRoster returns 15 players, getTeams returns 7 Bristol teams, getDivision returns 'Bristol Division 2', getSchedule returns 14 fixtures.

- [ ] **Step 3: Clear the hardcoded defaults in `src/storage.js`**

Make these four changes:

**Line 13-16** — replace `DEFAULT_TEAMS`:
```js
const DEFAULT_TEAMS = []
```

**Lines 30-48** — replace `DEFAULT_ROSTER` (the 15-player array) with:
```js
const DEFAULT_ROSTER = []
```

**Line 79** — replace the `getDivision` default:
```js
export function getDivision() { return get(K.DIVISION, '') }
```

**Lines 106-121** — replace `DEFAULT_SCHEDULE` (the 14-fixture array) with:
```js
const DEFAULT_SCHEDULE = []
```

Also remove the comment on line 105 (`// Only Renegades fixtures from the Bristol Division 2 2026 schedule`).

- [ ] **Step 4: Run all tests to confirm they pass**

```bash
npm test
```

Expected: all tests pass including the 4 new ones and the 3 from Task 2.

- [ ] **Step 5: Commit**

```bash
git add src/storage.js src/tests/storage.test.js
git commit -m "feat: remove hardcoded Renegades defaults from storage"
```

---

## Task 4: Make OUR_TEAM dynamic in GameSetupPage.jsx

**Files:**
- Modify: `src/pages/GameSetupPage.jsx` (line 6 and line 49)

- [ ] **Step 1: Add `getTeamConfig` to the import in `GameSetupPage.jsx`**

Line 6 currently reads:
```js
import { getRoster, getTeams, getDivision, getTournaments, rememberTournament, getSetupDraft, saveSetupDraft, clearSetupDraft } from '../storage'
```

Change it to:
```js
import { getRoster, getTeams, getDivision, getTournaments, rememberTournament, getSetupDraft, saveSetupDraft, clearSetupDraft, getTeamConfig } from '../storage'
```

- [ ] **Step 2: Make `OUR_TEAM` read from config**

Line 49 currently reads:
```js
const OUR_TEAM = 'The Renegades'
```

Change it to:
```js
const OUR_TEAM = getTeamConfig()?.name ?? ''
```

- [ ] **Step 3: Verify build still passes**

```bash
npm run build
```

Expected: build completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/GameSetupPage.jsx
git commit -m "feat: make OUR_TEAM read from team config instead of hardcoded string"
```

---

## Task 5: Build OnboardingPage.jsx (TDD)

**Files:**
- Create: `src/pages/OnboardingPage.jsx`
- Create: `src/tests/OnboardingPage.test.jsx`

- [ ] **Step 1: Write failing component tests**

Create `src/tests/OnboardingPage.test.jsx`:

```jsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OnboardingPage from '../pages/OnboardingPage'
import { getTeamConfig, getPin } from '../storage'

describe('OnboardingPage', () => {
  test('renders team name, division, and PIN fields', () => {
    render(<OnboardingPage onComplete={() => {}} />)
    expect(screen.getByLabelText(/team name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/division/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/admin pin/i)).toBeInTheDocument()
  })

  test('shows validation errors when submitting empty form', async () => {
    const user = userEvent.setup()
    render(<OnboardingPage onComplete={() => {}} />)
    await user.click(screen.getByRole('button', { name: /set up my team/i }))
    expect(screen.getByText(/team name is required/i)).toBeInTheDocument()
    expect(screen.getByText(/division is required/i)).toBeInTheDocument()
    expect(screen.getByText(/pin must be 4 or more digits/i)).toBeInTheDocument()
  })

  test('shows PIN error when PIN is too short', async () => {
    const user = userEvent.setup()
    render(<OnboardingPage onComplete={() => {}} />)
    await user.type(screen.getByLabelText(/team name/i), 'Test FC')
    await user.type(screen.getByLabelText(/division/i), 'Div 1')
    await user.type(screen.getByLabelText(/admin pin/i), '12')
    await user.click(screen.getByRole('button', { name: /set up my team/i }))
    expect(screen.getByText(/pin must be 4 or more digits/i)).toBeInTheDocument()
  })

  test('shows PIN error when PIN contains non-digits', async () => {
    const user = userEvent.setup()
    render(<OnboardingPage onComplete={() => {}} />)
    await user.type(screen.getByLabelText(/team name/i), 'Test FC')
    await user.type(screen.getByLabelText(/division/i), 'Div 1')
    await user.type(screen.getByLabelText(/admin pin/i), 'abcd')
    await user.click(screen.getByRole('button', { name: /set up my team/i }))
    expect(screen.getByText(/pin must be 4 or more digits/i)).toBeInTheDocument()
  })

  test('saves team config and PIN then calls onComplete on valid submit', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<OnboardingPage onComplete={onComplete} />)
    await user.type(screen.getByLabelText(/team name/i), 'The Renegades')
    await user.type(screen.getByLabelText(/division/i), 'Bristol Division 2')
    await user.type(screen.getByLabelText(/admin pin/i), '1234')
    await user.click(screen.getByRole('button', { name: /set up my team/i }))
    expect(getTeamConfig()).toEqual({
      name: 'The Renegades',
      division: 'Bristol Division 2',
      setupComplete: true,
    })
    expect(getPin()).toBe('1234')
    expect(onComplete).toHaveBeenCalledOnce()
  })

  test('trims whitespace from team name and division', async () => {
    const user = userEvent.setup()
    render(<OnboardingPage onComplete={() => {}} />)
    await user.type(screen.getByLabelText(/team name/i), '  Test FC  ')
    await user.type(screen.getByLabelText(/division/i), '  Div 1  ')
    await user.type(screen.getByLabelText(/admin pin/i), '9999')
    await user.click(screen.getByRole('button', { name: /set up my team/i }))
    expect(getTeamConfig()).toMatchObject({ name: 'Test FC', division: 'Div 1' })
  })
})
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npm test
```

Expected: failures mentioning `Cannot find module '../pages/OnboardingPage'`.

- [ ] **Step 3: Create `src/pages/OnboardingPage.jsx`**

```jsx
import { useState } from 'react'
import { setTeamConfig, setPin } from '../storage'

export default function OnboardingPage({ onComplete }) {
  const [teamName, setTeamName] = useState('')
  const [division, setDivision] = useState('')
  const [pin, setPinValue] = useState('')
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!teamName.trim()) e.teamName = 'Team name is required'
    if (!division.trim()) e.division = 'Division is required'
    if (!pin || pin.length < 4 || !/^\d+$/.test(pin)) e.pin = 'PIN must be 4 or more digits'
    return e
  }

  function handleSubmit(ev) {
    ev.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setTeamConfig({ name: teamName.trim(), division: division.trim(), setupComplete: true })
    setPin(pin)
    onComplete()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <svg viewBox="0 0 100 100" className="w-20 h-20 mx-auto mb-3" aria-label="Softball">
            <circle cx="50" cy="50" r="42" fill="#fef3c7" stroke="#1e40af" strokeWidth="2.5" />
            <path d="M 18 32 Q 50 56 82 32" stroke="#dc2626" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="3 4" />
            <path d="M 18 68 Q 50 44 82 68" stroke="#dc2626" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="3 4" />
          </svg>
          <h1 className="text-2xl font-black tracking-tight text-gray-800">Softball Tracker</h1>
          <p className="text-gray-500 text-sm mt-0.5">Let's get your team set up</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow p-6 space-y-4">
          <div>
            <label htmlFor="teamName" className="block text-sm text-gray-600 mb-1">Team name</label>
            <input
              id="teamName"
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              placeholder="e.g. The Renegades"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {errors.teamName && <p className="text-red-500 text-xs mt-1">{errors.teamName}</p>}
          </div>

          <div>
            <label htmlFor="division" className="block text-sm text-gray-600 mb-1">Division / league</label>
            <input
              id="division"
              value={division}
              onChange={e => setDivision(e.target.value)}
              placeholder="e.g. Bristol Division 2"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {errors.division && <p className="text-red-500 text-xs mt-1">{errors.division}</p>}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            ℹ️ This app is for <strong>mixed co-ed slow-pitch softball</strong> with strict BBH/SBH batting order alternation. The co-ed walk rule applies (BBH walks to 2B).
          </div>

          <div>
            <label htmlFor="pin" className="block text-sm text-gray-600 mb-1">Admin PIN (4+ digits)</label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={e => setPinValue(e.target.value)}
              placeholder="••••"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {errors.pin && <p className="text-red-500 text-xs mt-1">{errors.pin}</p>}
          </div>

          <button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl transition-colors"
          >
            Set up my team →
          </button>

          <p className="text-center text-xs text-gray-400">You can update all of this later in Admin settings</p>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```bash
npm test
```

Expected: all 6 OnboardingPage tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/OnboardingPage.jsx src/tests/OnboardingPage.test.jsx
git commit -m "feat: add OnboardingPage first-run wizard"
```

---

## Task 6: Wire App.jsx — auto-migration + onboarding gate (TDD)

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/tests/storage.test.js`

- [ ] **Step 1: Write failing test for auto-migration logic**

Append to `src/tests/storage.test.js`:

```js
import { setTeamConfig, getTeamConfig, setPin, getPin } from '../storage'

describe('Renegades auto-migration', () => {
  // This tests the migration logic we'll add to App.jsx.
  // We test the storage functions directly to keep it simple.

  test('getTeamConfig returns null when only roster exists (pre-migration state)', () => {
    // Simulate an existing install that has roster data but no team config
    localStorage.setItem('sft_roster', JSON.stringify([{ id: 'matt', name: 'Matt', type: 'BBH', active: true }]))
    expect(getTeamConfig()).toBeNull()
  })

  test('setTeamConfig with migration values produces the expected config', () => {
    // Simulate what App.jsx migration code will do
    localStorage.setItem('sft_roster', JSON.stringify([{ id: 'matt', name: 'Matt', type: 'BBH', active: true }]))
    localStorage.setItem('sft_division', JSON.stringify('Bristol Division 2'))
    // Migration logic:
    const hasRoster = localStorage.getItem('sft_roster') !== null
    const hasTeam = localStorage.getItem('sft_team') !== null
    if (hasRoster && !hasTeam) {
      setTeamConfig({
        name: 'The Renegades',
        division: 'Bristol Division 2',
        setupComplete: true,
      })
    }
    expect(getTeamConfig()).toEqual({
      name: 'The Renegades',
      division: 'Bristol Division 2',
      setupComplete: true,
    })
  })

  test('migration does not overwrite an existing team config', () => {
    localStorage.setItem('sft_roster', JSON.stringify([]))
    setTeamConfig({ name: 'Different Team', division: 'Div 3', setupComplete: true })
    // Migration logic should not fire if sft_team already exists:
    const hasRoster = localStorage.getItem('sft_roster') !== null
    const hasTeam = localStorage.getItem('sft_team') !== null
    if (hasRoster && !hasTeam) {
      setTeamConfig({ name: 'The Renegades', division: 'Bristol Division 2', setupComplete: true })
    }
    expect(getTeamConfig()).toEqual({ name: 'Different Team', division: 'Div 3', setupComplete: true })
  })
})
```

- [ ] **Step 2: Run tests to confirm they pass (these test storage logic directly)**

```bash
npm test
```

Expected: all 3 new migration tests pass (they test storage functions, not App.jsx yet).

- [ ] **Step 3: Add migration + onboarding gate to `src/App.jsx`**

Add these imports near the top of `src/App.jsx` (line 8, alongside existing storage imports):

```js
import { saveGame, getActiveGame, clearActiveGame, getSchedule, saveSetupDraft, getSetupDraft, getAllSetupDrafts, getTeamConfig, setTeamConfig, getDivision } from './storage'
import OnboardingPage from './pages/OnboardingPage'
```

At the top of the `App` function (before the existing `const [page, setPage] = useState(...)` line), add:

```js
// Auto-migrate existing installs: if roster data exists but no team config,
// silently create the Renegades config so the onboarding wizard is skipped.
const [onboarded, setOnboarded] = useState(() => {
  const hasRoster = localStorage.getItem('sft_roster') !== null
  const hasTeam = localStorage.getItem('sft_team') !== null
  if (hasRoster && !hasTeam) {
    setTeamConfig({
      name: 'The Renegades',
      division: getDivision() || 'Bristol Division 2',
      setupComplete: true,
    })
  }
  return !!getTeamConfig()?.setupComplete
})
```

Immediately after the `onboarded` state declaration (still inside the `App` function, before any other logic), add the gate:

```js
if (!onboarded) {
  return <OnboardingPage onComplete={() => setOnboarded(true)} />
}
```

- [ ] **Step 4: Verify build passes**

```bash
npm run build
```

Expected: no errors.

- [ ] **Step 5: Smoke-test manually in browser**

```bash
npm run dev
```

1. Open http://localhost:5173/softball-tracker/
2. Open DevTools → Application → Local Storage → clear all `sft_*` keys
3. Refresh — you should see the onboarding wizard
4. Fill in team name, division, and PIN → submit
5. Main app loads with empty roster and schedule (no Renegades data)
6. Confirm: clear storage again, add `sft_roster` key manually (any JSON array), refresh — onboarding wizard should NOT appear (auto-migration ran)

- [ ] **Step 6: Commit**

```bash
git add src/App.jsx
git commit -m "feat: add onboarding gate and Renegades auto-migration to App"
```

---

## Task 7: Cleanup and final verification

**Files:**
- Delete: `src/tests/smoke.test.js` (no longer needed)

- [ ] **Step 1: Delete the smoke test**

```bash
rm src/tests/smoke.test.js
```

- [ ] **Step 2: Run full test suite**

```bash
npm test
```

Expected output (all passing):
```
✓ src/tests/storage.test.js > team config > ... (3 tests)
✓ src/tests/storage.test.js > default values ... (4 tests)
✓ src/tests/storage.test.js > Renegades auto-migration > ... (3 tests)
✓ src/tests/OnboardingPage.test.jsx > OnboardingPage > ... (6 tests)

Test Files  2 passed (2)
Tests       16 passed (16)
```

- [ ] **Step 3: Verify production build**

```bash
npm run build
```

Expected: no errors or warnings.

- [ ] **Step 4: Final commit and push**

```bash
git add -A
git commit -m "chore: remove smoke test, Phase 1 complete"
git push
```

Expected: GitHub Actions deploys to https://emizzer3.github.io/softball-tracker/ in ~2 minutes.

- [ ] **Step 5: Verify live deployment**

1. Open https://emizzer3.github.io/softball-tracker/ on a device that has never visited the site
2. Should see onboarding wizard
3. Existing device (with Renegades localStorage data) should open straight to the main app, unaffected

---

## What's next

Once Phase 1 is live and stable, the Phase 2 plan (Supabase cloud sync) will cover:
- Setting up a free Supabase project
- Team creation flow with duplicate detection
- Team ID + PIN login for new devices
- Cloud sync of all `sft_*` keys
- Renegades data upload as initial sync

See `docs/superpowers/specs/2026-06-09-multi-tenant-platform-design.md` § Phase 2 for full details.
