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
