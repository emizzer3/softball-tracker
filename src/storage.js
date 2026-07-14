import { FIELD_HOME } from './components/softballFieldConstants'

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
export function computeSeasonStats(gamesInput) {
  const games = gamesInput || getGames()
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
        // pitch counts (only for PAs where count was tracked)
        pitchPA: 0, totalPitches: 0, deepCounts: 0,
      }
    }
    return stats[name]
  }

  for (const game of games) {
    const result = game.result // 'W' | 'L' | 'D' | undefined
    const playersThisGame = new Set()

    for (const ab of (game.atBats || [])) {
      if (ab.isOpponent) continue
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
      if (ab.finalBalls != null && ab.finalStrikes != null) {
        const pitches = ab.finalBalls + ab.finalStrikes + 1
        s.pitchPA++
        s.totalPitches += pitches
        if (pitches >= 4) s.deepCounts++
      }
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
      if (play.type === 'putout' || play.type === 'runnerOut') {
        if (play.fielder)  ensure(play.fielder).PO++
        if (play.assister) ensure(play.assister).A++
      }
    }
  }

  return Object.values(stats).map(s => {
    const singles = s.H - s['2B'] - s['3B'] - s.HR
    const tb = singles + s['2B'] * 2 + s['3B'] * 3 + s.HR * 4
    const gCount = s.G.size
    const pa = s.AB + s.BB   // plate appearances (for BBPct denominator)
    return {
      ...s,
      G:      gCount,
      AVG:    s.AB > 0 ? (s.H / s.AB).toFixed(3).replace(/^0/, '') : '.000',
      OBP:    (s.AB + s.BB) > 0 ? ((s.H + s.BB) / (s.AB + s.BB)).toFixed(3).replace(/^0/, '') : '.000',
      SLG:    s.AB > 0 ? (tb / s.AB).toFixed(3).replace(/^0/, '') : '.000',
      KPct:      s.AB > 0 ? (s.K  / s.AB * 100).toFixed(1) : '0.0',
      BBPct:     pa       > 0 ? (s.BB / pa    * 100).toFixed(1) : '0.0',
      POPerG:    gCount   > 0 ? (s.PO / gCount).toFixed(1) : '0.0',
      APerG:     gCount   > 0 ? (s.A  / gCount).toFixed(1) : '0.0',
      EPerG:     gCount   > 0 ? (s.E  / gCount).toFixed(1) : '0.0',
      PPerPA:    s.pitchPA > 0 ? (s.totalPitches / s.pitchPA).toFixed(1) : null,
      DeepPct:   s.pitchPA > 0 ? (s.deepCounts / s.pitchPA * 100).toFixed(0) : null,
    }
  }).sort((a, b) => b.AB - a.AB)
}

// ── Per-player game log (for drill-down in SeasonStatsPage) ───────────────
export function computePlayerGameLog(playerName, gamesInput) {
  const games = gamesInput || getGames()
  const rows = []

  for (const game of games) {
    const abs = (game.atBats || []).filter(ab => ab.batter === playerName)
    if (abs.length === 0) continue

    const AB    = abs.filter(ab => !['BB','HBP','SAC'].includes(ab.outcome)).length
    const H     = abs.filter(ab => ['1B','2B','3B','HR'].includes(ab.outcome)).length
    const twoB  = abs.filter(ab => ab.outcome === '2B').length
    const threeB = abs.filter(ab => ab.outcome === '3B').length
    const HR    = abs.filter(ab => ab.outcome === 'HR').length
    const RBI   = abs.reduce((s, ab) => s + (ab.rbi || 0), 0)
    const BB    = abs.filter(ab => ab.outcome === 'BB').length
    const K     = abs.filter(ab => ab.outcome === 'K').length
    const AVG   = AB > 0 ? (H / AB).toFixed(3).replace(/^0/, '') : '.000'

    rows.push({
      gameId:  game.id,
      date:    game.date,
      matchup: `${game.away} @ ${game.home}`,
      result:  game.result || '—',
      AB, H, '2B': twoB, '3B': threeB, HR, RBI, BB, K, AVG,
    })
  }

  return rows.sort((a, b) => a.date.localeCompare(b.date))
}

