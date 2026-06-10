import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock sync so no Supabase calls
vi.mock('../sync', () => ({
  pushKey: vi.fn().mockResolvedValue(undefined),
}))

import AdminPage from '../pages/AdminPage'
import { setTeamConfig, setPin } from '../storage'

beforeEach(() => {
  localStorage.clear()
  setTeamConfig({ name: 'Test FC', division: 'Div 1', setupComplete: true, teamId: 'uuid-1', shortId: 'TES-1234' })
  setPin('1234')
})

describe('AdminPage TeamIdSection', () => {
  it('shows the shortId after unlocking', async () => {
    render(<AdminPage onBack={vi.fn()} />)
    await userEvent.type(screen.getByPlaceholderText('••••'), '1234')
    await userEvent.click(screen.getByRole('button', { name: /unlock/i }))
    expect(screen.getByText('TES-1234')).toBeInTheDocument()
  })

  it('does not show Team ID section when teamId is "local"', async () => {
    setTeamConfig({ name: 'Test FC', division: 'Div 1', setupComplete: true, teamId: 'local' })
    render(<AdminPage onBack={vi.fn()} />)
    await userEvent.type(screen.getByPlaceholderText('••••'), '1234')
    await userEvent.click(screen.getByRole('button', { name: /unlock/i }))
    expect(screen.queryByText(/your team id/i)).not.toBeInTheDocument()
  })
})
