import { useState } from 'react'
import { RotateCcw, ChevronDown, ChevronUp } from 'lucide-react'

// Outcome colour map for the last-play card
const OUTCOME_META = {
  '1B':  { label: 'Single',           bg: 'bg-green-50',  border: 'border-green-400', text: 'text-green-700' },
  '2B':  { label: 'Double',           bg: 'bg-green-50',  border: 'border-green-400', text: 'text-green-700' },
  '3B':  { label: 'Triple',           bg: 'bg-green-50',  border: 'border-green-400', text: 'text-green-700' },
  'HR':  { label: 'Home Run',         bg: 'bg-green-50',  border: 'border-green-600', text: 'text-green-800' },
  'BB':  { label: 'Walk',             bg: 'bg-blue-50',   border: 'border-blue-300',  text: 'text-blue-700'  },
  'HBP': { label: 'Hit By Pitch',     bg: 'bg-blue-50',   border: 'border-blue-300',  text: 'text-blue-700'  },
  'K':   { label: 'Strikeout',        bg: 'bg-red-50',    border: 'border-red-400',   text: 'text-red-700'   },
  'F':   { label: 'Flyout',           bg: 'bg-red-50',    border: 'border-red-400',   text: 'text-red-700'   },
  'G':   { label: 'Groundout',        bg: 'bg-red-50',    border: 'border-red-400',   text: 'text-red-700'   },
  'E':   { label: 'On Error',         bg: 'bg-amber-50',  border: 'border-amber-400', text: 'text-amber-700' },
  'FC':  { label: "Fielder's Choice", bg: 'bg-amber-50',  border: 'border-amber-400', text: 'text-amber-700' },
  'SAC': { label: 'Sacrifice',        bg: 'bg-gray-50',   border: 'border-gray-300',  text: 'text-gray-600'  },
}

export default function LastPlayCard({ action, atBats, playLog, onUndo, onEditRbi = null }) {
  const [expanded, setExpanded] = useState(false)
  const meta = OUTCOME_META[action.code] || { label: action.code, bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' }
  const isOut = ['K','F','G','FC','SAC'].includes(action.code)

  // Build the chronological history. At-bats are timestamped via id (Date.now).
  // Newest first.
  const history = [...(atBats || [])].sort((a, b) => b.id - a.id)
  // Build putout/error lookup keyed by batter+inning+half for fielding annotation
  const putoutFor = ab => (playLog || []).find(p =>
    p.type === 'putout' && p.batter === ab.batter && p.inning === ab.inning && p.half === ab.half
  )

  return (
    <div className={`rounded-lg border-l-4 ${meta.border} ${meta.bg} mb-3`}>
      {/* Summary row (latest play) */}
      <div className="p-3 flex gap-3 items-start">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`font-black text-lg ${meta.text}`}>{action.code}</span>
            <span className="text-sm font-semibold text-gray-700">{action.batter}</span>
            <span className="text-xs text-gray-500">{meta.label}</span>
            {(action.rbi > 0 || onEditRbi) && (
              <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-700 font-bold px-1.5 py-0.5 rounded">
                {action.rbi} RBI
                {onEditRbi && (
                  <>
                    <button
                      onClick={() => onEditRbi(-1)}
                      className="text-amber-500 hover:text-amber-800 font-black leading-none px-0.5"
                      title="Decrease RBI"
                    >−</button>
                    <button
                      onClick={() => onEditRbi(+1)}
                      className="text-amber-500 hover:text-amber-800 font-black leading-none px-0.5"
                      title="Increase RBI"
                    >+</button>
                  </>
                )}
              </span>
            )}
          </div>

          {isOut && (
            <div className="mt-1 text-xs text-gray-500 flex items-center gap-1.5 flex-wrap">
              {action.autoFielder ? (
                <>
                  <span className="bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded">PO</span>
                  <span>{action.autoFielder}</span>
                  <span className="text-gray-400 italic">(auto — catcher)</span>
                </>
              ) : action.fielder ? (
                <>
                  <span className="bg-red-100 text-red-600 font-semibold px-1.5 py-0.5 rounded">PO</span>
                  <span>{action.fielder}</span>
                  {action.assister && (
                    <>
                      <span className="text-gray-300">·</span>
                      <span className="bg-amber-100 text-amber-600 font-semibold px-1.5 py-0.5 rounded">A</span>
                      <span>{action.assister}</span>
                    </>
                  )}
                </>
              ) : (
                <span className="italic text-gray-400">Fielding not recorded</span>
              )}
            </div>
          )}
        </div>

        <button onClick={onUndo} className="btn btn-ghost btn-sm p-1 text-gray-400 shrink-0" title="Undo">
          <RotateCcw size={15} />
        </button>
      </div>

      {/* Expand toggle */}
      {history.length > 1 && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="w-full border-t border-gray-200/60 px-3 py-1.5 text-xs text-gray-500 hover:bg-black/5 flex items-center justify-center gap-1"
        >
          {expanded ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
          {expanded ? 'Hide' : `Show all ${history.length} plays`}
        </button>
      )}

      {/* Expanded list */}
      {expanded && (
        <div className="border-t border-gray-200/60 max-h-60 overflow-y-auto bg-white/50">
          <ul className="divide-y divide-gray-100">
            {history.map(ab => {
              const m = OUTCOME_META[ab.outcome] || { text: 'text-gray-700' }
              const po = putoutFor(ab)
              return (
                <li key={ab.id} className="px-3 py-1.5 text-xs flex items-center gap-2">
                  <span className="text-gray-400 font-mono text-[10px] w-12 shrink-0">
                    {ab.inning}{ab.half === 'top' ? '▲' : '▼'}
                  </span>
                  <span className={`font-black ${m.text} w-8 shrink-0`}>{ab.outcome}</span>
                  <span className="font-medium text-gray-700 flex-1 truncate">{ab.batter}</span>
                  {ab.rbi > 0 && (
                    <span className="text-[10px] bg-amber-100 text-amber-700 font-bold px-1 py-0.5 rounded shrink-0">
                      {ab.rbi} RBI
                    </span>
                  )}
                  {po && (
                    <span className="text-[10px] text-gray-400 shrink-0">
                      {po.fielder}{po.assister ? `·${po.assister}` : ''}
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