// ── Single-game stat breakdown (for SummaryPage) ──────────────────────────
export function computeGameStats(game) {
  const { atBats = [], battingOrder = [], roster = [], playLog = [], playerPositions = {} } = game
  const rosterMap = Object.fromEntries(roster.map(p => [p.name, p.type]))

  // Hit type / out type breakdown
  const hitTypes = { '1B': 0, '2B': 0, '3B': 0, 'HR': 0 }
  const outTypes = { 'K': 0, 'F': 0, 'G': 0, 'E': 0, 'FC': 0, 'SAC': 0 }
  for (const ab of atBats) {
    if (hitTypes[ab.outcome] !== undefined) hitTypes[ab.outcome]++
    if (outTypes[ab.outcome] !== undefined) outTypes[ab.outcome]++
  }
  const totalHits = Object.values(hitTypes).reduce((a, b) => a + b, 0)
  const totalOuts = Object.values(outTypes).reduce((a, b) => a + b, 0)
  const totalAB = atBats.filter(ab => !['BB','HBP','SAC'].includes(ab.outcome)).length
  const totalBB = atBats.filter(ab => ab.outcome === 'BB').length
  const teamAVG = totalAB > 0 ? (totalHits / totalAB).toFixed(3).replace(/^0/, '') : '.000'
  const teamOBP = (totalAB + totalBB) > 0 ? ((totalHits + totalBB) / (totalAB + totalBB)).toFixed(3).replace(/^0/, '') : '.000'

  // Per-player batting stats
  const playerStats = battingOrder.map(name => {
    const abs = atBats.filter(ab => ab.batter === name)
    const AB  = abs.filter(ab => !['BB','HBP','SAC'].includes(ab.outcome)).length
    const H   = abs.filter(ab => ['1B','2B','3B','HR'].includes(ab.outcome)).length
    const BB  = abs.filter(ab => ab.outcome === 'BB').length
    const K   = abs.filter(ab => ab.outcome === 'K').length
    const RBI = abs.reduce((s, ab) => s + (ab.rbi || 0), 0)
    const HR  = abs.filter(ab => ab.outcome === 'HR').length
    const AVG = AB > 0 ? (H / AB).toFixed(3).replace(/^0/, '') : '-'
    const type = rosterMap[name]
    return { name, AB, H, BB, K, RBI, HR, AVG, type }
  }).sort((a, b) => b.H - a.H)

  // Per-player fielding stats
  const fieldingStats = battingOrder.map(name => {
    const PO = playLog.filter(l => (l.type === 'putout' || l.type === 'runnerOut') && l.fielder  === name).length
    const A  = playLog.filter(l => (l.type === 'putout' || l.type === 'runnerOut') && l.assister === name).length
    const E  = playLog.filter(l => l.type === 'error'  && l.fielder  === name).length
    const pos = playerPositions[name] || ''
    return { name, pos, PO, A, E }
  })
  const hasFieldingData = fieldingStats.some(f => f.PO + f.A + f.E > 0)

  return {
    hitTypes, outTypes, totalHits, totalOuts, totalAB, totalBB,
    teamAVG, teamOBP, playerStats, fieldingStats, hasFieldingData,
  }
}

// ── Team runs per game (for trend chart in SeasonStatsPage) ──────────────
export function computeRunsPerGame(gamesInput) {
  return (gamesInput || getGames())
    .filter(g => g.date)
    .map(g => {
      const weAreHome = g.setup?.weAreHome !== false
      const ourRuns   = weAreHome ? (g.homeScore ?? 0) : (g.awayScore ?? 0)
      const theirRuns = weAreHome ? (g.awayScore ?? 0) : (g.homeScore ?? 0)
      const opponent  = weAreHome ? g.away : g.home
      return { gameId: g.id, date: g.date, ourRuns, theirRuns, result: g.result || '—', opponent }
    })
    .sort((a, b) => a.date.localeCompare(b.date))
}

