import { describe, it, expect, beforeEach, vi } from 'vitest'

// Provide stub env vars before importing sync.js
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')

// Mock the Supabase client so no real HTTP calls are made
const mockSingle = vi.fn()
const mockSelect = vi.fn(() => ({ eq: vi.fn(() => ({ single: mockSingle })) }))
const mockUpsert = vi.fn()
const mockInsert = vi.fn(() => ({ select: vi.fn(() => ({ single: mockSingle })) }))
const mockFrom = vi.fn(() => ({
  select: mockSelect,
  insert: mockInsert,
  upsert: mockUpsert,
}))
const mockClient = { from: mockFrom }

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockClient),
}))

// Import AFTER mocks are set up
const { hashPin, generateShortId, _setClientForTesting } = await import('../sync.js')

beforeEach(() => {
  // Reset to mock client between tests so no test leaks state.
  // Tests that need "Supabase not configured" call _setClientForTesting(null) themselves.
  _setClientForTesting(mockClient)
  vi.clearAllMocks()
})

describe('hashPin', () => {
  it('returns a 64-character hex string', async () => {
    const hash = await hashPin('1234')
    expect(hash).toMatch(/^[0-9a-f]{64}$/)
  })

  it('returns the same hash for the same PIN', async () => {
    const h1 = await hashPin('5678')
    const h2 = await hashPin('5678')
    expect(h1).toBe(h2)
  })

  it('returns different hashes for different PINs', async () => {
    const h1 = await hashPin('1234')
    const h2 = await hashPin('9999')
    expect(h1).not.toBe(h2)
  })
})

describe('generateShortId', () => {
  it('returns format XXX-NNNN', () => {
    const id = generateShortId('The Renegades')
    expect(id).toMatch(/^[A-Z]{3}-\d{4}$/)
  })

  it('uses first 3 letters of team name uppercased', () => {
    const id = generateShortId('Bristol Bulls')
    expect(id.startsWith('BRI-')).toBe(true)
  })

  it('pads short names with X', () => {
    const id = generateShortId('Go')
    expect(id.startsWith('GOX-')).toBe(true)
  })

  it('strips non-alpha characters from name prefix', () => {
    const id = generateShortId('123 Team')
    expect(id.startsWith('TEA-')).toBe(true)
  })
})

// Re-import the functions added in this task
// (dynamic import at top of file already covers the whole module)
const { pushKey, pushAllLocalData, createTeam } = await import('../sync.js')

describe('pushKey', () => {
  it('does nothing when teamId is "local"', async () => {
    localStorage.setItem('sft_team', JSON.stringify({ teamId: 'local' }))
    await pushKey('sft_roster')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('does nothing when key is not in SYNC_KEYS', async () => {
    localStorage.setItem('sft_team', JSON.stringify({ teamId: 'uuid-123' }))
    await pushKey('sft_setup_drafts')
    expect(mockFrom).not.toHaveBeenCalled()
  })

  it('calls upsert with correct team_id and key', async () => {
    localStorage.setItem('sft_team', JSON.stringify({ teamId: 'uuid-abc' }))
    localStorage.setItem('sft_roster', JSON.stringify([{ id: '1', name: 'Alice' }]))
    mockFrom.mockReturnValue({ upsert: mockUpsert })
    mockUpsert.mockResolvedValue({ error: null })

    await pushKey('sft_roster')

    expect(mockFrom).toHaveBeenCalledWith('team_data')
    expect(mockUpsert).toHaveBeenCalledWith(
      { team_id: 'uuid-abc', key: 'roster', value: [{ id: '1', name: 'Alice' }] },
      { onConflict: 'team_id,key' }
    )
  })

  it('does nothing when localStorage key has no value', async () => {
    localStorage.setItem('sft_team', JSON.stringify({ teamId: 'uuid-abc' }))
    localStorage.removeItem('sft_roster')
    await pushKey('sft_roster')
    expect(mockUpsert).not.toHaveBeenCalled()
  })
})

describe('createTeam', () => {
  it('throws when Supabase is not configured', async () => {
    _setClientForTesting(null)
    await expect(createTeam({ name: 'Test', division: 'Div 1', pin: '1234' }))
      .rejects.toThrow('Cloud sync not configured')
    _setClientForTesting(mockClient)
  })

  it('throws on duplicate team name+division', async () => {
    const mockInsertChain = {
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: { code: '23505', message: 'duplicate key value violates unique constraint "teams_name_division_key"' },
        }),
      })),
    }
    mockFrom.mockReturnValue({ insert: vi.fn(() => mockInsertChain) })

    await expect(createTeam({ name: 'Duplicate', division: 'Div 1', pin: '1234' }))
      .rejects.toThrow('A team with this name and division already exists.')
  })

  it('returns teamId and shortId on success', async () => {
    const mockInsertChain = {
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: 'team-uuid-1', short_id: 'TES-1234' },
          error: null,
        }),
      })),
    }
    mockFrom.mockReturnValue({ insert: vi.fn(() => mockInsertChain) })

    const result = await createTeam({ name: 'Test FC', division: 'Div 2', pin: '5678' })
    expect(result).toEqual({ teamId: 'team-uuid-1', shortId: 'TES-1234' })
  })
})

