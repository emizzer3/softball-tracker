import { describe, it, expect, beforeEach } from 'vitest'
import { saveGame, computePlayerGameLog } from '../storage'

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
