import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import SeasonStatsPage from '../pages/SeasonStatsPage'
import * as storage from '../storage'

beforeEach(() => localStorage.clear())

describe('SeasonStatsPage batting table', () => {
  it('shows R column header', () => {
    vi.spyOn(storage, 'computeSeasonStats').mockReturnValue([
      { name: 'Alice', G: 3, AB: 9, H: 3, '2B': 1, '3B': 0, HR: 0, R: 2, RBI: 2, BB: 1, K: 2, PO: 0, A: 0, E: 0, AVG: '.333', OBP: '.364', SLG: '.444', W: 2, L: 1, D: 0 },
    ])
    vi.spyOn(storage, 'getSeasonRecord').mockReturnValue({ W: 2, L: 1, D: 0 })
    vi.spyOn(storage, 'getGames').mockReturnValue([])
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    expect(screen.getByRole('columnheader', { name: 'R' })).toBeInTheDocument()
  })

  it('sorts by AB descending when AB header clicked', () => {
    vi.spyOn(storage, 'computeSeasonStats').mockReturnValue([
      { name: 'Alice', G: 3, AB: 9, H: 3, '2B': 0, '3B': 0, HR: 0, R: 2, RBI: 2, BB: 1, K: 2, PO: 0, A: 0, E: 0, AVG: '.333', OBP: '.364', SLG: '.333', W: 2, L: 1, D: 0 },
      { name: 'Bob',   G: 2, AB: 5, H: 2, '2B': 0, '3B': 0, HR: 0, R: 1, RBI: 1, BB: 0, K: 1, PO: 0, A: 0, E: 0, AVG: '.400', OBP: '.400', SLG: '.400', W: 2, L: 0, D: 0 },
    ])
    vi.spyOn(storage, 'getSeasonRecord').mockReturnValue({ W: 2, L: 1, D: 0 })
    vi.spyOn(storage, 'getGames').mockReturnValue([])
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    // Default: sorted by AB desc (Alice first)
    const rows = screen.getAllByRole('row')
    expect(rows[1]).toHaveTextContent('Alice')
    // Click AB header → ascending
    fireEvent.click(screen.getByRole('columnheader', { name: /^AB/ }))
    const rowsAfter = screen.getAllByRole('row')
    expect(rowsAfter[1]).toHaveTextContent('Bob')
  })
})
