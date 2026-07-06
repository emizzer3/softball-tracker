# Phase 2 — Supabase Cloud Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add optional Supabase cloud sync so any team can create an account, access their data from multiple devices, and log in with a Short Team ID + PIN.

**Architecture:** A new `src/sync.js` module owns all Supabase operations. Components call `pushKey(localStorageKey)` after writes (fire-and-forget). A new `CloudConnectPage` is gated between onboarding and the main app — shown once, then never again. The `sft_team` shape is extended with `teamId` and `shortId`.

**Tech Stack:** `@supabase/supabase-js` v2, Supabase free-tier (PostgreSQL), Web Crypto API (`crypto.subtle`) for SHA-256 PIN hashing, Vitest + @testing-library/react for tests.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/sync.js` | **Create** | Supabase client, hashPin, generateShortId, createTeam, loadTeamByShortId, pushKey, pullAllData |
| `src/pages/CloudConnectPage.jsx` | **Create** | First-time cloud setup UI (create team / load team / skip) |
| `src/App.jsx` | **Modify** | Cloud gate between onboarding and main app; game save sync; pull on mount |
| `src/pages/AdminPage.jsx` | **Modify** | pushKey after each write; TeamIdSection showing shortId |
| `src/tests/sync.test.js` | **Create** | Unit tests for all sync.js functions |
| `src/tests/CloudConnectPage.test.jsx` | **Create** | Component tests for CloudConnectPage |
| `.github/workflows/deploy.yml` | **Modify** | Add Supabase env vars from repository secrets |

**NOT modified:** `src/storage.js`, `src/pages/OnboardingPage.jsx`, any game tracking pages.

---

## Task 1: Supabase project setup

**Files:**
- Manual: Supabase dashboard (no code changes)
- Modify: `.github/workflows/deploy.yml`
- Create: `.env.local` (gitignored — local dev only)

### Steps

- [ ] **Step 1.1: Create a Supabase project**

Go to [supabase.com](https://supabase.com), sign in, click "New project":
- Organisation: your account
- Name: `softball-tracker`
- Database Password: save this somewhere safe
- Region: closest to your users (e.g. West EU)

Wait ~2 min for provisioning. Then go to **Settings → API**. Copy:
- **Project URL** (looks like `https://xxxx.supabase.co`)
- **anon/public key** (under "Project API keys")

- [ ] **Step 1.2: Run SQL DDL in Supabase SQL Editor**

Go to **SQL Editor** in the Supabase dashboard and run this script:

```sql
-- Teams table: one row per registered team
CREATE TABLE teams (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  division    text NOT NULL,
  pin_hash    text NOT NULL,
  short_id    text UNIQUE,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (name, division)
);

-- Team data table: one row per key per team (mirrors localStorage)
CREATE TABLE team_data (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id     uuid REFERENCES teams(id) ON DELETE CASCADE,
  key         text NOT NULL,
  value       jsonb NOT NULL,
  updated_at  timestamptz DEFAULT now(),
  UNIQUE (team_id, key)
);
```

Confirm both tables appear under **Table Editor**.

- [ ] **Step 1.3: Create `.env.local` for local development**

In the repo root (same level as `package.json`), create `.env.local`:

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_ANON_KEY_HERE
```

Replace with the values from Step 1.1. This file is already in `.gitignore` (Vite ignores `.env.local` by default — verify with `cat .gitignore | grep env`; if missing, add `.env.local` to `.gitignore` manually).

- [ ] **Step 1.4: Add secrets to GitHub repository**

Go to the repo on GitHub → **Settings → Secrets and variables → Actions → New repository secret**. Add two secrets:
- `VITE_SUPABASE_URL` = your Project URL
- `VITE_SUPABASE_ANON_KEY` = your anon key

- [ ] **Step 1.5: Update deploy.yml to pass secrets as env vars**

```yaml
# .github/workflows/deploy.yml — modify the build step
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
```

The full modified `deploy.yml`:

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: true

env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: actions/setup-node@v6
        with:
          node-version: 24
          cache: npm
      - run: npm ci
      - run: npm run build
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - uses: actions/configure-pages@v5
      - uses: actions/deploy-pages@v4
        id: deployment
```

- [ ] **Step 1.6: Commit deploy.yml**

```bash
git add .github/workflows/deploy.yml
git commit -m "feat: pass Supabase env vars to GitHub Actions build"
```

---

## Task 2: sync.js — foundation (client, hashPin, generateShortId)

**Files:**
- Create: `src/sync.js`
- Install: `@supabase/supabase-js`
- Create: `src/tests/sync.test.js`

- [ ] **Step 2.1: Install @supabase/supabase-js**

```bash
npm install @supabase/supabase-js
```

Expected output: package installed, package.json updated with `"@supabase/supabase-js": "^2.x.x"` under `dependencies`.

- [ ] **Step 2.2: Write failing tests for hashPin and generateShortId**

