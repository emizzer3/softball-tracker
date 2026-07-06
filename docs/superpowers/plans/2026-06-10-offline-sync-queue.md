# Offline Sync Queue Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Buffer failed `pushKey` calls when the device is offline and automatically flush them when the network reconnects, so no game data is silently lost on patchy WiFi.

**Architecture:** A small queue is persisted in `localStorage` under `sft_sync_queue` (an array of localStorage key names). When a `pushKey` call fails and the device is offline, the key is added to the queue. `App.jsx` listens for the `window.online` event and calls `flushQueue()`, which replays each queued key in order. Successful pushes are removed from the queue. A subtle banner in the app header shows "Offline — changes will sync when reconnected."

**Tech Stack:** Existing `sync.js`, `navigator.onLine`, `window` event listener, localStorage.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/sync.js` | **Modify** | Add queue helpers (`enqueue`, `getQueue`, `clearQueue`, `flushQueue`); modify `pushKey` to enqueue on offline failure |
| `src/App.jsx` | **Modify** | Add `useEffect` to listen for `online` event → call `flushQueue`; show offline banner |
| `src/tests/sync.queue.test.js` | **Create** | Unit tests for queue behaviour |

---

## Task 1: Add queue to sync.js

**Files:**
- Modify: `src/sync.js`
- Create: `src/tests/sync.queue.test.js`

The queue is a Set-like structure stored in localStorage: each entry is a localStorage key name (`sft_games`, etc.). If the same key is queued twice, we only store it once (last push wins — we always push the current value when flushing).

- [ ] **Step 1.1: Write the failing tests**

Create `src/tests/sync.queue.test.js`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { _setClientForTesting, pushKey, flushQueue, getQueue } from '../sync'

beforeEach(() => {
  localStorage.clear()
  _setClientForTesting(undefined) // reset lazy client
})

describe('offline queue', () => {
  it('getQueue returns empty array initially', () => {
    expect(getQueue()).toEqual([])
  })

  it('pushKey enqueues the key when device is offline and push fails', async () => {
    // Simulate connected team
    localStorage.setItem('sft_team', JSON.stringify({ teamId: 'team-abc', shortId: 'REN-1234', setupComplete: true }))
    localStorage.setItem('sft_games', JSON.stringify([{ id: 'g1' }]))

    // Simulate offline + Supabase error
    vi.stubGlobal('navigator', { onLine: false })
    const mockClient = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: { message: 'Network error' } }),
      }),
    }
    _setClientForTesting(mockClient)

    await pushKey('sft_games')
    expect(getQueue()).toContain('sft_games')

    vi.unstubAllGlobals()
  })

  it('pushKey does NOT enqueue when device is online and push fails (server error)', async () => {
    localStorage.setItem('sft_team', JSON.stringify({ teamId: 'team-abc', shortId: 'REN-1234', setupComplete: true }))
    localStorage.setItem('sft_games', JSON.stringify([]))

    vi.stubGlobal('navigator', { onLine: true })
    const mockClient = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: { message: 'Server error' } }),
      }),
    }
    _setClientForTesting(mockClient)

    await pushKey('sft_games')
    expect(getQueue()).toEqual([])

    vi.unstubAllGlobals()
  })

  it('flushQueue calls pushKey for each queued key and clears the queue', async () => {
    localStorage.setItem('sft_team', JSON.stringify({ teamId: 'team-abc', shortId: 'REN-1234', setupComplete: true }))
    localStorage.setItem('sft_games', JSON.stringify([]))
    localStorage.setItem('sft_roster', JSON.stringify([]))

    // Pre-populate queue
    localStorage.setItem('sft_sync_queue', JSON.stringify(['sft_games', 'sft_roster']))

    const mockClient = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }),
    }
    _setClientForTesting(mockClient)
    vi.stubGlobal('navigator', { onLine: true })

    await flushQueue()

    expect(getQueue()).toEqual([])
    expect(mockClient.from).toHaveBeenCalledTimes(2)

    vi.unstubAllGlobals()
  })

  it('flushQueue is a no-op when queue is empty', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }),
    }
    _setClientForTesting(mockClient)

    await flushQueue()
    expect(mockClient.from).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 1.2: Run tests to verify they fail**

```bash
cd /Users/emilysewell/Documents/Github\ Projects/softball-tracker
npx vitest run src/tests/sync.queue.test.js
```

Expected: FAIL — `flushQueue` and `getQueue` not exported

- [ ] **Step 1.3: Add queue helpers and modify `pushKey` in `src/sync.js`**

**a) Add queue constants and helpers** — insert after the `SYNC_KEYS` export (around line 48):

```js
// ── Offline sync queue ────────────────────────────────────────
const QUEUE_KEY = 'sft_sync_queue'

export function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') } catch { return [] }
}

function enqueue(localKey) {
  const q = new Set(getQueue())
  q.add(localKey)
  localStorage.setItem(QUEUE_KEY, JSON.stringify([...q]))
}

