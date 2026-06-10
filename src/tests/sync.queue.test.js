import { describe, it, expect, beforeEach, vi } from 'vitest'

// Provide stub env vars before importing sync.js
vi.stubEnv('VITE_SUPABASE_URL', 'https://test.supabase.co')
vi.stubEnv('VITE_SUPABASE_ANON_KEY', 'test-anon-key')

// Mock the Supabase client
const mockUpsert = vi.fn()
const mockFrom = vi.fn(() => ({
  upsert: mockUpsert,
}))
const mockClient = { from: mockFrom }

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockClient),
}))

// Import after mocks are set up
const { _setClientForTesting, pushKey, flushQueue, getQueue } = await import('../sync.js')

beforeEach(() => {
  localStorage.clear()
  _setClientForTesting(undefined) // reset lazy client
  vi.clearAllMocks()
})

describe('offline queue', () => {
  it('getQueue returns empty array initially', () => {
    expect(getQueue()).toEqual([])
  })

  it('pushKey enqueues the key when device is offline and push fails', async () => {
    localStorage.setItem('sft_team', JSON.stringify({ teamId: 'team-abc', shortId: 'REN-1234', setupComplete: true }))
    localStorage.setItem('sft_games', JSON.stringify([{ id: 'g1' }]))

    vi.stubGlobal('navigator', { onLine: false })
    const mockClientOffline = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: { message: 'Network error' } }),
      }),
    }
    _setClientForTesting(mockClientOffline)

    await pushKey('sft_games')
    expect(getQueue()).toContain('sft_games')

    vi.unstubAllGlobals()
  })

  it('pushKey does NOT enqueue when device is online and push fails (server error)', async () => {
    localStorage.setItem('sft_team', JSON.stringify({ teamId: 'team-abc', shortId: 'REN-1234', setupComplete: true }))
    localStorage.setItem('sft_games', JSON.stringify([]))

    vi.stubGlobal('navigator', { onLine: true })
    const mockClientOnline = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: { message: 'Server error' } }),
      }),
    }
    _setClientForTesting(mockClientOnline)

    await pushKey('sft_games')
    expect(getQueue()).toEqual([])

    vi.unstubAllGlobals()
  })

  it('flushQueue calls pushKey for each queued key and clears the queue', async () => {
    localStorage.setItem('sft_team', JSON.stringify({ teamId: 'team-abc', shortId: 'REN-1234', setupComplete: true }))
    localStorage.setItem('sft_games', JSON.stringify([]))
    localStorage.setItem('sft_roster', JSON.stringify([]))
    localStorage.setItem('sft_sync_queue', JSON.stringify(['sft_games', 'sft_roster']))

    const mockClientFlush = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }),
    }
    _setClientForTesting(mockClientFlush)
    vi.stubGlobal('navigator', { onLine: true })

    await flushQueue()

    expect(getQueue()).toEqual([])
    expect(mockClientFlush.from).toHaveBeenCalledTimes(2)

    vi.unstubAllGlobals()
  })

  it('flushQueue is a no-op when queue is empty', async () => {
    const mockClientEmpty = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }),
    }
    _setClientForTesting(mockClientEmpty)

    await flushQueue()
    expect(mockClientEmpty.from).not.toHaveBeenCalled()
  })

  it('dequeues a key when push succeeds', async () => {
    localStorage.setItem('sft_team', JSON.stringify({ teamId: 'team-abc', shortId: 'REN-1234', setupComplete: true }))
    localStorage.setItem('sft_games', JSON.stringify([{ id: 'g1' }]))
    localStorage.setItem('sft_sync_queue', JSON.stringify(['sft_games']))

    const mockClientSuccess = {
      from: vi.fn().mockReturnValue({
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }),
    }
    _setClientForTesting(mockClientSuccess)
    vi.stubGlobal('navigator', { onLine: true })

    await pushKey('sft_games')
    expect(getQueue()).toEqual([])

    vi.unstubAllGlobals()
  })
})
