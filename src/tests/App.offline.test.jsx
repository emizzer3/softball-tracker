import { render, screen, act } from '@testing-library/react'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import App from '../App'
import * as storage from '../storage'
import * as syncModule from '../sync'

vi.mock('../sync', () => ({
  pushKey: vi.fn().mockResolvedValue(undefined),
  pullAllData: vi.fn().mockResolvedValue(undefined),
  flushQueue: vi.fn().mockResolvedValue(undefined),
}))

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem('sft_team', JSON.stringify({
    name: 'Test FC', division: 'Div 1', setupComplete: true, teamId: 'local'
  }))
  vi.spyOn(storage, 'getSchedule').mockReturnValue([])
  vi.spyOn(storage, 'getActiveGame').mockReturnValue(null)
  vi.spyOn(storage, 'getAllSetupDrafts').mockReturnValue({})
})

describe('offline banner and flush', () => {
  it('shows offline banner when navigator.onLine is false', () => {
    vi.stubGlobal('navigator', { onLine: false, clipboard: null })
    render(<App />)
    expect(screen.getByText(/offline.*sync/i)).toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('does not show offline banner when navigator.onLine is true', () => {
    vi.stubGlobal('navigator', { onLine: true, clipboard: null })
    render(<App />)
    expect(screen.queryByText(/offline.*sync/i)).not.toBeInTheDocument()
    vi.unstubAllGlobals()
  })

  it('calls flushQueue when window online event fires', async () => {
    vi.stubGlobal('navigator', { onLine: true, clipboard: null })
    render(<App />)
    await act(async () => {
      window.dispatchEvent(new Event('online'))
    })
    expect(syncModule.flushQueue).toHaveBeenCalled()
    vi.unstubAllGlobals()
  })
})
