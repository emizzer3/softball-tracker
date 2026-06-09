# Multi-Tenant Platform Design
**Date:** 2026-06-09  
**Status:** Approved

---

## Context

The Softball Tracker PWA is currently hardcoded to a single team — The Renegades, Bristol Division 2. The team name, roster, default schedule, and opponent list are all baked into the source code (`GameSetupPage.jsx`, `storage.js`). The goal is to open the app to any mixed co-ed slow-pitch softball team while keeping the core experience identical.

The target outcome is a platform where:
- Any team can create an account and configure the app for their own use
- Data syncs across devices (manager can use any phone/browser)
- The app still works offline at the field with no signal
- The Renegades' existing data migrates without disruption

---

## Scope & Non-Goals

**In scope:**
- Remove all Renegades-specific defaults
- Add first-run onboarding wizard
- Add team creation, Team ID + PIN login
- Supabase cloud sync
- Offline-first write queue with background sync

**Not in scope:**
- Multiple login users per team (one PIN per team for now)
- League management / cross-team stats / leaderboards
- Push notifications
- Email auth
- Any change to game rules — the app remains fixed to mixed co-ed slow-pitch with BBH/SBH alternation and the co-ed walk rule

---

## Phase 1 — Generalize the App (~1–2 days)

### Goal
Strip all Renegades-specific defaults. Any team can install and configure the app. Still 100% offline, no backend changes.

### New localStorage key: `sft_team`
```js
{
  name: string,        // e.g. "The Renegades"
  division: string,    // e.g. "Bristol Division 2"
  setupComplete: boolean
}
```

### Changes to `src/storage.js`
| What | Where | Change |
|------|-------|--------|
| Default roster | Lines 30–48 | `DEFAULT_ROSTER = []` |
| Default opponent teams | Lines 13–16 | `DEFAULT_TEAMS = []` |
| Default division | Line 79 | `getDivision()` returns `''` |
| Hardcoded schedule | Lines 106–121 | `DEFAULT_SCHEDULE = []` |
| New functions | — | `getTeamConfig()`, `setTeamConfig(config)` |

### Changes to `src/pages/GameSetupPage.jsx`
- `OUR_TEAM` (line 49) changes from `'The Renegades'` to `getTeamConfig().name`
- No other logic changes — `home`/`away`/`weAreHome` continue to work as-is

### New component: `src/pages/OnboardingPage.jsx`
Single-page wizard shown when `!getTeamConfig()?.setupComplete`. Fields:
1. Team name (required)
2. Division / league (required)
3. Informational co-ed rules confirmation (not a toggle — just a notice)
4. Admin PIN (4+ digits, replaces the default `1234`)

On submit: calls `setTeamConfig({ name, division, setupComplete: true })` and `setPin(pin)`.

### Changes to `src/App.jsx`
- On mount: check `getTeamConfig()?.setupComplete`
- If false/missing → render `<OnboardingPage>` instead of normal app
- After onboarding completes → render normal app

### Renegades migration (silent, automatic)
On mount, before the onboarding check: if `sft_roster` exists but `sft_team` does not, auto-create:
```js
setTeamConfig({
  name: 'The Renegades',
  division: getDivision() || 'Bristol Division 2',
  setupComplete: true
})
```
This means existing installs never see the onboarding screen.

---

## Phase 2 — Supabase Cloud Sync (~1 week)

### Goal
Multi-device access. Any team can load their data on a new device using Team ID + PIN. The Renegades migrate their existing data to Supabase.

### Supabase schema

**`teams` table**
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
name        text NOT NULL
division    text NOT NULL
pin_hash    text NOT NULL       -- SHA-256 of PIN, client-side hashed before storage
short_id    text UNIQUE         -- human-readable, e.g. "RNG-4821"
created_at  timestamptz DEFAULT now()

UNIQUE (name, division)         -- one team per name+division combination
```

**`team_data` table**
```sql
id          uuid PRIMARY KEY DEFAULT gen_random_uuid()
team_id     uuid REFERENCES teams(id)
key         text NOT NULL       -- mirrors localStorage key suffix: 'roster', 'games', etc.
value       jsonb NOT NULL
updated_at  timestamptz DEFAULT now()

