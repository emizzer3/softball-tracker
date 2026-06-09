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

describe('Renegades auto-migration', () => {
  // This tests the migration logic we'll add to App.jsx.
  // We test the storage functions directly to keep it simple.

  test('getTeamConfig returns null when only roster exists (pre-migration state)', () => {
    // Simulate an existing install that has roster data but no team config
    localStorage.setItem('sft_roster', JSON.stringify([{ id: 'matt', name: 'Matt', type: 'BBH', active: true }]))
    expect(getTeamConfig()).toBeNull()
  })

  test('setTeamConfig with migration values produces the expected config', () => {
    // Simulate what App.jsx migration code will do
    localStorage.setItem('sft_roster', JSON.stringify([{ id: 'matt', name: 'Matt', type: 'BBH', active: true }]))
    localStorage.setItem('sft_division', JSON.stringify('Bristol Division 2'))
    // Migration logic:
    const hasRoster = localStorage.getItem('sft_roster') !== null
    const hasTeam = localStorage.getItem('sft_team') !== null
    if (hasRoster && !hasTeam) {
      setTeamConfig({
        name: 'The Renegades',
        division: 'Bristol Division 2',
        setupComplete: true,
      })
    }
    expect(getTeamConfig()).toEqual({
      name: 'The Renegades',
      division: 'Bristol Division 2',
      setupComplete: true,
    })
  })

  test('migration does not overwrite an existing team config', () => {
    localStorage.setItem('sft_roster', JSON.stringify([]))
    setTeamConfig({ name: 'Different Team', division: 'Div 3', setupComplete: true })
    // Migration logic should not fire if sft_team already exists:
    const hasRoster = localStorage.getItem('sft_roster') !== null
    const hasTeam = localStorage.getItem('sft_team') !== null
    if (hasRoster && !hasTeam) {
      setTeamConfig({ name: 'The Renegades', division: 'Bristol Division 2', setupComplete: true })
    }
    expect(getTeamConfig()).toEqual({ name: 'Different Team', division: 'Div 3', setupComplete: true })
  })
})
