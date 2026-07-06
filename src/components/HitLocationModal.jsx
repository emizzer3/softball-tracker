import { useState } from 'react'
import { SoftballField } from './SoftballField'
import { HIT_COLORS } from './softballFieldConstants'

// ── Hit location modal ────────────────────────────────────────────────────────
export default function HitLocationModal({ batter, outcomeCode, onConfirm, onSkip }) {
  const [location, setLocation] = useState(null)
  const isHit = ['1B','2B','3B','HR'].includes(outcomeCode)
  const label = isHit ? 'Where did the ball land?' : 'Where was the ball hit?'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50">
      <div className="bg-white rounded-t-2xl w-full max-h-[90vh] flex flex-col">
        <div className="p-4 pb-0 overflow-y-auto">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-bold">{label}</h3>
            <span className={`font-black text-sm px-2 py-0.5 rounded text-white`}
              style={{ background: HIT_COLORS[outcomeCode] || '#6b7280' }}>
              {outcomeCode}
            </span>
          </div>
          <p className="text-sm text-gray-600 mb-1 font-medium">{batter}</p>
          <p className="text-xs text-gray-400 mb-3">Tap the field to mark the location · tap again to move it</p>

          <div className="rounded-xl overflow-hidden border border-gray-200 bg-green-900/10 mb-4">
            <SoftballField onLocationSelect={setLocation} />
          </div>
        </div>

        <div className="flex gap-2 p-4 pt-3 border-t border-gray-100 shrink-0">
          <button type="button" onClick={onSkip} className="btn btn-ghost btn-md flex-1">Skip</button>
          <button
            type="button"
            onClick={() => onConfirm(location)}
            disabled={!location}
            className={`btn btn-md flex-1 ${location ? 'btn-success' : 'btn-ghost opacity-50'}`}
          >
            {location ? '✓ Save Location' : 'Tap field first'}
          </button>
        </div>
      </div>
    </div>
  )
}
