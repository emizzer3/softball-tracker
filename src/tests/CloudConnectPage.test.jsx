import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

// Mock sync.js before importing the component
vi.mock('../sync', () => ({
  createTeam: vi.fn(),
  pushAllLocalData: vi.fn(),
  loadTeamByShortId: vi.fn(),
}))

import CloudConnectPage from '../pages/CloudConnectPage'
import { getTeamConfig, setTeamConfig } from '../storage'
import { createTeam, pushAllLocalData, loadTeamByShortId } from '../sync'

beforeEach(() => {
  localStorage.clear()
  setTeamConfig({ name: 'Test FC', division: 'Bristol Div 2', setupComplete: true })
  vi.clearAllMocks()
})

describe('CloudConnectPage', () => {
  it('renders create and load options', () => {
    render(<CloudConnectPage onComplete={vi.fn()} />)
    expect(screen.getByText(/create a new team/i)).toBeInTheDocument()
    expect(screen.getByText(/load existing team/i)).toBeInTheDocument()
    expect(screen.getByText(/without cloud sync/i)).toBeInTheDocument()
  })

  it('skip calls onComplete and sets teamId to "local"', async () => {
    const onComplete = vi.fn()
    render(<CloudConnectPage onComplete={onComplete} />)
    await userEvent.click(screen.getByText(/without cloud sync/i))
    expect(getTeamConfig().teamId).toBe('local')
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('shows create form when Create button clicked', async () => {
    render(<CloudConnectPage onComplete={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /create a new team/i }))
    expect(screen.getByLabelText(/admin pin/i)).toBeInTheDocument()
  })

  it('shows error when create form submitted without PIN', async () => {
    render(<CloudConnectPage onComplete={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /create a new team/i }))
    await userEvent.click(screen.getByRole('button', { name: /set up cloud sync/i }))
    expect(screen.getByText(/pin must be/i)).toBeInTheDocument()
    expect(createTeam).not.toHaveBeenCalled()
  })

  it('calls createTeam and onComplete on valid create submit', async () => {
    createTeam.mockResolvedValue({ teamId: 'uuid-1', shortId: 'TES-1234' })
    pushAllLocalData.mockResolvedValue(undefined)
    const onComplete = vi.fn()

    render(<CloudConnectPage onComplete={onComplete} />)
    await userEvent.click(screen.getByRole('button', { name: /create a new team/i }))
    await userEvent.type(screen.getByLabelText(/admin pin/i), '5678')
    await userEvent.click(screen.getByRole('button', { name: /set up cloud sync/i }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(createTeam).toHaveBeenCalledWith({ name: 'Test FC', division: 'Bristol Div 2', pin: '5678' })
    expect(getTeamConfig().teamId).toBe('uuid-1')
    expect(getTeamConfig().shortId).toBe('TES-1234')
  })

  it('shows error message from createTeam on failure', async () => {
    createTeam.mockRejectedValue(new Error('A team with this name and division already exists.'))
    render(<CloudConnectPage onComplete={vi.fn()} />)
    await userEvent.click(screen.getByRole('button', { name: /create a new team/i }))
    await userEvent.type(screen.getByLabelText(/admin pin/i), '1234')
    await userEvent.click(screen.getByRole('button', { name: /set up cloud sync/i }))
    await waitFor(() => expect(screen.getByText(/already exists/i)).toBeInTheDocument())
  })

  it('calls loadTeamByShortId and onComplete on valid load submit', async () => {
    loadTeamByShortId.mockResolvedValue({ teamId: 'uuid-2', shortId: 'RNG-9999', name: 'Test FC', division: 'Bristol Div 2' })
    const onComplete = vi.fn()

    render(<CloudConnectPage onComplete={onComplete} />)
    await userEvent.type(screen.getByLabelText(/team id/i), 'RNG-9999')
    await userEvent.type(screen.getByLabelText(/pin/i), '1234')
    await userEvent.click(screen.getByRole('button', { name: /load team/i }))

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(loadTeamByShortId).toHaveBeenCalledWith('RNG-9999', '1234')
    expect(getTeamConfig().teamId).toBe('uuid-2')
  })
})
