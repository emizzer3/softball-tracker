// Keys
const K = {
  ROSTER:      'sft_roster',
  GAMES:       'sft_games',
  ACTIVE_GAME: 'sft_active_game',
  PIN:         'sft_pin',
  DIVISION:    'sft_division',
  TEAMS:       'sft_teams',
  TOURNAMENTS: 'sft_tournaments',
}

const DEFAULT_TEAMS = [
  'The Renegades', 'Bristol Bulls', 'Buccs Whizz',
  'Easton Cowfolk', 'Flyers', 'Underarm Tossers',
]

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
const DEFAULT_ROSTER = [
  { id: 'luke',      name: 'Luke',      type: 'BBH', active: true },
  { id: 'caoimhe',   name: 'Caoimhe',   type: 'SBH', active: true },
  { id: 'matt',      name: 'Matt',      type: 'BBH', active: true },
  { id: 'jeremy',    name: 'Jeremy',    type: 'BBH', active: true },
  { id: 'arthur',    name: 'Arthur',    type: 'BBH', active: true },
  { id: 'charlotte', name: 'Charlotte', type: 'SBH', active: true },
  { id: 'lewis',     name: 'Lewis',     type: 'BBH', active: true },
  { id: 'emily',     name: 'Emily',     type: 'SBH', active: true },
  { id: 'becky',     name: 'Becky',     type: 'SBH', active: true },
  { id: 'jack',      name: 'Jack',      type: 'BBH', active: true },
  { id: 'sam',       name: 'Sam',       type: 'BBH', active: true },
  { id: 'karl',      name: 'Karl',      type: 'BBH', active: true },
  { id: 'gavin',     name: 'Gavin',     type: 'BBH', active: true },
  { id: 'becci',     name: 'Becci',     type: 'SBH', active: true },
  { id: 'emma',      name: 'Emma',      type: 'SBH', active: true },
  { id: 'sarah',     name: 'Sarah',     type: 'SBH', active: true },
]

export function getRoster() {
  return get(K.ROSTER, DEFAULT_ROSTER)
}

export function saveRoster(roster) {
  set(K.ROSTER, roster)
}

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
  // keep most recent first, deduplicate, cap at 10
  const list = [name, ...getTournaments().filter(t => t !== name)].slice(0, 10)
  set(K.TOURNAMENTS, list)
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

// ── Season stats (derived, not stored — computed from games) ──
export function computeSeasonStats() {
  const games = getGames()
  const stats = {}

  function ensure(name) {
    if (!stats[name]) {
      stats[name] = {
        name,
        G: new Set(),
        // batting
        AB: 0, H: 0, '2B': 0, '3B': 0, HR: 0, R: 0, RBI: 0, BB: 0, K: 0, SB: 0,
        // fielding
        PO: 0, A: 0, E: 0,
      }
    }
    return stats[name]
  }

  for (const game of games) {
    for (const ab of (game.atBats || [])) {
      const s = ensure(ab.batter)
      s.G.add(game.id)
      const outcome = ab.outcome || ''
      if (!['BB', 'HBP', 'SAC'].includes(outcome)) s.AB++
      if (['1B','2B','3B','HR'].includes(outcome)) s.H++
      if (outcome === '2B') s['2B']++
      if (outcome === '3B') s['3B']++
      if (outcome === 'HR') s.HR++
      if (outcome === 'BB') s.BB++
      if (outcome === 'K')  s.K++
      s.RBI += (ab.rbi || 0)
    }
    // runs, stolen bases, putouts, assists, errors from play log
    for (const play of (game.playLog || [])) {
      if (play.type === 'run' && play.player)    ensure(play.player).R++
      if (play.type === 'sb'  && play.player)    ensure(play.player).SB++
      if (play.type === 'error' && play.fielder) ensure(play.fielder).E++
      if (play.type === 'putout') {
        if (play.fielder)  ensure(play.fielder).PO++
        if (play.assister) ensure(play.assister).A++
      }
    }
  }

  return Object.values(stats).map(s => ({
    ...s,
    G: s.G.size,
    AVG: s.AB > 0 ? (s.H / s.AB).toFixed(3).replace(/^0/, '') : '.000',
    OBP: (s.AB + s.BB) > 0 ? ((s.H + s.BB) / (s.AB + s.BB)).toFixed(3).replace(/^0/, '') : '.000',
  })).sort((a, b) => b.AB - a.AB)
}