const { loadTeamByShortId, pullAllData } = await import('../sync.js')

describe('pullAllData', () => {
  it('writes fetched rows into localStorage', async () => {
    const mockSelectChain = {
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({
          data: [
            { key: 'roster', value: [{ id: '1', name: 'Alice' }] },
            { key: 'division', value: 'Bristol Div 2' },
          ],
          error: null,
        })),
      })),
    }
    mockFrom.mockReturnValue(mockSelectChain)

    await pullAllData('team-uuid-1')

    expect(localStorage.getItem('sft_roster')).toBe(JSON.stringify([{ id: '1', name: 'Alice' }]))
    expect(localStorage.getItem('sft_division')).toBe(JSON.stringify('Bristol Div 2'))
  })

  it('does nothing for teamId "local"', async () => {
    await pullAllData('local')
    expect(mockFrom).not.toHaveBeenCalled()
  })
})

describe('loadTeamByShortId', () => {
  it('throws when team not found', async () => {
    const mockSelectChain = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }),
        })),
      })),
    }
    mockFrom.mockReturnValue(mockSelectChain)

    await expect(loadTeamByShortId('ABC-0000', '1234'))
      .rejects.toThrow('Team not found')
  })

  it('throws on wrong PIN', async () => {
    // hashPin('9999') won't match the stored hash of '1234'
    const storedHash = await hashPin('1234')
    const mockSelectChain = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({
            data: { id: 'uuid-1', name: 'Test', division: 'Div', pin_hash: storedHash, short_id: 'TES-1234' },
            error: null,
          }),
        })),
      })),
    }
    // pullAllData will call from() too — make it return empty
    mockFrom
      .mockReturnValueOnce(mockSelectChain)
      .mockReturnValue({ select: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ data: [], error: null })) })) })

    await expect(loadTeamByShortId('TES-1234', '9999'))
      .rejects.toThrow('Wrong PIN')
  })

  it('returns team data and pulls all data on correct PIN', async () => {
    const storedHash = await hashPin('5678')
    const teamRow = { id: 'uuid-2', name: 'Bulls', division: 'Div 1', pin_hash: storedHash, short_id: 'BUL-4321' }
    const mockSelectChain = {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: teamRow, error: null }),
        })),
      })),
    }
    const mockPullChain = {
      select: vi.fn(() => ({
        eq: vi.fn(() => Promise.resolve({ data: [], error: null })),
      })),
    }
    mockFrom
      .mockReturnValueOnce(mockSelectChain) // teams lookup
      .mockReturnValue(mockPullChain)        // team_data pull

    const result = await loadTeamByShortId('BUL-4321', '5678')
    expect(result).toEqual({ teamId: 'uuid-2', shortId: 'BUL-4321', name: 'Bulls', division: 'Div 1' })
  })
})
