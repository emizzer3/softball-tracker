// Keys
const K = {
  ROSTER:      'sft_roster',
  GAMES:       'sft_games',
  ACTIVE_GAME: 'sft_active_game',
  PIN:         'sft_pin',
  DIVISION:    'sft_division',
  TEAMS:       'sft_teams',
  TOURNAMENTS: 'sft_tournaments',
  SCHEDULE:    'sft_schedule',
  TEAM:        'sft_team',
}

const DEFAULT_TEAMS = []

function get(key, fallback) {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : JSON.parse(raw)
  } catch { return fallback }
}

function set(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}

// ── Roster ────────────────────────────────────────────────────
const DEFAULT_ROSTER = []

export function getRoster() { return get(K.ROSTER, DEFAULT_ROSTER) }
export function saveRoster(roster) { set(K.ROSTER, roster) }

export function addPlayer(name, type) {
  const roster = getRoster()
  const id = name.toLowerCase().replace(/\s+/g, '_') + '_' + Date.now()
  roster.push({ id, name, type, active: true })
  saveRoster(roster)
  return roster
}

export function updatePlayer(id, changes) {
  const roster = getRoster().map(p => p.id === id ? { ...p, ...changes } : p)
  saveRoster(roster)
  return roster
}

export function removePlayer(id) {
  const roster = getRoster().filter(p => p.id !== id)
  saveRoster(roster)
  return roster
}

// ── PIN ───────────────────────────────────────────────────────
export function getPin() { return get(K.PIN, '1234') }
export function setPin(pin) { set(K.PIN, pin) }
export function checkPin(pin) { return pin === getPin() }

// ── League settings ───────────────────────────────────────────
export function getDivision() { return get(K.DIVISION, '') }
export function setDivision(name) { set(K.DIVISION, name) }

export function getTeams() { return get(K.TEAMS, DEFAULT_TEAMS) }
export function saveTeams(teams) { set(K.TEAMS, teams) }
export function addTeam(name) {
  const teams = getTeams()
  if (!teams.includes(name)) teams.push(name)
  saveTeams(teams)
  return teams
}
export function removeTeam(name) {
  const teams = getTeams().filter(t => t !== name)
  saveTeams(teams)
  return teams
}

// ── Tournaments (remembered names) ───────────────────────────
export function getTournaments() { return get(K.TOURNAMENTS, []) }
export function rememberTournament(name) {
  if (!name?.trim()) return
  const list = [name, ...getTournaments().filter(t => t !== name)].slice(0, 10)
  set(K.TOURNAMENTS, list)
}

// ── Schedule (upcoming fixtures) ─────────────────────────────
const DEFAULT_SCHEDULE = []

export function getSchedule() { return get(K.SCHEDULE, DEFAULT_SCHEDULE) }
export function saveSchedule(schedule) { set(K.SCHEDULE, schedule) }
export function addFixture(fixture) {
  const schedule = getSchedule()
  schedule.push({ id: Date.now().toString(), ...fixture })
  schedule.sort((a, b) => a.date.localeCompare(b.date))
  saveSchedule(schedule)
  return getSchedule()
}
export function removeFixture(id) {
  const schedule = getSchedule().filter(f => f.id !== id)
  saveSchedule(schedule)
  return schedule
}

// ── Games ─────────────────────────────────────────────────────
export function getGames() { return get(K.GAMES, []) }

export function saveGame(game) {
  const games = getGames()
  const idx = games.findIndex(g => g.id === game.id)
  if (idx >= 0) games[idx] = game
  else games.push(game)
  set(K.GAMES, games)
}

export function getGame(id) {
  return getGames().find(g => g.id === id) || null
}

export function deleteGame(id) {
  set(K.GAMES, getGames().filter(g => g.id !== id))
}

// ── Active game (in-progress) ─────────────────────────────────
export function getActiveGame() { return get(K.ACTIVE_GAME, null) }
export function setActiveGame(game) { set(K.ACTIVE_GAME, game) }
export function clearActiveGame() { localStorage.removeItem(K.ACTIVE_GAME) }

// ── Setup drafts (per-fixture; survive navigation; multiple may co-exist) ─
const K_DRAFTS = 'sft_setup_drafts'
export function getAllSetupDrafts() { return get(K_DRAFTS, {}) }
export function getSetupDraft(key = 'default') { return getAllSetupDrafts()[key] || null }
export function saveSetupDraft(key, draft) {
  // Back-compat: if called with a single argument that's an object, treat as the default slot
  if (typeof key === 'object' && key !== null && draft === undefined) {
    draft = key
    key = 'default'
  }
  const all = getAllSetupDrafts()
  all[key] = draft
  set(K_DRAFTS, all)
}
export function clearSetupDraft(key = 'default') {
  const all = getAllSetupDrafts()
  delete all[key]
  set(K_DRAFTS, all)
}
export function hasSetupDraft(key) { return !!getSetupDraft(key) }

