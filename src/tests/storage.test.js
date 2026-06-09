import { getTeamConfig, setTeamConfig } from '../storage'

describe('team config', () => {
  test('getTeamConfig returns null when no team has been configured', () => {
    expect(getTeamConfig()).toBeNull()
  })

  test('setTeamConfig saves config and getTeamConfig retrieves it', () => {
    setTeamConfig({ name: 'Test FC', division: 'Div 1', setupComplete: true })
    expect(getTeamConfig()).toEqual({ name: 'Test FC', division: 'Div 1', setupComplete: true })
  })

  test('setTeamConfig can update an existing config', () => {
    setTeamConfig({ name: 'Old Name', division: 'Div 1', setupComplete: false })
    setTeamConfig({ name: 'New Name', division: 'Div 2', setupComplete: true })
    expect(getTeamConfig()).toEqual({ name: 'New Name', division: 'Div 2', setupComplete: true })
  })
})
