import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../sync', () => ({
  createTeam: vi.fn(),
  pushAllLocalData: vi.fn(),
  loadTeamByShortId: vi.fn(),
  pushKey: vi.fn().mockResolvedValue(undefined),
  pullAllData: vi.fn().mockResolvedValue(undefined),
}))

import App from '../App'
import { setTeamConfig } from '../storage'

beforeEach(() => {
  localStorage.clear()
})

describe('App cloud gate', () => {
  it('shows CloudConnectPage when onboarded but no teamId', () => {
    setTeamConfig({ name: 'Test FC', division: 'Div 1', setupComplete: true })
    render(<App />)
    expect(screen.getByText(/set up cloud sync/i)).toBeInTheDocument()
  })

  it('shows normal app when teamId is "local"', () => {
    setTeamConfig({ name: 'Test FC', division: 'Div 1', setupComplete: true, teamId: 'local' })
    render(<App />)
    expect(screen.getByText(/softball tracker/i)).toBeInTheDocument()
    expect(screen.queryByText(/set up cloud sync/i)).not.toBeInTheDocument()
  })

  it('shows normal app when teamId is a real UUID', () => {
    setTeamConfig({ name: 'Test FC', division: 'Div 1', setupComplete: true, teamId: 'some-uuid' })
    render(<App />)
    expect(screen.getByText(/softball tracker/i)).toBeInTheDocument()
  })
})
