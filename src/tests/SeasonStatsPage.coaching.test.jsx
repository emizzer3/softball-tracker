import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import SeasonStatsPage from '../pages/SeasonStatsPage'
import * as storage from '../storage'

beforeEach(() => localStorage.clear())

const baseStats = [
  { name: 'Alice', G: 5, AB: 15, H: 6, '2B': 1, '3B': 0, HR: 0, R: 3, RBI: 3, BB: 1, K: 2, PO: 0, A: 0, E: 0, AVG: '.400', OBP: '.438', SLG: '.467', W: 3, L: 2, D: 0 },
]

function setupMocks(overrides = {}) {
  vi.spyOn(storage, 'computeSeasonStats').mockReturnValue(overrides.stats ?? baseStats)
  vi.spyOn(storage, 'getSeasonRecord').mockReturnValue({ W: 3, L: 2, D: 0 })
  vi.spyOn(storage, 'getGames').mockReturnValue([])
  vi.spyOn(storage, 'computePlayerGameLog').mockReturnValue(overrides.log ?? [])
  vi.spyOn(storage, 'computeRunsPerGame').mockReturnValue(overrides.runs ?? [])
  vi.spyOn(storage, 'computeGroupStats').mockReturnValue(overrides.groups ?? [
    { type: 'BBH', players: 0, AB: 0, H: 0, HR: 0, RBI: 0, BB: 0, K: 0, AVG: '.000', OBP: '.000' },
    { type: 'SBH', players: 0, AB: 0, H: 0, HR: 0, RBI: 0, BB: 0, K: 0, AVG: '.000', OBP: '.000' },
  ])
}

describe('hot/cold streak badge', () => {
  it('shows 🔥 for a player on a hot streak (last3 avg >= season avg + .080)', () => {
    setupMocks({
      log: [
        { gameId: 'g1', date: '2024-04-01', AB: 3, H: 0, '2B': 0, '3B': 0, HR: 0, RBI: 0, BB: 0, K: 1, AVG: '.000' },
        { gameId: 'g2', date: '2024-04-08', AB: 3, H: 0, '2B': 0, '3B': 0, HR: 0, RBI: 0, BB: 0, K: 1, AVG: '.000' },
        { gameId: 'g3', date: '2024-04-15', AB: 3, H: 2, '2B': 0, '3B': 0, HR: 0, RBI: 1, BB: 0, K: 0, AVG: '.667' },
        { gameId: 'g4', date: '2024-04-22', AB: 3, H: 2, '2B': 0, '3B': 0, HR: 0, RBI: 1, BB: 0, K: 0, AVG: '.667' },
        { gameId: 'g5', date: '2024-04-29', AB: 3, H: 2, '2B': 1, '3B': 0, HR: 0, RBI: 1, BB: 1, K: 0, AVG: '.667' },
      ],
    })
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    // Alice season AVG .400, last 3 games: 6/9 = .667 — hot
    expect(screen.getByText('🔥')).toBeInTheDocument()
  })

  it('shows 🥶 for a player in a cold streak (last3 avg <= season avg - .080)', () => {
    setupMocks({
      log: [
        { gameId: 'g1', date: '2024-04-01', AB: 3, H: 3, '2B': 0, '3B': 0, HR: 0, RBI: 2, BB: 0, K: 0, AVG: '1.000' },
        { gameId: 'g2', date: '2024-04-08', AB: 3, H: 3, '2B': 0, '3B': 0, HR: 0, RBI: 2, BB: 0, K: 0, AVG: '1.000' },
        { gameId: 'g3', date: '2024-04-15', AB: 3, H: 0, '2B': 0, '3B': 0, HR: 0, RBI: 0, BB: 0, K: 2, AVG: '.000' },
        { gameId: 'g4', date: '2024-04-22', AB: 3, H: 0, '2B': 0, '3B': 0, HR: 0, RBI: 0, BB: 0, K: 2, AVG: '.000' },
        { gameId: 'g5', date: '2024-04-29', AB: 3, H: 0, '2B': 0, '3B': 0, HR: 0, RBI: 0, BB: 0, K: 2, AVG: '.000' },
      ],
    })
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    // Alice season AVG .400, last 3 games: 0/9 = .000 — cold
    expect(screen.getByText('🥶')).toBeInTheDocument()
  })

  it('shows no badge when fewer than 3 games played', () => {
    setupMocks({
      log: [
        { gameId: 'g1', date: '2024-04-01', AB: 3, H: 3, '2B': 0, '3B': 0, HR: 0, RBI: 2, BB: 0, K: 0, AVG: '1.000' },
        { gameId: 'g2', date: '2024-04-08', AB: 3, H: 3, '2B': 0, '3B': 0, HR: 0, RBI: 2, BB: 0, K: 0, AVG: '1.000' },
      ],
    })
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    expect(screen.queryByText('🔥')).not.toBeInTheDocument()
    expect(screen.queryByText('🥶')).not.toBeInTheDocument()
  })
})

describe('runs per game chart', () => {
  it('shows runs chart in Trends tab when 2+ games exist', () => {
    setupMocks({
      runs: [
        { gameId: 'g1', date: '2024-05-01', ourRuns: 7, theirRuns: 3, result: 'W', opponent: 'Bulls' },
        { gameId: 'g2', date: '2024-05-08', ourRuns: 4, theirRuns: 6, result: 'L', opponent: 'Eagles' },
      ],
    })
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    fireEvent.click(screen.getByText('📈 Trends'))
    expect(screen.getByText('Runs Scored vs Allowed')).toBeInTheDocument()
  })

  it('hides chart when fewer than 2 games', () => {
    setupMocks({ runs: [] })
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    fireEvent.click(screen.getByText('📈 Trends'))
    expect(screen.queryByText('Runs Scored vs Allowed')).not.toBeInTheDocument()
  })
})

describe('BBH vs SBH comparison', () => {
  it('shows BBH vs SBH table when players exist', () => {
    setupMocks({
      groups: [
        { type: 'BBH', players: 3, AB: 20, H: 8, HR: 1, RBI: 5, BB: 2, K: 3, AVG: '.400', OBP: '.455' },
        { type: 'SBH', players: 4, AB: 25, H: 7, HR: 0, RBI: 3, BB: 3, K: 5, AVG: '.280', OBP: '.357' },
      ],
    })
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    expect(screen.getByText('BBH vs SBH')).toBeInTheDocument()
  })

  it('hides BBH vs SBH when no players have stats', () => {
    setupMocks()  // groups with 0 players
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    expect(screen.queryByText('BBH vs SBH')).not.toBeInTheDocument()
  })
})