Create `src/tests/sync.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest'

// Provide stub env vars before importing sync.js
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')

// Mock the Supabase client so no real HTTP calls are made
const mockSingle = vi.fn()
const mockSelect = vi.fn(() => ({ eq: vi.fn(() => ({ single: mockSingle })) }))
const mockUpsert = vi.fn()
const mockInsert = vi.fn(() => ({ select: vi.fn(() => ({ single: mockSingle })) }))
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  upsert: mockUpsert,
}))
const mockClient = { from: mockFrom }

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockClient),
}))

// Import AFTER mocks are set up
const { hashPin, generateShortId, _setClientForTesting } = await import('../sync.js')

beforeEach(() => {
  _setClientForTesting(mockClient)
  vi.clearAllMocks()
})

describe('hashPin', () => {
  it('returns a 64-character hex string', async () => {
    const hash = await hashPin('1234')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns the same hash for the same PIN', async () => {
    const h1 = await hashPin('5678')
    const h2 = await hashPin('5678')
    expect(h1).toBe(h2)
  })

  it('returns different hashes for different PINs', async () => {
    const h1 = await hashPin('1234')
    const h2 = await hashPin('9999')
    expect(h1).not.toBe(h2)
  })
})

describe('generateShortId', () => {
  it('returns format XXX-NNNN', () => {
    const id = generateShortId('The Renegades')
    expect(id).toMatch(/^[A-Z]{3}-\d{4}$/)
  })

  it('uses first 3 letters of team name uppercased', () => {
    const id = generateShortId('Bristol Bulls')
    expect(id.startsWith('BRI-')).toBe(true)
  })

  it('pads short names with X', () => {
    const id = generateShortId('Go')
    expect(id.startsWith('GOX-')).toBe(true)
  })

  it('strips non-alpha characters from name prefix', () => {
    const id = generateShortId('123 Team')
    expect(id.startsWith('TEA-')).toBe(true)
  })
})
```

- [ ] **Step 2.3: Run tests to verify they fail**

```bash
npm test -- src/tests/sync.test.js
```

Expected: FAIL with "Cannot find module '../sync.js'"

- [ ] **Step 2.4: Create src/sync.js with foundation**

```js
// src/sync.js
import { createClient } from '@supabase/supabase-js'
import { getTeamConfig } from './storage'

// Lazily-initialised Supabase client.
// _setClientForTesting() allows tests to inject a mock without env vars.
let _client = null
export function _setClientForTesting(client) { _client = client }

function getSupabase() {
  if (_client) return _client
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null
  _client = createClient(url, key)
  return _client
}

// ── Crypto ────────────────────────────────────────────────────
export async function hashPin(pin) {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Short ID ─────────────────────────────────────────────────
export function generateShortId(teamName) {
  const letters = teamName.toUpperCase().replace(/[^A-Z]/g, '')
  const prefix = letters.slice(0, 3).padEnd(3, 'X')
  const suffix = Math.floor(1000 + Math.random() * 9000)
  return `${prefix}-${suffix}`
}

// ── Key map: localStorage key → Supabase remote key ──────────
export const SYNC_KEYS = {
  sft_roster:       'roster',
  sft_games:        'games',
  sft_active_game:  'active_game',
  sft_division:     'division',
  sft_teams:        'teams',
  sft_tournaments:  'tournaments',
  sft_schedule:     'schedule',
}
```

- [ ] **Step 2.5: Run tests to verify they pass**

```bash
npm test -- src/tests/sync.test.js
```

Expected: All `hashPin` and `generateShortId` tests PASS.

- [ ] **Step 2.6: Commit**

```bash
git add src/sync.js src/tests/sync.test.js package.json package-lock.json
git commit -m "feat: add sync.js foundation with hashPin and generateShortId"
```

---

## Task 3: sync.js — createTeam + pushKey + pushAllLocalData

**Files:**
- Modify: `src/sync.js`
- Modify: `src/tests/sync.test.js`

- [ ] **Step 3.1: Write failing tests for pushKey and createTeam**

Append to `src/tests/sync.test.js`:

```js
// Re-import the functions added in this task
// (dynamic import at top of file already covers the whole module)
const { pushKey, pushAllLocalData, createTeam } = await import('../sync.js')

describe('pushKey', () => {
  it('does nothing when teamId is "local"', async () => {
    localStorage.setItem('sft_team', JSON.stringify({ teamId: 'local' }))
    await pushKey('sft_roster')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('does nothing when key is not in SYNC_KEYS', async () => {
    localStorage.setItem('sft_team', JSON.stringify({ teamId: 'uuid-123' }))
    await pushKey('sft_setup_drafts')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('calls upsert with correct team_id and key', async () => {
    localStorage.setItem('sft_team', JSON.stringify({ teamId: 'uuid-abc' }))
    localStorage.setItem('sft_roster', JSON.stringify([{ id: '1', name: 'Alice' }]))
    mockFrom.mockReturnValue({ upsert: mockUpsert })
    mockUpsert.mockResolvedValue({ error: null })

    await pushKey('sft_roster')

    expect(mockFrom).toHaveBeenCalledWith('team_data')
    expect(mockUpsert).toHaveBeenCalledWith(
      { team_id: 'uuid-abc', key: 'roster', value: [{ id: '1', name: 'Alice' }] },
      { onConflict: 'team_id,key' }
    )
  })

  it('does nothing when localStorage key has no value', async () => {
    localStorage.setItem('sft_team', JSON.stringify({ teamId: 'uuid-abc' }))
    localStorage.removeItem('sft_roster')
    await pushKey('sft_roster')
    expect(mockUpsert).not.toHaveBeenCalled()
  })
})

describe('createTeam', () => {
  it('throws when Supabase is not configured', async () => {
    _setClientForTesting(null)
    await expect(createTeam({ name: 'Test', division: 'Div 1', pin: '1234' }))
      .rejects.toThrow('Cloud sync not configured')
    _setClientForTesting(mockClient)
  })

  it('throws on duplicate team name+division', async () => {
    const mockInsertChain = {
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: '23505', message: 'duplicate key value violates unique constraint "teams_name_division_key"' },
        }),
      })),
    }
    mockFrom.mockReturnValue({ insert: vi.fn(() => mockInsertChain) })

    await expect(createTeam({ name: 'Duplicate', division: 'Div 1', pin: '1234' }))
      .rejects.toThrow('A team with this name and division already exists.')
  })

  it('returns teamId and shortId on success', async () => {
    const mockInsertChain = {
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: 'team-uuid-1', short_id: 'TES-1234' },
          error: null,
        }),
      })),
    }
    mockFrom.mockReturnValue({ insert: vi.fn(() => mockInsertChain) })

    const result = await createTeam({ name: 'Test FC', division: 'Div 2', pin: '5678' })
    expect(result).toEqual({ teamId: 'team-uuid-1', shortId: 'TES-1234' })
  })
})
```

