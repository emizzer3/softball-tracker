# Mid-Season Player Cards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a flip-card "mid-season report card" per player — front shows a headline stat and a vintage-illustrated pose, back shows detailed stats, auto-generated coaching tips, a mini spray diagram, and an out-type breakdown — viewable in Season Stats and downloadable as one stacked PNG.

**Architecture:** A new pure data function `computePlayerCard` in `storage.js` (stats + team-average comparison + tips + spray/out analysis), a new `PlayerCardModal.jsx` component (flip-card UI, entered from a new button in `SeasonStatsPage.jsx`), and four placeholder illustration assets the user will swap for real artwork later without any code change.

**Tech Stack:** Vite + React (JSX), Tailwind CSS v4, `html-to-image` (new dependency, added in Task 4) for PNG capture, Vitest + Testing Library for tests.

## Global Constraints

- No TypeScript — plain JSX only.
- Batting stats only on the card (AVG, OBP, SLG, K%, BB%) — no fielding stats (PO/A/E).
- `MIN_AB_FOR_OWN_STATS = 5` (already defined in `storage.js`) gates: own-stat qualification, teammate baseline inclusion, and the spray-zone tip minimum (all three reuse the same constant, per the spec).
- Rate-stat thresholds: `±.050` for AVG/OBP/SLG, `±5` points for K%/BB%.
- Ranking/pose-selection uses **severity** (`signedGap / threshold`), never raw gap — AVG/OBP/SLG gaps (~0-0.3) and K%/BB% gaps (~0-50) are on different scales and are not directly comparable.
- Pose selection considers the **full uncapped** set of qualifying strengths restricted to `{AVG, OBP, SLG, BBPct}`, not the display-capped (max 3) `strengths` list.
- Zone classification: 6 zones (`Infield`/`Outfield` × `Left`/`Center`/`Right`), using `FIELD_HOME` from `src/components/softballFieldConstants.js` and the infield-dirt circle already drawn in `ScoresheetPage.jsx` (center `(140, 200)`, radius `73`). No batter handedness is tracked, so zones are always neutral (Left/Center/Right), never pull/oppo.
- Existing code that must not change: `PlayerDetailModal` (per-game log) in `SeasonStatsPage.jsx`, and the inline outs-breakdown logic already in that file's Players tab — the card computes its own smaller version rather than sharing a function.
- Spec: `docs/superpowers/specs/2026-07-14-player-cards-design.md` (read for full rationale; this plan's Global Constraints and task code are the authoritative values).

---

### Task 1: Core `computePlayerCard` — stats, baseline, tips, pose

**Files:**
- Modify: `src/storage.js` (append at end of file, after `setTeamConfig` at line 558)
- Test: `src/tests/storage.playerCard.test.js` (create)

**Interfaces:**
- Produces: `computePlayerCard(playerName, gamesInput?)` → `{ name, type, qualifies, G, AB, AVG, OBP, SLG, KPct, BBPct, pose, headlineStat: {key, value}, strengths: [{stat, message}], needsWork: [{stat, message}], neutral, spray: {dots: [], bestZone: null, worstZone: null}, outBreakdown: {counts: {K,F,G,FC,SAC}, total: 0, mostCommon: null} }`. In this task, `spray` and `outBreakdown` are always the empty/default shape shown — Task 2 fills them in for real without changing any other field.
- Consumes: `getGames`, `computeSeasonStats`, `getRoster` (all already exported in `storage.js`), and the existing `MIN_AB_FOR_OWN_STATS` constant (already defined at line 439, above `computeOptimalBattingOrder`).

- [ ] **Step 1: Write the failing tests**

Create `src/tests/storage.playerCard.test.js`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { saveGame, computePlayerCard } from '../storage'

beforeEach(() => localStorage.clear())

// Builds `hits` at-bats with outcome '1B' and `outs` at-bats with outcome 'K'
// for one batter — same helper convention as storage.optimalOrder.test.js.
function makeAtBats(batter, hits, outs, walks = 0) {
  const atBats = []
  for (let i = 0; i < hits; i++) atBats.push({ id: `${batter}-h${i}`, batter, inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [false, false, false] })
  for (let i = 0; i < outs; i++) atBats.push({ id: `${batter}-o${i}`, batter, inning: 1, half: 'bottom', outcome: 'K', rbi: 0, bases: [false, false, false] })
  for (let i = 0; i < walks; i++) atBats.push({ id: `${batter}-w${i}`, batter, inning: 1, half: 'bottom', outcome: 'BB', rbi: 0, bases: [false, false, false] })
  return atBats
}

function seedGame(id, roster, ...playerFixtures) {
  const atBats = playerFixtures.flatMap(([name, hits, outs, walks]) => makeAtBats(name, hits, outs, walks))
  saveGame({
    id, date: '2024-05-01', gameType: 'League',
    home: 'Renegades', away: 'Bulls', homeScore: 1, awayScore: 0, result: 'W',
    roster, atBats, playLog: [],
  })
}

const ROSTER = [
  { id: '1', name: 'PlayerX', type: 'BBH', active: true },
  { id: '2', name: 'Mate1', type: 'BBH', active: true },
  { id: '3', name: 'Mate2', type: 'BBH', active: true },
]

describe('computePlayerCard — qualifying player with strengths and needs-work', () => {
  it('ranks tips by severity (normalized gap), not raw gap, and picks a pose from the uncapped set', () => {
    // PlayerX: AB=10, H=6 (1B), BB=0, K=1 -> AVG=.600 OBP=.600 SLG=.600 KPct=10.0 BBPct=0.0
    // Mate1 & Mate2 (identical): AB=10, H=3 (1B), BB=4, K=3 -> AVG=.300 OBP=.500 SLG=.300 KPct=30.0 BBPct=28.6
    // Baseline (raw sums across all 3, PlayerX included, per spec Step 3):
    //   AB=30 H=12 BB=8 K=7 TB=12 -> AVG=.400 OBP=20/38=.5263 SLG=.400 KPct=23.33 BBPct=8/38*100=21.05
    // Severities: AVG=(.6-.4)/.05=4.0  OBP=(.6-.5263)/.05=1.47  SLG=4.0  KPct=((10-23.33)*-1)/5=2.67  BBPct=(0-21.05)/5=-4.21
    // Strengths sorted desc: AVG(4.0), SLG(4.0, tie broken by original AVG/OBP/SLG/KPct/BBPct order), KPct(2.67), OBP(1.47)
    // -> capped top 3 display: AVG, SLG, KPct (OBP loses the cap slot to KPct despite being pose-eligible)
    // -> pose picked from the FULL uncapped set restricted to {AVG,OBP,SLG,BBPct}: AVG(4.0) beats SLG(4.0, later in
    //    the stable sort) and OBP(1.47) -> pose 'contact', headline AVG
    seedGame('g1', ROSTER,
      ['PlayerX', 6, 1, 0],
      ['Mate1', 3, 3, 4],
      ['Mate2', 3, 3, 4],
    )
    const card = computePlayerCard('PlayerX')

    expect(card.qualifies).toBe(true)
    expect(card.AVG).toBe('.600')
    expect(card.strengths.map(s => s.stat)).toEqual(['AVG', 'SLG', 'KPct'])
    expect(card.needsWork.map(s => s.stat)).toEqual(['BBPct'])
    expect(card.pose).toBe('contact')
    expect(card.headlineStat).toEqual({ key: 'AVG', value: '.600' })
    expect(card.neutral).toBe(false)
  })

  it('picks the patient pose from BBPct even though OBP is the headline stat shown', () => {
    // PlayerC: AB=5 (qualifies), H=1, BB=10, K=4 -> AVG=.200 OBP=11/15=.733 SLG=.200 KPct=80.0 BBPct=10/15*100=66.7
    // Teammate: AB=10, H=3, BB=0, K=3 -> AVG=.300 OBP=.300 SLG=.300 KPct=30.0 BBPct=0.0
    // Baseline: AB=15 H=4 BB=10 K=7 TB=4 -> AVG=4/15=.2667 OBP=14/25=.560 SLG=.2667 KPct=46.67 BBPct=10/25*100=40.0
    // OBP severity=(.733-.560)/.05=3.47 (strength) | BBPct severity=(66.7-40.0)/5=5.34 (strength, higher than OBP)
    // -> pose-eligible top is BBPct, which maps to 'patient', but headlineStat is always OBP for that pose.
    saveGame({
      id: 'g2', date: '2024-05-01', gameType: 'League',
      home: 'Renegades', away: 'Bulls', homeScore: 1, awayScore: 0, result: 'W',
      roster: [
        { id: '1', name: 'PlayerC', type: 'SBH', active: true },
        { id: '2', name: 'Teammate', type: 'SBH', active: true },
      ],
      atBats: [
        ...makeAtBats('PlayerC', 1, 4, 10),
        ...makeAtBats('Teammate', 3, 3, 0),
      ],
      playLog: [],
    })
    const card = computePlayerCard('PlayerC')
    expect(card.pose).toBe('patient')
    expect(card.headlineStat.key).toBe('OBP')
    expect(card.headlineStat.value).toBe('.733')
  })

  it('picks the power pose when SLG is the only qualifying strength', () => {
    // PlayerA: AB=10, hits = 2 HR + 1 3B + 1 2B + 1 1B -> H=5, TB=14 -> AVG=.500 SLG=1.400
    // Teammate: AB=10, H=5 (all 1B) -> AVG=.500 SLG=.500
    // Baseline: AB=20 H=10 TB=19 -> AVG=.500 SLG=19/20=.950
    // AVG gap=0 (no tip). SLG severity=(1.4-.95)/.05=9.0 -> only qualifying pose-eligible strength -> pose 'power'.
    saveGame({
      id: 'g3', date: '2024-05-01', gameType: 'League',
      home: 'Renegades', away: 'Bulls', homeScore: 1, awayScore: 0, result: 'W',
      roster: [
        { id: '1', name: 'PlayerA', type: 'BBH', active: true },
        { id: '2', name: 'Teammate', type: 'BBH', active: true },
      ],
      atBats: [
        { id: 'a-hr0', batter: 'PlayerA', inning: 1, half: 'bottom', outcome: 'HR', rbi: 0, bases: [false, false, false] },
        { id: 'a-hr1', batter: 'PlayerA', inning: 1, half: 'bottom', outcome: 'HR', rbi: 0, bases: [false, false, false] },
        { id: 'a-3b0', batter: 'PlayerA', inning: 1, half: 'bottom', outcome: '3B', rbi: 0, bases: [false, false, false] },
        { id: 'a-2b0', batter: 'PlayerA', inning: 1, half: 'bottom', outcome: '2B', rbi: 0, bases: [false, false, false] },
        { id: 'a-1b0', batter: 'PlayerA', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [false, false, false] },
        ...Array.from({ length: 5 }, (_, i) => ({ id: `a-o${i}`, batter: 'PlayerA', inning: 1, half: 'bottom', outcome: 'K', rbi: 0, bases: [false, false, false] })),
        ...makeAtBats('Teammate', 5, 5, 0),
      ],
      playLog: [],
    })
    const card = computePlayerCard('PlayerA')
    expect(card.pose).toBe('power')
    expect(card.headlineStat).toEqual({ key: 'SLG', value: '1.400' })
  })
})

describe('computePlayerCard — neutral and cold-start', () => {
  it('is neutral when the only qualifying teammate is the player themselves', () => {
    // PlayerSolo (SBH, AB=5, qualifies) is the only qualifying SBH player; Bench (SBH, AB=2) doesn't qualify
    // and is excluded from the baseline -> baseline equals PlayerSolo's own stats exactly -> every gap is 0.
    saveGame({
      id: 'g4', date: '2024-05-01', gameType: 'League',
      home: 'Renegades', away: 'Bulls', homeScore: 1, awayScore: 0, result: 'W',
      roster: [
        { id: '1', name: 'PlayerSolo', type: 'SBH', active: true },
        { id: '2', name: 'Bench', type: 'SBH', active: true },
      ],
      atBats: [...makeAtBats('PlayerSolo', 2, 3, 0), ...makeAtBats('Bench', 1, 1, 0)],
      playLog: [],
    })
    const card = computePlayerCard('PlayerSolo')
    expect(card.qualifies).toBe(true)
    expect(card.neutral).toBe(true)
    expect(card.strengths).toEqual([])
    expect(card.needsWork).toEqual([])
    expect(card.pose).toBe('ready')
  })

  it('returns qualifies: false for a player under the AB threshold, without touching baseline stats', () => {
    seedGame('g5', ROSTER, ['PlayerX', 8, 2, 0], ['Mate1', 6, 4, 0], ['Mate2', 4, 6, 0])
    saveGame({
      id: 'g6', date: '2024-05-02', gameType: 'League',
      home: 'Renegades', away: 'Bulls', homeScore: 1, awayScore: 0, result: 'W',
      roster: ROSTER,
      atBats: makeAtBats('Rookie', 1, 0, 0), // AB = 1, below MIN_AB_FOR_OWN_STATS (5)
      playLog: [],
    })
    const card = computePlayerCard('Rookie')
    expect(card.qualifies).toBe(false)
    expect(card.AB).toBe(1)
    expect(card.pose).toBe('ready')
    expect(card.strengths).toEqual([])
    expect(card.needsWork).toEqual([])
  })

  it('returns qualifies: false for a player with no games at all', () => {
    const card = computePlayerCard('NeverPlayed')
    expect(card.qualifies).toBe(false)
    expect(card.AB).toBe(0)
    expect(card.AVG).toBe('.000')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- storage.playerCard`
Expected: FAIL — `computePlayerCard is not a function` (or similar import error), since it doesn't exist yet.

- [ ] **Step 3: Add the implementation to `storage.js`**

Modify `src/storage.js`: append this block at the very end of the file (after the existing `setTeamConfig` function, which currently ends the file at line 558):

```js

// ── Mid-season player card ──────────────────────────────────────────────
const RATE_THRESHOLD = 0.050
const PCT_THRESHOLD = 5
const POSE_STATS = ['AVG', 'OBP', 'SLG', 'BBPct']

const RATE_TIPS = {
  AVG:   { strength: 'Hitting well above the team average — keep it up.', needsWork: 'Batting average is below the team average — focus on solid contact.' },
  OBP:   { strength: 'Excellent at getting on base.', needsWork: 'On-base rate is below average — look for more pitches to work the count.' },
  SLG:   { strength: 'Strong extra-base power.', needsWork: 'Limited extra-base pop so far — look to drive the ball with authority.' },
  KPct:  { strength: 'Rarely strikes out — great plate discipline.', needsWork: 'Strikeout rate is high — see the ball, shorten the swing.' },
  BBPct: { strength: 'Draws a lot of walks — great eye at the plate.', needsWork: 'Rarely walks — work the count and be more selective.' },
}

export function computePlayerCard(playerName, gamesInput) {
  const games = gamesInput || getGames()
  const seasonStats = computeSeasonStats(games)
  const player = seasonStats.find(s => s.name === playerName)
  const roster = getRoster()
  const type = roster.find(p => p.name === playerName)?.type

  const G     = player?.G || 0
  const AB    = player?.AB || 0
  const AVG   = player?.AVG || '.000'
  const OBP   = player?.OBP || '.000'
  const SLG   = player?.SLG || '.000'
  const KPct  = player?.KPct || '0.0'
  const BBPct = player?.BBPct || '0.0'

  // Spray/out-type data doesn't depend on AB qualification, so it's computed once
  // up front and reused by both return paths below. Task 2 replaces these two
  // placeholders with real computation — no other line in this function changes.
  const spray = { dots: [], bestZone: null, worstZone: null }
  const outBreakdown = { counts: { K: 0, F: 0, G: 0, FC: 0, SAC: 0 }, total: 0, mostCommon: null }

  if (AB < MIN_AB_FOR_OWN_STATS) {
    return {
      name: playerName, type, qualifies: false,
      G, AB, AVG, OBP, SLG, KPct, BBPct,
      pose: 'ready',
      headlineStat: { key: 'AVG', value: AVG },
      strengths: [], needsWork: [], neutral: true,
      spray, outBreakdown,
    }
  }

  // Team-average baseline: same type, qualifying teammates only (includes this
  // player themselves if they qualify — matches computeGroupStats' existing
  // "all qualifying players of this type" semantics).
  const teammates = seasonStats.filter(s => {
    const t = roster.find(p => p.name === s.name)?.type
    return t === type && s.AB >= MIN_AB_FOR_OWN_STATS
  })

  let baseAB = 0, baseH = 0, baseBB = 0, baseK = 0, baseTB = 0
  for (const t of teammates) {
    const singles = t.H - t['2B'] - t['3B'] - t.HR
    baseTB += singles + t['2B'] * 2 + t['3B'] * 3 + t.HR * 4
    baseAB += t.AB; baseH += t.H; baseBB += t.BB; baseK += t.K
  }
  const baseline = {
    AVG:   baseAB > 0 ? baseH / baseAB : 0,
    OBP:   (baseAB + baseBB) > 0 ? (baseH + baseBB) / (baseAB + baseBB) : 0,
    SLG:   baseAB > 0 ? baseTB / baseAB : 0,
    KPct:  baseAB > 0 ? (baseK / baseAB) * 100 : 0,
    BBPct: (baseAB + baseBB) > 0 ? (baseBB / (baseAB + baseBB)) * 100 : 0,
  }

  const playerRates = {
    AVG: parseFloat(AVG), OBP: parseFloat(OBP), SLG: parseFloat(SLG),
    KPct: parseFloat(KPct), BBPct: parseFloat(BBPct),
  }

  // Severity = signedGap / threshold. Normalizes AVG/OBP/SLG (gaps ~0-0.3) against
  // KPct/BBPct (gaps ~0-50 points) onto a comparable scale before ranking — sorting
  // by raw gap would let KPct/BBPct dominate every ranking regardless of how
  // meaningful the AVG/OBP/SLG difference actually is.
  const rateStrengths = []
  const rateNeedsWork = []
  for (const stat of ['AVG', 'OBP', 'SLG', 'KPct', 'BBPct']) {
    const threshold = (stat === 'KPct' || stat === 'BBPct') ? PCT_THRESHOLD : RATE_THRESHOLD
    const inverted = stat === 'KPct' // lower is better
    const rawGap = playerRates[stat] - baseline[stat]
    const signedGap = inverted ? -rawGap : rawGap
    const severity = signedGap / threshold
    if (severity >= 1) rateStrengths.push({ stat, message: RATE_TIPS[stat].strength, severity })
    else if (severity <= -1) rateNeedsWork.push({ stat, message: RATE_TIPS[stat].needsWork, severity })
  }
  rateStrengths.sort((a, b) => b.severity - a.severity)
  rateNeedsWork.sort((a, b) => a.severity - b.severity)

  const strengths = rateStrengths.slice(0, 3).map(({ stat, message }) => ({ stat, message }))
  const needsWork = rateNeedsWork.slice(0, 3).map(({ stat, message }) => ({ stat, message }))

  // Pose uses the FULL uncapped rateStrengths list (not the display-capped
  // `strengths` above), restricted to the 4 pose-eligible stats — a non-pose stat
  // (KPct) crowding a pose-eligible stat out of the top-3 display cap must not
  // affect which pose gets picked.
  const poseEligible = rateStrengths.filter(s => POSE_STATS.includes(s.stat))
  const topPoseStat = poseEligible[0]?.stat
  let pose = 'ready'
  let headlineKey = 'AVG'
  if (topPoseStat === 'SLG') { pose = 'power'; headlineKey = 'SLG' }
  else if (topPoseStat === 'AVG') { pose = 'contact'; headlineKey = 'AVG' }
  else if (topPoseStat === 'OBP' || topPoseStat === 'BBPct') { pose = 'patient'; headlineKey = 'OBP' }
  const headlineValue = headlineKey === 'AVG' ? AVG : headlineKey === 'OBP' ? OBP : SLG

  const neutral = strengths.length === 0 && needsWork.length === 0

  return {
    name: playerName, type, qualifies: true,
    G, AB, AVG, OBP, SLG, KPct, BBPct,
    pose,
    headlineStat: { key: headlineKey, value: headlineValue },
    strengths, needsWork, neutral,
    spray, outBreakdown,
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- storage.playerCard`
Expected: PASS — 6/6 tests.

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `npm test`
Expected: PASS — all existing tests still pass (this task only appends new code; nothing existing was modified except the new top-of-file import, which nothing else in `storage.js` uses yet).

- [ ] **Step 6: Commit**

```bash
git add src/storage.js src/tests/storage.playerCard.test.js
git commit -m "feat: add computePlayerCard data layer for mid-season player cards"
```

---

### Task 2: Spray-zone insight and out-type breakdown

**Files:**
- Modify: `src/storage.js` (extends `computePlayerCard` from Task 1; adds two new helper functions)
- Test: `src/tests/storage.playerCard.test.js` (extend, same file as Task 1)

**Interfaces:**
- Consumes: `computePlayerCard`'s existing structure from Task 1 (specifically the two placeholder lines `const spray = ...` / `const outBreakdown = ...`, and the `strengths`/`needsWork`/`neutral` block).
- Produces: `spray: { dots: [{x, y, outcome, isHit}], bestZone: string|null, worstZone: string|null }` and `outBreakdown: { counts: {K,F,G,FC,SAC}, total, mostCommon: string|null }`, both now real. No other field in `computePlayerCard`'s return shape changes.

- [ ] **Step 1: Write the failing tests**

Append to `src/tests/storage.playerCard.test.js`:

```js
describe('computePlayerCard — spray-zone insight', () => {
  const SPRAY_ROSTER = [{ id: '1', name: 'PlayerE', type: 'BBH', active: true }]

  function sprayGame(hitDots, outDots) {
    const atBats = [
      ...hitDots.map(([x, y], i) => ({ id: `h${i}`, batter: 'PlayerE', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [false, false, false], hitLocation: { x, y } })),
      ...outDots.map(([x, y], i) => ({ id: `o${i}`, batter: 'PlayerE', inning: 1, half: 'bottom', outcome: 'G', rbi: 0, bases: [false, false, false], hitLocation: { x, y } })),
    ]
    saveGame({ id: 'gs', date: '2024-05-01', gameType: 'League', home: 'Renegades', away: 'Bulls', homeScore: 1, awayScore: 0, result: 'W', roster: SPRAY_ROSTER, atBats, playLog: [] })
  }

  it('identifies a clear best zone (hits) and worst zone (outs)', () => {
    // 3 hits straight up the middle, deep (Outfield Center); 3 outs short and to the
    // left of home (Infield Left). 6 located at-bats total, both zones have samples >= 2.
    sprayGame(
      [[140, 50], [135, 55], [145, 45]],
      [[100, 230], [105, 225], [95, 235]],
    )
    const card = computePlayerCard('PlayerE')
    expect(card.spray.dots).toHaveLength(6)
    expect(card.spray.bestZone).toBe('Outfield Center')
    expect(card.spray.worstZone).toBe('Infield Left')
    expect(card.strengths.some(s => s.stat === 'SPRAY_BEST' && s.message.includes('Outfield Center'))).toBe(true)
    expect(card.needsWork.some(s => s.stat === 'SPRAY_WORST' && s.message.includes('Infield Left'))).toBe(true)
  })

  it('leaves bestZone/worstZone null below the 5-located-AB threshold, but still returns dots', () => {
    sprayGame([[140, 50], [135, 55]], [[100, 230]]) // 3 located at-bats total
    const card = computePlayerCard('PlayerE')
    expect(card.spray.dots).toHaveLength(3)
    expect(card.spray.bestZone).toBeNull()
    expect(card.spray.worstZone).toBeNull()
  })

  it('reports only one of bestZone/worstZone when just one zone ever qualifies', () => {
    // 2 hits in Outfield Center (qualifies, total=2), plus 3 more located at-bats each
    // in a different zone (Infield Left, Infield Right, Outfield Left) with only 1 each
    // -- none of those reach the 2-sample zone minimum, so only Outfield Center qualifies.
    // hitRate there is 1.0 (>= 0.5) so it's reported as bestZone only.
    sprayGame(
      [[140, 50], [135, 55]],
      [[100, 230], [180, 230], [20, 130]],
    )
    const card = computePlayerCard('PlayerE')
    expect(card.spray.dots).toHaveLength(5)
    expect(card.spray.bestZone).toBe('Outfield Center')
    expect(card.spray.worstZone).toBeNull()
  })

  it('marks neutral: false when the only signal is a spray tip, not a rate-stat tip', () => {
    // PlayerF and Teammate have identical aggregate stats (AB=10 H=5 K=2 BB=0 each) ->
    // baseline equals PlayerF's own rates exactly -> no rate-stat strengths/needsWork.
    // 3 of PlayerF's hits are located in Outfield Center, 3 of their outs (G) in
    // Infield Left -> a real spray pattern despite the rate-stat tie.
    saveGame({
      id: 'gn', date: '2024-05-01', gameType: 'League',
      home: 'Renegades', away: 'Bulls', homeScore: 1, awayScore: 0, result: 'W',
      roster: [
        { id: '1', name: 'PlayerF', type: 'BBH', active: true },
        { id: '2', name: 'Teammate', type: 'BBH', active: true },
      ],
      atBats: [
        { id: 'f-h0', batter: 'PlayerF', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [false, false, false], hitLocation: { x: 140, y: 50 } },
        { id: 'f-h1', batter: 'PlayerF', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [false, false, false], hitLocation: { x: 135, y: 55 } },
        { id: 'f-h2', batter: 'PlayerF', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [false, false, false], hitLocation: { x: 145, y: 45 } },
        { id: 'f-h3', batter: 'PlayerF', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [false, false, false] },
        { id: 'f-h4', batter: 'PlayerF', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [false, false, false] },
        { id: 'f-g0', batter: 'PlayerF', inning: 1, half: 'bottom', outcome: 'G', rbi: 0, bases: [false, false, false], hitLocation: { x: 100, y: 230 } },
        { id: 'f-g1', batter: 'PlayerF', inning: 1, half: 'bottom', outcome: 'G', rbi: 0, bases: [false, false, false], hitLocation: { x: 105, y: 225 } },
        { id: 'f-g2', batter: 'PlayerF', inning: 1, half: 'bottom', outcome: 'G', rbi: 0, bases: [false, false, false], hitLocation: { x: 95, y: 235 } },
        { id: 'f-k0', batter: 'PlayerF', inning: 1, half: 'bottom', outcome: 'K', rbi: 0, bases: [false, false, false] },
        { id: 'f-k1', batter: 'PlayerF', inning: 1, half: 'bottom', outcome: 'K', rbi: 0, bases: [false, false, false] },
        ...makeAtBats('Teammate', 5, 3, 0).map((ab, i) => i < 2 ? { ...ab, outcome: 'K' } : ab), // K=2, matches PlayerF
      ],
      playLog: [],
    })
    const card = computePlayerCard('PlayerF')
    expect(card.strengths.filter(s => s.stat !== 'SPRAY_BEST')).toEqual([])
    expect(card.needsWork.filter(s => s.stat !== 'SPRAY_WORST')).toEqual([])
    expect(card.spray.bestZone).toBe('Outfield Center')
    expect(card.spray.worstZone).toBe('Infield Left')
    expect(card.neutral).toBe(false)
  })
})

describe('computePlayerCard — out-type breakdown', () => {
  it('identifies the most common out type', () => {
    const atBats = [
      ...Array.from({ length: 4 }, (_, i) => ({ id: `k${i}`, batter: 'PlayerG', inning: 1, half: 'bottom', outcome: 'K', rbi: 0, bases: [false, false, false] })),
      ...Array.from({ length: 2 }, (_, i) => ({ id: `g${i}`, batter: 'PlayerG', inning: 1, half: 'bottom', outcome: 'G', rbi: 0, bases: [false, false, false] })),
      { id: 'f0', batter: 'PlayerG', inning: 1, half: 'bottom', outcome: 'F', rbi: 0, bases: [false, false, false] },
    ]
    saveGame({ id: 'go1', date: '2024-05-01', gameType: 'League', home: 'Renegades', away: 'Bulls', homeScore: 1, awayScore: 0, result: 'W', roster: [{ id: '1', name: 'PlayerG', type: 'BBH', active: true }], atBats, playLog: [] })
    const card = computePlayerCard('PlayerG')
    expect(card.outBreakdown.total).toBe(7)
    expect(card.outBreakdown.mostCommon).toBe('K')
  })

  it('returns mostCommon: null below MIN_OUTS_FOR_BREAKDOWN (3)', () => {
    const atBats = [
      { id: 'k0', batter: 'PlayerH', inning: 1, half: 'bottom', outcome: 'K', rbi: 0, bases: [false, false, false] },
      { id: 'g0', batter: 'PlayerH', inning: 1, half: 'bottom', outcome: 'G', rbi: 0, bases: [false, false, false] },
    ]
    saveGame({ id: 'go2', date: '2024-05-01', gameType: 'League', home: 'Renegades', away: 'Bulls', homeScore: 1, awayScore: 0, result: 'W', roster: [{ id: '1', name: 'PlayerH', type: 'BBH', active: true }], atBats, playLog: [] })
    const card = computePlayerCard('PlayerH')
    expect(card.outBreakdown.total).toBe(2)
    expect(card.outBreakdown.mostCommon).toBeNull()
  })

  it('breaks a tie using OUT_TYPES order (K before F)', () => {
    const atBats = [
      { id: 'k0', batter: 'PlayerI', inning: 1, half: 'bottom', outcome: 'K', rbi: 0, bases: [false, false, false] },
      { id: 'k1', batter: 'PlayerI', inning: 1, half: 'bottom', outcome: 'K', rbi: 0, bases: [false, false, false] },
      { id: 'f0', batter: 'PlayerI', inning: 1, half: 'bottom', outcome: 'F', rbi: 0, bases: [false, false, false] },
      { id: 'f1', batter: 'PlayerI', inning: 1, half: 'bottom', outcome: 'F', rbi: 0, bases: [false, false, false] },
    ]
    saveGame({ id: 'go3', date: '2024-05-01', gameType: 'League', home: 'Renegades', away: 'Bulls', homeScore: 1, awayScore: 0, result: 'W', roster: [{ id: '1', name: 'PlayerI', type: 'BBH', active: true }], atBats, playLog: [] })
    const card = computePlayerCard('PlayerI')
    expect(card.outBreakdown.mostCommon).toBe('K')
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm test -- storage.playerCard`
Expected: FAIL — the new spray/out-breakdown assertions fail because `computePlayerCard` still returns the Task 1 placeholders (`dots: []`, `bestZone: null`, `mostCommon: null` unconditionally).

- [ ] **Step 3: Add the helper functions and wire them in**

Modify `src/storage.js`: insert this import as the very first line of the file (before the existing `// Keys` comment and `const K = {` block):

```js
import { FIELD_HOME } from './components/softballFieldConstants'
```

Then insert these two constants and two functions immediately **before** the `export function computePlayerCard` line added in Task 1:

```js
const OUT_TYPES_FOR_CARD = ['K', 'F', 'G', 'FC', 'SAC']
const MIN_OUTS_FOR_BREAKDOWN = 3
const MIN_ZONE_SAMPLE = 2
const ZONE_ORDER = ['Infield Left', 'Infield Center', 'Infield Right', 'Outfield Left', 'Outfield Center', 'Outfield Right']

function classifyZone(x, y) {
  const dx = x - FIELD_HOME[0]
  const dy = y - FIELD_HOME[1]
  const angle = Math.atan2(dx, -dy) * (180 / Math.PI) // 0deg = straight up the middle, + = toward right field
  const side = angle < -15 ? 'Left' : angle > 15 ? 'Right' : 'Center'
  const distFromMound = Math.hypot(x - 140, y - 200) // infield-dirt circle center, matches ScoresheetPage
  const depth = distFromMound <= 73 ? 'Infield' : 'Outfield' // matches ScoresheetPage's infield-dirt radius
  return `${depth} ${side}`
}

function computeSeasonSpray(playerName, games) {
  const dots = []
  for (const game of games) {
    for (const ab of (game.atBats || [])) {
      if (ab.batter !== playerName || ab.isOpponent || !ab.hitLocation) continue
      dots.push({
        x: ab.hitLocation.x, y: ab.hitLocation.y, outcome: ab.outcome,
        isHit: ['1B', '2B', '3B', 'HR'].includes(ab.outcome),
      })
    }
  }
  if (dots.length < MIN_AB_FOR_OWN_STATS) return { dots, bestZone: null, worstZone: null }

  const zoneStats = {}
  for (const dot of dots) {
    const zone = classifyZone(dot.x, dot.y)
    if (!zoneStats[zone]) zoneStats[zone] = { total: 0, hits: 0 }
    zoneStats[zone].total++
    if (dot.isHit) zoneStats[zone].hits++
  }

  const qualifying = ZONE_ORDER
    .filter(zone => zoneStats[zone] && zoneStats[zone].total >= MIN_ZONE_SAMPLE)
    .map(zone => ({ zone, ...zoneStats[zone], hitRate: zoneStats[zone].hits / zoneStats[zone].total }))

  if (qualifying.length === 0) return { dots, bestZone: null, worstZone: null }

  const byHitRateDesc = [...qualifying].sort((a, b) => b.hitRate - a.hitRate || b.hits - a.hits)
  const byHitRateAsc  = [...qualifying].sort((a, b) => a.hitRate - b.hitRate || (b.total - b.hits) - (a.total - a.hits))
  const topBest = byHitRateDesc[0]
  const topWorst = byHitRateAsc[0]

  if (topBest.zone === topWorst.zone) {
    return topBest.hitRate >= 0.5
      ? { dots, bestZone: topBest.zone, worstZone: null }
      : { dots, bestZone: null, worstZone: topWorst.zone }
  }
  return { dots, bestZone: topBest.zone, worstZone: topWorst.zone }
}

function computeOutBreakdown(playerName, games) {
  const counts = { K: 0, F: 0, G: 0, FC: 0, SAC: 0 }
  let total = 0
  for (const game of games) {
    for (const ab of (game.atBats || [])) {
      if (ab.batter !== playerName || ab.isOpponent) continue
      if (OUT_TYPES_FOR_CARD.includes(ab.outcome)) { counts[ab.outcome]++; total++ }
    }
  }
  const mostCommon = total >= MIN_OUTS_FOR_BREAKDOWN
    ? OUT_TYPES_FOR_CARD.reduce((best, t) => (counts[t] > counts[best] ? t : best), OUT_TYPES_FOR_CARD[0])
    : null
  return { counts, total, mostCommon }
}
```

Then, inside `computePlayerCard` (added in Task 1), make two small edits:

1. Replace the placeholder lines:

```js
  const spray = { dots: [], bestZone: null, worstZone: null }
  const outBreakdown = { counts: { K: 0, F: 0, G: 0, FC: 0, SAC: 0 }, total: 0, mostCommon: null }
```

with:

```js
  const spray = computeSeasonSpray(playerName, games)
  const outBreakdown = computeOutBreakdown(playerName, games)
```

2. Replace:

```js
  const neutral = strengths.length === 0 && needsWork.length === 0
```

with:

```js
  if (spray.bestZone) strengths.push({ stat: 'SPRAY_BEST', message: `Best contact zone: ${spray.bestZone} — that's where most of your hits land.` })
  if (spray.worstZone) needsWork.push({ stat: 'SPRAY_WORST', message: `A lot of outs come on balls hit to ${spray.worstZone} — worth working on in BP.` })

  const neutral = strengths.length === 0 && needsWork.length === 0
```

(This is the only place `neutral` is computed — moving it after the spray-tip append means a spray-only signal correctly clears the neutral flag, per the failing test in Step 1.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm test -- storage.playerCard`
Expected: PASS — 15/15 tests (6 from Task 1 + 9 new).

- [ ] **Step 5: Run the full suite to check for regressions**

Run: `npm test`
Expected: PASS — all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/storage.js src/tests/storage.playerCard.test.js
git commit -m "feat: add spray-zone insight and out-type breakdown to computePlayerCard"
```

---

### Task 3: `PlayerCardModal.jsx` — flip-card UI, illustration placeholders, wiring

**Files:**
- Create: `src/assets/cards/swing-power.svg`, `src/assets/cards/swing-contact.svg`, `src/assets/cards/patient-stance.svg`, `src/assets/cards/ready-stance.svg`
- Create: `src/components/PlayerCardModal.jsx`
- Modify: `src/pages/SeasonStatsPage.jsx`
- Test: `src/tests/PlayerCardModal.test.jsx` (create)

**Interfaces:**
- Consumes: `computePlayerCard(name)` from `../storage` (Tasks 1-2's complete return shape).
- Produces: `export default function PlayerCardModal({ name, onClose })` — a modal component. `SeasonStatsPage.jsx` renders it exactly like the existing `PlayerDetailModal` (conditional render keyed on a `viewCardPlayer` state string).

- [ ] **Step 1: Create the four placeholder illustration SVGs**

Same vintage stitched-badge design validated in brainstorming, one per pose, differing only in emoji and label — swap-in-place later with real artwork using these exact filenames.

Create `src/assets/cards/swing-power.svg`:

```svg
<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
  <circle cx="80" cy="80" r="68" fill="none" stroke="#1c2b4a" stroke-width="4"/>
  <circle cx="80" cy="80" r="58" fill="none" stroke="#c0392b" stroke-width="2" stroke-dasharray="4 6"/>
  <text x="80" y="75" text-anchor="middle" font-family="Georgia, serif" font-size="34">💥</text>
  <text x="80" y="112" text-anchor="middle" font-family="Georgia, serif" font-size="13" font-weight="bold" fill="#1c2b4a" letter-spacing="1">POWER</text>
</svg>
```

Create `src/assets/cards/swing-contact.svg`:

```svg
<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
  <circle cx="80" cy="80" r="68" fill="none" stroke="#1c2b4a" stroke-width="4"/>
  <circle cx="80" cy="80" r="58" fill="none" stroke="#c0392b" stroke-width="2" stroke-dasharray="4 6"/>
  <text x="80" y="75" text-anchor="middle" font-family="Georgia, serif" font-size="34">🎯</text>
  <text x="80" y="112" text-anchor="middle" font-family="Georgia, serif" font-size="13" font-weight="bold" fill="#1c2b4a" letter-spacing="1">CONTACT</text>
</svg>
```

Create `src/assets/cards/patient-stance.svg`:

```svg
<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
  <circle cx="80" cy="80" r="68" fill="none" stroke="#1c2b4a" stroke-width="4"/>
  <circle cx="80" cy="80" r="58" fill="none" stroke="#c0392b" stroke-width="2" stroke-dasharray="4 6"/>
  <text x="80" y="75" text-anchor="middle" font-family="Georgia, serif" font-size="34">👁️</text>
  <text x="80" y="112" text-anchor="middle" font-family="Georgia, serif" font-size="13" font-weight="bold" fill="#1c2b4a" letter-spacing="1">PATIENT</text>
</svg>
```

Create `src/assets/cards/ready-stance.svg`:

```svg
<svg viewBox="0 0 160 160" xmlns="http://www.w3.org/2000/svg">
  <circle cx="80" cy="80" r="68" fill="none" stroke="#1c2b4a" stroke-width="4"/>
  <circle cx="80" cy="80" r="58" fill="none" stroke="#c0392b" stroke-width="2" stroke-dasharray="4 6"/>
  <text x="80" y="75" text-anchor="middle" font-family="Georgia, serif" font-size="34">⚾</text>
  <text x="80" y="112" text-anchor="middle" font-family="Georgia, serif" font-size="13" font-weight="bold" fill="#1c2b4a" letter-spacing="1">READY</text>
</svg>
```

- [ ] **Step 2: Write the failing component test**

Create `src/tests/PlayerCardModal.test.jsx`:

```js
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PlayerCardModal from '../components/PlayerCardModal'
import { saveGame } from '../storage'

beforeEach(() => localStorage.clear())

function seedQualifyingPlayer() {
  const atBats = [
    ...Array.from({ length: 6 }, (_, i) => ({ id: `h${i}`, batter: 'Amy', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [false, false, false] })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: `o${i}`, batter: 'Amy', inning: 1, half: 'bottom', outcome: 'K', rbi: 0, bases: [false, false, false] })),
  ]
  saveGame({
    id: 'g1', date: '2024-05-01', gameType: 'League', home: 'Renegades', away: 'Bulls',
    homeScore: 1, awayScore: 0, result: 'W',
    roster: [{ id: '1', name: 'Amy', type: 'BBH', active: true }],
    atBats, playLog: [],
  })
}

describe('PlayerCardModal', () => {
  it('renders the front face by default and flips to the back face on tap', () => {
    seedQualifyingPlayer()
    render(<PlayerCardModal name="Amy" onClose={() => {}} />)
    // "MID-SEASON CARD" is a JSX literal following an interpolated type-emoji prefix
    // (renders as e.g. "⚾ BBH · MID-SEASON CARD"), so it must be matched with a regex,
    // not an exact string. Use getAllByText().at(0), not getByText: Task 4 mounts a
    // second, visually hidden copy of the same front/back content for print/download
    // capture, so by the end of this plan the same text exists twice in the DOM —
    // getByText would then throw "multiple elements found." getAllByText stays valid
    // both before and after that change.
    expect(screen.getAllByText(/MID-SEASON CARD/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('SEASON STATS').length).toBeGreaterThan(0) // present in DOM (back face), just not visually flipped

    const frontFace = screen.getAllByText(/MID-SEASON CARD/)[0]
    fireEvent.click(frontFace.closest('.pc-wrap'))
    // After flipping, the wrapper carries the 'flipped' class (visual-only change; both faces stay mounted)
    expect(document.querySelector('.pc-wrap.flipped')).toBeInTheDocument()
  })

  it('shows the not-enough-at-bats message for a cold-start player instead of tips', () => {
    saveGame({
      id: 'g2', date: '2024-05-01', gameType: 'League', home: 'Renegades', away: 'Bulls',
      homeScore: 1, awayScore: 0, result: 'W',
      roster: [{ id: '1', name: 'Rookie', type: 'BBH', active: true }],
      atBats: [{ id: 'h0', batter: 'Rookie', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [false, false, false] }],
      playLog: [],
    })
    render(<PlayerCardModal name="Rookie" onClose={() => {}} />)
    // getAllByText, not getByText — see note above (Task 4 duplicates this text into a hidden capture copy).
    expect(screen.getAllByText(/not enough at-bats yet/i).length).toBeGreaterThan(0)
  })

  it('calls onClose when the Close button is clicked', () => {
    seedQualifyingPlayer()
    let closed = false
    render(<PlayerCardModal name="Amy" onClose={() => { closed = true }} />)
    fireEvent.click(screen.getByText('Close'))
    expect(closed).toBe(true)
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- PlayerCardModal`
Expected: FAIL — cannot resolve `../components/PlayerCardModal` (file doesn't exist yet).

- [ ] **Step 4: Create `PlayerCardModal.jsx`**

Create `src/components/PlayerCardModal.jsx`:

```jsx
import { useState } from 'react'
import { X } from 'lucide-react'
import { computePlayerCard } from '../storage'
import swingPower from '../assets/cards/swing-power.svg'
import swingContact from '../assets/cards/swing-contact.svg'
import patientStance from '../assets/cards/patient-stance.svg'
import readyStance from '../assets/cards/ready-stance.svg'

const POSE_IMAGES = { power: swingPower, contact: swingContact, patient: patientStance, ready: readyStance }
const HEADLINE_LABELS = { AVG: 'BATTING AVG', OBP: 'ON-BASE %', SLG: 'SLUGGING %' }
const STAT_SHORT_LABEL = { AVG: 'CONTACT', OBP: 'ON-BASE', SLG: 'POWER', KPct: 'DISCIPLINE', BBPct: 'PATIENCE', SPRAY_BEST: 'PLACEMENT' }
const OUT_LABELS = { K: 'Strikeout', F: 'Flyout', G: 'Groundout', FC: "Fielder's Choice", SAC: 'Sacrifice' }
const SPRAY_DOT_COLORS = { '1B': '#22c55e', '2B': '#16a34a', '3B': '#15803d', 'HR': '#14532d', 'F': '#ef4444', 'G': '#dc2626', 'FC': '#f59e0b', 'SAC': '#f97316' }

// Small, non-interactive field outline for the card back — same geometry as
// SprayDiamond/SprayChart, simplified (no tap-to-inspect, fixed small size).
function MiniSprayDiagram({ dots }) {
  const home = [140, 250], lf = [9, 119], rf = [271, 119]
  return (
    <svg viewBox="0 0 280 260" style={{ width: '100%', maxWidth: 180, display: 'block', margin: '0 auto' }}>
      <path d={`M ${home[0]},${home[1]} L ${lf[0]},${lf[1]} A 185,185 0 0,1 ${rf[0]},${rf[1]} Z`} fill="#86efac" opacity="0.25" />
      <circle cx={140} cy={200} r={73} fill="#d4a264" opacity="0.25" />
      <path d={`M ${lf[0]},${lf[1]} A 185,185 0 0,1 ${rf[0]},${rf[1]}`} fill="none" stroke="#94a3b8" strokeWidth={1.5} />
      <line x1={home[0]} y1={home[1]} x2={lf[0]} y2={lf[1]} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3" />
      <line x1={home[0]} y1={home[1]} x2={rf[0]} y2={rf[1]} stroke="#94a3b8" strokeWidth={1.5} strokeDasharray="5 3" />
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={6} fill={SPRAY_DOT_COLORS[d.outcome] || '#6b7280'} stroke="white" strokeWidth={1} opacity={0.85} />
      ))}
    </svg>
  )
}

function CardFront({ card }) {
  return (
    <>
      <div style={{ background: '#1c2b4a', padding: '10px 12px', textAlign: 'center' }}>
        <div style={{ color: '#f3ead9', fontSize: 20, fontWeight: 'bold', letterSpacing: 1 }}>{card.name}</div>
        <div style={{ color: '#c0392b', fontSize: 11, fontWeight: 'bold' }}>{card.type ? `${card.type === 'BBH' ? '⚾' : '🥎'} ${card.type} · ` : ''}MID-SEASON CARD</div>
      </div>
      <div style={{ padding: '16px 14px', textAlign: 'center' }}>
        <img src={POSE_IMAGES[card.pose]} alt={`${card.pose} pose`} style={{ width: 120, height: 120, margin: '0 auto', display: 'block' }} />
        <div style={{ marginTop: 12, fontSize: 30, fontWeight: 'bold', color: '#1c2b4a' }}>{card.headlineStat.value}</div>
        <div style={{ fontSize: 10, letterSpacing: 2, color: '#c0392b', fontWeight: 'bold' }}>{HEADLINE_LABELS[card.headlineStat.key]}</div>
      </div>
      {card.strengths.length > 0 && (
        <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, textAlign: 'center' }}>
          <span style={{ display: 'inline-block', border: '2px solid #c0392b', borderRadius: 20, color: '#c0392b', padding: '3px 10px', fontSize: 9, fontWeight: 'bold' }}>
            ⭐ TEAM STRENGTH: {STAT_SHORT_LABEL[card.strengths[0].stat] || card.strengths[0].stat}
          </span>
        </div>
      )}
    </>
  )
}

function CardBack({ card }) {
  return (
    <>
      <div style={{ background: '#1c2b4a', padding: '8px 12px', textAlign: 'center' }}>
        <div style={{ color: '#f3ead9', fontSize: 14, fontWeight: 'bold' }}>SEASON STATS</div>
      </div>
      <div style={{ padding: '10px 14px', overflowY: 'auto' }}>
        <table style={{ width: '100%', fontSize: 10, borderCollapse: 'collapse', color: '#1c2b4a', textAlign: 'center' }}>
          <tbody>
            <tr style={{ borderTop: '2px solid #1c2b4a', borderBottom: '2px solid #1c2b4a', fontWeight: 'bold' }}>
              <td style={{ padding: '4px 2px' }}>G</td><td>AB</td><td>AVG</td><td>OBP</td><td>SLG</td><td>K%</td><td>BB%</td>
            </tr>
            <tr><td style={{ padding: '4px 2px' }}>{card.G}</td><td>{card.AB}</td><td>{card.AVG}</td><td>{card.OBP}</td><td>{card.SLG}</td><td>{card.KPct}%</td><td>{card.BBPct}%</td></tr>
          </tbody>
        </table>

        <div style={{ marginTop: 10, fontSize: 10, fontWeight: 'bold', color: '#1c2b4a', letterSpacing: 1, borderBottom: '1px solid #1c2b4a', paddingBottom: 3 }}>COACH'S NOTES</div>
        <div style={{ marginTop: 6 }}>
          {!card.qualifies && (
            <p style={{ fontSize: 11, color: '#1c2b4a' }}>Not enough at-bats yet (needs 5+, has {card.AB}) — check back later in the season.</p>
          )}
          {card.qualifies && card.neutral && (
            <p style={{ fontSize: 11, color: '#1c2b4a' }}>Right around team average across the board — consistent, well-rounded hitter.</p>
          )}
          {card.qualifies && !card.neutral && (
            <>
              {card.strengths.map((s, i) => (
                <div key={i} style={{ fontSize: 11, background: '#dff0d8', borderLeft: '4px solid #2f7d3c', padding: '6px 8px', color: '#1c2b4a', marginBottom: 4 }}>🟢 {s.message}</div>
              ))}
              {card.needsWork.map((s, i) => (
                <div key={i} style={{ fontSize: 11, background: '#fbe1df', borderLeft: '4px solid #c0392b', padding: '6px 8px', color: '#1c2b4a', marginBottom: 4 }}>🔴 {s.message}</div>
              ))}
            </>
          )}
        </div>

        {card.outBreakdown.mostCommon && (
          <p style={{ fontSize: 10, color: '#1c2b4a', marginTop: 8 }}>Most frequent out: <b>{OUT_LABELS[card.outBreakdown.mostCommon]}</b> ({card.outBreakdown.counts[card.outBreakdown.mostCommon]}/{card.outBreakdown.total})</p>
        )}

        {card.spray.dots.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <MiniSprayDiagram dots={card.spray.dots} />
          </div>
        )}
      </div>
    </>
  )
}

export default function PlayerCardModal({ name, onClose }) {
  const [flipped, setFlipped] = useState(false)
  const card = computePlayerCard(name)

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full p-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3 no-print">
          <h3 className="font-bold text-base">{name}'s Card</h3>
          <button onClick={onClose} aria-label="Close" className="btn btn-ghost btn-sm p-1"><X size={18} /></button>
        </div>

        <style>{`
          .pc-wrap { perspective: 1000px; width: 280px; margin: 0 auto; }
          .pc-inner { position: relative; width: 100%; height: 400px; transition: transform 0.6s; transform-style: preserve-3d; cursor: pointer; }
          .pc-wrap.flipped .pc-inner { transform: rotateY(180deg); }
          .pc-face { position: absolute; inset: 0; backface-visibility: hidden; border-radius: 10px; border: 5px solid #1c2b4a; background: #f3ead9; font-family: Georgia, serif; overflow: hidden; }
          .pc-back { transform: rotateY(180deg); }
        `}</style>

        <div className={`pc-wrap no-print ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(f => !f)}>
          <div className="pc-inner">
            <div className="pc-face"><CardFront card={card} /></div>
            <div className="pc-face pc-back"><CardBack card={card} /></div>
          </div>
        </div>
        <p className="text-center text-[10px] text-gray-400 mt-2 no-print">👆 tap the card to flip it</p>

        <button onClick={onClose} className="btn btn-primary btn-md w-full mt-4 no-print">Close</button>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- PlayerCardModal`
Expected: PASS — 3/3 tests.

- [ ] **Step 6: Wire the "View Card" entry point into `SeasonStatsPage.jsx`**

Modify `src/pages/SeasonStatsPage.jsx` line 3 (the `storage` import) — add `computePlayerCard` is NOT needed here (it's internal to `PlayerCardModal`), only the component import is needed. Add this new import line right after the existing `lucide-react` import (currently line 2):

```js
import PlayerCardModal from '../components/PlayerCardModal'
```

Modify line 220 (inside the `useState` declarations, right after `const [selectedPlayer, setSelectedPlayer] = useState(null)`) — add:

```js
  const [viewCardPlayer, setViewCardPlayer] = useState(null)
```

Modify the player-name table cell (currently lines 332-337):

```jsx
                      <td
                        className="py-1.5 px-1 font-medium whitespace-nowrap cursor-pointer text-blue-700 hover:underline"
                        onClick={() => setSelectedPlayer(p.name)}
                      >
                        {p.name}
                      </td>
```

Replace with:

```jsx
                      <td className="py-1.5 px-1 font-medium whitespace-nowrap">
                        <span
                          className="cursor-pointer text-blue-700 hover:underline"
                          onClick={() => setSelectedPlayer(p.name)}
                        >
                          {p.name}
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setViewCardPlayer(p.name) }}
                          className="ml-1 align-middle"
                          aria-label={`View ${p.name}'s card`}
                          title="View Card"
                        >
                          🃏
                        </button>
                      </td>
```

Modify the closing render block (currently `{selectedPlayer && <PlayerDetailModal name={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}` near the end of the file) — add the new modal render right after it:

```jsx
      {selectedPlayer && <PlayerDetailModal name={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
      {viewCardPlayer && <PlayerCardModal name={viewCardPlayer} onClose={() => setViewCardPlayer(null)} />}
      {showGuide && <StatGuideSheet onClose={() => setShowGuide(false)} />}
```

- [ ] **Step 7: Run the full suite to check for regressions**

Run: `npm test`
Expected: PASS — all existing tests still pass, including the existing `SeasonStatsPage.*.test.jsx` files (the `View Card` button is additive and doesn't change any existing element's text or role).

- [ ] **Step 8: Manual check in the dev server**

Run: `npm run dev`, open the app, go to Season Stats, click the 🃏 next to any player with 5+ AB, confirm the card renders, tap it to flip, confirm both faces show correct data, confirm Close works.

- [ ] **Step 9: Commit**

```bash
git add src/assets/cards src/components/PlayerCardModal.jsx src/pages/SeasonStatsPage.jsx src/tests/PlayerCardModal.test.jsx
git commit -m "feat: add PlayerCardModal flip-card UI with View Card entry point"
```

---

### Task 4: Download (stacked PNG) and Print

**Files:**
- Modify: `package.json` (new dependency)
- Modify: `src/components/PlayerCardModal.jsx`
- Test: `src/tests/PlayerCardModal.test.jsx` (extend)

**Interfaces:**
- Consumes: `CardFront`/`CardBack` components from Task 3 (reused, unchanged, rendered a second time in a flat off-screen capture container).
- Produces: a "Download" button that saves `<PlayerName>-card.png` (front stacked above back) and a "Print" button that reuses the existing `window.print()` + `.no-print` pattern already established in `ScoresheetPage.jsx`.

- [ ] **Step 1: Install the new dependency**

Run: `npm install html-to-image`
Expected: adds `html-to-image` to `package.json` `dependencies` (no other packages in this repo currently provide DOM-to-image capture).

- [ ] **Step 2: Write the failing test**

Modify `src/tests/PlayerCardModal.test.jsx`: change the existing top import line (added in Task 3)

```js
import { describe, it, expect, beforeEach } from 'vitest'
```

to add `vi`:

```js
import { describe, it, expect, beforeEach, vi } from 'vitest'
```

Then append to the end of the file:

```js
describe('PlayerCardModal — download and print', () => {
  it('renders Download and Print buttons', () => {
    seedQualifyingPlayer()
    render(<PlayerCardModal name="Amy" onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument()
  })

  it('calls window.print when Print is clicked', () => {
    seedQualifyingPlayer()
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    render(<PlayerCardModal name="Amy" onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /print/i }))
    expect(printSpy).toHaveBeenCalledOnce()
    printSpy.mockRestore()
  })
})
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npm test -- PlayerCardModal`
Expected: FAIL — no button with accessible name matching `/download/i` or `/print/i` exists yet.

- [ ] **Step 4: Add capture refs, download/print handlers, and buttons**

Modify `src/components/PlayerCardModal.jsx`: change the imports at the top of the file —

```js
import { useState } from 'react'
import { X } from 'lucide-react'
import { computePlayerCard } from '../storage'
```

becomes:

```js
import { useState, useRef } from 'react'
import { X, Download, Printer } from 'lucide-react'
import { toPng } from 'html-to-image'
import { computePlayerCard } from '../storage'
```

Add this helper function above `export default function PlayerCardModal`:

```js
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}
```

Replace the entire `export default function PlayerCardModal({ name, onClose }) { ... }` body with:

```jsx
export default function PlayerCardModal({ name, onClose }) {
  const [flipped, setFlipped] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const card = computePlayerCard(name)
  const frontRef = useRef(null)
  const backRef = useRef(null)

  async function handleDownload() {
    setDownloading(true)
    try {
      const [frontPng, backPng] = await Promise.all([
        toPng(frontRef.current, { pixelRatio: 2 }),
        toPng(backRef.current, { pixelRatio: 2 }),
      ])
      const [frontImg, backImg] = await Promise.all([loadImage(frontPng), loadImage(backPng)])
      const canvas = document.createElement('canvas')
      canvas.width = frontImg.width
      canvas.height = frontImg.height + backImg.height
      const ctx = canvas.getContext('2d')
      ctx.drawImage(frontImg, 0, 0)
      ctx.drawImage(backImg, 0, frontImg.height)
      const link = document.createElement('a')
      link.download = `${name.replace(/\s+/g, '-')}-card.png`
      link.href = canvas.toDataURL('image/png')
      link.click()
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl w-full p-4 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3 no-print">
          <h3 className="font-bold text-base">{name}'s Card</h3>
          <button onClick={onClose} aria-label="Close" className="btn btn-ghost btn-sm p-1"><X size={18} /></button>
        </div>

        <style>{`
          .pc-wrap { perspective: 1000px; width: 280px; margin: 0 auto; }
          .pc-inner { position: relative; width: 100%; height: 400px; transition: transform 0.6s; transform-style: preserve-3d; cursor: pointer; }
          .pc-wrap.flipped .pc-inner { transform: rotateY(180deg); }
          .pc-face { position: absolute; inset: 0; backface-visibility: hidden; border-radius: 10px; border: 5px solid #1c2b4a; background: #f3ead9; font-family: Georgia, serif; overflow: hidden; }
          .pc-back { transform: rotateY(180deg); }
          .pc-face-flat { width: 280px; height: 400px; border-radius: 10px; border: 5px solid #1c2b4a; background: #f3ead9; font-family: Georgia, serif; overflow: hidden; position: relative; }
        `}</style>

        <div className={`pc-wrap no-print ${flipped ? 'flipped' : ''}`} onClick={() => setFlipped(f => !f)}>
          <div className="pc-inner">
            <div className="pc-face"><CardFront card={card} /></div>
            <div className="pc-face pc-back"><CardBack card={card} /></div>
          </div>
        </div>
        <p className="text-center text-[10px] text-gray-400 mt-2 no-print">👆 tap the card to flip it</p>

        {/* Flat, non-flipped copies used for PNG capture (Download) and for printing
            (both faces stacked, shown only under @media print via .hidden/.print:block). */}
        <div className="hidden print:flex print:flex-col print:items-center print:gap-4">
          <div ref={frontRef} className="pc-face-flat"><CardFront card={card} /></div>
          <div ref={backRef} className="pc-face-flat"><CardBack card={card} /></div>
        </div>

        <div className="flex gap-2 mt-4 no-print">
          <button onClick={handleDownload} disabled={downloading} className="btn btn-ghost btn-md flex-1 gap-1">
            <Download size={16} /> {downloading ? 'Saving…' : 'Download'}
          </button>
          <button onClick={() => window.print()} className="btn btn-ghost btn-md flex-1 gap-1">
            <Printer size={16} /> Print
          </button>
        </div>
        <button onClick={onClose} className="btn btn-primary btn-md w-full mt-2 no-print">Close</button>
      </div>
    </div>
  )
}
```

Note the capture container (`ref={frontRef}` / `ref={backRef}`) uses `hidden print:flex` — invisible on screen (so it doesn't show twice), but present in the DOM at all times so `toPng()` can capture it on demand without waiting for a visibility change, and shown for the browser's native print dialog via the existing Tailwind `print:` variant (this repo already relies on the plain `.no-print` custom class for the opposite direction — hiding on print — so this task is the first to use Tailwind's built-in `print:` variant for the reverse; both approaches coexist safely since they target different elements).

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm test -- PlayerCardModal`
Expected: PASS — 5/5 tests.

- [ ] **Step 6: Run the full suite to check for regressions**

Run: `npm test`
Expected: PASS — all existing tests still pass.

- [ ] **Step 7: Run the build to confirm the new dependency resolves cleanly**

Run: `npm run build`
Expected: build succeeds with no errors (confirms `html-to-image` and the four new SVG asset imports all resolve correctly under Vite).

- [ ] **Step 8: Manual check in the dev server**

Run: `npm run dev`, open a player's card, click Download — confirm a single PNG downloads showing the front stacked above the back. Click Print — confirm the browser print preview shows both faces stacked (not the flip-animated view).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json src/components/PlayerCardModal.jsx src/tests/PlayerCardModal.test.jsx
git commit -m "feat: add Download (stacked PNG) and Print to PlayerCardModal"
```
