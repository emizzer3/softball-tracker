import { useState } from 'react'

export default function RunnerOutModal({ mode, battingOrder, playerPositions, onConfirm, onCancel }) {
  const [fielder,  setFielder]  = useState('')
  const [assister, setAssister] = useState('')

  const players = battingOrder.map(name => ({
    name,
    pos: playerPositions?.[name] || '?',
  }))

  if (mode === 'batting') {
    return (
      <div className="fixed inset-0 bg-black/50 flex items-end z-50">
        <div className="bg-white rounded-t-2xl w-full p-4">
          <h3 className="font-bold mb-1">⚡ Runner Out</h3>
          <p className="text-sm text-gray-600 mb-4">
            Record a baserunning out (caught stealing, picked off). This adds 1 out without changing the current batter.
          </p>
          <div className="flex gap-2">
            <button onClick={onCancel} className="btn btn-ghost btn-md flex-1">Cancel</button>
            <button onClick={() => onConfirm(null, null)} className="btn btn-danger btn-md flex-1">
              ✓ Record Out
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50">
      <div className="bg-white rounded-t-2xl w-full p-4 max-h-[85vh] overflow-y-auto">
        <h3 className="font-bold mb-1">⚡ CS / Picked Off</h3>
        <p className="text-xs text-gray-500 mb-3">
          Their runner was thrown out. Tap who made the tag/catch (PO) and who threw it (A). Skip if unsure.
        </p>

        <div className="mb-3">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Who got the out?</span>
            <span className="text-xs bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded">PO</span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            {players.map(({ name, pos }) => (
              <button
                key={name}
                onClick={() => { setFielder(name); if (assister === name) setAssister('') }}
                className={`btn btn-sm flex flex-col h-auto py-1.5 gap-0 ${fielder === name ? 'btn-primary' : 'btn-ghost'}`}
              >
                <span className="text-xs font-black leading-tight">{pos}</span>
                <span className="text-xs leading-tight">{name.split(' ')[0]}</span>
              </button>
            ))}
          </div>
        </div>

        {fielder && (
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-xs font-bold uppercase tracking-wide text-gray-500">Who threw it? (optional)</span>
              <span className="text-xs bg-amber-100 text-amber-600 font-semibold px-1.5 py-0.5 rounded">A</span>
            </div>
            <div className="grid grid-cols-4 gap-1">
              {players.filter(p => p.name !== fielder).map(({ name, pos }) => (
                <button
                  key={name}
                  onClick={() => setAssister(prev => prev === name ? '' : name)}
                  className={`btn btn-sm flex flex-col h-auto py-1.5 gap-0 ${assister === name ? 'btn-warning' : 'btn-ghost'}`}
                >
                  <span className="text-xs font-black leading-tight">{pos}</span>
                  <span className="text-xs leading-tight">{name.split(' ')[0]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 mt-2">
          <button onClick={onCancel} className="btn btn-ghost btn-md flex-1">Cancel</button>
          <button
            onClick={() => onConfirm(fielder || null, assister || null)}
            className="btn btn-danger btn-md flex-1"
          >
            ✓ Record Out
          </button>
        </div>
      </div>
    </div>
  )
}