- [ ] **Step 3.2: Run tests to verify they fail**

```bash
npm test -- src/tests/sync.test.js
```

Expected: FAIL with "pushKey is not a function" (not yet exported)

- [ ] **Step 3.3: Add pushKey, pushAllLocalData, createTeam to sync.js**

Append to `src/sync.js` (after the SYNC_KEYS export):

```js
// ── Push a single key to Supabase ─────────────────────────────
// Reads teamId from sft_team; no-ops if local-only or Supabase unavailable.
export async function pushKey(localKey) {
  const teamId = getTeamConfig()?.teamId
  if (!teamId || teamId === 'local') return
  const remoteKey = SYNC_KEYS[localKey]
  if (!remoteKey) return
  const raw = localStorage.getItem(localKey)
  if (raw === null) return
  const client = getSupabase()
  if (!client) return
  const { error } = await client
    .from('team_data')
    .upsert(
      { team_id: teamId, key: remoteKey, value: JSON.parse(raw) },
      { onConflict: 'team_id,key' }
    )
  if (error) console.warn(`Sync push failed for ${localKey}:`, error.message)
}

// Push all synced keys at once (used after team creation / initial push).
export async function pushAllLocalData(teamId) {
  if (!teamId || teamId === 'local') return
  for (const localKey of Object.keys(SYNC_KEYS)) {
    const raw = localStorage.getItem(localKey)
    if (raw === null) continue
    const client = getSupabase()
    if (!client) return
    const { error } = await client
      .from('team_data')
      .upsert(
        { team_id: teamId, key: SYNC_KEYS[localKey], value: JSON.parse(raw) },
        { onConflict: 'team_id,key' }
      )
    if (error) console.warn(`pushAllLocalData failed for ${localKey}:`, error.message)
  }
}

// ── Create a new team in Supabase ─────────────────────────────
export async function createTeam({ name, division, pin }) {
  const client = getSupabase()
  if (!client) throw new Error('Cloud sync not configured')
  const pin_hash = await hashPin(pin)
  let retries = 0
  while (retries < 5) {
    const shortId = generateShortId(name)
    const { data, error } = await client
      .from('teams')
      .insert({ name, division, pin_hash, short_id: shortId })
      .select('id, short_id')
      .single()
    if (!error) return { teamId: data.id, shortId: data.short_id }
    if (error.code === '23505') {
      if (error.message.includes('name') && error.message.includes('division')) {
        throw new Error('A team with this name and division already exists.')
      }
      retries++ // short_id collision — retry with new random number
    } else {
      throw new Error(error.message)
    }
  }
  throw new Error('Could not generate a unique Team ID — please try again.')
}
```

- [ ] **Step 3.4: Run tests to verify they pass**

```bash
npm test -- src/tests/sync.test.js
```

Expected: All tests in `pushKey` and `createTeam` describe blocks PASS.

- [ ] **Step 3.5: Commit**

```bash
git add src/sync.js src/tests/sync.test.js
git commit -m "feat: add pushKey, pushAllLocalData, createTeam to sync.js"
```

---

## Task 4: sync.js — loadTeamByShortId + pullAllData

**Files:**
- Modify: `src/sync.js`
- Modify: `src/tests/sync.test.js`

- [ ] **Step 4.1: Write failing tests**

Append to `src/tests/sync.test.js`:

