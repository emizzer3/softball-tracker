# Team Tactics Insights — Design
**Date:** 2026-07-06
**Status:** Approved

---

## Context

`docs/2026-07-06-app-review.md` flagged that the Season Stats → Insights tab is strong on individual batting analysis (streaks, trajectory, how-players-get-out) but has nothing about team-level situational hitting — RISP (runners in scoring position), runners left on base, and double-play rate. That's a real gap given the user's stated priority: team-tactics insights first, individual second.

While scoping this, reorganizing the existing tabs came up too: **Trends** and **Insights** currently overlap in name ("insights" colloquially describes both), but their actual content splits cleanly along a different axis — raw numbers vs. visual/temporal charts vs. derived coaching analysis. The new situational content is the same category as the existing Insights content (derived analysis), just at team scope instead of individual scope. That prompted a full re-split of Season Stats into four scope-based tabs.

---

## Scope & Non-Goals

**In scope:**
- New `computeSituationalStats()` in `storage.js`: team RISP AVG, team LOB/game, team GIDP count, per-player RISP breakdown
- Reorganize `SeasonStatsPage.jsx` from 3 tabs (Batting / Trends / Insights) to 4 tabs (Batting / Team / Players / Trends)
- Move existing "Runs Scored vs Allowed" and "Hits by Type per Game" bar charts from Trends into the new Team tab
- Rename "Insights" tab to "Players" (content unchanged: Streaks, Season Trajectory, How Players Get Out)

**Not in scope:**
- GIDP "rate" (GIDP ÷ double-play chances) — would require tracking runner-on-1st-with-<2-outs situations across the season; only a raw GIDP count is in scope
- Fielding errors by position — errors are currently tracked per-player only, not per-position; attributing them to a position would require cross-referencing `fieldingLog` per inning, which is meaningfully more plumbing and is a separate future item
- Fixing the pre-existing gap where a caught-stealing/pickoff out doesn't clear the specific runner from `gs.bases` (only clears on the 3rd out) — noted as a known limitation on the new LOB stat, not fixed here
- Any change to game-tracking UX in `TrackerPage.jsx` — this is a stats/display-only feature, built entirely on data already recorded

---

## Data Layer — `computeSituationalStats(gamesInput)`

New exported function in `storage.js`, alongside the existing `computeGameStats` / `computeSeasonStats` / `computeRunsPerGame`.

### RISP (runners in scoring position)

For each game, walk `atBats` in array order (this is already one continuous chronological timeline per game, shared across both halves/innings). For at-bat `i`:

```
basesBefore(atBats[i]) =
  (atBats[i].inning === atBats[i-1].inning && atBats[i].half === atBats[i-1].half)
    ? atBats[i-1].bases
    : [false, false, false]   // new half-inning (or first at-bat of the game)
```

This correctly resets to empty across every half-inning boundary, regardless of whether that boundary was caused by a batted-ball out or a baserunning out (caught stealing/pickoff) recorded via `recordBattingRunnerOut`/`recordFieldingRunnerOut` — those don't add an at-bat, so the very next at-bat's `inning`/`half` simply won't match the previous at-bat's, and bases correctly reset to empty.

An at-bat is a **RISP at-bat** if `basesBefore[1]` (2nd) or `basesBefore[2]` (3rd) is true, and `!ab.isOpponent` (only our own team's batting — the opposing team's at-bats aren't tracked with individual batters and aren't relevant to our own hitting analysis).

Same AB/H accounting as the existing team AVG calculation (excludes `BB`/`HBP`/`SAC` from AB, counts `1B`/`2B`/`3B`/`HR` as H):

- **Team RISP AVG** = total RISP-H / total RISP-AB (season-wide)
- **Team overall AVG** = same as already computed in `computeSeasonStats` (for the delta comparison)
- **Per-player RISP** = `{ name, rispAB, rispH, rispAvg }[]` for every batter with `rispAB >= 1`, sorted by `rispAvg` descending

### LOB (left on base)

For each of our team's half-innings (grouped by `inning`, filtered to `!ab.isOpponent`), take the **last** at-bat in that group and count how many bases are occupied in its `bases` field. That count is the number of runners stranded when that half-inning ended.

- **Team LOB total** = sum across all our half-innings, all games
- **Team LOB/game** = total ÷ number of games played

