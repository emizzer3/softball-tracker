import { describe, it, expect, beforeEach } from 'vitest'
import { saveGame, computeOptimalBattingOrder } from '../storage'

beforeEach(() => localStorage.clear())

// Generates `hits` batter at-bats with outcome '1B' followed by `outs` at-bats
// with outcome 'K', all for the same game/inning — enough for computeSeasonStats
// to derive AB/H/AVG/OBP/SLG. No walks, so AVG === OBP === SLG for these
// fixtures, which keeps the expected blended scores easy to hand-calculate.
function makeAtBats(batter, hits, outs) {
  const atBats = []
  for (let i = 0; i < hits; i++) {
    atBats.push({ id: `${batter}-h${i}`, batter, inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [false, false, false] })
  }
  for (let i = 0; i < outs; i++) {
    atBats.push({ id: `${batter}-o${i}`, batter, inning: 1, half: 'bottom', outcome: 'K', rbi: 0, bases: [false, false, false] })
  }
  return atBats
}

function seedGame(id, ...playerHitOutPairs) {
  const atBats = playerHitOutPairs.flatMap(([name, hits, outs]) => makeAtBats(name, hits, outs))
  saveGame({
    id, date: '2024-05-01', gameType: 'League',
    home: 'Renegades', away: 'Bulls', homeScore: 1, awayScore: 0, result: 'W',
    atBats, playLog: [],
  })
}

// Same alternation check GameSetupPage's validateOrder performs, including
// the wraparound from last batter back to first.
function alternatesFully(order, typeByName) {
  for (let i = 0; i < order.length; i++) {
    const curr = typeByName[order[i]]
    const next = typeByName[order[(i + 1) % order.length]]
    if (curr === next) return false
  }
  return true
}

describe('computeOptimalBattingOrder — ranking within a stream', () => {
  it('ranks qualifying players by blended score, weakest last, all-BBH stream', () => {
    // AB=10 each (qualifies, threshold is AB >= 5). No walks, so AVG=OBP=SLG=blended score.
    seedGame('g1',
      ['Amy', 8, 2],   // AVG/OBP/SLG = .800
      ['Beth', 6, 4],  // .600
      ['Cora', 4, 6],  // .400
      ['Dana', 2, 8],  // .200
    )
    const players = [
      { name: 'Amy', type: 'BBH' }, { name: 'Beth', type: 'BBH' },
      { name: 'Cora', type: 'BBH' }, { name: 'Dana', type: 'BBH' },
    ]
    const order = computeOptimalBattingOrder(players)
    expect(order).toEqual(['Amy', 'Beth', 'Cora', 'Dana'])
  })

  it('picks leadoff by OBP even when another player has a higher blended score', () => {
    // Angela: few AB, many walks → high OBP, low power. AB=5 (qualifies), H=1, BB=10.
    // AVG = 1/5 = .200, OBP = (1+10)/(5+10) = .733, SLG = 1/5 = .200 → blended = .378
    saveGame({
      id: 'g2', date: '2024-05-01', gameType: 'League',
      home: 'Renegades', away: 'Bulls', homeScore: 1, awayScore: 0, result: 'W',
      atBats: [
        { id: 'a-h0', batter: 'Angela', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [false, false, false] },
        ...Array.from({ length: 4 }, (_, i) => ({ id: `a-o${i}`, batter: 'Angela', inning: 1, half: 'bottom', outcome: 'K', rbi: 0, bases: [false, false, false] })),
        ...Array.from({ length: 10 }, (_, i) => ({ id: `a-bb${i}`, batter: 'Angela', inning: 1, half: 'bottom', outcome: 'BB', rbi: 0, bases: [false, false, false] })),
        // Brenda: AB=10, H=5 (3 singles + 2 doubles), no walks.
        // AVG = 5/10 = .500, OBP = 5/10 = .500, SLG = (3 + 2*2)/10 = .700 → blended = .567
        { id: 'b-2b0', batter: 'Brenda', inning: 1, half: 'bottom', outcome: '2B', rbi: 0, bases: [false, false, false] },
        { id: 'b-2b1', batter: 'Brenda', inning: 1, half: 'bottom', outcome: '2B', rbi: 0, bases: [false, false, false] },
        { id: 'b-1b0', batter: 'Brenda', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [false, false, false] },
        { id: 'b-1b1', batter: 'Brenda', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [false, false, false] },
        { id: 'b-1b2', batter: 'Brenda', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [false, false, false] },
        ...Array.from({ length: 5 }, (_, i) => ({ id: `b-o${i}`, batter: 'Brenda', inning: 1, half: 'bottom', outcome: 'K', rbi: 0, bases: [false, false, false] })),
      ],
      playLog: [],
    })
    const players = [{ name: 'Angela', type: 'BBH' }, { name: 'Brenda', type: 'BBH' }]
    const order = computeOptimalBattingOrder(players)
    // Angela has the lower blended score (.378 vs .567) but the higher OBP (.733 vs .500) —
    // she must still be picked leadoff.
    expect(order).toEqual(['Angela', 'Brenda'])
  })
})

