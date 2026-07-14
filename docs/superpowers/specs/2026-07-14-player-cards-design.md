# Mid-Season Player Cards — Design
**Date:** 2026-07-14
**Status:** Approved

---

## Context

Season Stats already shows raw per-player numbers (`computeSeasonStats`) and a per-game log (`PlayerDetailModal`), but there's no way to hand a player a digestible "here's how you're doing" summary. The coach wants a mid-season "report card" per player: a fun, baseball-card-styled flip card showing headline stats up front and detailed stats + auto-generated coaching feedback on the back, viewable in-app and downloadable to send to the player directly.

Design direction (from brainstorming, including a visual-companion session mocking up card styles): a **vintage linocut/woodblock-print baseball card**, cream card stock, navy-ink linework with red accents, that **flips on tap** — front is the "cool" headline side, back is the "coach's notes" detail side.

---

## Scope & Non-Goals

**In scope:**
- New `computePlayerCard(playerName, gamesInput)` in `storage.js` — stats, team-average baseline comparison, generated tips, illustration-pose selection, spray-zone insight, and out-type breakdown.
- New `PlayerCardModal.jsx` — the flip-card UI, entered via a "View Card" button on each player row in `SeasonStatsPage.jsx`.
- A mini spray diagram on the card back (reusing the existing field-drawing geometry from `SprayDiamond`/`SprayChart`), plus 0-1 tip each for the player's best/worst hit-location zone.
- A compact "most frequent out type" line on the card back, derived the same way as the existing Players-tab outs breakdown, but computed fresh for the card rather than reusing that inline code.
- Download button that captures **both card faces stacked into one PNG** for sharing/printing.
- Four illustration "slots" (`src/assets/cards/*.svg`) — shipped as hand-coded vintage-badge-style placeholders now; the user will supply real commissioned/AI-generated artwork later as a **drop-in file replacement at the same paths**, requiring no code changes.

**Not in scope:**
- Fielding stats (PO/A/E) on the card — batting only (confirmed in the original brainstorming round: AVG, OBP, SLG, K%, BB%). The out-type breakdown is about *how* a batter made outs, not fielding performance, so it stays in scope.
- Refactoring the existing outs-breakdown logic already inline in `SeasonStatsPage.jsx`'s Players tab — that code keeps working exactly as-is; the card computes its own smaller version rather than sharing a function, to avoid touching already-shipped, working code for this feature.
- Per-player photos — the illustration is a generic character, not a likeness.
- Any change to the existing `PlayerDetailModal` (per-game log) — the card is a new, separate view.
- Editing/customizing card text or colors per player — fully generated, no manual editing.
- Batter handedness / true "pull vs. opposite field" — not tracked anywhere in the app, so spray zones are described neutrally (Left/Center/Right), never as pull/oppo.

---

## Data Layer — `computePlayerCard(playerName, gamesInput)`

New exported function in `storage.js`, alongside `computeSeasonStats` / `computeOptimalBattingOrder`.

### Step 1: Pull the player's stats and type

```js
const seasonStats = computeSeasonStats(gamesInput)
const player = seasonStats.find(s => s.name === playerName)
const roster = getRoster()
const type = roster.find(p => p.name === playerName)?.type // 'BBH' | 'SBH'
```

If there's no `player` entry at all (never batted this season), treat as `AB: 0` — same cold-start path as below.

### Step 2: Cold-start check

Reuses the existing `MIN_AB_FOR_OWN_STATS = 5` constant already defined in `storage.js` (from the Optimal Batting Order feature).

If `player.AB < 5`: return early —

```js
{ name, type, qualifies: false, G, AB, AVG, OBP, SLG, KPct, BBPct }
```

The UI shows raw stats but replaces the tips section with a "not enough at-bats yet" note, and the illustration defaults to the neutral `ready-stance` pose.

### Step 3: Compute the team-average baseline (same type, weighted)