**Known limitation** (documented in the UI, not fixed): if a half-inning's final out is a caught-stealing or pickoff (via the "CS/Picked Off" button) rather than a batted-ball out, the specific runner isn't cleared from `bases` by that play — only a full reset on the 3rd out clears it. This means LOB can be slightly overcounted for innings ending that way. This is a pre-existing gap in the base-tracking logic, unrelated to this feature; fixing it is a separate follow-up.

### GIDP (grounded into double play)

No inference needed — [TrackerPage.jsx:358](../../../src/pages/TrackerPage.jsx#L358) already tags the primary putout's `playLog` entry with `doublePlay`/`triplePlay` flags and the `batter` name when `PutoutModal` records a double/triple play.

- **Team GIDP count** = count of `playLog` entries where `type === 'putout' && (doublePlay || triplePlay) && batter` (the primary entry only, not the paired second-out entry which has `batter: null`), summed across all games
- No per-player breakdown, no rate/denominator (see Non-Goals)

### Return shape

```js
{
  team: {
    rispAB, rispH, rispAvg,     // strings formatted like existing AVG (e.g. ".310")
    overallAvg,                  // for the delta comparison
    lobTotal, lobPerGame,
    gidpCount,
  },
  players: [
    { name, rispAB, rispH, rispAvg }
  ]  // sorted by rispAvg desc, only players with rispAB >= 1
}
```

---

## UI — `SeasonStatsPage.jsx`

### Tab bar changes

Current: `Batting | Trends | Insights`
New: `Batting | Team | Players | Trends`

- **Batting** — unchanged. Per-player leaderboard table (AB/H/2B/3B/HR/RBI/BB/K/AVG/OBP/SLG/K%/BB%), BBH vs SBH comparison sub-table, Fielding sub-table (PO/A/E), Pitch Patience sub-table.
- **Team** *(new tab, `activeTab === 'team'`)*:
  1. "Runs Scored vs Allowed" bar chart — moved as-is from Trends (same component/logic, same `computeRunsPerGame()` call)
  2. "Hits by Type per Game" bar chart — moved as-is from Trends (same `battingByGame` computation)
  3. New: three headline stat blocks — RISP AVG (with delta vs. team overall AVG, styled like the existing hot/cold streak cards), LOB/game, GIDP count
  4. New: "Clutch Hitting" table — Player · RISP AB · RISP H · RISP AVG, sorted by RISP AVG descending
  5. Small caption under the LOB stat: *"LOB may be slightly overcounted on innings ending in a caught-stealing/pickoff rather than a batted out."*
  6. No multi-game minimum gate — meaningful from game 1. If zero RISP at-bats exist yet, show: *"No runners in scoring position yet this season"* in place of the clutch table.
- **Players** *(renamed from `insights` to `players`)* — same content as today's Insights tab, unchanged: Streaks (Last 3 Games), Season Trajectory (Improving/Declining), How Players Get Out. Only the tab label and internal `activeTab` value change.
- **Trends** *(slimmed)* — Season Spray Chart, Per-Game Spray Chart Grid only. The empty-state gate (`"Play at least 2 games to see trends"`) changes from checking `runs.length < 2 && allDots.length === 0` to checking spray data alone (`allDots.length === 0`), since the runs chart no longer lives here.

### State

`activeTab` default value stays `'batting'`. Valid values become `'batting' | 'team' | 'players' | 'trends'` (renaming `'insights'` → `'players'`).

---

## Testing

- Add `src/tests/storage.situational.test.js` (matching the existing `storage.coaching.test.js` / `storage.stats.test.js` naming convention) covering `computeSituationalStats`:
  - RISP AB/H counted correctly when 2nd/3rd occupied before the at-bat, excluded when bases empty
  - Bases-before correctly resets to empty across a half-inning/inning boundary, including one ended by a `runnerOut` play with no corresponding at-bat
  - Opponent at-bats (`isOpponent: true`) excluded from all three stats
  - LOB computed from the last at-bat of each of our half-innings
  - GIDP counted once per double play (not twice, despite two `playLog` entries), triple plays counted correctly
  - Games with zero RISP at-bats produce `players: []` and `team.rispAB === 0` without dividing by zero
- Update `src/tests/SeasonStatsPage.coaching.test.jsx` and `src/tests/SeasonStatsPage.sort.test.jsx` for the renamed (`insights` → `players`) and new (`team`) tab values
- Update `src/tests/SeasonStatsPage.drilldown.test.jsx` if it depends on tab structure/labels
