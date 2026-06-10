import { render, screen, waitFor } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import App from '../App'
import * as syncModule from '../sync'

beforeEach(() => {
  localStorage.clear()
})

describe('App viewer mode', () => {
  it('renders ViewerPage when ?view=REN-1234 is in URL', async () => {
    vi.stubGlobal('location', { ...window.location, search: '?view=REN-1234' })

    vi.spyOn(syncModule, 'loadViewerData').mockResolvedValue({
      teamName: 'Renegades',
      sft_games: [],
      sft_schedule: [],
      sft_active_game: null,
    })

    render(<App />)

    await waitFor(() => expect(screen.getByText('Renegades')).toBeInTheDocument())
    expect(screen.getByText(/viewer/i)).toBeInTheDocument()

    vi.unstubAllGlobals()
  })

  it('shows loading state while fetching viewer data', () => {
    vi.stubGlobal('location', { ...window.location, search: '?view=REN-1234' })

    vi.spyOn(syncModule, 'loadViewerData').mockReturnValue(new Promise(() => {})) // never resolves

    render(<App />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()

    vi.unstubAllGlobals()
  })

  it('shows error when team not found', async () => {
    vi.stubGlobal('location', { ...window.location, search: '?view=XXX-0000' })

    vi.spyOn(syncModule, 'loadViewerData').mockRejectedValue(new Error('Team not found — check the link.'))

    render(<App />)
    await waitFor(() => expect(screen.getByText(/team not found/i)).toBeInTheDocument())

    vi.unstubAllGlobals()
  })
})
