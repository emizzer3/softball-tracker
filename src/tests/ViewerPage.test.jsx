import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import ViewerPage from '../pages/ViewerPage'

const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]

const baseData = {
  teamName: 'Renegades',
  sft_games: [],
  sft_schedule: [],
  sft_active_game: null,
}

describe('ViewerPage', () => {
  it('shows team name', () => {
    render(<ViewerPage data={baseData} onRefresh={() => {}} />)
    expect(screen.getByText('Renegades')).toBeInTheDocument()
  })

  it('shows viewer mode badge', () => {
    render(<ViewerPage data={baseData} onRefresh={() => {}} />)
    expect(screen.getByText(/viewer/i)).toBeInTheDocument()
  })

  it('shows active game score when a game is in progress', () => {
    const data = {
      ...baseData,
      sft_active_game: {
        setup: { home: 'Renegades', away: 'Bulls' },
        homeScore: 4,
        awayScore: 2,
        inning: 3,
        half: 'top',
      },
    }
    render(<ViewerPage data={data} onRefresh={() => {}} />)
    expect(screen.getByText('4')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText(/in progress/i)).toBeInTheDocument()
  })

  it('shows upcoming fixtures', () => {
    const data = {
      ...baseData,
      sft_schedule: [
        { id: 'f1', date: tomorrow, opponent: 'Eagles', gameType: 'League', location: 'Home' },
      ],
    }
    render(<ViewerPage data={data} onRefresh={() => {}} />)
    expect(screen.getByText('Eagles')).toBeInTheDocument()
  })

  it('shows season record from completed games', () => {
    const data = {
      ...baseData,
      sft_games: [
        { id: 'g1', result: 'W' },
        { id: 'g2', result: 'W' },
        { id: 'g3', result: 'L' },
      ],
    }
    render(<ViewerPage data={data} onRefresh={() => {}} />)
    expect(screen.getByText('2W')).toBeInTheDocument()
    expect(screen.getByText('1L')).toBeInTheDocument()
  })

  it('calls onRefresh when Refresh button clicked', () => {
    const onRefresh = vi.fn()
    render(<ViewerPage data={baseData} onRefresh={onRefresh} />)
    fireEvent.click(screen.getByRole('button', { name: /refresh/i }))
    expect(onRefresh).toHaveBeenCalledOnce()
  })
})
