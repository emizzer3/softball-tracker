// src/sync.js
import { createClient } from '@supabase/supabase-js'

// Lazily-initialised Supabase client.
// _setClientForTesting() allows tests to inject a mock without env vars.
let _client = null
export function _setClientForTesting(client) { _client = client }

function getSupabase() {
  if (_client) return _client
  const url = import.meta.env.VITE_SUPABASE_URL
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY
  if (!url || !key) return null
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
