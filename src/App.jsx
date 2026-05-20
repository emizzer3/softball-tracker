import { useState } from 'react'
import AdminPage from './pages/AdminPage'
import GameSetupPage from './pages/GameSetupPage'
import TrackerPage from './pages/TrackerPage'
import ScoresheetPage from './pages/ScoresheetPage'
import SummaryPage from './pages/SummaryPage'
import SeasonStatsPage from './pages/SeasonStatsPage'
import { saveGame, getActiveGame, clearActiveGame } from './storage'
import { Settings, Plus, BarChart2 } from 'lucide-react'

const P = { HOME: 'home', ADMIN: 'admin', SETUP: 'setup', TRACKER: 'tracker', SCORESHEET: 'scoresheet', SUMMARY: 'summary', SEASON: 'season' }

function HomePage({ onNav }) {
  const activeGame = getActiveGame()

  return (
    <div className="max-w-lg mx-auto p-4 pb-24">
      <div className="text-center py-8">
        <p className="text-6xl mb-3">⚾</p>
        <h1 className="text-3xl font-black mb-1">Softball Tracker</h1>
        <p className="text-gray-500 text-sm">Mixed recreational slow-pitch</p>
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
            <p className="text-xs text-gray-500">Manage players · PIN required</p>
          </div>
        </button>
      </div>
    </div>
  )
}

export default function App() {
  const [page, setPage] = useState(P.HOME)
  const [currentSetup, setCurrentSetup] = useState(null)
  const [savedState, setSavedState] = useState(null)
  const [finishedGame, setFinishedGame] = useState(null)

  function handleNav(p, data) {
    if (p === P.TRACKER && data?.setup) {
      setCurrentSetup(data.setup)
      setSavedState(data)
    }
    setPage(p)
  }

  function handleGameStart(setup) {
    setCurrentSetup(setup)
    setSavedState(null)
    setPage(P.TRACKER)
  }

  function handleGameEnd(completedGame) {
    saveGame(completedGame)
    clearActiveGame()
    setFinishedGame(completedGame)
    setCurrentSetup(null)
    setPage(P.SCORESHEET)
  }

  const showNav = [P.HOME, P.SETUP, P.SEASON, P.ADMIN].includes(page)

  return (
    <>
      {page === P.HOME       && <HomePage onNav={handleNav} />}
      {page === P.ADMIN      && <AdminPage onBack={() => setPage(P.HOME)} />}
      {page === P.SETUP      && <GameSetupPage onStart={handleGameStart} onBack={() => setPage(P.HOME)} />}
      {page === P.TRACKER    && currentSetup && (
        <TrackerPage setup={currentSetup} savedState={savedState} onEnd={handleGameEnd} />
      )}
      {page === P.SCORESHEET && finishedGame && (
        <ScoresheetPage game={finishedGame} onHome={() => setPage(P.HOME)} />
      )}
      {page === P.SUMMARY    && finishedGame && (
        <SummaryPage game={finishedGame} onHome={() => setPage(P.HOME)} />
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
            { p: P.HOME,   icon: '⚾', label: 'Home' },
            { p: P.SETUP,  icon: <Plus size={20} />, label: 'New Game' },
            { p: P.SEASON, icon: <BarChart2 size={20} />, label: 'Stats' },
            { p: P.ADMIN,  icon: <Settings size={20} />, label: 'Admin' },
          ].map(({ p, icon, label }) => (
            <button
              key={p}
              onClick={() => setPage(p)}
              className={`flex flex-col items-center py-2 px-4 text-xs font-medium transition-colors ${page === p ? 'text-blue-600' : 'text-gray-500'}`}
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
