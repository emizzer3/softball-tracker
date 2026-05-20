import { useState } from 'react'
import { Lock, Plus, Trash2, ToggleLeft, ToggleRight, KeyRound, ChevronLeft, Trophy } from 'lucide-react'
import { getRoster, addPlayer, updatePlayer, removePlayer, checkPin, setPin, getDivision, setDivision, getTeams, addTeam, removeTeam } from '../storage'

function PinGate({ onUnlock }) {
  const [pin, setPin] = useState('')
  const [err, setErr] = useState('')

  function submit(e) {
    e.preventDefault()
    if (checkPin(pin)) onUnlock()
    else { setErr('Wrong PIN'); setPin('') }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="card w-full max-w-xs text-center">
        <Lock className="mx-auto mb-3 text-blue-600" size={36} />
        <h2 className="text-xl font-bold mb-1">Admin Access</h2>
        <p className="text-sm text-gray-500 mb-4">Enter your PIN to manage the roster</p>
        <form onSubmit={submit} className="space-y-3">
          <input
            className="input text-center text-2xl tracking-widest"
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={pin}
            onChange={e => { setPin(e.target.value); setErr('') }}
            placeholder="••••"
            autoFocus
          />
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <button type="submit" className="btn btn-primary btn-md w-full">Unlock</button>
        </form>
      </div>
    </div>
  )
}

function AddPlayerForm({ onAdd }) {
  const [name, setName] = useState('')
  const [type, setType] = useState('BBH')

  function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    onAdd(name.trim(), type)
    setName('')
    setType('BBH')
  }

  return (
    <form onSubmit={submit} className="card mb-4">
      <h3 className="font-semibold mb-3 flex items-center gap-2"><Plus size={18} /> Add Player</h3>
      <div className="flex gap-2 mb-2">
        <input className="input flex-1" placeholder="Player name" value={name} onChange={e => setName(e.target.value)} />
        <select className="input w-24" value={type} onChange={e => setType(e.target.value)}>
          <option value="BBH">BBH</option>
          <option value="SBH">SBH</option>
        </select>
      </div>
      <p className="text-xs text-gray-500 mb-3">BBH = Big Bat Hitter · SBH = Small Bat Hitter</p>
      <button type="submit" className="btn btn-success btn-sm w-full">Add to Roster</button>
    </form>
  )
}

function ChangePinForm() {
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [msg, setMsg] = useState(null)

  function submit(e) {
    e.preventDefault()
    if (!checkPin(cur)) { setMsg({ type: 'error', text: 'Current PIN is wrong' }); return }
    if (next.length < 4) { setMsg({ type: 'error', text: 'New PIN must be at least 4 digits' }); return }
    if (next !== confirm) { setMsg({ type: 'error', text: 'PINs do not match' }); return }
    setPin(next)
    setMsg({ type: 'success', text: 'PIN updated' })
    setCur(''); setNext(''); setConfirm('')
  }

  return (
    <form onSubmit={submit} className="card mt-4">
      <h3 className="font-semibold mb-3 flex items-center gap-2"><KeyRound size={18} /> Change PIN</h3>
      <div className="space-y-2 mb-3">
        {[['Current PIN', cur, setCur], ['New PIN', next, setNext], ['Confirm New PIN', confirm, setConfirm]].map(([label, val, fn]) => (
          <div key={label}>
            <label className="label">{label}</label>
            <input className="input" type="password" inputMode="numeric" maxLength={8} value={val} onChange={e => fn(e.target.value)} />
          </div>
        ))}
      </div>
      {msg && <p className={`text-sm mb-2 ${msg.type === 'error' ? 'text-red-600' : 'text-green-600'}`}>{msg.text}</p>}
      <button type="submit" className="btn btn-warning btn-sm w-full">Update PIN</button>
    </form>
  )
}

