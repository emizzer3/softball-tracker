import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import SeasonStatsPage from '../pages/SeasonStatsPage'
import * as storage from '../storage'

beforeEach(() => localStorage.clear())

// The tab bar (including the Team tab) only renders when computeSeasonStats()
// returns at least one player — mirrors the baseStats pattern in
// SeasonStatsPage.coaching.test.jsx.
const baseStats = [
  { name: 'Alice', G: 5, AB: 15, H: 6, '2B': 1, '3B': 0, HR: 0, R: 3, RBI: 3, BB: 1, K: 2, PO: 0, A: 0, E: 0, AVG: '.400', OBP: '.438', SLG: '.467', W: 3, L: 2, D: 0 },
]

function setupMocks(overrides = {}) {
  vi.spyOn(storage, 'computeSeasonStats').mockReturnValue(overrides.stats ?? baseStats)
  vi.spyOn(storage, 'getSeasonRecord').mockReturnValue({ W: 1, L: 0, D: 0 })
  vi.spyOn(storage, 'getGames').mockReturnValue([])
  vi.spyOn(storage, 'computePlayerGameLog').mockReturnValue([])
  vi.spyOn(storage, 'computeRunsPerGame').mockReturnValue(overrides.runs ?? [])
  vi.spyOn(storage, 'computeGroupStats').mockReturnValue([
    { type: 'BBH', players: 0, AB: 0, H: 0, HR: 0, RBI: 0, BB: 0, K: 0, AVG: '.000', OBP: '.000' },
    { type: 'SBH', players: 0, AB: 0, H: 0, HR: 0, RBI: 0, BB: 0, K: 0, AVG: '.000', OBP: '.000' },
  ])
  vi.spyOn(storage, 'computeSituationalStats').mockReturnValue(overrides.situational ?? {
    team: { rispAB: 0, rispH: 0, rispAvg: '.000', overallAvg: '.000', lobTotal: 0, lobPerGame: 0, gidpCount: 0 },
    players: [],
  })
}

describe('Team tab — situational hitting', () => {
  it('shows RISP AVG, LOB/game, and GIDP stat blocks', () => {
    setupMocks({
      situational: {
        team: { rispAB: 10, rispH: 4, rispAvg: '.400', overallAvg: '.275', lobTotal: 9, lobPerGame: 4.5, gidpCount: 3 },
        players: [],
      },
    })
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    fireEvent.click(screen.getByText('🎯 Team'))
    expect(screen.getByText('.400')).toBeInTheDocument()
    expect(screen.getByText('4.5')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('shows the clutch hitting table with per-player RISP rows', () => {
    setupMocks({
      situational: {
        team: { rispAB: 5, rispH: 2, rispAvg: '.400', overallAvg: '.300', lobTotal: 3, lobPerGame: 3, gidpCount: 1 },
        players: [
          { name: 'Alice', rispAB: 3, rispH: 2, rispAvg: '.667' },
          { name: 'Bob',   rispAB: 2, rispH: 0, rispAvg: '.000' },
        ],
      },
    })
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    fireEvent.click(screen.getByText('🎯 Team'))
    expect(screen.getByText('Clutch Hitting (RISP)')).toBeInTheDocument()
    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('Alice')
    expect(rows[2]).toHaveTextContent('Bob')
  })

  it('shows an empty state when no RISP at-bats have been recorded yet', () => {
    setupMocks()
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    fireEvent.click(screen.getByText('🎯 Team'))
    expect(screen.getByText('No runners in scoring position yet this season')).toBeInTheDocument()
  })

  it('shows the LOB caveat caption', () => {
    setupMocks()
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    fireEvent.click(screen.getByText('🎯 Team'))
    expect(screen.getByText(/caught-stealing\/pickoff/)).toBeInTheDocument()
  })
})