// ── Situational team hitting: RISP / LOB / GIDP (for Team tab) ───────────
export function computeSituationalStats(gamesInput) {
  const games = gamesInput || getGames()

  let totalAB = 0, totalH = 0
  let rispAB = 0, rispH = 0
  let lobTotal = 0, lobGames = 0
  let gidpCount = 0
  const playerRisp = {}

  function ensurePlayer(name) {
    if (!playerRisp[name]) playerRisp[name] = { AB: 0, H: 0 }
    return playerRisp[name]
  }

  for (const game of games) {
    const atBats = game.atBats || []
    const lastOurAtBatByHalf = {}
    let gameHasOurAtBat = false

    atBats.forEach((ab, i) => {
      if (ab.isOpponent) return
      gameHasOurAtBat = true

      const prev = atBats[i - 1]
      const basesBefore = (prev && prev.inning === ab.inning && prev.half === ab.half)
        ? prev.bases
        : [false, false, false]

      const isAB = !['BB', 'HBP', 'SAC'].includes(ab.outcome)
      const isHit = ['1B', '2B', '3B', 'HR'].includes(ab.outcome)

      if (isAB) {
        totalAB++
        if (isHit) totalH++

        if (basesBefore[1] || basesBefore[2]) {
          rispAB++
          const p = ensurePlayer(ab.batter)
          p.AB++
          if (isHit) { rispH++; p.H++ }
        }
      }

      lastOurAtBatByHalf[`${ab.inning}-${ab.half}`] = ab
    })

    if (gameHasOurAtBat) lobGames++
    for (const key in lastOurAtBatByHalf) {
      lobTotal += lastOurAtBatByHalf[key].bases.filter(Boolean).length
    }

    for (const play of (game.playLog || [])) {
      if (play.type === 'putout' && (play.doublePlay || play.triplePlay) && play.batter) {
        gidpCount++
      }
    }
  }

  const fmtAvg = n => n.toFixed(3).replace(/^0/, '')

  const players = Object.entries(playerRisp)
    .map(([name, s]) => ({ name, rispAB: s.AB, rispH: s.H, rispAvg: fmtAvg(s.H / s.AB) }))
    .sort((a, b) => parseFloat(b.rispAvg) - parseFloat(a.rispAvg))

  return {
    team: {
      rispAB, rispH,
      rispAvg: rispAB > 0 ? fmtAvg(rispH / rispAB) : '.000',
      overallAvg: totalAB > 0 ? fmtAvg(totalH / totalAB) : '.000',
      lobTotal,
      lobPerGame: lobGames > 0 ? +(lobTotal / lobGames).toFixed(1) : 0,
      gidpCount,
    },
    players,
  }
}

// ── Optimal batting order: rank players by season performance ────────────
const MIN_AB_FOR_OWN_STATS = 5

export function computeOptimalBattingOrder(players, gamesInput) {
  const seasonStats = computeSeasonStats(gamesInput)
  const statsByName = Object.fromEntries(seasonStats.map(s => [s.name, s]))

  function blendedScore(name) {
    const s = statsByName[name]
    return (parseFloat(s.AVG) + parseFloat(s.OBP) + parseFloat(s.SLG)) / 3
  }

  function qualifies(name) {
    const s = statsByName[name]
    return !!s && s.AB >= MIN_AB_FOR_OWN_STATS
  }

  const qualifying = players.map(p => p.name).filter(qualifies)
  const avgScore = qualifying.length > 0
    ? qualifying.reduce((sum, n) => sum + blendedScore(n), 0) / qualifying.length
    : 0
  const avgObp = qualifying.length > 0
    ? qualifying.reduce((sum, n) => sum + parseFloat(statsByName[n].OBP), 0) / qualifying.length
    : 0

  const scoreFor = name => (qualifies(name) ? blendedScore(name) : avgScore)
  const obpFor = name => (qualifies(name) ? parseFloat(statsByName[name].OBP) : avgObp)

  function shapeStream(stream) {
    if (stream.length <= 1) return stream.slice()

    const working = stream.slice()

    // Leadoff: highest OBP. Ties keep the earliest player (strict `>`), so an
    // all-tied stream (nobody qualifies) leaves the original first player in front.
    let leadoffIdx = 0
    for (let i = 1; i < working.length; i++) {
      if (obpFor(working[i].name) > obpFor(working[leadoffIdx].name)) leadoffIdx = i
    }
    const leadoff = working.splice(leadoffIdx, 1)[0]

    // Last: lowest blended score. Ties keep the latest player (`<=`, not `<`) so
    // that an all-tied remainder collapses back to the true original last player —
    // this is what makes the "nobody qualifies" case a clean pass-through instead
    // of swapping the 2nd and last original players.
    let lastIdx = 0
    for (let i = 1; i < working.length; i++) {
      if (scoreFor(working[i].name) <= scoreFor(working[lastIdx].name)) lastIdx = i
    }
    const last = working.splice(lastIdx, 1)[0]

    const middle = working.sort((a, b) => scoreFor(b.name) - scoreFor(a.name))
    return [leadoff, ...middle, last]
  }

  const bbhShaped = shapeStream(players.filter(p => p.type === 'BBH'))
  const sbhShaped = shapeStream(players.filter(p => p.type === 'SBH'))

  const [first, second] = bbhShaped.length >= sbhShaped.length
    ? [bbhShaped, sbhShaped]
    : [sbhShaped, bbhShaped]

  const result = []
  for (let i = 0; i < Math.max(first.length, second.length); i++) {
    if (first[i]) result.push(first[i].name)
    if (second[i]) result.push(second[i].name)
  }
  return result
}

