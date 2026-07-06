# Softball Tracker — Full Review (2026-07-06)

Scope: the live PWA (`softball-tracker`), reviewed from three angles — code health, in-game tracking UX (offense + defense), and stats/coaching value. Based on reading the full source and hands-on testing of a live game in the browser (setup → tracker → season stats).

## Where things stand today

- Only **1 game** is in season history in this environment, so the stats/insights features are mostly unproven against real volume yet — worth keeping in mind when judging "is this useful."
- The app is considerably more built-out than a quick glance suggests. It already has cloud sync, a viewer mode, onboarding, spray charts, and a coaching-insights tab. This is not a thin MVP.

## 1. Code health

- [TrackerPage.jsx](../src/pages/TrackerPage.jsx) is **1,680 lines** — by far the largest file, and it's a single component holding ~15 pieces of state plus 6 inline modal components (`SacRunsModal`, `RunnerOutModal`, `PutoutModal`, `HitLocationModal`, `FieldingModal`, `OutcomeGuideSheet`). It works, but it's the one file where a future bug is most likely to hide, and it's the hardest one to safely hand to an agent (or a future you) for a small change. Splitting the modals into their own files would shrink the blast radius of any edit here — worth doing before the next big feature lands on this page.
- [SeasonStatsPage.jsx](../src/pages/SeasonStatsPage.jsx) (907 lines) is the second-largest and doing three jobs (batting/fielding tables, trends/spray chart, insights engine). Same shape of risk, lower urgency.
- Good separation elsewhere: `storage.js` is a clean, dependency-free data layer; stat computation is centralized there rather than scattered across pages (`SummaryPage.jsx` is the one exception — see below).
- Test coverage exists (`src/tests/*`) for storage, sync, and several pages — good sign for a hobby project.

## 2. Live tracking — offense vs defense complexity

This was the main ask, so I actually played through a game rather than just reading the code.

### Defense (opponent batting) — this is already well-tuned for pace
When your team is fielding, the screen simplifies down to two giant buttons: **OUT** and **RUN**. One tap closes out a play. Detailed fielder attribution (who caught it, who got the assist, double play) is tucked behind an optional "Track opponent at-bats in detail" `<details>` disclosure and a CS/Picked-off sheet — you only pay for that detail if you choose to. For your stated pain point ("fast-paced innings, falling behind"), **this half of the app already solves the problem** — it's about as low-friction as pitch-by-pitch tracking gets.

### Offense (your team batting) — noticeably more taps per play
Every ball-in-play outcome (1B/2B/3B/HR/F/G/E/FC/SAC — everything except BB/K) triggers a full-screen "Where did the ball land?" location picker before the play is logged. Even a routine groundout — where, because we're batting, there's no fielder to attribute — still goes through: **tap outcome → tap/skip hit location → skip/log double-play toggle**. That's 2–3 taps for a play defense logs in 1.
- This isn't wasted overhead, though — it's what feeds the **season spray chart** (Trends tab), which is genuinely good and already working with real data. So this is a real trade-off (more taps now for a valuable chart later), not a plain bug. Worth being explicit with yourself about whether that trade is worth it during a close, fast-moving game — an easy option would be a settings toggle to disable hit-location capture entirely for a given game.
- Minor real finding: the hit-location modal is a full-bleed field graphic with the "Skip" button below it — on the standard mobile viewport I tested, that button sits at the bottom of a tall stacked layout. Worth a quick check on an actual phone that "Skip" is reachable without scrolling during a fast at-bat.

### Setup friction (not live-game, but real and recurring)
Every game requires building a batting order that strictly alternates BBH/SBH. The player picker groups players visually by BBH/SBH, but the initial order is just click order — so picking "all the BBH players, then all the SBH players" (a very natural way to select) produces a fully-clashing order that then needs manual drag-to-reorder for every player. There's no "auto-arrange alternating" helper. This isn't a big deal once, but it's a small tax paid before every single game.

### Session-resilience gap
On a fresh page load I hit a "Set up cloud sync" interstitial gate before reaching the home screen — it didn't respect an already-in-progress game silently in the background (a "Resume Game" card was still there after dismissing it, so no data was lost, but the extra screen is exactly the kind of thing that could stall you for 10–15 seconds if your phone reloads the tab mid-game, e.g. after being backgrounded a while on iOS). Worth checking whether this gate can be skipped automatically whenever there's an active in-progress game.

## 3. Stats & "where to improve" — more built than expected

`storage.js` computes a genuinely rich stat set: AVG/OBP/SLG, K%/BB%, pitches-per-PA and "deep count %" (from ball/strike tracking), fielding PO/A/E per game, BBH-vs-SBH group splits, per-player game logs, and team runs-per-game trends.

The **Season Stats → Insights tab** already does real coaching-relevant work:
- Hot/cold streak detection (last-3-games AVG vs season AVG, ±0.080 threshold)
- Improving/declining trend detection with sparklines
- **"How players get out"** breakdown — flags "Most Ks," "Most FCs," "Most Groundouts" per player with a stacked bar of out-type composition

This is close to exactly what you described wanting ("figure out the best way to use the data to highlight improvement areas") — it's built, just needs more games in the log to become meaningful (streak/trend logic needs 3+ games).

**Gap found:** `KPct` and `BBPct` are computed and even have glossary entries in the Guide sheet, but are never actually rendered as a column anywhere. Given you're specifically interested in improvement areas, K% and BB% per player (walk discipline, strikeout rate) seem like an easy, valuable addition to the batting table — the computation already exists, it just needs a column.

**Gap found:** `SummaryPage.jsx` (the per-game summary shown right after a game ends) recomputes its own local AVG/OBP instead of reusing the shared `computeSeasonStats` logic in storage.js. Not a bug today, but a duplicate-logic seam that could drift out of sync if the stat formulas ever change in one place and not the other.

## 4. Backlog / build ideas

Roughly in priority order given what you told me (team-level insights first, individual second, pace matters most defensively — which is already solved):

1. **Surface K% and BB% as columns** in the season batting table — cheap, data's already computed.
2. **Auto-arrange batting order button** — one function to interleave BBH/SBH by roster order, replacing the manual drag step for the common case.
3. **Skip the cloud-sync gate when an active game exists** — avoid the mid-game interstitial risk.
4. **Optional "skip hit-location capture" toggle per game** — for when you want max pace over spray-chart detail (e.g. a tournament with quick turnarounds).
5. **Lower the streak/trend thresholds' games-needed bar or show partial insights at 2 games** — right now with 1 game in history, the Insights tab's headline metrics (streak/trend) are silent; a lightweight "not enough games yet, here's what you have" state would make the feature feel alive sooner in a season.
6. **Team-level "leaves runners on / GIDP rate / errors by position" view** — you specifically want team-tactics-first insights; the current Insights tab is strong on individual batting but has nothing yet about situational hitting (RISP), stranded runners, or fielding-error hot-spots by position. This is the natural next addition given the "team tactics" priority you named.
7. **Split TrackerPage's modals into their own files** — pure code-health, no user-facing change, but reduces risk on the file most likely to need touching next.
8. **Reconcile SummaryPage's local stat math with storage.js's shared functions** — same reasoning as #7.

## Open question for you

Given the Insights tab already covers a lot of the "individual improvement" ground you asked about, the highest-leverage next step is probably #6 (team-tactics insights) since you said that's the priority — want me to brainstorm that as its own feature (spec it properly, given how much logic already exists to build on)?