// ── Backup / Restore ──────────────────────────────────────────
export function exportAllData() {
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    roster:      getRoster(),
    games:       getGames(),
    division:    getDivision(),
    teams:       getTeams(),
    tournaments: getTournaments(),
    schedule:    getSchedule(),
    teamConfig:  getTeamConfig(),
  }
}

export function importAllData(data) {
  if (!data?.version || !Array.isArray(data.roster)) {
    throw new Error('Invalid backup file — not a Softball Tracker export')
  }
  saveRoster(data.roster)
  set(K.GAMES,       data.games       || [])
  setDivision(       data.division    || '')
  saveTeams(         data.teams       || DEFAULT_TEAMS)
  set(K.TOURNAMENTS, data.tournaments || [])
  if (data.schedule) saveSchedule(data.schedule)
  if (data.teamConfig) {
    // Preserve teamId/shortId from current install — backup files predate cloud sync
    const existing = getTeamConfig()
    setTeamConfig({ ...data.teamConfig, teamId: existing?.teamId, shortId: existing?.shortId })
  }
}

// ── Season stats (derived, not stored — computed from games) ──
export function computeSeasonStats() {
  const games = getGames()
  const stats = {}

  function ensure(name) {
    if (!stats[name]) {
      stats[name] = {
        name,
        G: new Set(), W: 0, L: 0, D: 0,
        // batting
        AB: 0, H: 0, '1B': 0, '2B': 0, '3B': 0, HR: 0, R: 0, RBI: 0, BB: 0, K: 0,
        // fielding
        PO: 0, A: 0, E: 0,
      }
    }
    return stats[name]
  }

  for (const game of games) {
    const result = game.result // 'W' | 'L' | 'D' | undefined
    const playersThisGame = new Set()

    for (const ab of (game.atBats || [])) {
      const s = ensure(ab.batter)
      s.G.add(game.id)
      playersThisGame.add(ab.batter)

      const outcome = ab.outcome || ''
      if (!['BB', 'HBP', 'SAC'].includes(outcome)) s.AB++
      if (['1B','2B','3B','HR'].includes(outcome)) { s.H++; s[outcome]++ }
      if (outcome === 'BB')  s.BB++
      if (outcome === 'K')   s.K++
      s.RBI += (ab.rbi || 0)
      if (outcome === 'HR') s.R++
    }

    // W/L/D credited once per player per game (not once per at-bat)
    for (const playerName of playersThisGame) {
      const s = ensure(playerName)
      if (result === 'W') s.W++
      else if (result === 'L') s.L++
      else if (result === 'D') s.D++
    }

    // runs, stolen bases, putouts, assists, errors from play log
    for (const play of (game.playLog || [])) {
      if (play.type === 'run'    && play.player)   ensure(play.player).R++
      if (play.type === 'error'  && play.fielder)  ensure(play.fielder).E++
      if (play.type === 'putout') {
        if (play.fielder)  ensure(play.fielder).PO++
        if (play.assister) ensure(play.assister).A++
      }
    }
  }

  return Object.values(stats).map(s => {
    const singles = s.H - s['2B'] - s['3B'] - s.HR
    const tb = singles + s['2B'] * 2 + s['3B'] * 3 + s.HR * 4
    return {
      ...s,
      G: s.G.size,
      AVG: s.AB > 0 ? (s.H / s.AB).toFixed(3).replace(/^0/, '') : '.000',
      OBP: (s.AB + s.BB) > 0 ? ((s.H + s.BB) / (s.AB + s.BB)).toFixed(3).replace(/^0/, '') : '.000',
      SLG: s.AB > 0 ? (tb / s.AB).toFixed(3).replace(/^0/, '') : '.000',
    }
  }).sort((a, b) => b.AB - a.AB)
}

// ── Season W/L/D record ───────────────────────────────────────
export function getSeasonRecord() {
  const games = getGames()
  return games.reduce(
    (rec, g) => {
      if (g.result === 'W') rec.W++
      else if (g.result === 'L') rec.L++
      else if (g.result === 'D') rec.D++
      return rec
    },
    { W: 0, L: 0, D: 0 }
  )
}

// ── Team config ───────────────────────────────────────────────
// Shape: { name: string, division: string, setupComplete: boolean }
// Phase 2 will extend this with { teamId: string, shortId: string }
export function getTeamConfig() { return get(K.TEAM, null) }
export function setTeamConfig(config) { set(K.TEAM, config) }