```js
const teammates = seasonStats.filter(s => {
  const t = roster.find(p => p.name === s.name)?.type
  return t === type && s.AB >= MIN_AB_FOR_OWN_STATS
})
```

Sum raw counts across `teammates` (AB, H, BB, K, total bases — total bases derived the same way `computeSeasonStats` does: `singles + 2B*2 + 3B*3 + HR*4`), then derive baseline AVG/OBP/SLG/K%/BB% from those sums (same weighted-average approach `computeGroupStats` already uses, extended to cover SLG/K%/BB%, which `computeGroupStats` doesn't currently compute).

If `teammates` is empty (including the case where the player is the only qualifier of their type), baseline defaults to all-zero rates — every comparison then falls below the "strength" threshold and the player gets the neutral message. This is an accepted edge case, not a bug.

### Step 4: Compare against thresholds, generate tips

For each of these stat/direction pairs, compute `player_value - baseline_value` (K% is inverted — lower is better):

| Stat | Threshold | Strength phrasing | Needs-work phrasing |
|------|-----------|--------------------|----------------------|
| AVG  | ±.050     | "Hitting well above the team average — keep it up." | "Batting average is below the team average — focus on solid contact." |
| OBP  | ±.050     | "Excellent at getting on base." | "On-base rate is below average — look for more pitches to work the count." |
| SLG  | ±.050     | "Strong extra-base power." | "Limited extra-base pop so far — look to drive the ball with authority." |
| K%   | ±5 pts (lower=better) | "Rarely strikes out — great plate discipline." | "Strikeout rate is high — see the ball, shorten the swing." |
| BB%  | ±5 pts (higher=better) | "Draws a lot of walks — great eye at the plate." | "Rarely walks — work the count and be more selective." |

**Ranking uses severity, not raw gap.** AVG/OBP/SLG gaps live on a ~0-0.3 decimal scale while K%/BB% gaps live on a ~0-50 percentage-point scale — sorting by raw gap would let K%/BB% dominate every ranking regardless of how meaningful the AVG/OBP/SLG difference actually is. Instead, compute `severity = signedGap / threshold` for each stat that clears its threshold (e.g. an AVG gap of `.200` against a `.050` threshold is severity `4.0`; a K% gap of `20` points against a `5` threshold is also severity `4.0` — now directly comparable). Collect all strengths and all needs-work into two lists, each **sorted by severity descending**, each capped at 3. If both lists are empty, set a single `neutral: true` flag with the message "Right around team average across the board — consistent, well-rounded hitter."

### Step 5: Pick the illustration pose and headline stat

This uses the **full set of stats that cleared the strength threshold in Step 4, before the top-3 display cap is applied** — not the final capped `strengths` list. That decoupling matters: K% almost never has the single highest severity among pose-eligible stats, but it can still crowd a pose-eligible stat (e.g. OBP) out of the top-3 *display* list purely because K% clears its own threshold by more. Pose selection shouldn't be affected by that unrelated display-cap collision, so it looks at the wider, uncapped set. Restrict that set to `{AVG, OBP, SLG, BBPct}` (K% has no positive pose — it's a rate to minimize, not something to depict). Take the single highest-severity entry among those and map to a pose:

```
SLG          → 'power'
AVG          → 'contact'
OBP or BBPct → 'patient'
(none found) → 'ready'
```

If the player doesn't qualify (`AB < 5`), pose is always `'ready'`.

**The headline stat shown big on the front face is derived from the pose**, not picked independently, so the number and the illustration always agree:

```
pose 'power'   → headlineStat = SLG
pose 'contact' → headlineStat = AVG
pose 'patient' → headlineStat = OBP   (even when BBPct was the actual driver — OBP reads better as a headline number; BBPct still shows in the back-side tips)
pose 'ready'   → headlineStat = AVG   (safe default, shown even though it didn't clear the strength threshold)
```

### Step 6: Spray-zone insight (optional — depends on tracked hit locations)