UNIQUE (team_id, key)
```

Keys stored: `roster`, `games`, `active_game`, `schedule`, `teams` (opponents), `division`, `tournaments`.  
Not synced (local-only): `setup_drafts` (per-fixture in-progress setup state — ephemeral, no value syncing).

**Row Level Security:** RLS enabled on `team_data`. Policy: `team_id` must match the `team_id` in the current session context (set client-side at login). Since this is a softball tracker with low security stakes, the PIN hash check is client-side — RLS uses an anon key scoped to the team's `team_id`.

### Short Team ID generation
On team creation: generate `XXX-NNNN` where `XXX` is first 3 letters of team name (uppercased) and `NNNN` is a random 4-digit number. Retry if collision. Stored in `teams.short_id`, shown in Admin settings.

### Team creation flow
1. User taps "Create a new team" on the Phase 2 splash screen
2. Fills in: team name, division, PIN → same onboarding form as Phase 1
3. App checks Supabase for `(name, division)` uniqueness — if exists, show error
4. On success: Supabase creates team record, returns `{ id, short_id }`
5. App stores `{ teamId, shortId }` in `sft_team` (extends Phase 1 shape)
6. Existing localStorage data is pushed to Supabase as initial sync

### Team login (new device)
1. User enters Short Team ID + PIN
2. App looks up team by `short_id`, verifies `pin_hash`, fetches all `team_data` rows
3. Data written to localStorage; `sft_team` updated with `teamId`
4. Normal app renders

### Sync strategy (Phase 2 — online required)
- **On save:** every write that currently calls a storage function also calls a Supabase upsert for that key
- **On load:** on app mount (if online), pull latest `team_data` from Supabase and merge into localStorage (Supabase wins on conflict — last-write-wins per key)
- **Sync wrapper:** new `src/sync.js` module wraps all storage writes. Phase 2 version pushes to Supabase immediately; Phase 3 version queues if offline.

### Changes to `src/App.jsx`
- Add splash screen before onboarding check: if no `sft_team.teamId` → show "Create team / Load team" screen
- After login/creation → proceed to normal app (or onboarding if new team)

---

## Phase 3 — Offline-First Sync (~3–5 days)

### Goal
The app tracks games at the field with no signal. Changes queue locally and sync automatically when back online.

### Write queue (IndexedDB via `idb-keyval`)
- Every write goes to localStorage immediately (UX is instant)
- If online: also push to Supabase immediately (same as Phase 2)
- If offline: add `{ key, value, timestamp }` entry to IndexedDB queue

### Sync on reconnect
- `window.addEventListener('online', flushQueue)` in `src/sync.js`
- Service worker `sync` event as fallback (Background Sync API)
- `flushQueue()` processes the IndexedDB queue in order, upserts to Supabase

### Conflict resolution
- Conflict unit: individual `team_data` key (e.g. `games`, `roster`)
- Strategy: **last-write-wins per key** using `updated_at` timestamp
- Rationale: games are discrete and immutable once complete; roster changes are rare; two devices editing simultaneously is not a real use case for a single-manager team

### Online/offline indicator
- Small status dot in the app header: green (online + synced), yellow (online + pending), grey (offline)
- No blocking UI — app always works regardless of status

---

## Migration Plan (The Renegades)

| Step | When | What |
|------|------|------|
| Phase 1 ships | Immediately | Silent auto-migration adds `sft_team` to existing localStorage. No data loss. |
| Phase 2 ships | After Phase 2 | On first open, app detects `sft_team` has no `teamId` → prompts "Set up cloud sync for your team". User picks team name/division/PIN → Renegades data pushed to Supabase. |
| Phase 3 ships | After Phase 3 | No migration needed — sync behaviour upgrades transparently. |

---

## File Map (key files touched per phase)

### Phase 1
- `src/storage.js` — remove defaults, add `getTeamConfig`/`setTeamConfig`
- `src/pages/GameSetupPage.jsx` — `OUR_TEAM` reads from config
- `src/pages/OnboardingPage.jsx` — new file
- `src/App.jsx` — onboarding gate + Renegades auto-migration

### Phase 2
- `src/sync.js` — new file, Supabase client + sync wrapper
- `src/App.jsx` — team login splash screen
- `src/pages/OnboardingPage.jsx` — extend for team creation (Supabase call)
- `src/pages/AdminPage.jsx` — show Short Team ID in settings
- `src/storage.js` — extend `sft_team` shape with `teamId`, `shortId`

### Phase 3
- `src/sync.js` — add IndexedDB queue, `flushQueue`, online listener
- `src/App.jsx` — add online/offline status indicator
- `public/sw.js` — add Background Sync registration

---

## Verification

### Phase 1
1. Fresh install (clear localStorage) → onboarding wizard appears
2. Fill in team name/division/PIN → normal app loads with empty roster/schedule
3. Existing install (Renegades data present) → onboarding never appears, app works as before
4. Game setup shows configured team name (not "The Renegades" unless that's what was entered)

### Phase 2
1. Create a new team → Short Team ID appears in Admin
2. Open app on second device → "Load team" with Short Team ID + PIN → data loads
3. Try to create duplicate team (same name + division) → error shown
4. Wrong PIN → error shown, no data loaded

### Phase 3
1. Go offline (airplane mode) → track an at-bat → save game → no errors
2. Go back online → game appears in Supabase `team_data`
3. Open on second device → new game visible after sync
