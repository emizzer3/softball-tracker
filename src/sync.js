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
// sft_pin is excluded — the authoritative copy lives in teams.pin_hash.
// sft_team and sft_setup_drafts are also excluded (identity/ephemeral).
export const SYNC_KEYS = {
  sft_roster:       'roster',
  sft_games:        'games',
  sft_active_game:  'active_game',
  sft_division:     'division',
  sft_teams:        'teams',
  sft_tournaments:  'tournaments',
  sft_schedule:     'schedule',
}

// ── Offline sync queue ────────────────────────────────────────
const QUEUE_KEY = 'sft_sync_queue'

export function getQueue() {
  try { return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]') } catch { return [] }
}

function enqueue(localKey) {
  const q = new Set(getQueue())
  q.add(localKey)
  localStorage.setItem(QUEUE_KEY, JSON.stringify([...q]))
}

function dequeue(localKey) {
  const q = getQueue().filter(k => k !== localKey)
  localStorage.setItem(QUEUE_KEY, JSON.stringify(q))
}

export async function flushQueue() {
  const q = getQueue()
  if (q.length === 0) return
  for (const localKey of q) {
    await pushKey(localKey).catch(() => {})
  }
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
  if (error) {
    if (!navigator.onLine) enqueue(localKey)
    console.warn(`Sync push failed for ${localKey}:`, error.message)
    return
  }
  dequeue(localKey)
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

// ── Pull all team data from Supabase into localStorage ────────
// Overwrites local keys unconditionally — no timestamp comparison.
// Phase 2: used both for initial load on a new device AND on-mount refresh in App.jsx.
// Safe because this app has a single manager — concurrent multi-device edits are not a use case.
// Phase 3 will add a write queue + last-write-wins before making sync bidirectional.
export async function pullAllData(teamId) {
  if (!teamId || teamId === 'local') return
  const client = getSupabase()
  if (!client) return
  const { data, error } = await client
    .from('team_data')
    .select('key, value')
    .eq('team_id', teamId)
  if (error) throw error
  const reverseKeys = Object.fromEntries(
    Object.entries(SYNC_KEYS).map(([localKey, remoteKey]) => [remoteKey, localKey])
  )
  for (const row of (data || [])) {
    const localKey = reverseKeys[row.key]
    if (localKey) localStorage.setItem(localKey, JSON.stringify(row.value))
  }
}

// ── Load an existing team by Short ID + PIN ────────────────────
export async function loadTeamByShortId(shortId, pin) {
  const client = getSupabase()
  if (!client) throw new Error('Cloud sync not configured')
  const { data: team, error } = await client
    .from('teams')
    .select('id, name, division, pin_hash, short_id')
    .eq('short_id', shortId.trim().toUpperCase())
    .single()
  if (error || !team) throw new Error('Team not found — check your Team ID.')
  const inputHash = await hashPin(pin)
  if (inputHash !== team.pin_hash) throw new Error('Wrong PIN.')
  await pullAllData(team.id)
  return { teamId: team.id, shortId: team.short_id, name: team.name, division: team.division }
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
