import { useState, useRef } from 'react'
import { Lock, Plus, Trash2, ToggleLeft, ToggleRight, KeyRound, ChevronLeft, Trophy, Download, Upload, CalendarDays } from 'lucide-react'
import { getRoster, addPlayer, updatePlayer, removePlayer, checkPin, setPin, getDivision, setDivision, getTeams, addTeam, removeTeam, exportAllData, importAllData, getSchedule, addFixture, removeFixture, getTeamConfig } from '../storage'
import { pushKey } from '../sync'

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
    pushKey('sft_division').catch(console.warn)
    setDivSaved(true)
    setTimeout(() => setDivSaved(false), 1500)
  }

  function handleAddTeam(e) {
    e.preventDefault()
    const name = newTeam.trim()
    if (!name || teams.includes(name)) return
    setTeams(addTeam(name))
    pushKey('sft_teams').catch(console.warn)
    setNewTeam('')
  }

  function handleRemoveTeam(name) {
    setTeams(removeTeam(name))
    pushKey('sft_teams').catch(console.warn)
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

const GAME_TYPES_SCHEDULE = ['League', 'Friendly', 'Tournament', 'Training', 'Cup']

function ScheduleSection() {
  const [fixtures, setFixtures] = useState(getSchedule)
  const [date, setDate]       = useState('')
  const [opponent, setOpponent] = useState('')
  const [time, setTime]       = useState('')
  const [location, setLocation] = useState('')
  const [gameType, setGameType] = useState('League')

  function handleAdd(e) {
    e.preventDefault()
    if (!date || !opponent.trim()) return
    setFixtures(addFixture({ date, opponent: opponent.trim(), time, location, gameType }))
    pushKey('sft_schedule').catch(console.warn)
    setOpponent('')
    setTime('')
    setLocation('')
    setDate('')
    setGameType('League')
  }

  function handleRemove(id) {
    setFixtures(removeFixture(id))
    pushKey('sft_schedule').catch(console.warn)
  }

  const today = new Date().toISOString().split('T')[0]
  const upcoming = fixtures.filter(f => f.date >= today)
  const past     = fixtures.filter(f => f.date < today)

  return (
    <div className="card mb-4">
      <h3 className="font-semibold mb-3 flex items-center gap-2"><CalendarDays size={18} /> Schedule / Fixtures</h3>
      <p className="text-xs text-gray-500 mb-3">
        Upcoming fixtures appear on the home screen. Past fixtures are kept for reference.
      </p>

      {/* Add fixture form */}
      <form onSubmit={handleAdd} className="space-y-2 mb-4 bg-gray-50 rounded-lg p-3">
        <p className="text-xs font-semibold text-gray-600 mb-1">Add fixture</p>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="label">Date</label>
            <input type="date" className="input text-sm" value={date} onChange={e => setDate(e.target.value)} required />
          </div>
          <div className="w-24">
            <label className="label">Time</label>
            <input type="time" className="input text-sm" value={time} onChange={e => setTime(e.target.value)} placeholder="Optional" />
          </div>
        </div>
        <div>
          <label className="label">Opponent</label>
          <input className="input text-sm" placeholder="e.g. Bristol Bulls" value={opponent} onChange={e => setOpponent(e.target.value)} required />
        </div>
        <div className="flex gap-2">
          <div className="flex-1">
            <label className="label">Location (optional)</label>
            <input className="input text-sm" placeholder="e.g. Ashton Gate" value={location} onChange={e => setLocation(e.target.value)} />
          </div>
          <div className="w-28">
            <label className="label">Type</label>
            <select className="input text-sm" value={gameType} onChange={e => setGameType(e.target.value)}>
              {GAME_TYPES_SCHEDULE.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <button type="submit" className="btn btn-success btn-sm w-full gap-1">
          <Plus size={14} /> Add to Schedule
        </button>
      </form>

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <div className="mb-3">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Upcoming</p>
          <ul className="divide-y divide-gray-100">
            {upcoming.map(f => (
              <li key={f.id} className="flex items-center gap-2 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">
                    vs {f.opponent}
                    <span className="ml-2 text-xs font-normal bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">{f.gameType}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    {new Date(f.date + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}
                    {f.time ? ' · ' + f.time : ''}
                    {f.location ? ' · ' + f.location : ''}
                  </p>
                </div>
                <button onClick={() => handleRemove(f.id)} className="btn btn-ghost btn-sm p-1 text-red-400"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Past */}
      {past.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">Past fixtures</p>
          <ul className="divide-y divide-gray-100">
            {past.slice().reverse().map(f => (
              <li key={f.id} className="flex items-center gap-2 py-1.5 opacity-60">
                <div className="flex-1 min-w-0">
                  <p className="text-sm">vs {f.opponent}</p>
                  <p className="text-xs text-gray-500">
                    {new Date(f.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}
                    {f.location ? ' · ' + f.location : ''}
                  </p>
                </div>
                <button onClick={() => handleRemove(f.id)} className="btn btn-ghost btn-sm p-1 text-red-400"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {fixtures.length === 0 && (
        <p className="text-xs text-gray-400 text-center py-2">No fixtures added yet.</p>
      )}
    </div>
  )
}

function TeamIdSection() {
  const config = getTeamConfig()
  const shortId = config?.shortId
  const [copied, setCopied] = useState(false)

  if (!shortId || config?.teamId === 'local') return null

  function handleCopy() {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(shortId).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      }).catch(() => {})
    }
  }

  return (
    <div className="card mb-4">
      <h3 className="font-semibold mb-2 text-sm text-gray-600">☁️ Your Team ID</h3>
      <p className="text-xs text-gray-500 mb-3">
        Share this ID with anyone who needs to load your team data on a new device.
      </p>
      <div className="flex items-center gap-2">
        <span className="font-mono text-xl font-bold tracking-widest text-blue-700">{shortId}</span>
        <button onClick={handleCopy} className="btn btn-ghost btn-sm">
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  )
}

function BackupSection() {
  const fileInputRef = useRef(null)
  const [importMsg, setImportMsg] = useState(null)

  function handleExport() {
    const data = exportAllData()
    const date = new Date().toISOString().slice(0, 10)
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url  = URL.createObjectURL(blob)
    const a    = document.createElement('a')
    a.href     = url
    a.download = `softball-backup-${date}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportFile(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const data = JSON.parse(ev.target.result)
        if (!confirm(`This will overwrite your current roster, games, and league settings with the backup from ${data.exportedAt?.slice(0,10) || 'unknown date'}. Continue?`)) return
        importAllData(data)
        setImportMsg({ ok: true, text: 'Syncing to cloud…' })
        // Wait for all keys to push to Supabase before telling user to reload
        await Promise.all(['sft_roster','sft_games','sft_division','sft_teams','sft_tournaments','sft_schedule'].map(k => pushKey(k).catch(console.warn)))
        setImportMsg({ ok: true, text: 'Restored successfully — reload to see changes' })
      } catch (err) {
        setImportMsg({ ok: false, text: err.message || 'Failed to read backup file' })
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  return (
    <div className="card mb-4">
      <h3 className="font-semibold mb-3 flex items-center gap-2"><Download size={18} /> Backup &amp; Restore</h3>
      <p className="text-xs text-gray-500 mb-3">
        Export saves your roster, all games, and league settings as a JSON file.
        Store it in iCloud, email it to yourself, or use it to move data to another device.
      </p>
      <div className="flex gap-2 mb-3">
        <button onClick={handleExport} className="btn btn-primary btn-sm flex-1 gap-1">
          <Download size={14} /> Export backup
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="btn btn-ghost btn-sm flex-1 gap-1">
          <Upload size={14} /> Restore backup
        </button>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleImportFile}
      />
      {importMsg && (
        <p className={`text-sm ${importMsg.ok ? 'text-green-600' : 'text-red-600'}`}>
          {importMsg.ok ? '✅' : '⚠️'} {importMsg.text}
        </p>
      )}
    </div>
  )
}

export default function AdminPage({ onBack }) {
  const [unlocked, setUnlocked] = useState(false)
  const [roster, setRoster] = useState(getRoster)

  if (!unlocked) return <PinGate onUnlock={() => setUnlocked(true)} />

  function handleAdd(name, type) {
    setRoster(addPlayer(name, type))
    pushKey('sft_roster').catch(console.warn)
  }
  function handleToggle(id) {
    setRoster(updatePlayer(id, { active: !roster.find(p => p.id === id).active }))
    pushKey('sft_roster').catch(console.warn)
  }
  function handleRemove(id) {
    if (!confirm('Remove this player from the roster?')) return
    setRoster(removePlayer(id))
    pushKey('sft_roster').catch(console.warn)
  }
  function handleTypeToggle(id, type) {
    setRoster(updatePlayer(id, { type: type === 'BBH' ? 'SBH' : 'BBH' }))
    pushKey('sft_roster').catch(console.warn)
  }

  const bbh = roster.filter(p => p.type === 'BBH')
  const sbh = roster.filter(p => p.type === 'SBH')

  return (
    <div className="max-w-lg mx-auto p-4 pb-24">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={onBack} className="btn btn-ghost btn-sm"><ChevronLeft size={16} /> Back</button>
        <h1 className="text-xl font-bold">Admin</h1>
      </div>

      <LeagueSettings />

      <ScheduleSection />

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

      <TeamIdSection />
      <ChangePinForm />

      <BackupSection />
    </div>
  )
}