function LeagueSettings() {
  const [division, setDiv] = useState(getDivision)
  const [divSaved, setDivSaved] = useState(false)
  const [teams, setTeams] = useState(getTeams)
  const [newTeam, setNewTeam] = useState('')

  function saveDivision() {
    setDivision(division)
    setDivSaved(true)
    setTimeout(() => setDivSaved(false), 1500)
  }

  function handleAddTeam(e) {
    e.preventDefault()
    const name = newTeam.trim()
    if (!name || teams.includes(name)) return
    setTeams(addTeam(name))
    setNewTeam('')
  }

  function handleRemoveTeam(name) {
    setTeams(removeTeam(name))
  }

  return (
    <div className="card mb-4">
      <h3 className="font-semibold mb-3 flex items-center gap-2"><Trophy size={18} /> League Settings</h3>

      {/* Division */}
      <div className="mb-4">
        <label className="label">Division / League Name</label>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="e.g. Bristol Softball Division 1"
            value={division}
            onChange={e => { setDiv(e.target.value); setDivSaved(false) }}
          />
          <button onClick={saveDivision} className={`btn btn-sm ${divSaved ? 'btn-success' : 'btn-warning'} shrink-0`}>
            {divSaved ? '✓ Saved' : 'Save'}
          </button>
        </div>
      </div>

      {/* Teams */}
      <div>
        <label className="label">Opponent Teams</label>
        <ul className="divide-y divide-gray-100 mb-2">
          {teams.map(t => (
            <li key={t} className="flex items-center gap-2 py-1.5">
              <span className="flex-1 text-sm">{t}</span>
              <button onClick={() => handleRemoveTeam(t)} className="btn btn-ghost btn-sm p-1 text-red-400">
                <Trash2 size={14} />
              </button>
            </li>
          ))}
        </ul>
        <form onSubmit={handleAddTeam} className="flex gap-2">
          <input
            className="input flex-1 text-sm"
            placeholder="Add team name…"
            value={newTeam}
            onChange={e => setNewTeam(e.target.value)}
          />
          <button type="submit" className="btn btn-success btn-sm shrink-0">
            <Plus size={14} /> Add
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-1">These appear in the Home / Away dropdowns when setting up a game. "Other" is always available.</p>
      </div>
    </div>
  )
}

export default function AdminPage({ onBack }) {
  const [unlocked, setUnlocked] = useState(false)
  const [roster, setRoster] = useState(getRoster)

  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />

  function handleAdd(name, type) { setRoster(addPlayer(name, type)) }
  function handleToggle(id) { setRoster(updatePlayer(id, { active: !roster.find(p => p.id === id).active })) }
  function handleRemove(id) {
    if (!confirm('Remove this player from the roster?')) return
    setRoster(removePlayer(id))
  }
  function handleTypeToggle(id, type) { setRoster(updatePlayer(id, { type: type === 'BBH' ? 'SBH' : 'BBH' })) }

  const bbh = roster.filter(p => p.type === 'BBH')
  const sbh = roster.filter(p => p.type === 'SBH')

  return (
    <div className="max-w-lg mx-auto p-4 pb-24">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="btn btn-ghost btn-sm"><ChevronLeft size={16} /> Back</button>
        <h1 className="text-xl font-bold">Admin</h1>
      </div>

      <LeagueSettings />

      <AddPlayerForm onAdd={handleAdd} />

      {[['BBH — Big Bat Hitters', bbh, 'badge-bbh'], ['SBH — Small Bat Hitters', sbh, 'badge-sbh']].map(([title, players, badge]) => (
        <div key={title} className="card mb-3">
          <h3 className="font-semibold text-sm text-gray-500 mb-2">{title}</h3>
          <ul className="divide-y divide-gray-100">
            {players.map(p => (
              <li key={p.id} className="flex items-center gap-2 py-2">
                <span className={`font-medium flex-1 ${!p.active ? 'text-gray-400 line-through' : ''}`}>{p.name}</span>
                <button
                  className="btn btn-ghost btn-sm text-xs"
                  onClick={() => handleTypeToggle(p.id, p.type)}
                  title="Toggle BBH/SBH"
                >
                  <span className={badge}>{p.type}</span>
                </button>
                <button onClick={() => handleToggle(p.id)} className="btn btn-ghost btn-sm p-1" title={p.active ? 'Mark inactive' : 'Mark active'}>
                  {p.active
                    ? <ToggleRight size={22} className="text-green-500" />
                    : <ToggleLeft size={22} className="text-gray-400" />}
                </button>
                <button onClick={() => handleRemove(p.id)} className="btn btn-ghost btn-sm p-1 text-red-400">
                  <Trash2 size={16} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      ))}

      <p className="text-xs text-gray-400 text-center mb-1">
        {roster.filter(p => p.active).length} active · {roster.filter(p => !p.active).length} inactive
      </p>

      <ChangePinForm />
    </div>
  )
}
