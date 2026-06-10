import { useState } from 'react'
import { getTeamConfig, setTeamConfig } from '../storage'
import { createTeam, pushAllLocalData, loadTeamByShortId } from '../sync'

export default function CloudConnectPage({ onComplete }) {
  const config = getTeamConfig()
  const [mode, setMode] = useState(null) // null | 'create'
  const [pin, setPin] = useState('')
  const [shortId, setShortId] = useState('')
  const [loadPin, setLoadPin] = useState('')
  const [createError, setCreateError] = useState('')
  const [loadError, setLoadError] = useState('')
  const [loading, setLoading] = useState(false)

  function handleSkip() {
    setTeamConfig({ ...config, teamId: 'local' })
    onComplete()
  }

  async function handleCreate(e) {
    e.preventDefault()
    setCreateError('')
    if (!pin || pin.length < 4 || !/^\d+$/.test(pin)) {
      setCreateError('PIN must be at least 4 digits')
      return
    }
    setLoading(true)
    try {
      const { teamId, shortId: newShortId } = await createTeam({
        name: config.name,
        division: config.division,
        pin,
      })
      await pushAllLocalData(teamId)
      setTeamConfig({ ...config, teamId, shortId: newShortId })
      onComplete()
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setLoading(false)
    }
  }

  async function handleLoad(e) {
    e.preventDefault()
    setLoadError('')
    if (!shortId.trim()) { setLoadError('Enter your Team ID'); return }
    if (!loadPin) { setLoadError('Enter your PIN'); return }
    setLoading(true)
    try {
      const result = await loadTeamByShortId(shortId, loadPin)
      setTeamConfig({ ...config, teamId: result.teamId, shortId: result.shortId })
      onComplete()
    } catch (err) {
      setLoadError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="card w-full max-w-sm">
        <div className="text-center mb-6">
          <div className="text-4xl mb-2">☁️</div>
          <h2 className="text-xl font-bold">Set up cloud sync</h2>
          <p className="text-sm text-gray-500 mt-1">
            Access your data from any device using a Team ID and PIN.
          </p>
        </div>

        {/* Create a new team */}
        {mode === 'create' ? (
          <form onSubmit={handleCreate} className="space-y-3 mb-4">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
              Team: <strong>{config?.name}</strong> · {config?.division}
            </div>
            <div>
              <label htmlFor="cloud-pin" className="label">Admin PIN (4+ digits)</label>
              <input
                id="cloud-pin"
                type="password"
                inputMode="numeric"
                className="input"
                placeholder="••••"
                maxLength={8}
                value={pin}
                onChange={e => { setPin(e.target.value); setCreateError('') }}
                autoFocus
              />
            </div>
            {createError && <p className="text-red-600 text-sm">{createError}</p>}
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-md w-full"
            >
              {loading ? 'Creating…' : 'Set up cloud sync →'}
            </button>
            <button
              type="button"
              onClick={() => { setMode(null); setCreateError('') }}
              className="btn btn-ghost btn-sm w-full"
            >
              Cancel
            </button>
          </form>
        ) : (
          <>
            {/* Create button (null mode) */}
            <div className="mb-4">
              <button
                onClick={() => { setMode('create'); setCreateError('') }}
                className="btn btn-primary btn-md w-full"
              >
                Create a new team
              </button>
            </div>

            {/* Load existing team — always visible in null mode */}
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-3">Load existing team</p>
              <form onSubmit={handleLoad} className="space-y-3">
                <div>
                  <label htmlFor="cloud-short-id" className="label">Team ID</label>
                  <input
                    id="cloud-short-id"
                    className="input uppercase"
                    placeholder="e.g. RNG-4821"
                    value={shortId}
                    onChange={e => { setShortId(e.target.value); setLoadError('') }}
                  />
                </div>
                <div>
                  <label htmlFor="cloud-load-pin" className="label">PIN</label>
                  <input
                    id="cloud-load-pin"
                    type="password"
                    inputMode="numeric"
                    className="input"
                    placeholder="••••"
                    maxLength={8}
                    value={loadPin}
                    onChange={e => { setLoadPin(e.target.value); setLoadError('') }}
                  />
                </div>
                {loadError && <p className="text-red-600 text-sm">{loadError}</p>}
                <button
                  type="submit"
                  disabled={loading}
                  className="btn btn-ghost btn-md w-full border border-gray-200"
                >
                  {loading ? 'Loading…' : 'Load team →'}
                </button>
              </form>
            </div>

            {/* Skip */}
            <button
              onClick={handleSkip}
              className="text-xs text-gray-400 hover:text-gray-600 w-full text-center py-2 transition-colors"
            >
              Continue without cloud sync
            </button>
          </>
        )}
      </div>
    </div>
  )
}
