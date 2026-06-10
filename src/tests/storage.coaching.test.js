import { describe, it, expect, beforeEach } from 'vitest'
import { saveGame, saveRoster, computeRunsPerGame, computeGroupStats } from '../storage'

beforeEach(() => localStorage.clear())

describe('computeRunsPerGame', () => {
  it('returns empty array with no games', () => {
    expect(computeRunsPerGame()).toEqual([])
  })

  it('uses homeScore as ourRuns when weAreHome', () => {
    saveGame({ id: 'g1', date: '2024-05-01', home: 'Renegades', away: 'Bulls',
      homeScore: 7, awayScore: 3, result: 'W', setup: { weAreHome: true },
      atBats: [], playLog: [] })
    const [row] = computeRunsPerGame()
    expect(row.ourRuns).toBe(7)
    expect(row.theirRuns).toBe(3)
    expect(row.opponent).toBe('Bulls')
  })

  it('uses awayScore as ourRuns when not weAreHome', () => {
    saveGame({ id: 'g1', date: '2024-05-01', home: 'Bulls', away: 'Renegades',
      homeScore: 4, awayScore: 6, result: 'W', setup: { weAreHome: false },
      atBats: [], playLog: [] })
    const [row] = computeRunsPerGame()
    expect(row.ourRuns).toBe(6)
    expect(row.opponent).toBe('Bulls')
  })

  it('sorts by date ascending', () => {
    saveGame({ id: 'g2', date: '2024-05-08', home: 'Renegades', away: 'Eagles', homeScore: 5, awayScore: 2, result: 'W', setup: { weAreHome: true }, atBats: [], playLog: [] })
    saveGame({ id: 'g1', date: '2024-05-01', home: 'Renegades', away: 'Bulls',  homeScore: 3, awayScore: 1, result: 'W', setup: { weAreHome: true }, atBats: [], playLog: [] })
    const rows = computeRunsPerGame()
    expect(rows[0].date).toBe('2024-05-01')
    expect(rows[1].date).toBe('2024-05-08')
  })
})

describe('computeGroupStats', () => {
  it('returns two groups BBH and SBH', () => {
    saveRoster([
      { id: 'p1', name: 'Alice', type: 'BBH', active: true },
      { id: 'p2', name: 'Bob',   type: 'SBH', active: true },
    ])
    saveGame({ id: 'g1', date: '2024-05-01', home: 'Renegades', away: 'Bulls',
      homeScore: 5, awayScore: 2, result: 'W',
      atBats: [
        { id: 'ab1', batter: 'Alice', inning: 1, half: 'bottom', outcome: '1B', rbi: 1 },
        { id: 'ab2', batter: 'Bob',   inning: 1, half: 'bottom', outcome: 'HR', rbi: 2 },
      ],
      playLog: [] })
    const groups = computeGroupStats()
    const bbh = groups.find(g => g.type === 'BBH')
    const sbh = groups.find(g => g.type === 'SBH')
    expect(bbh.AB).toBe(1)
    expect(bbh.H).toBe(1)
    expect(sbh.HR).toBe(1)
    expect(sbh.RBI).toBe(2)
  })

  it('returns .000 AVG for group with no at-bats', () => {
    saveRoster([{ id: 'p1', name: 'Alice', type: 'BBH', active: true }])
    const groups = computeGroupStats()
    const bbh = groups.find(g => g.type === 'BBH')
    expect(bbh.AVG).toBe('.000')
  })
})