function dequeue(localKey) {
  const q = getQueue().filter(k => k !== localKey)
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

export async function flushQueue() {
  const q = getQueue()
  if (q.length === 0) return
  for (const localKey of q) {
    try {
      await pushKey(localKey)
    } catch {
      // pushKey failed again — leave it in the queue (next online event will retry)
      return
    }
  }
}
```

**b) Modify `pushKey`** — find the `if (error) console.warn(...)` block inside `pushKey` (currently one line). Replace it:

```js
  if (error) {
    if (!navigator.onLine) enqueue(localKey)
    console.warn(`Sync push failed for ${localKey}:`, error.message)
    return
  }
  dequeue(localKey)  // successful push: remove from queue if it was there
```

Full updated `pushKey` for clarity (replace the existing function body):

```js
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
  if (error) {
    if (!navigator.onLine) enqueue(localKey)
    console.warn(`Sync push failed for ${localKey}:`, error.message)
    return
  }
  dequeue(localKey)
}
```

- [ ] **Step 1.4: Run tests to verify they pass**

```bash
npx vitest run src/tests/sync.queue.test.js
```

Expected: all 5 tests PASS

- [ ] **Step 1.5: Commit**

```bash
git add src/sync.js src/tests/sync.queue.test.js
git commit -m "feat: offline sync queue — buffer failed pushes, flush on reconnect"
```

---

## Task 2: Wire up online listener and offline banner in App.jsx

**Files:**
- Modify: `src/App.jsx`

When the app comes back online, `flushQueue` runs automatically. A subtle banner is shown when `navigator.onLine` is false, so the user knows their changes are queued.

- [ ] **Step 2.1: Write the failing test**

Create `src/tests/App.offline.test.jsx`:

```jsx
import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import App from '../App'
import * as storage from '../storage'
import * as syncModule from '../sync'

beforeEach(() => {
  localStorage.clear()
  // Provide minimal state so App renders main home screen (not onboarding/cloud gate)
  localStorage.setItem('sft_team', JSON.stringify({ name: 'Test FC', division: 'Div 1', setupComplete: true, teamId: 'local' }))
  vi.spyOn(storage, 'getSchedule').mockReturnValue([])
  vi.spyOn(storage, 'getActiveGame').mockReturnValue(null)
  vi.spyOn(storage, 'getAllSetupDrafts').mockReturnValue({})
  vi.spyOn(syncModule, 'pullAllData').mockResolvedValue(undefined)
  vi.spyOn(syncModule, 'flushQueue').mockResolvedValue(undefined)
})

describe('offline banner and flush', () => {
  it('shows offline banner when navigator.onLine is false', () => {
    vi.stubGlobal('navigator', { onLine: false, clipboard: null })
    render(<App />)
    expect(screen.getByText(/offline/i)).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('calls flushQueue when window online event fires', async () => {
    vi.stubGlobal('navigator', { onLine: true, clipboard: null })
    render(<App />)
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    expect(syncModule.flushQueue).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 2.2: Run test to verify it fails**

```bash
npx vitest run src/tests/App.offline.test.jsx
```

Expected: FAIL — no offline banner, flushQueue not called

- [ ] **Step 2.3: Update `src/App.jsx`**

**a) Add import** — add `flushQueue` to the sync import:

```js
import { pushKey, pullAllData, flushQueue } from './sync'
```

**b) Add online state and listener** — add this `useEffect` after the existing mount pull effect (around line 158):

```jsx
const [isOnline, setIsOnline] = useState(() => navigator.onLine)

useEffect(() => {
  function handleOnline() {
    setIsOnline(true)
    flushQueue().catch(console.warn)
  }
  function handleOffline() { setIsOnline(false) }
  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)
  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}, [])
```

**c) Add offline banner** — inside the main return, add this just above the `{page === P.HOME && ...}` block (i.e., as the first child after the fragment `<>`):

```jsx
{!isOnline && (
  <div className="fixed top-0 left-0 right-0 z-50 bg-amber-500 text-white text-xs text-center py-1 font-semibold">
    Offline — changes will sync when reconnected
  </div>
)}
```

- [ ] **Step 2.4: Run tests to verify they pass**

```bash
npx vitest run src/tests/App.offline.test.jsx
```

Expected: both tests PASS

- [ ] **Step 2.5: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 2.6: Commit**

```bash
git add src/App.jsx src/tests/App.offline.test.jsx
git commit -m "feat: show offline banner and flush sync queue on reconnect"
```

---

## Self-Review Checklist

- [x] Queue persisted in localStorage (`sft_sync_queue`) — survives page reload
- [x] `pushKey` enqueues only when `navigator.onLine` is false (not for server errors)
- [x] Successful push dequeues the key
- [x] `flushQueue` replays all queued keys in order
- [x] App listens for `online` event and calls `flushQueue`
- [x] Offline banner visible when `navigator.onLine` is false
- [x] Event listeners cleaned up on unmount (no memory leak)
- [x] All behaviour covered by tests
