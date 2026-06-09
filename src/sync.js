// src/sync.js
import { createClient } from '@supabase/supabase-js'
import { getTeamConfig } from './storage'

// Lazily-initialised Supabase client.
// _setClientForTesting(mockClient) — inject a mock; _setClientForTesting(null) — simulate "not configured".
// undefined = not yet initialised; null = explicitly disabled (no Supabase).
let _client = undefined
export function _setClientForTesting(client) { _client = client }

function getSupabase() {
  if (_client !== undefined) return _client   // covers injected mock AND explicit null (disabled)
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) { _client = null; return null }
  _client = createClient(url, key)
  return _client
}

// ── Crypto ────────────────────────────────────────────────────
export async function hashPin(pin) {
  const encoder = new TextEncoder()
  const data = encoder.encode(pin)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

// ── Short ID ─────────────────────────────────────────────────
export function generateShortId(teamName) {
  const letters = teamName.toUpperCase().replace(/[^A-Z]/g, '')
  const prefix = letters.slice(0, 3).padEnd(3, 'X')
  const suffix = Math.floor(1000 + Math.random() * 9000)
  return `${prefix}-${suffix}`
}

// ── Key map: localStorage key → Supabase remote key ──────────
export const SYNC_KEYS = {
  sft_roster:       'roster',
  sft_games:        'games',
  sft_active_game:  'active_game',
  sft_division:     'division',
  sft_teams:        'teams',
  sft_tournaments:  'tournaments',
  sft_schedule:     'schedule',
}

// ── Push a single key to Supabase ─────────────────────────────
// Reads teamId from sft_team; no-ops if local-only or Supabase unavailable.
export async function pushKey(localKey) {
  const teamId = getTeamConfig()?.teamId
  if (!teamId || teamId === 'local') return
  const remoteKey = SYNC_KEYS[localKey]
  if (!remoteKey) return
  const raw = localStorage.getItem(localKey)
  if (raw === null) return
  const client = getSupabase()
  if (!client) return
  const { error } = await client
    .from('team_data')
    .upsert(
      { team_id: teamId, key: remoteKey, value: JSON.parse(raw) },
      { onConflict: 'team_id,key' }
    )
  if (error) console.warn(`Sync push failed for ${localKey}:`, error.message)
}

// Push all synced keys at once (used after team creation / initial push).
export async function pushAllLocalData(teamId) {
  if (!teamId || teamId === 'local') return
  for (const localKey of Object.keys(SYNC_KEYS)) {
    const raw = localStorage.getItem(localKey)
    if (raw === null) continue
    const client = getSupabase()
    if (!client) return
    const { error } = await client
      .from('team_data')
      .upsert(
        { team_id: teamId, key: SYNC_KEYS[localKey], value: JSON.parse(raw) },
        { onConflict: 'team_id,key' }
      )
    if (error) console.warn(`pushAllLocalData failed for ${localKey}:`, error.message)
  }
}

// ── Create a new team in Supabase ─────────────────────────────
export async function createTeam({ name, division, pin }) {
  const client = getSupabase()
  if (!client) throw new Error('Cloud sync not configured')
  const pin_hash = await hashPin(pin)
  let retries = 0
  while (retries < 5) {
    const shortId = generateShortId(name)
    const { data, error } = await client
      .from('teams')
      .insert({ name, division, pin_hash, short_id: shortId })
      .select('id, short_id')
      .single()
    if (!error) return { teamId: data.id, shortId: data.short_id }
    if (error.code === '23505') {
      if (error.message.includes('name') && error.message.includes('division')) {
        throw new Error('A team with this name and division already exists.')
      }
      retries++ // short_id collision — retry with new random number
    } else {
      throw new Error(error.message)
    }
  }
  throw new Error('Could not generate a unique Team ID — please try again.')
}
