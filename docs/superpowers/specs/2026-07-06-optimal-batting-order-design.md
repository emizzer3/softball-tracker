# Optimal Batting Order — Design
**Date:** 2026-07-06
**Status:** Approved

---

## Context

Game Setup's batting-order step (Step 3) currently offers one automated helper, `autoArrangeOrder()`, which interleaves the already-selected players into a valid BBH/SBH/BBH/SBH… alternation but does so blind to performance — it just preserves whatever order the players happened to be selected in. The user wants a second option: given the same list of players playing, suggest a batting order that both satisfies the alternation rule *and* orders hitters by how well they've hit this season, using data the app already tracks (`computeSeasonStats`).

---

## Scope & Non-Goals

**In scope:**
- New `computeOptimalBattingOrder(players, gamesInput)` in `storage.js`, returning a valid, alternating batting order (array of names) ranked by season batting performance
- New "🧠 Optimize Order" button in `GameSetupPage.jsx` Step 3, alongside the existing "Auto-arrange" button

**Not in scope:**
- Fielding position / bench / DH recommendations — batting order only (confirmed with user)
- Any change to the existing `autoArrangeOrder()` (alternation-only, order-preserving) — it stays as-is, both buttons coexist
- A standalone "Lineup Optimizer" page outside Game Setup — this is a Step 3 action only
- Stolen bases / speed as a ranking factor — not currently tracked anywhere in the app
- Per-position fielding error rates — not currently tracked (errors are per-player only)

---

## Data Layer — `computeOptimalBattingOrder(players, gamesInput)`

New exported function in `storage.js`, alongside `computeSeasonStats` / `computeSituationalStats`.

**Input:** `players` — `[{ name, type }]` (type is `'BBH'` or `'SBH'`), the same shape Game Setup already has as `order.map(name => ({ name, type: rosterMap[name] }))`.
**Input:** `gamesInput` — optional, for testing (same convention as every other `compute*` function; defaults to `getGames()`).

### Step 1: Score every player

Call `computeSeasonStats(gamesInput)` and build a lookup by name. For each player in the input list:

```
blendedScore(p) = (parseFloat(AVG) + parseFloat(OBP) + parseFloat(SLG)) / 3
```

(`AVG`/`OBP`/`SLG` are the existing `.310`-style strings `computeSeasonStats` already returns — `parseFloat('.310')` correctly yields `0.31`.)

### Step 2: Cold-start substitution

A player **qualifies** for their own stats only if `AB >= 5` this season. Players with no stats entry at all (never played) or `AB < 5` (new ringer, 1-2 at-bat fluke sample) are **not** ranked on their own numbers — they receive the **league-average blended score**, computed as the mean `blendedScore` across only the qualifying players in this specific `players` list.

If zero players qualify (e.g. first game of a brand-new season, nobody has 5 AB yet), every player's score is `0` — the sort becomes a no-op stable pass-through, so the resulting order equals the alternation-only order (same output as `autoArrangeOrder` would produce for that input).

`OBP` for the leadoff pick (Step 4) uses the same qualify/substitute logic: non-qualifying players use the league-average raw OBP instead of their own.

### Step 3: Split into streams

```js
const bbhStream = players.filter(p => p.type === 'BBH')
const sbhStream = players.filter(p => p.type === 'SBH')
```

Same split `autoArrangeOrder` already performs in `GameSetupPage.jsx`.

### Step 4: Shape each stream

For a stream of length `N`:
- `N === 0`: empty, skip.
- `N === 1`: that one player, unchanged.
- `N >= 2`:
  1. **Leadoff** = the player with the highest OBP (using Step 2 substitution) in the stream. Remove from the working set.
  2. **Last** = the player with the lowest `blendedScore` among the remaining `N - 1` players. Remove from the working set.
  3. **Middle** = whatever remains (`N - 2` players), sorted by `blendedScore` descending.
  4. Shaped stream = `[leadoff, ...middle, last]`.

Ties at any step are broken by original input order (JS `Array.prototype.sort` is stable), so results are deterministic without extra tie-break logic.

### Step 5: Interleave streams

Identical interleave logic to the existing `autoArrangeOrder` in `GameSetupPage.jsx:178-190`: the longer shaped stream goes first, alternating one-for-one with the shorter shaped stream.

```
first, second = (bbhShaped.length >= sbhShaped.length) ? [bbhShaped, sbhShaped] : [sbhShaped, bbhShaped]
result = interleave(first, second)   // same loop as autoArrangeOrder
```

### Return shape

`string[]` — a batting order (array of player names), same shape as the `order` state in `GameSetupPage.jsx` and the same shape `autoArrangeOrder` already produces. Guaranteed to pass the existing `validateOrder()` alternation check.

---

## UI — `GameSetupPage.jsx` Step 3

Add a second button next to the existing "Auto-arrange" button:

```jsx
<button
  onClick={optimizeOrder}
  className="btn btn-sm btn-secondary"
>
  🧠 Optimize Order
</button>
```

```js
function optimizeOrder() {
  const players = order.map(name => ({ name, type: rosterMap[name] }))
  setOrder(computeOptimalBattingOrder(players))
  setOrderErr('')
  setOrderOk(false)
}
```

- Reuses the existing `order` (currently selected players) and `rosterMap` (name → BBH/SBH) state already in the component — no new player-picker UI.
- Behaves exactly like `autoArrangeOrder` from the user's perspective: instantly replaces the visible order, still fully drag-and-drop editable afterward, still must be confirmed via the existing "Confirm Order" step before advancing.
- Both buttons coexist; neither replaces the other.

---

## Testing

- New `src/tests/storage.optimalOrder.test.js` (matching existing `storage.situational.test.js` / `storage.stats.test.js` convention) covering `computeOptimalBattingOrder`:
  - Qualifying players (AB >= 5) ranked by blended score within their stream
  - Non-qualifying players (AB < 5 or no history) receive the league-average score, landing in the middle rather than top/bottom
  - Leadoff selection uses OBP, not blended score (construct a case where the highest-OBP player is not the highest-blended-score player, confirm they're picked leadoff anyway)
  - Weakest qualifying player lands last in their stream
  - Result always alternates BBH/SBH correctly (assert against the existing `validateOrder` helper, or an equivalent check) for streams of uneven length
  - Single-player stream (N === 1) and empty stream (N === 0) edge cases
  - Zero qualifying players in the whole list → deterministic pass-through order
- No existing test file covers `GameSetupPage.jsx` (confirmed: none in `src/tests/`) — add a new one, `src/tests/GameSetupPage.optimizeOrder.test.jsx`, verifying the "Optimize Order" button calls the new function and updates the visible order
