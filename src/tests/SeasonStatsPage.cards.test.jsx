import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import SeasonStatsPage from '../pages/SeasonStatsPage'
import * as storage from '../storage'

beforeEach(() => localStorage.clear())

const mockStats = [
  { name: 'Bob',   G: 2, AB: 5, H: 2, '2B': 0, '3B': 0, HR: 0, R: 1, RBI: 1, BB: 0, K: 1, PO: 0, A: 0, E: 0, AVG: '.400', OBP: '.400', SLG: '.400', KPct: '20.0', BBPct: '0.0', W: 2, L: 0, D: 0 },
  { name: 'Alice', G: 3, AB: 9, H: 3, '2B': 1, '3B': 0, HR: 0, R: 2, RBI: 2, BB: 1, K: 2, PO: 0, A: 0, E: 0, AVG: '.333', OBP: '.364', SLG: '.444', KPct: '22.2', BBPct: '10.0', W: 2, L: 1, D: 0 },
]

function mockCardFor(name) {
  return {
    name, type: 'BBH', qualifies: true,
    G: 3, AB: 9, AVG: '.333', OBP: '.364', SLG: '.444', KPct: '22.2', BBPct: '10.0',
    pose: 'contact',
    headlineStat: { key: 'AVG', value: '.333' },
    strengths: [], needsWork: [], neutral: true,
    spray: { dots: [], bestZone: null, worstZone: null },
    outBreakdown: { counts: {}, total: 0, mostCommon: null },
  }
}

describe('SeasonStatsPage — Cards tab', () => {
  beforeEach(() => {
    vi.spyOn(storage, 'computeSeasonStats').mockReturnValue(mockStats)
    vi.spyOn(storage, 'getSeasonRecord').mockReturnValue({ W: 2, L: 1, D: 0 })
    vi.spyOn(storage, 'getGames').mockReturnValue([])
    vi.spyOn(storage, 'computePlayerCard').mockImplementation(mockCardFor)
  })

  it('renders one card preview per player, alphabetically, when Cards tab is selected', () => {
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    fireEvent.click(screen.getByText('🃏 Cards'))
    const cardButtons = screen.getAllByRole('button', { name: /^View .*'s card$/ })
    expect(cardButtons).toHaveLength(2)
    expect(cardButtons[0]).toHaveAccessibleName("View Alice's card")
    expect(cardButtons[1]).toHaveAccessibleName("View Bob's card")
  })

  it('opens PlayerCardModal for the tapped player', () => {
    render(<SeasonStatsPage onHome={() => {}} onViewGame={() => {}} />)
    fireEvent.click(screen.getByText('🃏 Cards'))
    fireEvent.click(screen.getByRole('button', { name: "View Bob's card" }))
    expect(screen.getByText("Bob's Card")).toBeInTheDocument()
  })
})
