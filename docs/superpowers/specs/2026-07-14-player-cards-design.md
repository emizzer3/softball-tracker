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
- New `computePlayerCard(playerName, gamesInput)` in `storage.js` — stats, team-average baseline comparison, generated tips, and illustration-pose selection.
- New `PlayerCardModal.jsx` — the flip-card UI, entered via a "View Card" button on each player row in `SeasonStatsPage.jsx`.
- Download button that captures **both card faces stacked into one PNG** for sharing/printing.
- Four illustration "slots" (`src/assets/cards/*.svg`) — shipped as hand-coded vintage-badge-style placeholders now; the user will supply real commissioned/AI-generated artwork later as a **drop-in file replacement at the same paths**, requiring no code changes.

**Not in scope:**
- Fielding stats on the card — batting only (confirmed in the original brainstorming round: AVG, OBP, SLG, K%, BB%).
- Per-player photos — the illustration is a generic character, not a likeness.
- Any change to the existing `PlayerDetailModal` (per-game log) — the card is a new, separate view.
- Editing/customizing card text or colors per player — fully generated, no manual editing.

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

Collect all strengths and all needs-work into two lists, each sorted by gap size descending, each capped at 3. If both lists are empty, set a single `neutral: true` flag with the message "Right around team average across the board — consistent, well-rounded hitter."

### Step 5: Pick the illustration pose and headline stat

Restrict to the strengths list filtered to `{AVG, OBP, SLG, BBPct}` (K% has no positive pose — it's a rate to minimize, not something to depict). Take the single largest-gap entry among those and map to a pose:

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
  strengths,                 // [{ stat, message }], up to 3
  needsWork,                 // [{ stat, message }], up to 3
  neutral,                   // boolean — true when strengths and needsWork are both empty
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
  - Tips capped at 3 each, sorted by gap size descending
- New `src/tests/PlayerCardModal.test.jsx`:
  - Renders front face by default, flips to back face on click/tap
  - Renders the correct pose illustration based on `computePlayerCard`'s `pose` field
  - Cold-start player shows the "not enough at-bats" message instead of tips
