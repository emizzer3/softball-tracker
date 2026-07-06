import { useState } from 'react'

// Bottom sheet: record who made a groundout or flyout
export default function PutoutModal({ outCode, battingOrder, playerPositions, bases = [false,false,false], hideFielders = false, onConfirm, onSkip }) {
  const [putoutPlayer,  setPutoutPlayer]  = useState('')
  const [assistPlayer,  setAssistPlayer]  = useState('')
  const [doublePlay,    setDoublePlay]    = useState(false)
  const [triplePlay,    setTriplePlay]    = useState(false)
  const [putoutPlayer2, setPutoutPlayer2] = useState('')
  const [assistPlayer2, setAssistPlayer2] = useState('')

  const players = battingOrder.map(name => ({
    name,
    pos: playerPositions?.[name] || '?',
  }))

  const label = outCode === 'G' ? 'Groundout' : outCode === 'FC' ? "Fielder's Choice" : outCode === 'SAC' ? 'Sacrifice Fly Catch' : 'Flyout'
  // DP only makes sense for ground balls / FC, and only when there's a runner who could be the 2nd out
  const canDP = (outCode === 'G' || outCode === 'FC') && bases.some(Boolean)
  // TP needs at least 2 runners on base
  const canTP = canDP && bases.filter(Boolean).length >= 2
  // When we're batting, hide the fielder selection (those would be opponent fielders we don't track)
  const showFielders = !hideFielders

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50">
      <div className="bg-white rounded-t-2xl w-full p-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🧤</span>
          <h3 className="font-bold">Record {label}</h3>
        </div>
        <p className="text-xs text-gray-500 mb-4">
          {showFielders
            ? 'Tap the fielder who got the out. Tap a second player if there was an assist (they threw it to get the out). Skip if unsure.'
            : 'Toggle Double Play if the opposing team got a second out on this play.'}
        </p>

        {showFielders && (
          <div className="mb-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Who got the out?</span>
              <span className="text-xs bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded">PO</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {players.map(({ name, pos }) => (
                <button
                  key={name}
                  onClick={() => {
                    setPutoutPlayer(name)
                    if (assistPlayer === name) setAssistPlayer('')
                  }}
                  className={`btn btn-sm flex flex-col h-auto py-1.5 gap-0 ${putoutPlayer === name ? 'btn-primary' : 'btn-ghost'}`}
                >
                  <span className="text-xs font-black leading-tight">{pos}</span>
                  <span className="text-xs leading-tight">{name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {showFielders && putoutPlayer && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Who threw/relayed? (optional)</span>
              <span className="text-xs bg-amber-100 text-amber-600 font-semibold px-1.5 py-0.5 rounded">A</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {players.filter(p => p.name !== putoutPlayer).map(({ name, pos }) => (
                <button
                  key={name}
                  onClick={() => setAssistPlayer(prev => prev === name ? '' : name)}
                  className={`btn btn-sm flex flex-col h-auto py-1.5 gap-0 ${assistPlayer === name ? 'btn-warning' : 'btn-ghost'}`}
                >
                  <span className="text-xs font-black leading-tight">{pos}</span>
                  <span className="text-xs leading-tight">{name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Double-play / Triple-play toggles — only for FC/G with runners on base */}
        {canDP && (
          <div className="mt-3 mb-3 p-2 border-2 border-dashed border-red-300 bg-red-50 rounded-lg space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={doublePlay || triplePlay}
                onChange={e => {
                  setDoublePlay(e.target.checked)
                  if (!e.target.checked) setTriplePlay(false)
                }}
                className="w-4 h-4 accent-red-600"
              />
              <span className="text-sm font-bold text-red-700">⚡ Double Play</span>
              <span className="text-xs text-red-600/80">— records a second out</span>
            </label>
            {canTP && (doublePlay || triplePlay) && (
              <label className="flex items-center gap-2 cursor-pointer pl-6">
                <input
                  type="checkbox"
                  checked={triplePlay}
                  onChange={e => setTriplePlay(e.target.checked)}
                  className="w-4 h-4 accent-red-800"
                />
                <span className="text-sm font-bold text-red-900">⚡⚡ Triple Play</span>
                <span className="text-xs text-red-800/80">— records a third out</span>
              </label>
            )}
          </div>
        )}

        {/* Second out fielder picker — shown when DP is enabled and we track fielders */}
        {showFielders && (doublePlay || triplePlay) && (
          <div className="mt-3 mb-2">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">2nd out — who got the runner?</span>
              <span className="text-xs bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded">PO</span>
              <span className="text-xs text-gray-400">(optional)</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {players.map(({ name, pos }) => (
                <button
                  key={name}
                  onClick={() => { setPutoutPlayer2(prev => prev === name ? '' : name); if (assistPlayer2 === name) setAssistPlayer2('') }}
                  className={`btn btn-sm flex flex-col h-auto py-1.5 gap-0 ${putoutPlayer2 === name ? 'btn-primary' : 'btn-ghost'}`}
                >
                  <span className="text-xs font-black leading-tight">{pos}</span>
                  <span className="text-xs leading-tight">{name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
            {putoutPlayer2 && (
              <>
                <div className="flex items-center gap-2 mb-1.5 mt-2">
                  <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Who threw it? (optional)</span>
                  <span className="text-xs bg-amber-100 text-amber-600 font-semibold px-1.5 py-0.5 rounded">A</span>
                </div>
                <div className="grid grid-cols-4 gap-1">
                  {players.filter(p => p.name !== putoutPlayer2).map(({ name, pos }) => (
                    <button
                      key={name}
                      onClick={() => setAssistPlayer2(prev => prev === name ? '' : name)}
                      className={`btn btn-sm flex flex-col h-auto py-1.5 gap-0 ${assistPlayer2 === name ? 'btn-warning' : 'btn-ghost'}`}
                    >
                      <span className="text-xs font-black leading-tight">{pos}</span>
                      <span className="text-xs leading-tight">{name.split(' ')[0]}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <button onClick={onSkip} className="btn btn-ghost btn-md flex-1">Skip</button>
          <button
            onClick={() => onConfirm(putoutPlayer, assistPlayer, doublePlay || triplePlay, triplePlay, putoutPlayer2 || null, assistPlayer2 || null)}
            disabled={showFielders && !putoutPlayer}
            className="btn btn-success btn-md flex-1"
          >
            ✓ Log {triplePlay ? 'Triple ' : doublePlay ? 'Double ' : ''}Play
          </button>
        </div>
      </div>
    </div>
  )
}