// ── BBH vs SBH aggregate batting stats ───────────────────────────────────
export function computeGroupStats() {
  const roster = getRoster()
  const typeMap = Object.fromEntries(roster.map(p => [p.name, p.type]))  // name → 'BBH'|'SBH'
  const season = computeSeasonStats()  // already computed; reuse

  const groups = { BBH: { AB: 0, H: 0, BB: 0, HR: 0, RBI: 0, K: 0, players: 0 },
                   SBH: { AB: 0, H: 0, BB: 0, HR: 0, RBI: 0, K: 0, players: 0 } }

  for (const p of season) {
    const type = typeMap[p.name]
    if (!type || !groups[type]) continue
    const g = groups[type]
    g.AB  += p.AB;  g.H   += p.H;   g.BB  += p.BB
    g.HR  += p.HR;  g.RBI += p.RBI; g.K   += p.K
    g.players++
  }

  return Object.entries(groups).map(([type, g]) => ({
    type,
    players: g.players,
    AB:  g.AB,
    H:   g.H,
    HR:  g.HR,
    RBI: g.RBI,
    BB:  g.BB,
    K:   g.K,
    AVG: g.AB > 0 ? (g.H / g.AB).toFixed(3).replace(/^0/, '') : '.000',
    OBP: (g.AB + g.BB) > 0 ? ((g.H + g.BB) / (g.AB + g.BB)).toFixed(3).replace(/^0/, '') : '.000',
  }))
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

// ── Mid-season player card ──────────────────────────────────────────────
const RATE_THRESHOLD = 0.050
const PCT_THRESHOLD = 5
const POSE_STATS = ['AVG', 'OBP', 'SLG', 'BBPct']

const OUT_TYPES_FOR_CARD = ['K', 'F', 'G', 'FC', 'SAC']
const MIN_OUTS_FOR_BREAKDOWN = 3
const MIN_ZONE_SAMPLE = 2
const ZONE_ORDER = ['Infield Left', 'Infield Center', 'Infield Right', 'Outfield Left', 'Outfield Center', 'Outfield Right']

function classifyZone(x, y) {
  const dx = x - FIELD_HOME[0]
  const dy = y - FIELD_HOME[1]
  const angle = Math.atan2(dx, -dy) * (180 / Math.PI) // 0deg = straight up the middle, + = toward right field
  const side = angle < -15 ? 'Left' : angle > 15 ? 'Right' : 'Center'
  const distFromMound = Math.hypot(x - 140, y - 200) // infield-dirt circle center, matches ScoresheetPage
  const depth = distFromMound <= 73 ? 'Infield' : 'Outfield' // matches ScoresheetPage's infield-dirt radius
  return `${depth} ${side}`
}

function computeSeasonSpray(playerName, games) {
  const dots = []
  for (const game of games) {
    for (const ab of (game.atBats || [])) {
      if (ab.batter !== playerName || ab.isOpponent || !ab.hitLocation) continue
      dots.push({
        x: ab.hitLocation.x, y: ab.hitLocation.y, outcome: ab.outcome,
        isHit: ['1B', '2B', '3B', 'HR'].includes(ab.outcome),
      })
    }
  }
  if (dots.length < MIN_AB_FOR_OWN_STATS) return { dots, bestZone: null, worstZone: null }

  const zoneStats = {}
  for (const dot of dots) {
    const zone = classifyZone(dot.x, dot.y)
    if (!zoneStats[zone]) zoneStats[zone] = { total: 0, hits: 0 }
    zoneStats[zone].total++
    if (dot.isHit) zoneStats[zone].hits++
  }

  const qualifying = ZONE_ORDER
    .filter(zone => zoneStats[zone] && zoneStats[zone].total >= MIN_ZONE_SAMPLE)
    .map(zone => ({ zone, ...zoneStats[zone], hitRate: zoneStats[zone].hits / zoneStats[zone].total }))

  if (qualifying.length === 0) return { dots, bestZone: null, worstZone: null }

  const byHitRateDesc = [...qualifying].sort((a, b) => b.hitRate - a.hitRate || b.hits - a.hits)
  const byHitRateAsc  = [...qualifying].sort((a, b) => a.hitRate - b.hitRate || (b.total - b.hits) - (a.total - a.hits))
  const topBest = byHitRateDesc[0]
  const topWorst = byHitRateAsc[0]

  if (topBest.zone === topWorst.zone) {
    return topBest.hitRate >= 0.5
      ? { dots, bestZone: topBest.zone, worstZone: null }
      : { dots, bestZone: null, worstZone: topWorst.zone }
  }
  return { dots, bestZone: topBest.zone, worstZone: topWorst.zone }
}

function computeOutBreakdown(playerName, games) {
  const counts = { K: 0, F: 0, G: 0, FC: 0, SAC: 0 }
  let total = 0
  for (const game of games) {
    for (const ab of (game.atBats || [])) {
      if (ab.batter !== playerName || ab.isOpponent) continue
      if (OUT_TYPES_FOR_CARD.includes(ab.outcome)) { counts[ab.outcome]++; total++ }
    }
  }
  const mostCommon = total >= MIN_OUTS_FOR_BREAKDOWN
    ? OUT_TYPES_FOR_CARD.reduce((best, t) => (counts[t] > counts[best] ? t : best), OUT_TYPES_FOR_CARD[0])
    : null
  return { counts, total, mostCommon }
}

const RATE_TIPS = {
  AVG:   { strength: 'Hitting well above the team average — keep it up.', needsWork: 'Batting average is below the team average — focus on solid contact.' },
  OBP:   { strength: 'Excellent at getting on base.', needsWork: 'On-base rate is below average — look for more pitches to work the count.' },
  SLG:   { strength: 'Strong extra-base power.', needsWork: 'Limited extra-base pop so far — look to drive the ball with authority.' },
  KPct:  { strength: 'Rarely strikes out — great plate discipline.', needsWork: 'Strikeout rate is high — see the ball, shorten the swing.' },
  BBPct: { strength: 'Draws a lot of walks — great eye at the plate.', needsWork: 'Rarely walks — work the count and be more selective.' },
}

export function computePlayerCard(playerName, gamesInput) {
  const games = gamesInput || getGames()
  const seasonStats = computeSeasonStats(games)
  const player = seasonStats.find(s => s.name === playerName)
  const roster = getRoster()
  const type = roster.find(p => p.name === playerName)?.type

  const G     = player?.G || 0
  const AB    = player?.AB || 0
  const AVG   = player?.AVG || '.000'
  const OBP   = player?.OBP || '.000'
  const SLG   = player?.SLG || '.000'
  const KPct  = player?.KPct || '0.0'
  const BBPct = player?.BBPct || '0.0'

  // Spray/out-type data doesn't depend on AB qualification, so it's computed once
  // up front and reused by both return paths below. Task 2 replaces these two
  // placeholders with real computation — no other line in this function changes.
  const spray = computeSeasonSpray(playerName, games)
  const outBreakdown = computeOutBreakdown(playerName, games)

  if (AB < MIN_AB_FOR_OWN_STATS) {
    return {
      name: playerName, type, qualifies: false,
      G, AB, AVG, OBP, SLG, KPct, BBPct,
      pose: 'ready',
      headlineStat: { key: 'AVG', value: AVG },
      strengths: [], needsWork: [], neutral: true,
      spray, outBreakdown,
    }
  }

  // Team-average baseline: same type, qualifying teammates only (includes this
  // player themselves if they qualify — matches computeGroupStats' existing
  // "all qualifying players of this type" semantics).
  const teammates = seasonStats.filter(s => {
    const t = roster.find(p => p.name === s.name)?.type
    return t === type && s.AB >= MIN_AB_FOR_OWN_STATS
  })

  let baseAB = 0, baseH = 0, baseBB = 0, baseK = 0, baseTB = 0
  for (const t of teammates) {
    const singles = t.H - t['2B'] - t['3B'] - t.HR
    baseTB += singles + t['2B'] * 2 + t['3B'] * 3 + t.HR * 4
    baseAB += t.AB; baseH += t.H; baseBB += t.BB; baseK += t.K
  }
  const baseline = {
    AVG:   baseAB > 0 ? baseH / baseAB : 0,
    OBP:   (baseAB + baseBB) > 0 ? (baseH + baseBB) / (baseAB + baseBB) : 0,
    SLG:   baseAB > 0 ? baseTB / baseAB : 0,
    KPct:  baseAB > 0 ? (baseK / baseAB) * 100 : 0,
    BBPct: (baseAB + baseBB) > 0 ? (baseBB / (baseAB + baseBB)) * 100 : 0,
  }

  const playerRates = {
    AVG: parseFloat(AVG), OBP: parseFloat(OBP), SLG: parseFloat(SLG),
    KPct: parseFloat(KPct), BBPct: parseFloat(BBPct),
  }

  // Severity = signedGap / threshold. Normalizes AVG/OBP/SLG (gaps ~0-0.3) against
  // KPct/BBPct (gaps ~0-50 points) onto a comparable scale before ranking — sorting
  // by raw gap would let KPct/BBPct dominate every ranking regardless of how
  // meaningful the AVG/OBP/SLG difference actually is.
  const rateStrengths = []
  const rateNeedsWork = []
  for (const stat of ['AVG', 'OBP', 'SLG', 'KPct', 'BBPct']) {
    const threshold = (stat === 'KPct' || stat === 'BBPct') ? PCT_THRESHOLD : RATE_THRESHOLD
    const inverted = stat === 'KPct' // lower is better
    const rawGap = playerRates[stat] - baseline[stat]
    const signedGap = inverted ? -rawGap : rawGap
    const severity = signedGap / threshold
    if (severity >= 1) rateStrengths.push({ stat, message: RATE_TIPS[stat].strength, severity })
    else if (severity <= -1) rateNeedsWork.push({ stat, message: RATE_TIPS[stat].needsWork, severity })
  }
  rateStrengths.sort((a, b) => b.severity - a.severity)
  rateNeedsWork.sort((a, b) => a.severity - b.severity)

  const strengths = rateStrengths.slice(0, 3).map(({ stat, message }) => ({ stat, message }))
  const needsWork = rateNeedsWork.slice(0, 3).map(({ stat, message }) => ({ stat, message }))

  // Pose uses the FULL uncapped rateStrengths list (not the display-capped
  // `strengths` above), restricted to the 4 pose-eligible stats — a non-pose stat
  // (KPct) crowding a pose-eligible stat out of the top-3 display cap must not
  // affect which pose gets picked.
  const poseEligible = rateStrengths.filter(s => POSE_STATS.includes(s.stat))
  const topPoseStat = poseEligible[0]?.stat
  let pose = 'ready'
  let headlineKey = 'AVG'
  if (topPoseStat === 'SLG') { pose = 'power'; headlineKey = 'SLG' }
  else if (topPoseStat === 'AVG') { pose = 'contact'; headlineKey = 'AVG' }
  else if (topPoseStat === 'OBP' || topPoseStat === 'BBPct') { pose = 'patient'; headlineKey = 'OBP' }
  const headlineValue = headlineKey === 'AVG' ? AVG : headlineKey === 'OBP' ? OBP : SLG

  if (spray.bestZone) strengths.push({ stat: 'SPRAY_BEST', message: `Best contact zone: ${spray.bestZone} — that's where most of your hits land.` })
  if (spray.worstZone) needsWork.push({ stat: 'SPRAY_WORST', message: `A lot of outs come on balls hit to ${spray.worstZone} — worth working on in BP.` })

  const neutral = strengths.length === 0 && needsWork.length === 0

  return {
    name: playerName, type, qualifies: true,
    G, AB, AVG, OBP, SLG, KPct, BBPct,
    pose,
    headlineStat: { key: headlineKey, value: headlineValue },
    strengths, needsWork, neutral,
    spray, outBreakdown,
  }
}
