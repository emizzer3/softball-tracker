import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ScoresheetPage from '../pages/ScoresheetPage'

const minimalGame = {
  id: 'g1',
  date: '2024-05-15',
  gameType: 'League',
  tournamentName: '',
  home: 'Renegades',
  away: 'Bulls',
  homeScore: 8,
  awayScore: 5,
  result: 'W',
  innings: 5,
  battingOrder: ['Alice', 'Bob'],
  roster: [
    { name: 'Alice', type: 'BBH' },
    { name: 'Bob',   type: 'SBH' },
  ],
  atBats: [
    { id: 'ab1', batter: 'Alice', inning: 1, half: 'bottom', outcome: '1B', rbi: 1 },
    { id: 'ab2', batter: 'Alice', inning: 2, half: 'bottom', outcome: 'HR', rbi: 2 },
    { id: 'ab3', batter: 'Bob',   inning: 1, half: 'bottom', outcome: 'K',  rbi: 0 },
    { id: 'ab4', batter: 'Bob',   inning: 2, half: 'bottom', outcome: 'BB', rbi: 0 },
  ],
  inningScores: [{ home: 3, away: 1 }, { home: 5, away: 4 }],
  playLog: [],
  fieldingLineup: {},
}

describe('ScoresheetPage share', () => {
  it('renders a Share button', () => {
    render(<ScoresheetPage game={minimalGame} onHome={() => {}} onSummary={() => {}} />)
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument()
  })

  it('calls navigator.share when available', async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share: mockShare, clipboard: null })

    render(<ScoresheetPage game={minimalGame} onHome={() => {}} onSummary={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /share/i }))

    await waitFor(() => expect(mockShare).toHaveBeenCalledOnce())
    const call = mockShare.mock.calls[0][0]
    expect(call.title).toContain('Bulls')
    expect(call.title).toContain('Renegades')
    expect(call.text).toContain('Final: 5–8')  // away (Bulls=5) – home (Renegades=8)
    expect(call.text).toContain('Alice')
    vi.unstubAllGlobals()
  })

  it('falls back to clipboard when navigator.share not available', async () => {
    const mockWrite = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share: undefined, clipboard: { writeText: mockWrite } })

    render(<ScoresheetPage game={minimalGame} onHome={() => {}} onSummary={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /share/i }))

    await waitFor(() => expect(mockWrite).toHaveBeenCalledOnce())
    expect(mockWrite.mock.calls[0][0]).toContain('Renegades')
    vi.unstubAllGlobals()
  })

  it('shows Copied! toast after clipboard copy', async () => {
    vi.stubGlobal('navigator', { share: undefined, clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })

    render(<ScoresheetPage game={minimalGame} onHome={() => {}} onSummary={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /share/i }))

    await waitFor(() => expect(screen.getByText(/copied/i)).toBeInTheDocument())
    vi.unstubAllGlobals()
  })
})