```js
const { loadTeamByShortId, pullAllData } = await import('../sync.js')

describe('pullAllData', () => {
  it('writes fetched rows into localStorage', async () => {
    const mockSelectChain = {
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({
          data: [
            { key: 'roster', value: [{ id: '1', name: 'Alice' }] },
            { key: 'division', value: 'Bristol Div 2' },
          ],
          error: null,
        })),
      })),
    }
    mockFrom.mockReturnValue(mockSelectChain)

    await pullAllData('team-uuid-1')

    expect(localStorage.getItem('sft_roster')).toBe(JSON.stringify([{ id: '1', name: 'Alice' }]))
    expect(localStorage.getItem('sft_division')).toBe(JSON.stringify('Bristol Div 2'))
  })

  it('does nothing for teamId "local"', async () => {
    await pullAllData('local')
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('loadTeamByShortId', () => {
  it('throws when team not found', async () => {
    const mockSelectChain = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
        })),
      })),
    }
    mockFrom.mockReturnValue(mockSelectChain)

    await expect(loadTeamByShortId('ABC-0000', '1234'))
      .rejects.toThrow('Team not found')
  })

  it('throws on wrong PIN', async () => {
    // hashPin('9999') won't match the stored hash of '1234'
    const storedHash = await hashPin('1234')
    const mockSelectChain = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: 'uuid-1', name: 'Test', division: 'Div', pin_hash: storedHash, short_id: 'TES-1234' },
            error: null,
          }),
        })),
      })),
    }
    // pullAllData will call from() too — make it return empty
    mockFrom
      .mockReturnValueOnce(mockSelectChain)
      .mockReturnValue({ select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: [], error: null })) })) })

    await expect(loadTeamByShortId('TES-1234', '9999'))
      .rejects.toThrow('Wrong PIN')
  })

  it('returns team data and pulls all data on correct PIN', async () => {
    const storedHash = await hashPin('5678')
    const teamRow = { id: 'uuid-2', name: 'Bulls', division: 'Div 1', pin_hash: storedHash, short_id: 'BUL-4321' }
    const mockSelectChain = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: teamRow, error: null }),
        })),
      })),
    }
    const mockPullChain = {
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    }
    mockFrom
      .mockReturnValueOnce(mockSelectChain) // teams lookup
      .mockReturnValue(mockPullChain)        // team_data pull

    const result = await loadTeamByShortId('BUL-4321', '5678')
    expect(result).toEqual({ teamId: 'uuid-2', shortId: 'BUL-4321', name: 'Bulls', division: 'Div 1' })
  })
})
```

- [ ] **Step 4.2: Run tests to verify they fail**

```bash
npm test -- src/tests/sync.test.js
```

Expected: FAIL with "loadTeamByShortId is not a function"

- [ ] **Step 4.3: Add pullAllData and loadTeamByShortId to sync.js**

Append to `src/sync.js`:

```js
// ── Pull all team data from Supabase into localStorage ────────
export async function pullAllData(teamId) {
  if (!teamId || teamId === 'local') return
  const client = getSupabase()
  if (!client) return
  const { data, error } = await client
    .from('team_data')
    .select('key, value')
    .eq('team_id', teamId)
  if (error) throw error
  const reverseKeys = Object.fromEntries(
    Object.entries(SYNC_KEYS).map(([localKey, remoteKey]) => [remoteKey, localKey])
  )
  for (const row of (data || [])) {
    const localKey = reverseKeys[row.key]
    if (localKey) localStorage.setItem(localKey, JSON.stringify(row.value))
  }
}

// ── Load an existing team by Short ID + PIN ────────────────────
export async function loadTeamByShortId(shortId, pin) {
  const client = getSupabase()
  if (!client) throw new Error('Cloud sync not configured')
  const { data: team, error } = await client
    .from('teams')
    .select('id, name, division, pin_hash, short_id')
    .eq('short_id', shortId.trim().toUpperCase())
    .single()
  if (error || !team) throw new Error('Team not found — check your Team ID.')
  const inputHash = await hashPin(pin)
  if (inputHash !== team.pin_hash) throw new Error('Wrong PIN.')
  await pullAllData(team.id)
  return { teamId: team.id, shortId: team.short_id, name: team.name, division: team.division }
}
```

- [ ] **Step 4.4: Run all sync tests**

```bash
npm test -- src/tests/sync.test.js
```

Expected: All tests PASS.

- [ ] **Step 4.5: Commit**

```bash
git add src/sync.js src/tests/sync.test.js
git commit -m "feat: add pullAllData and loadTeamByShortId to sync.js"
```

---

## Task 5: CloudConnectPage.jsx

**Files:**
- Create: `src/pages/CloudConnectPage.jsx`
- Create: `src/tests/CloudConnectPage.test.jsx`

CloudConnectPage is shown once, right after onboarding, when `!getTeamConfig()?.teamId`. It presents three options:
1. **Create a new team** — inline form: team name (pre-filled from config), division (pre-filled), PIN. On submit: calls `createTeam()`, `pushAllLocalData()`, updates `sft_team` with `teamId` + `shortId`, calls `onComplete()`.
2. **Load existing team** — Short Team ID + PIN. On submit: calls `loadTeamByShortId()`, updates `sft_team`, calls `onComplete()`.
3. **Use without cloud sync** (small text link) — sets `teamId: 'local'` in `sft_team`, calls `onComplete()`.

**Props:** `onComplete: () => void`

- [ ] **Step 5.1: Write failing tests**

