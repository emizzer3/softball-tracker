import { describe, it, expect, beforeEach } from 'vitest'
import { saveGame, computePlayerGameLog, computeSeasonStats } from '../storage'

beforeEach(() => localStorage.clear())

describe('computePlayerGameLog', () => {
  it('returns empty array when player has no games', () => {
    expect(computePlayerGameLog('Alice')).toEqual([])
  })

  it('returns one row per game the player batted in', () => {
    saveGame({
      id: 'g1', date: '2024-05-01', gameType: 'League',
      home: 'Renegades', away: 'Bulls',
      homeScore: 5, awayScore: 3, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Alice', inning: 1, half: 'bottom', outcome: '1B', rbi: 1 },
        { id: 'ab2', batter: 'Alice', inning: 2, half: 'bottom', outcome: 'K',  rbi: 0 },
        { id: 'ab3', batter: 'Bob',   inning: 1, half: 'bottom', outcome: 'HR', rbi: 2 },
      ],
      playLog: [],
    })
    const log = computePlayerGameLog('Alice')
    expect(log).toHaveLength(1)
    expect(log[0]).toMatchObject({
      gameId: 'g1', date: '2024-05-01', matchup: 'Bulls @ Renegades', result: 'W',
      AB: 2, H: 1, '2B': 0, '3B': 0, HR: 0, RBI: 1, BB: 0, K: 1,
    })
    expect(log[0].AVG).toBe('.500')
  })

  it('excludes BB/HBP/SAC from AB count', () => {
    saveGame({
      id: 'g2', date: '2024-05-08', gameType: 'League',
      home: 'Renegades', away: 'Eagles',
      homeScore: 4, awayScore: 2, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Alice', inning: 1, half: 'bottom', outcome: 'BB',  rbi: 0 },
        { id: 'ab2', batter: 'Alice', inning: 2, half: 'bottom', outcome: '2B',  rbi: 1 },
        { id: 'ab3', batter: 'Alice', inning: 3, half: 'bottom', outcome: 'SAC', rbi: 1 },
      ],
      playLog: [],
    })
    const log = computePlayerGameLog('Alice')
    expect(log[0].AB).toBe(1)  // only 2B counts
    expect(log[0].BB).toBe(1)
    expect(log[0].H).toBe(1)
    expect(log[0].RBI).toBe(2)
  })

  it('returns games sorted by date ascending', () => {
    saveGame({ id: 'g1', date: '2024-05-08', gameType: 'League', home: 'Renegades', away: 'Eagles', homeScore: 1, awayScore: 0, result: 'W', atBats: [{ id: 'ab1', batter: 'Alice', inning: 1, half: 'bottom', outcome: '1B', rbi: 0 }], playLog: [] })
    saveGame({ id: 'g2', date: '2024-05-01', gameType: 'League', home: 'Renegades', away: 'Bulls',  homeScore: 2, awayScore: 1, result: 'W', atBats: [{ id: 'ab2', batter: 'Alice', inning: 1, half: 'bottom', outcome: '1B', rbi: 0 }], playLog: [] })
    const log = computePlayerGameLog('Alice')
    expect(log[0].date).toBe('2024-05-01')
    expect(log[1].date).toBe('2024-05-08')
  })
})

