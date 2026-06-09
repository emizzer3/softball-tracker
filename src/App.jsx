import { useState } from 'react'
import AdminPage from './pages/AdminPage'
import GameSetupPage from './pages/GameSetupPage'
import TrackerPage from './pages/TrackerPage'
import ScoresheetPage from './pages/ScoresheetPage'
import SummaryPage from './pages/SummaryPage'
import SeasonStatsPage from './pages/SeasonStatsPage'
import OnboardingPage from './pages/OnboardingPage'
import { saveGame, getActiveGame, clearActiveGame, getSchedule, saveSetupDraft, getSetupDraft, getAllSetupDrafts, getTeamConfig, setTeamConfig, getDivision } from './storage'
import { Settings, Plus, BarChart2, CalendarDays, ChevronRight } from 'lucide-react'

const P = { HOME: 'home', ADMIN: 'admin', SETUP: 'setup', TRACKER: 'tracker', SCORESHEET: 'scoresheet', SUMMARY: 'summary', SEASON: 'season' }

function HomePage({ onNav, onFixtureClick }) {
  const activeGame = getActiveGame()
  const upcoming = getSchedule().filter(g => g.date >= new Date().toISOString().split('T')[0]).slice(0, 3)
  const drafts = getAllSetupDrafts()

  return (
    <div className="max-w-lg mx-auto p-4 pb-24">
      <div className="text-center py-6">
        {/* Generic softball logo — inline SVG so it's crisp at any size */}
        <svg
          viewBox="0 0 100 100"
          className="w-24 h-24 mx-auto mb-3 drop-shadow-sm"
          aria-label="Softball Tracker"
        >
          {/* Ball */}
          <circle cx="50" cy="50" r="42" fill="#fef3c7" stroke="#1e40af" strokeWidth="2.5" />
          {/* Two arcing stitch lines — classic softball look */}
          <path
            d="M 18 32 Q 50 56 82 32"
            stroke="#dc2626" strokeWidth="2" fill="none" strokeLinecap="round"
            strokeDasharray="3 4"
          />
          <path
            d="M 18 68 Q 50 44 82 68"
            stroke="#dc2626" strokeWidth="2" fill="none" strokeLinecap="round"
            strokeDasharray="3 4"
          />
        </svg>
        <h1 className="text-2xl font-black tracking-tight text-gray-800">Softball Tracker</h1>
        <p className="text-gray-400 text-xs mt-0.5">Mixed recreational slow-pitch</p>
      </div>

      <div className="space-y-3">
        {activeGame && (
          <button onClick={() => onNav(P.TRACKER, activeGame)} className="card w-full text-left flex items-center gap-3 border-2 border-amber-400 bg-amber-50">
            <span className="text-3xl">▶️</span>
            <div>
              <p className="font-bold text-amber-800">Resume Game</p>
              <p className="text-xs text-amber-700">{activeGame.setup?.away} @ {activeGame.setup?.home} · In progress</p>
            </div>
          </button>
        )}

        {upcoming.length > 0 && (
          <div className="card p-3">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1">
              <CalendarDays size={12} /> Upcoming
            </p>
            <ul className="space-y-2">
              {upcoming.map(g => {
                const hasDraft = !!drafts[`fixture-${g.id}`]
                return (
                  <li key={g.id}
                    onClick={() => onFixtureClick(g)}
                    className="flex items-center gap-2 cursor-pointer hover:bg-blue-50 active:bg-blue-100 rounded-lg transition-colors -mx-1 px-1 py-0.5"
                  >
                    <div className="text-center bg-blue-50 rounded px-2 py-1 min-w-10 shrink-0">
                      <p className="text-xs font-bold text-blue-700">{new Date(g.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate flex items-center gap-1.5">
                        vs {g.opponent}
                        {hasDraft && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-700 font-bold px-1.5 py-0.5 rounded-full">📝 Setup saved</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-500">
                        {g.location === 'Home' ? '🏠 Home' : g.location === 'Away' ? '✈️ Away' : ''}
                        {g.pitch ? (g.location ? ' · ' : '') + `Pitch ${g.pitch}` : ''}
                        {g.time ? ((g.location || g.pitch) ? ' · ' : '') + g.time : ''}
                      </p>
                    </div>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded shrink-0">{g.gameType || 'Game'}</span>
                    <ChevronRight size={14} className="text-gray-300 shrink-0" />
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        <button onClick={() => onNav(P.SETUP)} className="card w-full text-left flex items-center gap-3 hover:bg-gray-50 transition-colors">
          <Plus size={28} className="text-green-600 shrink-0" />
          <div>
            <p className="font-bold">New Game</p>
            <p className="text-xs text-gray-500">Set up teams, players, and batting order</p>
          </div>
        </button>

        <button onClick={() => onNav(P.SEASON)} className="card w-full text-left flex items-center gap-3 hover:bg-gray-50 transition-colors">
          <BarChart2 size={28} className="text-blue-600 shrink-0" />
          <div>
            <p className="font-bold">Season Stats</p>
            <p className="text-xs text-gray-500">Cumulative stats and game history</p>
          </div>
        </button>

        <button onClick={() => onNav(P.ADMIN)} className="card w-full text-left flex items-center gap-3 hover:bg-gray-50 transition-colors">
          <Settings size={28} className="text-gray-500 shrink-0" />
          <div>
            <p className="font-bold">Admin · Roster</p>
            <p className="text-xs text-gray-500">Manage players, league settings · PIN required</p>
          </div>
        </button>
      </div>
    </div>
  )
}

// Auto-migrate existing installs: if roster data exists but no team config,
// silently create the Renegades config so the onboarding wizard is skipped.
// Must be a pure module-level function (not inline) to satisfy React's rules
// for useState lazy initializers (no side effects inside the initializer).
function initAndMigrate() {
  const hasRoster = localStorage.getItem('sft_roster') !== null
  const hasTeam = localStorage.getItem('sft_team') !== null
  if (hasRoster && !hasTeam) {
    setTeamConfig({
      name: 'The Renegades',
      division: getDivision() || 'Bristol Division 2',
      setupComplete: true,
    })
  }
  return !!getTeamConfig()?.setupComplete
}

export default function App() {
  const [onboarded, setOnboarded] = useState(initAndMigrate)

  if (!onboarded) {
    return <OnboardingPage onComplete={() => setOnboarded(true)} />
  }

  const [page, setPage] = useState(P.HOME)
  const [currentSetup, setCurrentSetup] = useState(null)
  const [savedState, setSavedState] = useState(null)
  const [finishedGame, setFinishedGame] = useState(null)
  const [draftKey, setDraftKey] = useState('default')

  function handleNav(p, data) {
    if (p === P.TRACKER && data?.setup) {
      setCurrentSetup(data.setup)
      setSavedState(data)
    }
    if (p === P.SETUP) {
      setDraftKey('default')
    }
    setPage(p)
  }

  function handleFixtureSetup(fixture) {
    // Each fixture gets its own draft slot so multiple games can be staged
    const key = `fixture-${fixture.id}`
    setDraftKey(key)
    // If there's already a saved draft for this fixture, KEEP it — don't overwrite.
    // Otherwise seed a fresh draft from the fixture metadata.
    if (getSetupDraft(key)) {
      setPage(P.SETUP)
      return
    }
    const isLeague = fixture.gameType === 'League'
    saveSetupDraft(key, {
      fixtureId:  fixture.id,
      opponentLabel: fixture.opponent,
      date:       fixture.date,
      gameType:   fixture.gameType || 'League',
      weAreHome:  fixture.location === 'Home',
      oppTeam:    isLeague ? fixture.opponent : '',
      oppOther:   '',
      oppFree:    isLeague ? '' : fixture.opponent,
      tournamentName: '',
      pitch:      fixture.pitch || null,
      detailsOk:  false,
      selected: [], ringers: [], playersOk: false,
      order: [], orderOk: false,
      dhBBH: '', dhSBH: '',
      fieldingLineup: {}, fieldingOk: false,
    })
    setPage(P.SETUP)
  }

  function handleGameStart(setup) {
    setCurrentSetup(setup)
    setSavedState(null)
    setPage(P.TRACKER)
  }

  function handleGameEnd(completedGame) {
    // Determine W/L/D from our perspective
    const { homeScore, awayScore, weAreHome } = completedGame
    const ourScore  = weAreHome !== false ? homeScore : awayScore
    const theirScore = weAreHome !== false ? awayScore : homeScore
    const result = ourScore > theirScore ? 'W' : ourScore < theirScore ? 'L' : 'D'
    const gameWithResult = { ...completedGame, result }
    saveGame(gameWithResult)
    clearActiveGame()
    setFinishedGame(gameWithResult)
    setCurrentSetup(null)
    setPage(P.SCORESHEET)
  }

  const activeGame = getActiveGame()
  const hasActiveGame = !!(currentSetup || activeGame)

  // Nav is always visible except on scoresheet/summary (post-game review)
  const showNav = ![P.SCORESHEET, P.SUMMARY].includes(page)

  function handleTrackerTab() {
    // Always re-read the freshest active game from localStorage so the tracker
    // resumes from the latest play, even if the user navigated away mid-game.
    const fresh = getActiveGame()
    if (fresh) {
      setCurrentSetup(fresh.setup)
      setSavedState(fresh)
      setPage(P.TRACKER)
    } else if (currentSetup) {
      setPage(P.TRACKER)
    } else {
      setDraftKey('default')
      setPage(P.SETUP)
    }
  }

  return (
    <>
      {page === P.HOME       && <HomePage onNav={handleNav} onFixtureClick={handleFixtureSetup} />}
      {page === P.ADMIN      && <AdminPage onBack={() => setPage(P.HOME)} />}
      {page === P.SETUP      && <GameSetupPage draftKey={draftKey} onStart={handleGameStart} onBack={() => setPage(P.HOME)} />}
      {page === P.TRACKER    && currentSetup && (
        <TrackerPage setup={currentSetup} savedState={savedState} onEnd={handleGameEnd} onBack={() => setPage(P.HOME)} />
      )}
      {page === P.TRACKER    && !currentSetup && (
        <div className="max-w-lg mx-auto p-8 text-center text-gray-400 mt-16">
          <p className="text-5xl mb-4">🎮</p>
          <p className="font-semibold text-lg mb-1">No game in progress</p>
          <p className="text-sm mb-6">Set up a new game first, then come back here to track it.</p>
          <button onClick={() => { setDraftKey('default'); setPage(P.SETUP) }} className="btn btn-primary btn-md">Go to Setup</button>
        </div>
      )}
      {page === P.SCORESHEET && finishedGame && (
        <ScoresheetPage
          game={finishedGame}
          onHome={() => setPage(P.HOME)}
          onSummary={() => setPage(P.SUMMARY)}
        />
      )}
      {page === P.SUMMARY    && finishedGame && (
        <SummaryPage
          game={finishedGame}
          onHome={() => setPage(P.HOME)}
          onScoresheet={() => setPage(P.SCORESHEET)}
        />
      )}
      {page === P.SEASON     && (
        <SeasonStatsPage
          onHome={() => setPage(P.HOME)}
          onViewGame={g => { setFinishedGame(g); setPage(P.SCORESHEET) }}
        />
      )}

      {showNav && (
        <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex justify-around z-40 no-print pb-safe">
          {[
            { p: P.HOME,    icon: '⚾',                   label: 'Home',    action: () => setPage(P.HOME) },
            { p: P.SETUP,   icon: <Plus size={20} />,     label: 'Setup',   action: () => { setDraftKey('default'); setPage(P.SETUP) } },
            { p: P.TRACKER, icon: <span className="relative inline-block">
                🎮
                {hasActiveGame && <span className="absolute -top-0.5 -right-1.5 w-2 h-2 bg-green-500 rounded-full border border-white" />}
              </span>,                                     label: 'Tracker', action: handleTrackerTab },
            { p: P.SEASON,  icon: <BarChart2 size={20} />,label: 'Stats',   action: () => setPage(P.SEASON) },
            { p: P.ADMIN,   icon: <Settings size={20} />, label: 'Admin',   action: () => setPage(P.ADMIN) },
          ].map(({ p, icon, label, action }) => (
            <button
              key={p}
              onClick={action}
              className={`flex flex-col items-center py-2 px-3 text-xs font-medium transition-colors ${page === p ? 'text-blue-600' : 'text-gray-500'}`}
            >
              <span className="mb-0.5">{icon}</span>
              {label}
            </button>
          ))}
        </nav>
      )}
    </>
  )
}