Create `src/tests/CloudConnectPage.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock sync.js before importing the component
vi.mock('../sync', () => ({
  createTeam: vi.fn(),
  pushAllLocalData: vi.fn(),
  loadTeamByShortId: vi.fn(),
}))

import CloudConnectPage from '../pages/CloudConnectPage'
import { getTeamConfig, setTeamConfig } from '../storage'
import { createTeam, pushAllLocalData, loadTeamByShortId } from '../sync'

beforeEach(() => {
  localStorage.clear()
  setTeamConfig({ name: 'Test FC', division: 'Bristol Div 2', setupComplete: true })
  vi.clearAllMocks()
})

describe('CloudConnectPage', () => {
  it('renders create and load options', () => {
    render(<CloudConnectPage onComplete={vi.fn()} />)
    expect(screen.getByText(/create a new team/i)).toBeInTheDocument()
    expect(screen.getByText(/load existing team/i)).toBeInTheDocument()
    expect(screen.getByText(/without cloud sync/i)).toBeInTheDocument()
  })

  it('skip calls onComplete and sets teamId to "local"', async () => {
    const onComplete = vi.fn()
    render(<CloudConnectPage onComplete={onComplete} />)
    await userEvent.click(screen.getByText(/without cloud sync/i))
    expect(getTeamConfig().teamId).toBe('local')
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('shows create form when Create button clicked', async () => {
    render(<CloudConnectPage onComplete={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /create a new team/i }))
    expect(screen.getByLabelText(/admin pin/i)).toBeInTheDocument()
  })

  it('shows error when create form submitted without PIN', async () => {
    render(<CloudConnectPage onComplete={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /create a new team/i }))
    await userEvent.click(screen.getByRole('button', { name: /set up cloud sync/i }))
    expect(screen.getByText(/pin must be/i)).toBeInTheDocument()
    expect(createTeam).not.toHaveBeenCalled()
  })

  it('calls createTeam and onComplete on valid create submit', async () => {
    createTeam.mockResolvedValue({ teamId: 'uuid-1', shortId: 'TES-1234' })
    pushAllLocalData.mockResolvedValue(undefined)
    const onComplete = vi.fn()

    render(<CloudConnectPage onComplete={onComplete} />)
    await userEvent.click(screen.getByRole('button', { name: /create a new team/i }))
    await userEvent.type(screen.getByLabelText(/admin pin/i), '5678')
    await userEvent.click(screen.getByRole('button', { name: /set up cloud sync/i }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(createTeam).toHaveBeenCalledWith({ name: 'Test FC', division: 'Bristol Div 2', pin: '5678' })
    expect(getTeamConfig().teamId).toBe('uuid-1')
    expect(getTeamConfig().shortId).toBe('TES-1234')
  })

  it('shows error message from createTeam on failure', async () => {
    createTeam.mockRejectedValue(new Error('A team with this name and division already exists.'))
    render(<CloudConnectPage onComplete={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /create a new team/i }))
    await userEvent.type(screen.getByLabelText(/admin pin/i), '1234')
    await userEvent.click(screen.getByRole('button', { name: /set up cloud sync/i }))
    await waitFor(() => expect(screen.getByText(/already exists/i)).toBeInTheDocument())
  })

  it('calls loadTeamByShortId and onComplete on valid load submit', async () => {
    loadTeamByShortId.mockResolvedValue({ teamId: 'uuid-2', shortId: 'RNG-9999', name: 'Test FC', division: 'Bristol Div 2' })
    const onComplete = vi.fn()

    render(<CloudConnectPage onComplete={onComplete} />)
    await userEvent.type(screen.getByLabelText(/team id/i), 'RNG-9999')
    await userEvent.type(screen.getByLabelText(/pin/i), '1234')
    await userEvent.click(screen.getByRole('button', { name: /load team/i }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(loadTeamByShortId).toHaveBeenCalledWith('RNG-9999', '1234')
    expect(getTeamConfig().teamId).toBe('uuid-2')
  })
})
```

- [ ] **Step 5.2: Run tests to verify they fail**

```bash
npm test -- src/tests/CloudConnectPage.test.jsx
```

Expected: FAIL with "Cannot find module '../pages/CloudConnectPage'"

- [ ] **Step 5.3: Create CloudConnectPage.jsx**