`hitLocation` (`{x, y}` on the existing 280×260 field grid, home plate at `(140,250)`) is only present on at-bats where it was tapped in `HitLocationModal` — it's sparse and optional, unlike every other stat here. This step never blocks the rest of the card.

**Classify each located at-bat into one of 6 zones**, using the field geometry already defined in `src/components/softballFieldConstants.js` (`FIELD_HOME`) plus the infield-dirt circle already drawn in `ScoresheetPage.jsx` (center `(140, 200)`, radius `73`):

```js
function classifyZone({ x, y }) {
  const dx = x - FIELD_HOME[0]
  const dy = y - FIELD_HOME[1]
  const angle = Math.atan2(dx, -dy) * (180 / Math.PI) // 0° = straight up the middle, + = toward right field
  const side = angle < -15 ? 'Left' : angle > 15 ? 'Right' : 'Center'
  const distFromMound = Math.hypot(x - 140, y - 200)
  const depth = distFromMound <= 73 ? 'Infield' : 'Outfield'
  return `${depth} ${side}`   // one of 6: "Infield Left" … "Outfield Right"
}
```

**Gather every located at-bat for this player across the whole season** (not just one game — this differs from the existing per-game `SprayChart`/`SprayDiamond`, which only ever look at one game's `atBats`):

```js
const dots = []
for (const game of games) {
  for (const ab of (game.atBats || [])) {
    if (ab.batter !== playerName || ab.isOpponent || !ab.hitLocation) continue
    dots.push({ x: ab.hitLocation.x, y: ab.hitLocation.y, outcome: ab.outcome,
                isHit: ['1B','2B','3B','HR'].includes(ab.outcome) })
  }
}
```

The mini spray diagram on the card back renders `dots` (using the existing per-outcome colors already defined in `HIT_COLORS`) whenever `dots.length > 0` — no minimum, since it's just a plot of what actually happened, not a claim.

**Zone tips require `dots.length >= MIN_AB_FOR_OWN_STATS` (5, reusing the existing constant)** before generating any text insight — below that, `bestZone`/`worstZone` are both `null` and no zone-based tip is added. Above that:

1. Group `dots` by zone. A zone **qualifies** for best/worst consideration only with `total >= 2` located at-bats in that zone (avoids a single ball in play driving a claim).
2. `bestZone` = qualifying zone with the highest hit rate (`hits/total`), ties broken by more hits, then by zone order (`Infield Left, Infield Center, Infield Right, Outfield Left, Outfield Center, Outfield Right`).
3. `worstZone` = qualifying zone with the highest out rate, same tie-break logic (mirrored).
4. **If `bestZone === worstZone`** (only one zone ever qualified), report it as only one or the other, not both: if its hit rate is `>= 0.5` call it `bestZone` and set `worstZone = null`; otherwise call it `worstZone` and set `bestZone = null`.

Messages (appended to the `strengths`/`needsWork` lists from Step 4, after the rate-stat tips — each list gets at most **one** spray-derived entry on top of its existing cap of 3, so the displayed max per list is 4):

- `bestZone` → strengths: `{ stat: 'SPRAY_BEST', message: "Best contact zone: ${bestZone} — that's where most of your hits land." }`
- `worstZone` → needsWork: `{ stat: 'SPRAY_WORST', message: "A lot of outs come on balls hit to ${worstZone} — worth working on in BP." }`

Recompute `neutral` (`strengths.length === 0 && needsWork.length === 0`) *after* these are appended, so a player with no rate-stat signal but a real spray pattern is not incorrectly marked neutral.

### Step 7: Out-type breakdown

A small, card-scoped version of the outs analysis that already exists inline in `SeasonStatsPage.jsx`'s Players tab — **not a shared function**, since that existing code stays untouched (see Non-Goals). Same 5 out codes, same season-wide scope:

```js
const OUT_TYPES = ['K', 'F', 'G', 'FC', 'SAC']
const MIN_OUTS_FOR_BREAKDOWN = 3

function computeOutBreakdown(playerName, games) {
  const counts = { K: 0, F: 0, G: 0, FC: 0, SAC: 0 }
  let total = 0
  for (const game of games) {
    for (const ab of (game.atBats || [])) {
      if (ab.batter !== playerName || ab.isOpponent) continue
      if (OUT_TYPES.includes(ab.outcome)) { counts[ab.outcome]++; total++ }
    }
  }
  const mostCommon = total >= MIN_OUTS_FOR_BREAKDOWN
    ? OUT_TYPES.reduce((best, t) => (counts[t] > counts[best] ? t : best), OUT_TYPES[0])
    : null
  return { counts, total, mostCommon }
}
```

`mostCommon` ties are broken by `OUT_TYPES` order (K before F before G before FC before SAC), matching the deterministic tie-break style used everywhere else in this spec. This is purely descriptive (what kind of out happens most) and shown as its own line on the card back — it does **not** get merged into `strengths`/`needsWork`, since the K% rate-vs-baseline tip from Step 4 already covers the evaluative "your strikeout rate is high/low" judgment; this is just the raw fact.

### Edge case: player no longer on the roster

If `playerName` has no matching roster entry (e.g. removed from the roster after playing games this season), `type` is `undefined`. The teammate filter in Step 3 then matches nothing, so `teammates` is empty and the baseline falls back to all-zero rates (same fallback as the "zero qualifying teammates" case) rather than throwing. The card still renders with the player's raw stats; comparisons against a zero baseline will trivially read as strengths, which is an accepted quirk of this rare case, not a bug to special-case further.

### Return shape

```js
{
  name, type,               // string, 'BBH'|'SBH'|undefined
  qualifies,                 // boolean
  G, AB, AVG, OBP, SLG, KPct, BBPct,  // same string formats as computeSeasonStats
  pose,                      // 'power' | 'contact' | 'patient' | 'ready'
  headlineStat,              // { key: 'AVG'|'OBP'|'SLG', value } — derived from pose, see above
  strengths,                 // [{ stat, message }], up to 4 (3 rate-stat + up to 1 spray-derived)
  needsWork,                 // [{ stat, message }], up to 4 (3 rate-stat + up to 1 spray-derived)
  neutral,                   // boolean — true when strengths and needsWork are both empty (computed after spray tips are appended)
  spray: {
    dots,                     // [{ x, y, outcome, isHit }] — every located at-bat this season, [] if none
    bestZone,                 // string | null — one of the 6 zone names, or null
    worstZone,                // string | null
  },
  outBreakdown: {
    counts,                   // { K, F, G, FC, SAC }
    total,                     // number
    mostCommon,                // 'K'|'F'|'G'|'FC'|'SAC'|null — null if total < 3
  },
}
```

---

## Illustration Assets

Four files at `src/assets/cards/`:
- `swing-power.svg`
- `swing-contact.svg`
- `patient-stance.svg`
- `ready-stance.svg`

**Now:** each ships as a simple hand-coded placeholder — the vintage stitched-badge "seal" circle (navy ring, red dashed inner ring, player-initials-style monogram already validated in the brainstorming mockup) with the pose name printed underneath (e.g. "POWER") so it's visually obvious in dev which slot is which.

**Later:** the user replaces each file's *contents* with real commissioned/AI-generated artwork (prompts already provided to the user for an AI image generator), using the **same filenames**. `PlayerCardModal.jsx` imports these as static assets — no code changes needed when the files are swapped, only new file contents at the same path.

---

## UI — `PlayerCardModal.jsx`

Entered via a new "View Card" button added to each player row in `SeasonStatsPage.jsx` (next to the existing per-game-log entry point), passing the player's name.

**Flip mechanic:** CSS 3D flip (`transform-style: preserve-3d`, `backface-visibility: hidden`, `rotateY(180deg)` on tap), matching the validated brainstorming mockup — cream card stock, navy border, navy/red ink accents.

**Front face:**
- Navy header band: player name, type + "MID-SEASON CARD" label
- Illustration slot: the pose-selected SVG from `src/assets/cards/`
- Headline stat: `headlineStat` from `computePlayerCard` — large numeral + label, always paired with the pose (see Data Layer Step 5)
- Strength ribbon badge (only if `strengths.length > 0`): short label of the top strength (e.g. "TEAM STRENGTH: POWER")

**Back face:**
- Navy header: "SEASON STATS"
- Stat table: G, AB, AVG, OBP, SLG, K%, BB%
- "COACH'S NOTES" section: `strengths` in green-accented rows, `needsWork` in red-accented rows, or (if `!qualifies`) a "not enough at-bats yet" note, or (if `neutral`) the neutral message
- Mini spray diagram (only if `spray.dots.length > 0`): the same field-outline geometry as `SprayDiamond`/`SprayChart`, at a smaller size, plotting `spray.dots` with the existing `HIT_COLORS` per outcome — a compact, card-appropriate version, not an interactive one (no tap-to-inspect)
- "Most frequent out: `<label>`" line (only if `outBreakdown.mostCommon` is not `null`), using the same out-type labels already established in `SeasonStatsPage.jsx`'s Players tab (Strikeout / Flyout / Groundout / Fielder's Choice / Sacrifice)

