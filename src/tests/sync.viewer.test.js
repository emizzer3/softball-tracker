import { describe, it, expect, beforeEach, vi } from 'vitest'
import { _setClientForTesting, loadViewerData } from '../sync'

beforeEach(() => {
  localStorage.clear()
  _setClientForTesting(undefined)
})

describe('loadViewerData', () => {
  it('throws when Supabase not configured', async () => {
    _setClientForTesting(null)
    await expect(loadViewerData('REN-1234')).rejects.toThrow('Cloud sync not configured')
  })

  it('throws when team not found', async () => {
    const mockClient = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnThis(),
        eq:     vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } }),
      }),
    }
    _setClientForTesting(mockClient)
    await expect(loadViewerData('XXX-0000')).rejects.toThrow('Team not found')
  })

  it('returns parsed team data keyed by local storage key', async () => {
    const teamRow = { id: 'team-uuid', name: 'Renegades', short_id: 'REN-1234' }
    const dataRows = [
      { key: 'games',  value: [{ id: 'g1' }] },
      { key: 'roster', value: [{ id: 'p1', name: 'Alice' }] },
    ]

    const mockClient = {
      from: vi.fn().mockImplementation(table => {
        if (table === 'teams') {
          return {
            select: vi.fn().mockReturnThis(),
            eq:     vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: teamRow, error: null }),
          }
        }
        // team_data
        return {
          select: vi.fn().mockReturnThis(),
          eq:     vi.fn().mockResolvedValue({ data: dataRows, error: null }),
        }
      }),
    }
    _setClientForTesting(mockClient)

    const result = await loadViewerData('REN-1234')
    expect(result.teamName).toBe('Renegades')
    expect(result.sft_games).toEqual([{ id: 'g1' }])
    expect(result.sft_roster).toEqual([{ id: 'p1', name: 'Alice' }])
  })
})