```jsx
// src/pages/CloudConnectPage.jsx
import { useState } from 'react'
import { getTeamConfig, setTeamConfig } from '../storage'
import { createTeam, pushAllLocalData, loadTeamByShortId } from '../sync'

export default function CloudConnectPage({ onComplete }) {
  const config = getTeamConfig()
  const [mode, setMode] = useState(null) // null | 'create' | 'load'
  const [pin, setPin] = useState('')
  const [shortId, setShortId] = useState('')
  const [loadPin, setLoadPin] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleSkip() {
    setTeamConfig({ ...config, teamId: 'local' })
    onComplete()
  }

  async function handleCreate(e) {
    e.preventDefault()
    setError('')
    if (!pin || pin.length < 4 || !/^\d+$/.test(pin)) {
      setError('PIN must be at least 4 digits')
      return
    }
    setLoading(true)
    try {
      const { teamId, shortId: newShortId } = await createTeam({
        name: config.name,
        division: config.division,
        pin,
      })
      await pushAllLocalData(teamId)
      setTeamConfig({ ...config, teamId, shortId: newShortId })
      onComplete()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleLoad(e) {
    e.preventDefault()
    setError('')
    if (!shortId.trim()) { setError('Enter your Team ID'); return }
    if (!loadPin) { setError('Enter your PIN'); return }
    setLoading(true)
    try {
      const result = await loadTeamByShortId(shortId, loadPin)
      setTeamConfig({ ...config, teamId: result.teamId, shortId: result.shortId })
      onComplete()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="card w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">☁️</div>
          <h2 className="text-xl font-bold">Set up cloud sync</h2>
          <p className="text-sm text-gray-500 mt-1">
            Access your data from any device using a Team ID and PIN.
          </p>
        </div>

        {/* Create a new team */}
        {mode !== 'load' && (
          <div className="mb-4">
            {mode === 'create' ? (
              <form onSubmit={handleCreate} className="space-y-3">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                  Team: <strong>{config?.name}</strong> · {config?.division}
                </div>
                <div>
                  <label htmlFor="cloud-pin" className="label">Admin PIN (4+ digits)</label>
                  <input
                    id="cloud-pin"
                    type="password"
                    inputMode="numeric"
                    className="input"
                    placeholder="••••"
                    maxLength={8}
                    value={pin}
                    onChange={e => { setPin(e.target.value); setError('') }}
                    autoFocus
                  />
                </div>
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary btn-md w-full"
                >
                  {loading ? 'Creating…' : 'Set up cloud sync →'}
                </button>
                <button
                  type="button"
                  onClick={() => { setMode(null); setError('') }}
                  className="btn btn-ghost btn-sm w-full"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                onClick={() => { setMode('create'); setError('') }}
                className="btn btn-primary btn-md w-full"
              >
                Create a new team
              </button>
            )}
          </div>
        )}

        {/* Load existing team */}
        {mode !== 'create' && (
          <div className="mb-4">
            {mode === 'load' ? (
              <form onSubmit={handleLoad} className="space-y-3">
                <div>
                  <label htmlFor="cloud-short-id" className="label">Team ID</label>
                  <input
                    id="cloud-short-id"
                    className="input uppercase"
                    placeholder="e.g. RNG-4821"
                    value={shortId}
                    onChange={e => { setShortId(e.target.value); setError('') }}
                    autoFocus
                  />
                </div>
                <div>
                  <label htmlFor="cloud-load-pin" className="label">PIN</label>
                  <input
                    id="cloud-load-pin"
                    type="password"
                    inputMode="numeric"
                    className="input"
                    placeholder="••••"
                    maxLength={8}
                    value={loadPin}
                    onChange={e => { setLoadPin(e.target.value); setError('') }}
                  />
                </div>
                {error && <p className="text-red-600 text-sm">{error}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-primary btn-md w-full"
                >
                  {loading ? 'Loading…' : 'Load team →'}
                </button>
                <button
                  type="button"
                  onClick={() => { setMode(null); setError('') }}
                  className="btn btn-ghost btn-sm w-full"
                >
                  Cancel
                </button>
              </form>
            ) : (
              <button
                onClick={() => { setMode('load'); setError('') }}
                className="btn btn-ghost btn-md w-full border border-gray-200"
              >
                Load existing team
              </button>
            )}
          </div>
        )}

        {/* Skip */}
        {!mode && (
          <button
            onClick={handleSkip}
            className="text-xs text-gray-400 hover:text-gray-600 w-full text-center py-2 transition-colors"
          >
            Continue without cloud sync
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 5.4: Run tests to verify they pass**

```bash
npm test -- src/tests/CloudConnectPage.test.jsx
```

Expected: All 7 CloudConnectPage tests PASS.

- [ ] **Step 5.5: Run all tests**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 5.6: Commit**

```bash
git add src/pages/CloudConnectPage.jsx src/tests/CloudConnectPage.test.jsx
git commit -m "feat: add CloudConnectPage with create/load/skip options"
```

---

## Task 6: Wire App.jsx — cloud gate + sync

**Files:**
- Modify: `src/App.jsx`

The cloud gate sits between onboarding and the main app. After the user onboards AND has a `teamId` set (via CloudConnectPage or migration), the main app renders.

Additionally:
- `handleGameEnd` calls `pushKey('sft_games')` after saving a game.
- A `useEffect` on mount pulls latest data from Supabase (background, no reload needed — data is fresh on next session open if there's no page reload).

- [ ] **Step 6.1: Write the failing test for the cloud gate**

Create `src/tests/App.cloudgate.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../sync', () => ({
  createTeam: vi.fn(),
  pushAllLocalData: vi.fn(),
  loadTeamByShortId: vi.fn(),
  pushKey: vi.fn().mockResolvedValue(undefined),
  pullAllData: vi.fn().mockResolvedValue(undefined),
}))

import App from '../App'
import { setTeamConfig } from '../storage'

beforeEach(() => {
  localStorage.clear()
})