describe('computeOptimalBattingOrder — cold-start substitution', () => {
  it('gives a non-qualifying player the league-average score instead of their own', () => {
    // Vet1: AB=10, H=8 → blended .800 (qualifies)
    // Vet2: AB=10, H=2 → blended .200 (qualifies)
    // Rookie: AB=1, H=1 → would be 1.000 on their own numbers, but AB < 5 so they
    // get the average of the qualifying players instead: (.800 + .200) / 2 = .500
    seedGame('g3', ['Vet1', 8, 2], ['Vet2', 2, 8], ['Rookie', 1, 0])
    const players = [
      { name: 'Vet1', type: 'BBH' }, { name: 'Vet2', type: 'BBH' }, { name: 'Rookie', type: 'BBH' },
    ]
    const order = computeOptimalBattingOrder(players)
    // Vet1 leads off (highest OBP, .800, no walks so OBP=AVG here).
    // Vet2 is last (own blended .200 is lower than Rookie's substituted .500).
    // Rookie lands in the middle — not first (their real 1.000 would have topped
    // everyone) and not last (their real 1-for-1 sample is too small to trust).
    expect(order).toEqual(['Vet1', 'Rookie', 'Vet2'])
  })

  it('falls back to a fully deterministic pass-through order when nobody qualifies', () => {
    // No saveGame calls at all — every player has zero season history.
    const players = [
      { name: 'B1', type: 'BBH' }, { name: 'B2', type: 'BBH' },
      { name: 'S1', type: 'SBH' }, { name: 'S2', type: 'SBH' },
    ]
    const order = computeOptimalBattingOrder(players)
    expect(order).toEqual(['B1', 'S1', 'B2', 'S2'])
  })
})

describe('computeOptimalBattingOrder — stream edge cases', () => {
  it('handles a single-player BBH stream with no SBH players at all', () => {
    const order = computeOptimalBattingOrder([{ name: 'Solo', type: 'BBH' }])
    expect(order).toEqual(['Solo'])
  })

  it('handles a single-player SBH stream with no BBH players at all', () => {
    const order = computeOptimalBattingOrder([{ name: 'Solo', type: 'SBH' }])
    expect(order).toEqual(['Solo'])
  })
})

describe('computeOptimalBattingOrder — alternation', () => {
  it('strictly alternates BBH/SBH, including the wraparound, for equal-length streams', () => {
    seedGame('g4', ['Amy', 8, 2], ['Beth', 6, 4], ['Cora', 4, 6])
    seedGame('g5', ['Xena', 7, 3], ['Yara', 5, 5], ['Zoe', 3, 7])
    const players = [
      { name: 'Amy', type: 'BBH' }, { name: 'Beth', type: 'BBH' }, { name: 'Cora', type: 'BBH' },
      { name: 'Xena', type: 'SBH' }, { name: 'Yara', type: 'SBH' }, { name: 'Zoe', type: 'SBH' },
    ]
    const typeByName = Object.fromEntries(players.map(p => [p.name, p.type]))
    const order = computeOptimalBattingOrder(players)
    expect(order).toHaveLength(6)
    expect(alternatesFully(order, typeByName)).toBe(true)
  })
})
