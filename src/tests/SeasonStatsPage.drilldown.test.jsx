import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import SeasonStatsPage from '../pages/SeasonStatsPage'
import * as storage from '../storage'

beforeEach(() => localStorage.clear())

const mockStats = [
  { name: 'Alice', G: 3, AB: 9, H: 3, '2B': 1, '3B': 0, HR: 0, R: 2, RBI: 2, BB: 1, K: 2, PO: 0, A: 0, E: 0, AVG: '.333', OBP: '.364', SLG: '.444', W: 2, L: 1, D: 0 },
]

const mockLog = [
  { gameId: 'g1', date: '2024-05-01', matchup: 'Eagles @ Renegades', result: 'W', AB: 3, H: 1, '2B': 0, '3B': 0, HR: 0, RBI: 1, BB: 0, K: 1, AVG: '.333' },
  { gameId: 'g2', date: '2024-05-08', matchup: 'Bulls @ Renegades',  result: 'L', AB: 3, H: 1, '2B': 1, '3B': 0, HR: 0, RBI: 0, BB: 1, K: 1, AVG: '.333' },
]

describe('PlayerDetailModal', () => {
  beforeEach(() => {
    vi.spyOn(storage, 'computeSeasonStats').mockReturnValue(mockStats)
    vi.spyOn(storage, 'getSeasonRecord').mockReturnValue({ W: 2, L: 1, D: 0 })
    vi.spyOn(storage, 'getGames').mockReturnValue([])
    vi.spyOn(storage, 'computePlayerGameLog').mockReturnValue(mockLog)
  })

  it('shows player detail modal when player name is clicked', () => {
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    fireEvent.click(screen.getByText('Alice'))
    expect(screen.getByText("Alice's Stats")).toBeInTheDocument()
  })

  it('shows game-by-game rows in the modal', () => {
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    fireEvent.click(screen.getByText('Alice'))
    expect(screen.getByText('Eagles @ Renegades')).toBeInTheDocument()
    expect(screen.getByText('Bulls @ Renegades')).toBeInTheDocument()
  })

  it('closes modal when close button clicked', () => {
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    fireEvent.click(screen.getByText('Alice'))
    fireEvent.click(screen.getAllByRole('button', { name: /close/i })[0])
    expect(screen.queryByText("Alice's Stats")).not.toBeInTheDocument()
  })
})
