import { useState } from 'react'

// Fielding positions modal — defaults to game setup lineup, lets you update mid-game
export default function FieldingModal({ battingOrder, setupLineup, existing, inningKey, positions, onSave, onClose }) {
  // Use this inning's saved positions if any, otherwise fall back to the game setup lineup
  const defaults = Object.keys(existing).length > 0 ? existing : setupLineup
  const [assignments, setAssignments] = useState({ ...defaults })

  function assign(pos, player) {
    setAssignments(prev => {
      const next = { ...prev }
      // Remove player from any previous position
      Object.keys(next).forEach(k => { if (next[k] === player) delete next[k] })
      if (player) next[pos] = player
      else delete next[pos]
      return next
    })
  }

  const inningNum  = inningKey.split('-')[0]
  const inningHalf = inningKey.includes('top') ? '▲' : '▼'
  const assignedCount = Object.keys(assignments).length

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50">
      <div className="bg-white rounded-t-2xl w-full p-4 max-h-[90vh] overflow-y-auto">
        <h3 className="font-bold mb-0.5">Fielding Positions</h3>
        <p className="text-xs text-gray-500 mb-3">
          Inning {inningNum} {inningHalf} — update only if positions changed mid-game
        </p>
        <div className="grid grid-cols-2 gap-x-3 gap-y-2 mb-3">
          {positions.map(pos => (
            <div key={pos} className="flex items-center gap-2">
              <span className="w-8 text-xs font-bold text-gray-500 shrink-0">{pos}</span>
              <select
                className="input text-sm py-1 flex-1"
                value={assignments[pos] || ''}
                onChange={e => assign(pos, e.target.value)}
              >
                <option value="">—</option>
                {battingOrder.map(name => (
                  <option key={name} value={name}>
                    {name}{assignments[pos] !== name && Object.values(assignments).includes(name) ? ' ✓' : ''}
                  </option>
                ))}
              </select>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mb-3">{assignedCount} of {positions.length} positions assigned</p>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn btn-ghost btn-md flex-1">Cancel</button>
          <button onClick={() => onSave(inningKey, assignments)} className="btn btn-success btn-md flex-1">
            Save Positions
          </button>
        </div>
      </div>
    </div>
  )
}