describe('App cloud gate', () => {
  it('shows CloudConnectPage when onboarded but no teamId', () => {
    setTeamConfig({ name: 'Test FC', division: 'Div 1', setupComplete: true })
    render(<App />)
    expect(screen.getByText(/set up cloud sync/i)).toBeInTheDocument()
  })

  it('shows normal app when teamId is "local"', () => {
    setTeamConfig({ name: 'Test FC', division: 'Div 1', setupComplete: true, teamId: 'local' })
    render(<App />)
    expect(screen.getByText(/softball tracker/i)).toBeInTheDocument()
    expect(screen.queryByText(/set up cloud sync/i)).not.toBeInTheDocument()
  })

  it('shows normal app when teamId is a real UUID', () => {
    setTeamConfig({ name: 'Test FC', division: 'Div 1', setupComplete: true, teamId: 'some-uuid' })
    render(<App />)
    expect(screen.getByText(/softball tracker/i)).toBeInTheDocument()
  })
})
```

- [ ] **Step 6.2: Run test to verify it fails**

```bash
npm test -- src/tests/App.cloudgate.test.jsx
```

Expected: FAIL — "set up cloud sync" found even when teamId is set (gate not yet implemented)

- [ ] **Step 6.3: Modify App.jsx**

Add `CloudConnectPage` import and `import { pushKey, pullAllData } from './sync'`.

Replace the start of `App.jsx` (lines 1–9 imports + the `initAndMigrate` function stays unchanged):

```js
import { useState, useEffect } from 'react'
import AdminPage from './pages/AdminPage'
import GameSetupPage from './pages/GameSetupPage'
import TrackerPage from './pages/TrackerPage'
import ScoresheetPage from './pages/ScoresheetPage'
import SummaryPage from './pages/SummaryPage'
import SeasonStatsPage from './pages/SeasonStatsPage'
import OnboardingPage from './pages/OnboardingPage'
import CloudConnectPage from './pages/CloudConnectPage'
import { saveGame, getActiveGame, clearActiveGame, getSchedule, saveSetupDraft, getSetupDraft, getAllSetupDrafts, getTeamConfig, setTeamConfig, getDivision } from './storage'
import { pushKey, pullAllData } from './sync'
import { Settings, Plus, BarChart2, CalendarDays, ChevronRight } from 'lucide-react'
```

In the `App()` component function, after the `onboarded` state, add `cloudConnected` state and a pull-on-mount effect. Replace the `export default function App()` opening:

```js
export default function App() {
  const [onboarded, setOnboarded] = useState(initAndMigrate)
  const [cloudConnected, setCloudConnected] = useState(() => {
    return !!getTeamConfig()?.teamId
  })

  // Pull latest data from Supabase on mount (background, no-reload).
  // Keeps local cache fresh for teams using multiple devices.
  useEffect(() => {
    const teamId = getTeamConfig()?.teamId
    if (teamId && teamId !== 'local') {
      pullAllData(teamId).catch(console.warn)
    }
  }, [])

  if (!onboarded) {
    return <OnboardingPage onComplete={() => setOnboarded(true)} />
  }

  if (!cloudConnected) {
    return <CloudConnectPage onComplete={() => setCloudConnected(true)} />
  }
```

In `handleGameEnd`, after `saveGame(gameWithResult)`, add:

```js
    saveGame(gameWithResult)
    pushKey('sft_games').catch(console.warn)
    clearActiveGame()
```

- [ ] **Step 6.4: Run the cloud gate tests**

```bash
npm test -- src/tests/App.cloudgate.test.jsx
```

Expected: All 3 tests PASS.

- [ ] **Step 6.5: Run all tests**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 6.6: Smoke test in browser**

```bash
npm run dev
```

Open `http://localhost:5173/softball-tracker/`. 

- **Fresh localStorage**: should see onboarding, then CloudConnectPage.
- **After setting teamId: 'local' in localStorage manually** (DevTools → Application → localStorage → `sft_team` → edit to add `"teamId":"local"`): reload → normal app.
- **Existing Renegades install**: if `sft_roster` exists but no `sft_team`, the auto-migration sets `setupComplete: true` but NOT `teamId`, so CloudConnectPage appears ✓

- [ ] **Step 6.7: Commit**

```bash
git add src/App.jsx src/tests/App.cloudgate.test.jsx
git commit -m "feat: add cloud gate to App.jsx, pull on mount, push after game save"
```

---

## Task 7: AdminPage — pushKey after writes + TeamIdSection

**Files:**
- Modify: `src/pages/AdminPage.jsx`

Two changes:
1. Call `pushKey(localStorageKey)` after every storage write (fire-and-forget).
2. Add a `TeamIdSection` component near the bottom of Admin that shows the short Team ID with a copy button.

- [ ] **Step 7.1: Write the failing test for TeamIdSection**

Create `src/tests/AdminPage.teamid.test.jsx`:

```jsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock sync so no Supabase calls
vi.mock('../sync', () => ({
  pushKey: vi.fn().mockResolvedValue(undefined),
}))

import AdminPage from '../pages/AdminPage'
import { setTeamConfig, setPin } from '../storage'

beforeEach(() => {
  localStorage.clear()
  setTeamConfig({ name: 'Test FC', division: 'Div 1', setupComplete: true, teamId: 'uuid-1', shortId: 'TES-1234' })
  setPin('1234')
})

describe('AdminPage TeamIdSection', () => {
  it('shows the shortId after unlocking', async () => {
    render(<AdminPage onBack={vi.fn()} />)
    await userEvent.type(screen.getByPlaceholderText('••••'), '1234')
    await userEvent.click(screen.getByRole('button', { name: /unlock/i }))
    expect(screen.getByText('TES-1234')).toBeInTheDocument()
  })

  it('does not show Team ID section when teamId is "local"', async () => {
    setTeamConfig({ name: 'Test FC', division: 'Div 1', setupComplete: true, teamId: 'local' })
    render(<AdminPage onBack={vi.fn()} />)
    await userEvent.type(screen.getByPlaceholderText('••••'), '1234')
    await userEvent.click(screen.getByRole('button', { name: /unlock/i }))
    expect(screen.queryByText(/your team id/i)).not.toBeInTheDocument()
  })
})
```

- [ ] **Step 7.2: Run test to verify it fails**

```bash
npm test -- src/tests/AdminPage.teamid.test.jsx
```

Expected: FAIL — "TES-1234" not found in document

- [ ] **Step 7.3: Modify AdminPage.jsx**

**Add import for pushKey and getTeamConfig at top of file** (line 3, alongside existing imports):

```js
import { getRoster, addPlayer, updatePlayer, removePlayer, checkPin, setPin, getDivision, setDivision, getTeams, addTeam, removeTeam, exportAllData, importAllData, getSchedule, addFixture, removeFixture, getTeamConfig } from '../storage'
import { pushKey } from '../sync'
```

**Add TeamIdSection component** (insert before the `BackupSection` function):

```js
function TeamIdSection() {
  const config = getTeamConfig()
  const shortId = config?.shortId
  const [copied, setCopied] = useState(false)

  if (!shortId || config?.teamId === 'local') return null

  function handleCopy() {
    navigator.clipboard.writeText(shortId).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <div className="card mb-4">
      <h3 className="font-semibold mb-2 text-sm text-gray-600">☁️ Your Team ID</h3>
      <p className="text-xs text-gray-500 mb-3">
        Share this ID with anyone who needs to load your team data on a new device.
      </p>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xl font-bold tracking-widest text-blue-700">{shortId}</span>
        <button onClick={handleCopy} className="btn btn-ghost btn-sm">
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}
```

**Add pushKey calls in LeagueSettings** (after each storage write):

```js
// In saveDivision():
function saveDivision() {
  setDivision(division)
  pushKey('sft_division').catch(console.warn)
  setDivSaved(true)
  setTimeout(() => setDivSaved(false), 1500)
}

// In handleAddTeam (after setTeams(addTeam(name))):
setTeams(addTeam(name))
pushKey('sft_teams').catch(console.warn)
setNewTeam('')

// In handleRemoveTeam (after setTeams(removeTeam(name))):
setTeams(removeTeam(name))
pushKey('sft_teams').catch(console.warn)
```

**Add pushKey calls in ScheduleSection** (after each write):

```js
// In handleAdd (after setFixtures(addFixture(...))):
setFixtures(addFixture({ date, opponent: opponent.trim(), time, location, gameType }))
pushKey('sft_schedule').catch(console.warn)
// ... (rest of resets)

// In handleRemove (after setFixtures(removeFixture(id))):
setFixtures(removeFixture(id))
pushKey('sft_schedule').catch(console.warn)
```

**Add pushKey calls in AdminPage component handlers** (roster writes):

```js
function handleAdd(name, type) {
  setRoster(addPlayer(name, type))
  pushKey('sft_roster').catch(console.warn)
}
function handleToggle(id) {
  setRoster(updatePlayer(id, { active: !roster.find(p => p.id === id).active }))
  pushKey('sft_roster').catch(console.warn)
}
function handleRemove(id) {
  if (!confirm('Remove this player from the roster?')) return
  setRoster(removePlayer(id))
  pushKey('sft_roster').catch(console.warn)
}
function handleTypeToggle(id, type) {
  setRoster(updatePlayer(id, { type: type === 'BBH' ? 'SBH' : 'BBH' }))
  pushKey('sft_roster').catch(console.warn)
}
```

**Add `<TeamIdSection />` to AdminPage render** (before `<ChangePinForm />`):

```jsx
      <TeamIdSection />
      <ChangePinForm />
      <BackupSection />
```

- [ ] **Step 7.4: Run the TeamIdSection tests**

```bash
npm test -- src/tests/AdminPage.teamid.test.jsx
```

Expected: Both tests PASS.

- [ ] **Step 7.5: Run all tests**

```bash
npm test
```

Expected: All tests PASS.

- [ ] **Step 7.6: Smoke test in browser**

```bash
npm run dev
```

- Log in to Admin (PIN `1234` on a fresh install after onboarding).
- Verify TeamIdSection shows the shortId.
- Add/remove a player — verify no console errors from pushKey (it silently no-ops when Supabase isn't configured in dev if env vars are missing).

- [ ] **Step 7.7: Commit**

```bash
git add src/pages/AdminPage.jsx src/tests/AdminPage.teamid.test.jsx
git commit -m "feat: add pushKey sync to AdminPage writes + show TeamIdSection"
```

---

## Final verification checklist

Before pushing to `main` to deploy:

- [ ] `npm test` — all tests pass
- [ ] `npm run build` — no TypeScript/Vite errors
- [ ] Manual test: fresh install → onboarding → CloudConnectPage → "Use without cloud sync" → normal app loads
- [ ] Manual test (requires live Supabase): fresh install → onboarding → CloudConnectPage → "Create a new team" → PIN → Team ID appears in Admin
- [ ] Manual test (requires live Supabase): second device → CloudConnectPage → "Load existing team" → correct Short Team ID + PIN → data loads, app works
- [ ] Manual test: existing Renegades install (has `sft_roster`, no `sft_team`) → auto-migrated to `setupComplete: true`, teamId not set → CloudConnectPage shown

Spec verification checklist from design doc:
1. ✅ Create a new team → Short Team ID appears in Admin
2. ✅ Open app on second device → "Load team" with Short Team ID + PIN → data loads
3. ✅ Try to create duplicate team (same name + division) → error shown
4. ✅ Wrong PIN → error shown, no data loaded

- [ ] **Push to deploy**

```bash
git push
```

Wait ~2 min, verify at `https://emizzer3.github.io/softball-tracker/`.
