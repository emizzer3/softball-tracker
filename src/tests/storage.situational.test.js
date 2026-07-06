import { describe, it, expect, beforeEach } from 'vitest'
import { saveGame, computeSituationalStats } from '../storage'

beforeEach(() => localStorage.clear())

describe('computeSituationalStats — RISP', () => {
  it('counts an at-bat as RISP when 2nd or 3rd was occupied before the play', () => {
    saveGame({
      id: 'g1', date: '2024-05-01', gameType: 'League',
      home: 'Renegades', away: 'Bulls', homeScore: 2, awayScore: 0, result: 'W',
      atBats: [
        // bases empty before Alice — not RISP
        { id: 'ab1', batter: 'Alice', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [true, false, false] },
        // 1st occupied only before Bob — not RISP. Bob's own after-play bases (2nd+3rd
        // occupied) is what makes Carol's at-bat RISP-eligible next, since `bases` always
        // records post-play state.
        { id: 'ab2', batter: 'Bob', inning: 1, half: 'bottom', outcome: 'G', rbi: 0, bases: [false, true, true] },
        // 2nd+3rd occupied before Carol — RISP, out (no hit)
        { id: 'ab3', batter: 'Carol', inning: 1, half: 'bottom', outcome: 'K', rbi: 0, bases: [false, true, true] },
        // 2nd+3rd still occupied before Dave — RISP, hit
        { id: 'ab4', batter: 'Dave', inning: 1, half: 'bottom', outcome: '1B', rbi: 1, bases: [true, true, false] },
      ],
      playLog: [],
    })
    const { team, players } = computeSituationalStats()
    expect(team.rispAB).toBe(2)
    expect(team.rispH).toBe(1)
    expect(team.rispAvg).toBe('.500')
    expect(players).toEqual([
      { name: 'Dave', rispAB: 1, rispH: 1, rispAvg: '1.000' },
      { name: 'Carol', rispAB: 1, rispH: 0, rispAvg: '.000' },
    ])
  })

  it('excludes opponent at-bats from RISP', () => {
    saveGame({
      id: 'g2', date: '2024-05-08', gameType: 'League',
      home: 'Renegades', away: 'Eagles', homeScore: 1, awayScore: 0, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Eagles', inning: 1, half: 'top', outcome: '1B', rbi: 0, bases: [true, false, false], isOpponent: true },
        { id: 'ab2', batter: 'Eagles', inning: 1, half: 'top', outcome: '1B', rbi: 0, bases: [false, true, true], isOpponent: true },
      ],
      playLog: [],
    })
    const { team } = computeSituationalStats()
    expect(team.rispAB).toBe(0)
  })

  it('resets bases to empty across a half-inning boundary', () => {
    saveGame({
      id: 'g3', date: '2024-05-15', gameType: 'League',
      home: 'Renegades', away: 'Bulls', homeScore: 1, awayScore: 0, result: 'W',
      atBats: [
        // bottom of inning 1 ends with runners on — would look like RISP-before for the next at-bat if not reset
        { id: 'ab1', batter: 'Alice', inning: 1, half: 'bottom', outcome: '2B', rbi: 0, bases: [false, true, true] },
        // bottom of inning 2 — new half-inning, bases must be treated as empty even though ab1.bases had runners
        { id: 'ab2', batter: 'Bob', inning: 2, half: 'bottom', outcome: '1B', rbi: 0, bases: [true, false, false] },
      ],
      playLog: [],
    })
    const { team } = computeSituationalStats()
    expect(team.rispAB).toBe(0) // Bob's at-bat is not RISP — bases reset between innings
  })

  it('excludes BB/HBP/SAC from RISP AB count', () => {
    saveGame({
      id: 'g4', date: '2024-05-22', gameType: 'League',
      home: 'Renegades', away: 'Bulls', homeScore: 1, awayScore: 0, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Alice', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [false, true, false] },
        { id: 'ab2', batter: 'Bob', inning: 1, half: 'bottom', outcome: 'BB', rbi: 0, bases: [true, true, false] },
      ],
      playLog: [],
    })
    const { team } = computeSituationalStats()
    expect(team.rispAB).toBe(0) // Alice: bases empty before her. Bob: BB excluded from AB.
  })
})

describe('computeSituationalStats — LOB', () => {
  it('counts runners on base at the last at-bat of each of our half-innings', () => {
    saveGame({
      id: 'g5', date: '2024-06-01', gameType: 'League',
      home: 'Renegades', away: 'Bulls', homeScore: 3, awayScore: 0, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Alice', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [true, false, false] },
        { id: 'ab2', batter: 'Bob', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [true, true, false] },
        { id: 'ab3', batter: 'Carol', inning: 1, half: 'bottom', outcome: 'K', rbi: 0, bases: [true, true, false] },
        // inning 2: nobody left on
        { id: 'ab4', batter: 'Dave', inning: 2, half: 'bottom', outcome: 'K', rbi: 0, bases: [false, false, false] },
      ],
      playLog: [],
    })
    const { team } = computeSituationalStats()
    expect(team.lobTotal).toBe(2) // 1st + 2nd left on base at end of inning 1
    expect(team.lobPerGame).toBe(2)
  })
})

describe('computeSituationalStats — GIDP', () => {
  it('counts a double play once from the tagged playLog entry', () => {
    saveGame({
      id: 'g6', date: '2024-06-08', gameType: 'League',
      home: 'Renegades', away: 'Bulls', homeScore: 1, awayScore: 0, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Alice', inning: 1, half: 'bottom', outcome: 'G', rbi: 0, bases: [false, false, false] },
      ],
      playLog: [
        { type: 'putout', fielder: 'SS', assister: '2B', inning: 1, half: 'bottom', outCode: 'G', batter: 'Alice', doublePlay: true },
        { type: 'putout', fielder: '1B', assister: null, inning: 1, half: 'bottom', outCode: 'G', batter: null },
      ],
    })
    const { team } = computeSituationalStats()
    expect(team.gidpCount).toBe(1)
  })

  it('counts a triple play the same way', () => {
    saveGame({
      id: 'g7', date: '2024-06-15', gameType: 'League',
      home: 'Renegades', away: 'Bulls', homeScore: 1, awayScore: 0, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Bob', inning: 1, half: 'bottom', outcome: 'G', rbi: 0, bases: [false, false, false] },
      ],
      playLog: [
        { type: 'putout', fielder: 'SS', assister: '2B', inning: 1, half: 'bottom', outCode: 'G', batter: 'Bob', triplePlay: true },
        { type: 'putout', fielder: '1B', assister: null, inning: 1, half: 'bottom', outCode: 'G', batter: null },
        { type: 'putout', fielder: '3B', assister: null, inning: 1, half: 'bottom', outCode: 'G', batter: null },
      ],
    })
    const { team } = computeSituationalStats()
    expect(team.gidpCount).toBe(1)
  })
})

describe('computeSituationalStats — empty state', () => {
  it('returns zeroed team stats and empty players array with no games', () => {
    const { team, players } = computeSituationalStats()
    expect(team).toEqual({
      rispAB: 0, rispH: 0, rispAvg: '.000', overallAvg: '.000',
      lobTotal: 0, lobPerGame: 0, gidpCount: 0,
    })
    expect(players).toEqual([])
  })
})
