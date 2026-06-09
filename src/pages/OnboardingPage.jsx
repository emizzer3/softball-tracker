import { useState } from 'react'
import { setTeamConfig, setPin, setDivision } from '../storage'

export default function OnboardingPage({ onComplete }) {
  const [teamName, setTeamName] = useState('')
  const [division, setDivision] = useState('')
  const [pin, setPinValue] = useState('')
  const [errors, setErrors] = useState({})

  function validate() {
    const e = {}
    if (!teamName.trim()) e.teamName = 'Team name is required'
    if (!division.trim()) e.division = 'Division is required'
    if (!pin || pin.length < 4 || !/^\d+$/.test(pin)) e.pin = 'PIN must be 4 or more digits'
    return e
  }

  function handleSubmit(ev) {
    ev.preventDefault()
    const errs = validate()
    if (Object.keys(errs).length > 0) { setErrors(errs); return }
    setTeamConfig({ name: teamName.trim(), division: division.trim(), setupComplete: true })
    setDivision(division.trim())
    setPin(pin)
    onComplete()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gray-50">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6">
          <svg viewBox="0 0 100 100" className="w-20 h-20 mx-auto mb-3" aria-label="Softball">
            <circle cx="50" cy="50" r="42" fill="#fef3c7" stroke="#1e40af" strokeWidth="2.5" />
            <path d="M 18 32 Q 50 56 82 32" stroke="#dc2626" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="3 4" />
            <path d="M 18 68 Q 50 44 82 68" stroke="#dc2626" strokeWidth="2" fill="none" strokeLinecap="round" strokeDasharray="3 4" />
          </svg>
          <h1 className="text-2xl font-black tracking-tight text-gray-800">Softball Tracker</h1>
          <p className="text-gray-500 text-sm mt-0.5">Let's get your team set up</p>
        </div>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow p-6 space-y-4">
          <div>
            <label htmlFor="teamName" className="block text-sm text-gray-600 mb-1">Team name</label>
            <input
              id="teamName"
              value={teamName}
              onChange={e => setTeamName(e.target.value)}
              placeholder="e.g. The Renegades"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {errors.teamName && <p className="text-red-500 text-xs mt-1">{errors.teamName}</p>}
          </div>

          <div>
            <label htmlFor="division" className="block text-sm text-gray-600 mb-1">Division / league</label>
            <input
              id="division"
              value={division}
              onChange={e => setDivision(e.target.value)}
              placeholder="e.g. Bristol Division 2"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {errors.division && <p className="text-red-500 text-xs mt-1">{errors.division}</p>}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
            ℹ️ This app is for <strong>mixed co-ed slow-pitch softball</strong> with strict BBH/SBH batting order alternation. The co-ed walk rule applies (BBH walks to 2B).
          </div>

          <div>
            <label htmlFor="pin" className="block text-sm text-gray-600 mb-1">Admin PIN (4+ digits)</label>
            <input
              id="pin"
              type="password"
              inputMode="numeric"
              value={pin}
              onChange={e => setPinValue(e.target.value)}
              placeholder="••••"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            />
            {errors.pin && <p className="text-red-500 text-xs mt-1">{errors.pin}</p>}
          </div>

          <button
            type="submit"
            className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2.5 rounded-xl transition-colors"
          >
            Set up my team →
          </button>

          <p className="text-center text-xs text-gray-400">You can update all of this later in Admin settings</p>
        </form>
      </div>
    </div>
  )
}
