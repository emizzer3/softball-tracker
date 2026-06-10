import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import AdminPage from '../pages/AdminPage'
import { setTeamConfig, setPin } from '../storage'

beforeEach(() => {
  localStorage.clear()
  setPin('1234')
  setTeamConfig({
    name: 'Renegades', division: 'Division 1', setupComplete: true,
    teamId: 'team-uuid', shortId: 'REN-1234',
  })
})

describe('AdminPage viewer link', () => {
  it('shows Copy viewer link button when shortId exists', async () => {
    render(<AdminPage onBack={() => {}} />)
    // Unlock with PIN
    await userEvent.type(screen.getByPlaceholderText('••••'), '1234')
    await userEvent.click(screen.getByRole('button', { name: /unlock/i }))
    await waitFor(() => expect(screen.getByText(/copy viewer link/i)).toBeInTheDocument())
  })
})