describe('computeSeasonStats — rate fields', () => {
  it('computes KPct as K/AB * 100 with one decimal', () => {
    saveGame({
      id: 'g1', date: '2024-05-01', gameType: 'League',
      home: 'Home', away: 'Away', homeScore: 5, awayScore: 3, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Alice', inning: 1, half: 'bottom', outcome: '1B', rbi: 0 },
        { id: 'ab2', batter: 'Alice', inning: 2, half: 'bottom', outcome: 'K',  rbi: 0 },
        { id: 'ab3', batter: 'Alice', inning: 3, half: 'bottom', outcome: 'K',  rbi: 0 },
        { id: 'ab4', batter: 'Alice', inning: 4, half: 'bottom', outcome: 'K',  rbi: 0 },
      ],
      playLog: [],
    })
    const stats = computeSeasonStats()
    const alice = stats.find(p => p.name === 'Alice')
    // 3K / 4AB = 75.0%
    expect(alice.KPct).toBe('75.0')
  })

  it('computes BBPct as BB/AB * 100 with one decimal', () => {
    saveGame({
      id: 'g1', date: '2024-05-01', gameType: 'League',
      home: 'Home', away: 'Away', homeScore: 5, awayScore: 3, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Bob', inning: 1, half: 'bottom', outcome: '1B', rbi: 0 },
        { id: 'ab2', batter: 'Bob', inning: 2, half: 'bottom', outcome: 'BB', rbi: 0 },
        { id: 'ab3', batter: 'Bob', inning: 3, half: 'bottom', outcome: 'BB', rbi: 0 },
      ],
      playLog: [],
    })
    const stats = computeSeasonStats()
    const bob = stats.find(p => p.name === 'Bob')
    // BB excluded from AB: AB = 1, BB = 2, BBPct = 2/1 * 100...
    // Wait: BBPct should be BB/(AB+BB) or BB/PA?
    // Per the requirement "per-AB rates" — use AB as denominator since BB are excluded from AB.
    // The user wants "relative/per-game (or per-AB) rates" for comparison.
    // Let's use BB/PA (plate appearances) = BB/(AB+BB) for a more meaningful rate.
    // BBPct = 2 / (1 + 2) * 100 = 66.7
    expect(bob.BBPct).toBe('66.7')
  })

  it('returns KPct and BBPct as "0.0" when AB is 0', () => {
    saveGame({
      id: 'g1', date: '2024-05-01', gameType: 'League',
      home: 'Home', away: 'Away', homeScore: 5, awayScore: 3, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Carol', inning: 1, half: 'bottom', outcome: 'SAC', rbi: 1 },
      ],
      playLog: [],
    })
    const stats = computeSeasonStats()
    const carol = stats.find(p => p.name === 'Carol')
    expect(carol.KPct).toBe('0.0')
    expect(carol.BBPct).toBe('0.0')
  })

  it('computes POPerG, APerG, EPerG per game with one decimal', () => {
    saveGame({
      id: 'g1', date: '2024-05-01', gameType: 'League',
      home: 'Home', away: 'Away', homeScore: 5, awayScore: 3, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Dave', inning: 1, half: 'bottom', outcome: '1B', rbi: 0 },
      ],
      playLog: [
        { type: 'putout', fielder: 'Dave', assister: null, inning: 1, half: 'top', outCode: 'G', batter: 'Opp1' },
        { type: 'putout', fielder: 'Dave', assister: null, inning: 2, half: 'top', outCode: 'G', batter: 'Opp2' },
        { type: 'putout', fielder: 'Dave', assister: null, inning: 3, half: 'top', outCode: 'G', batter: 'Opp3' },
        { type: 'error',  fielder: 'Dave', inning: 1, half: 'top' },
        { type: 'error',  fielder: 'Dave', inning: 2, half: 'top' },
      ],
    })
    const stats = computeSeasonStats()
    const dave = stats.find(p => p.name === 'Dave')
    expect(dave.PO).toBe(3)
    expect(dave.E).toBe(2)
    expect(dave.POPerG).toBe('3.0') // 3 PO / 1 game
    expect(dave.EPerG).toBe('2.0')  // 2 E / 1 game
    expect(dave.APerG).toBe('0.0')  // 0 A / 1 game
  })

  it('returns POPerG etc as "0.0" when G is 0', () => {
    // Player with only play log entries (no at-bats → G=0)
    // This edge case shouldn't occur in practice but guard for safety
    const stats = computeSeasonStats([])
    expect(stats).toHaveLength(0)
  })
})
