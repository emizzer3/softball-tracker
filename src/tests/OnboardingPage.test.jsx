import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import OnboardingPage from '../pages/OnboardingPage'
import { getTeamConfig, getPin } from '../storage'

describe('OnboardingPage', () => {
  test('renders team name, division, and PIN fields', () => {
    render(<OnboardingPage onComplete={() => {}} />)
    expect(screen.getByLabelText(/team name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/division/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/admin pin/i)).toBeInTheDocument()
  })

  test('shows validation errors when submitting empty form', async () => {
    const user = userEvent.setup()
    render(<OnboardingPage onComplete={() => {}} />)
    await user.click(screen.getByRole('button', { name: /set up my team/i }))
    expect(screen.getByText(/team name is required/i)).toBeInTheDocument()
    expect(screen.getByText(/division is required/i)).toBeInTheDocument()
    expect(screen.getByText(/pin must be 4 or more digits/i)).toBeInTheDocument()
  })

  test('shows PIN error when PIN is too short', async () => {
    const user = userEvent.setup()
    render(<OnboardingPage onComplete={() => {}} />)
    await user.type(screen.getByLabelText(/team name/i), 'Test FC')
    await user.type(screen.getByLabelText(/division/i), 'Div 1')
    await user.type(screen.getByLabelText(/admin pin/i), '12')
    await user.click(screen.getByRole('button', { name: /set up my team/i }))
    expect(screen.getByText(/pin must be 4 or more digits/i)).toBeInTheDocument()
  })

  test('shows PIN error when PIN contains non-digits', async () => {
    const user = userEvent.setup()
    render(<OnboardingPage onComplete={() => {}} />)
    await user.type(screen.getByLabelText(/team name/i), 'Test FC')
    await user.type(screen.getByLabelText(/division/i), 'Div 1')
    await user.type(screen.getByLabelText(/admin pin/i), 'abcd')
    await user.click(screen.getByRole('button', { name: /set up my team/i }))
    expect(screen.getByText(/pin must be 4 or more digits/i)).toBeInTheDocument()
  })

  test('saves team config and PIN then calls onComplete on valid submit', async () => {
    const user = userEvent.setup()
    const onComplete = vi.fn()
    render(<OnboardingPage onComplete={onComplete} />)
    await user.type(screen.getByLabelText(/team name/i), 'The Renegades')
    await user.type(screen.getByLabelText(/division/i), 'Bristol Division 2')
    await user.type(screen.getByLabelText(/admin pin/i), '1234')
    await user.click(screen.getByRole('button', { name: /set up my team/i }))
    expect(getTeamConfig()).toEqual({
      name: 'The Renegades',
      division: 'Bristol Division 2',
      setupComplete: true,
    })
    expect(getPin()).toBe('1234')
    expect(onComplete).toHaveBeenCalledOnce()
  })

  test('trims whitespace from team name and division', async () => {
    const user = userEvent.setup()
    render(<OnboardingPage onComplete={() => {}} />)
    await user.type(screen.getByLabelText(/team name/i), '  Test FC  ')
    await user.type(screen.getByLabelText(/division/i), '  Div 1  ')
    await user.type(screen.getByLabelText(/admin pin/i), '9999')
    await user.click(screen.getByRole('button', { name: /set up my team/i }))
    expect(getTeamConfig()).toMatchObject({ name: 'Test FC', division: 'Div 1' })
  })
})
