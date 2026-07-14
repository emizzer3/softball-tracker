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
    // makeAtBats(batter, hits, outs, walks) sets AB = hits + outs (every "out" here
    // is coded as outcome 'K') and BB = walks separately — so to land on AB=10 for
    // each player, `outs` must be (10 - hits), not an arbitrary K count.
    // PlayerX: hits=6, outs=4, walks=0 -> AB=10, H=6, K=4, BB=0 -> AVG=.600 OBP=.600 SLG=.600 KPct=40.0 BBPct=0.0
    // Mate1 & Mate2 (identical): hits=3, outs=7, walks=4 -> AB=10, H=3, K=7, BB=4 -> AVG=.300 OBP=7/14=.500 SLG=.300 KPct=70.0 BBPct=4/14*100=28.6
    // Baseline (raw sums across all 3, PlayerX included, per spec Step 3):
    //   AB=30 H=12 BB=8 K=18 TB=12 -> AVG=.400 OBP=20/38=.5263 SLG=.400 KPct=18/30*100=60.0 BBPct=8/38*100=21.05
    // Severities: AVG=(.6-.4)/.05=4.0  OBP=(.6-.5263)/.05=1.47  SLG=4.0  KPct=((40-60)*-1)/5=4.0  BBPct=(0-21.05)/5=-4.21
    // These "4.0"s aren't an exact tie in IEEE-754: AVG/SLG both go through the identical
    // subtraction 0.6 - 12/30, which evaluates to 3.999999999999999 after the /0.05 divide
    // (the classic 0.6-0.4 float rounding), while KPct's severity is built from clean integer
    // division (20/5) and lands on exactly 4. So KPct (4) sorts strictly ahead of AVG/SLG
    // (3.999999999999999) — actual desc order is KPct, AVG, SLG (AVG before SLG since their
    // severities ARE bit-identical, tie-broken by iteration order) — then OBP(1.47) last.
    // -> capped top 3 display: KPct, AVG, SLG (OBP loses the cap slot to KPct despite being pose-eligible)
    // -> pose picked from the FULL uncapped set restricted to {AVG,OBP,SLG,BBPct} (KPct is not
    //    pose-eligible so it's filtered out here): AVG beats SLG (tied, AVG first by iteration
    //    order) and OBP(1.47) -> pose 'contact', headline AVG
    seedGame('g1', ROSTER,
      ['PlayerX', 6, 4, 0],
      ['Mate1', 3, 7, 4],
      ['Mate2', 3, 7, 4],
    )
    const card = computePlayerCard('PlayerX')

    expect(card.qualifies).toBe(true)
    expect(card.AVG).toBe('.600')
    expect(card.strengths.map(s => s.stat)).toEqual(['KPct', 'AVG', 'SLG'])
    expect(card.needsWork.map(s => s.stat)).toEqual(['BBPct'])
    expect(card.pose).toBe('contact')
    expect(card.headlineStat).toEqual({ key: 'AVG', value: '.600' })
    expect(card.neutral).toBe(false)
  })

  it('picks the patient pose from BBPct even though OBP is the headline stat shown', () => {
    // PlayerC: hits=1, outs=4, walks=10 -> AB=5 (qualifies), H=1, BB=10, K=4 -> AVG=.200 OBP=11/15=.733 SLG=.200 KPct=80.0 BBPct=10/15*100=66.7
    // Teammate: hits=3, outs=7 (not 3 — AB must be 10, and AB = hits + outs for this helper), walks=0
    //   -> AB=10, H=3, BB=0, K=7 -> AVG=.300 OBP=.300 SLG=.300 KPct=70.0 BBPct=0.0
    // Baseline: AB=15 H=4 BB=10 K=11 TB=4 -> AVG=4/15=.2667 OBP=14/25=.560 SLG=.2667 KPct=11/15*100=73.33 BBPct=10/25*100=40.0
    // OBP severity=(.733-.560)/.05=3.47 (strength) | BBPct severity=(66.7-40.0)/5=5.34 (strength, higher than OBP)
    // -> pose-eligible top is BBPct, which maps to 'patient', but headlineStat is always OBP for that pose.
    // (KPct also moves — player 80.0 vs baseline 73.33, severity -1.33, needsWork — but this test doesn't assert
    // on needsWork, only pose and headlineStat, so that shift doesn't affect any assertion below.)
    saveGame({
      id: 'g2', date: '2024-05-01', gameType: 'League',
      home: 'Renegades', away: 'Bulls', homeScore: 1, awayScore: 0, result: 'W',
      roster: [
        { id: '1', name: 'PlayerC', type: 'SBH', active: true },
        { id: '2', name: 'Teammate', type: 'SBH', active: true },
      ],
      atBats: [
        ...makeAtBats('PlayerC', 1, 4, 10),
        ...makeAtBats('Teammate', 3, 7, 0),
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
