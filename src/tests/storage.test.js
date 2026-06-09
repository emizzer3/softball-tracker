import { getRoster, getTeams, getDivision, getSchedule, getTeamConfig, setTeamConfig } from '../storage'

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

describe('default values (no localStorage data)', () => {
  test('getRoster returns empty array for a fresh install', () => {
    expect(getRoster()).toEqual([])
  })

  test('getTeams returns empty array for a fresh install', () => {
    expect(getTeams()).toEqual([])
  })

  test('getDivision returns empty string for a fresh install', () => {
    expect(getDivision()).toBe('')
  })

  test('getSchedule returns empty array for a fresh install', () => {
    expect(getSchedule()).toEqual([])
  })
})
