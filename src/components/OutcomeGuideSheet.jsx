import { BookOpen, X } from 'lucide-react'

// Plain-English guide shown in the Outcome Guide sheet
const OUTCOME_GUIDE = [
  { code: '1B',  label: 'Single',           desc: 'Hit the ball and safely reached 1st base.' },
  { code: '2B',  label: 'Double',           desc: 'Hit the ball and safely reached 2nd base.' },
  { code: '3B',  label: 'Triple',           desc: 'Hit the ball and safely reached 3rd base.' },
  { code: 'HR',  label: 'Home Run',         desc: 'Hit over/to the fence — batter runs all bases and scores.' },
  { code: 'BB',  label: 'Walk',             desc: '4 balls — co-ed rule: SBH walks to 1st, BBH walks straight to 2nd (deters pitchers from intentionally walking the male). Doesn\'t count as an at-bat.' },
  { code: 'K',   label: 'Strikeout',        desc: '3 strikes and the batter is out. Catcher auto-gets the putout (PO).' },
  { code: 'F',   label: 'Flyout',           desc: 'Batter hit the ball in the air and a fielder caught it before it bounced.' },
  { code: 'G',   label: 'Groundout',        desc: 'Batter hit a ground ball and was thrown out at first (or another base).' },
  { code: 'E',   label: 'On Error',         desc: 'Batter reached base because a fielder made a mistake. Doesn\'t count as a hit.' },
  { code: 'FC',  label: "Fielder's Choice", desc: 'Batter reached safely, but the fielder chose to put out a different runner instead.' },
  { code: 'SAC', label: 'Sacrifice Fly',    desc: 'Batter hits a fly ball and is caught (out), but a runner tags up and scores. Doesn\'t count as an at-bat.' },
]

export default function OutcomeGuideSheet({ onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-end z-50">
      <div className="bg-white rounded-t-2xl w-full p-4 max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold flex items-center gap-2"><BookOpen size={18} /> Outcome Guide</h3>
          <button onClick={onClose} className="btn btn-ghost btn-sm p-1"><X size={18} /></button>
        </div>
        <p className="text-xs text-gray-500 mb-3">
          Not sure which outcome to pick? Here's what each one means.
        </p>
        <div className="space-y-2.5">
          {OUTCOME_GUIDE.map(({ code, label, desc }) => (
            <div key={code} className="flex gap-3 items-start">
              <span className="shrink-0 w-10 text-center font-black text-sm bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                {code}
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-800">{label}</p>
                <p className="text-xs text-gray-500 leading-snug">{desc}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-3 border-t border-gray-100">
          <p className="text-xs text-gray-400">
            <strong>Tip:</strong> When in doubt, use 1B/2B/3B/HR for hits, K for strikeouts, and BB for walks. You can always log G/F for groundouts and flyouts to track fielding stats too.
          </p>
        </div>
        <button onClick={onClose} className="btn btn-primary btn-md w-full mt-3">Got it!</button>
      </div>
    </div>
  )
}
