// Bottom sheet: record how many runners tagged up and scored on a sac fly
export default function SacRunsModal({ batter, bases, onConfirm }) {
  const runnersOnBase = bases.filter(Boolean).length
  const baseLabels = ['1st','2nd','3rd']
  const runnersSummary = bases
    .map((occ, i) => occ ? baseLabels[i] : null)
    .filter(Boolean)
    .join(', ') || 'none'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50">
      <div className="bg-white rounded-t-2xl w-full p-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg">🛩️</span>
          <h3 className="font-bold">Sac Fly — {batter}</h3>
        </div>
        <p className="text-sm text-gray-600 mb-1">
          Runners on base: <span className="font-semibold">{runnersSummary}</span>
        </p>
        <p className="text-xs text-gray-500 mb-4">
          How many tagged up and scored? (Lead runners score first — e.g. tap "1" with runners on 2nd &amp; 3rd to score from 3rd, tap "2" to score from both.)
        </p>

        <div className="grid grid-cols-4 gap-2 mb-3">
          {[0, 1, 2, 3].map(n => (
            <button
              key={n}
              onClick={() => onConfirm(n)}
              disabled={n > runnersOnBase}
              className={`btn btn-md flex flex-col h-auto py-3 gap-0 ${
                n === 0 ? 'btn-ghost border border-gray-200' : 'btn-success'
              } disabled:opacity-30 disabled:bg-gray-100`}
            >
              <span className="text-2xl font-black leading-tight">{n}</span>
              <span className="text-xs leading-tight">{n === 1 ? 'run' : 'runs'}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-gray-400 text-center">Batter is out either way — this just records the RBIs.</p>
      </div>
    </div>
  )
}