**Download button:** captures both faces — rendered flat (not mid-flip-transform) off-screen or sequentially — using `html-to-image` (new dependency; no existing to-image/canvas library in this repo) `toPng()` on each face, then draws both onto a single `<canvas>` stacked vertically (front on top, back below) and triggers a file download of that combined canvas as one PNG. This mirrors the "both sides, stacked in one image" decision from brainstorming.

**Print button:** reuses the existing `window.print()` + `no-print` CSS class pattern from `ScoresheetPage.jsx`, printing both faces stacked (same flat, non-flipped rendering used for download).

---

## Testing

- New `src/tests/storage.playerCard.test.js` covering `computePlayerCard`:
  - Qualifying player with clear strengths and needs-work, correct thresholds applied
  - Neutral case — all deltas under threshold → `neutral: true`, empty strengths/needsWork
  - Cold-start (`AB < 5`) → `qualifies: false`, pose `'ready'`, no tips computed
  - Zero qualifying teammates of the same type → baseline defaults to zero rates, doesn't throw, player still gets a valid result (likely all-strength since baseline is 0)
  - Pose selection: SLG-driven → `'power'`, AVG-driven → `'contact'`, OBP-driven and BBPct-driven → `'patient'`, no qualifying strength → `'ready'`
  - Tips capped at 3 rate-stat entries each, sorted by gap size descending
  - Spray zone classification: a point straight up the middle in the outfield → `'Outfield Center'`; a point near the foul line close to home → `'Infield Left'` or `'Infield Right'`
  - Spray insight below the 5-located-AB threshold → `bestZone`/`worstZone` both `null`, but `dots` still populated
  - Spray insight with a clear best zone and a clear (different) worst zone → both populated, correct messages appended
  - Spray insight where only one zone ever qualifies → only `bestZone` OR only `worstZone` is set, never both, per the tie-break rule
  - `neutral` is `false` when the only signal is a spray tip (no rate-stat strengths/needsWork)
  - Out breakdown: clear most-common type identified; below `MIN_OUTS_FOR_BREAKDOWN` (3) → `mostCommon: null`; a tie between two out types → resolved by `OUT_TYPES` order
- New `src/tests/PlayerCardModal.test.jsx`:
  - Renders front face by default, flips to back face on click/tap
  - Renders the correct pose illustration based on `computePlayerCard`'s `pose` field
  - Cold-start player shows the "not enough at-bats" message instead of tips
  - Mini spray diagram renders when `spray.dots.length > 0`, is absent when empty
  - "Most frequent out" line renders when `outBreakdown.mostCommon` is set, is absent when `null`
