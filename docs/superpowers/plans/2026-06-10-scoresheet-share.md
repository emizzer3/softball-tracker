# Scoresheet Share Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Share" button to ScoresheetPage that uses the Web Share API to share a plain-text game summary. Falls back to copying to clipboard on unsupported browsers. No backend required.

**Architecture:** A `formatShareText(game)` helper formats the game into a readable text summary (score, batting stats per player). The Share button calls `navigator.share()` if available, otherwise copies to clipboard with a "Copied!" toast. The button sits next to the existing Print button in the scoresheet header.

**Tech Stack:** Web Share API (`navigator.share`), `navigator.clipboard`, existing React + Tailwind.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/pages/ScoresheetPage.jsx` | **Modify** | Add Share button and `formatShareText` helper |
| `src/tests/ScoresheetPage.share.test.jsx` | **Create** | Tests for share text formatting and button behaviour |

---

## Task 1: `formatShareText` helper and share button

**Files:**
- Modify: `src/pages/ScoresheetPage.jsx`
- Create: `src/tests/ScoresheetPage.share.test.jsx`

- [ ] **Step 1.1: Write the failing tests**

Create `src/tests/ScoresheetPage.share.test.jsx`:

```jsx
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import ScoresheetPage from '../pages/ScoresheetPage'

const minimalGame = {
  id: 'g1',
  date: '2024-05-15',
  gameType: 'League',
  tournamentName: '',
  home: 'Renegades',
  away: 'Bulls',
  homeScore: 8,
  awayScore: 5,
  result: 'W',
  innings: 5,
  battingOrder: ['Alice', 'Bob'],
  roster: [
    { name: 'Alice', type: 'BBH' },
    { name: 'Bob',   type: 'SBH' },
  ],
  atBats: [
    { id: 'ab1', batter: 'Alice', inning: 1, half: 'bottom', outcome: '1B', rbi: 1 },
    { id: 'ab2', batter: 'Alice', inning: 2, half: 'bottom', outcome: 'HR', rbi: 2 },
    { id: 'ab3', batter: 'Bob',   inning: 1, half: 'bottom', outcome: 'K',  rbi: 0 },
    { id: 'ab4', batter: 'Bob',   inning: 2, half: 'bottom', outcome: 'BB', rbi: 0 },
  ],
  inningScores: [{ home: 3, away: 1 }, { home: 5, away: 4 }],
  playLog: [],
  fieldingLineup: {},
}

describe('ScoresheetPage share', () => {
  it('renders a Share button', () => {
    render(<ScoresheetPage game={minimalGame} onHome={() => {}} onSummary={() => {}} />)
    expect(screen.getByRole('button', { name: /share/i })).toBeInTheDocument()
  })

  it('calls navigator.share when available', async () => {
    const mockShare = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share: mockShare, clipboard: null })

    render(<ScoresheetPage game={minimalGame} onHome={() => {}} onSummary={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /share/i }))

    await waitFor(() => expect(mockShare).toHaveBeenCalledOnce())
    const call = mockShare.mock.calls[0][0]
    expect(call.title).toContain('Bulls')
    expect(call.title).toContain('Renegades')
    expect(call.text).toContain('8')   // home score
    expect(call.text).toContain('5')   // away score
    expect(call.text).toContain('Alice')
    vi.unstubAllGlobals()
  })

  it('falls back to clipboard when navigator.share not available', async () => {
    const mockWrite = vi.fn().mockResolvedValue(undefined)
    vi.stubGlobal('navigator', { share: undefined, clipboard: { writeText: mockWrite } })

    render(<ScoresheetPage game={minimalGame} onHome={() => {}} onSummary={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /share/i }))

    await waitFor(() => expect(mockWrite).toHaveBeenCalledOnce())
    expect(mockWrite.mock.calls[0][0]).toContain('Renegades')
    vi.unstubAllGlobals()
  })

  it('shows Copied! toast after clipboard copy', async () => {
    vi.stubGlobal('navigator', { share: undefined, clipboard: { writeText: vi.fn().mockResolvedValue(undefined) } })

    render(<ScoresheetPage game={minimalGame} onHome={() => {}} onSummary={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /share/i }))

    await waitFor(() => expect(screen.getByText(/copied/i)).toBeInTheDocument())
    vi.unstubAllGlobals()
  })
})
```

- [ ] **Step 1.2: Run tests to verify they fail**

```bash
cd /Users/emilysewell/Documents/Github\ Projects/softball-tracker
npx vitest run src/tests/ScoresheetPage.share.test.jsx
```

Expected: FAIL — no Share button found

- [ ] **Step 1.3: Add `formatShareText` and the Share button to `src/pages/ScoresheetPage.jsx`**

**a) Add `Share2` to the lucide import** — find the first line:

```jsx
import { Printer, Home } from 'lucide-react'
```

Replace with:

```jsx
import { Printer, Home, Share2 } from 'lucide-react'
```

**b) Add `formatShareText` helper** — add this function before `export default function ScoresheetPage`:

```jsx
function formatShareText(game) {
  const { home, away, homeScore, awayScore, date, gameType, battingOrder = [], atBats = [] } = game
  const lines = [
    `${away} @ ${home}`,
    `${date} · ${gameType}`,
    `Final: ${homeScore ?? 0}–${awayScore ?? 0}`,
    '',
    'Batting:',
  ]
  for (const batter of battingOrder) {
    const abs = atBats.filter(ab => ab.batter === batter)
    const AB  = abs.filter(ab => !['BB','HBP','SAC'].includes(ab.outcome)).length
    const H   = abs.filter(ab => ['1B','2B','3B','HR'].includes(ab.outcome)).length
    const HR  = abs.filter(ab => ab.outcome === 'HR').length
    const RBI = abs.reduce((s, ab) => s + (ab.rbi || 0), 0)
    const AVG = AB > 0 ? (H / AB).toFixed(3).replace(/^0/, '') : '.000'
    const extras = []
    if (HR > 0)  extras.push(`${HR} HR`)
    if (RBI > 0) extras.push(`${RBI} RBI`)
    lines.push(`  ${batter}: ${H}/${AB}${extras.length ? ` (${extras.join(', ')})` : ''} · ${AVG}`)
  }
  return lines.join('\n')
}
```

**c) Add share state and handler** — inside `ScoresheetPage`, add after the destructuring line:

```jsx
const [copied, setCopied] = useState(false)

async function handleShare() {
  const title = `${away} @ ${home} — ${date}`
  const text  = formatShareText(game)
  if (navigator.share) {
    try { await navigator.share({ title, text }) } catch { /* user cancelled */ }
  } else if (navigator.clipboard) {
    await navigator.clipboard.writeText(`${title}\n\n${text}`).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
}
```

**d) Add Share button next to Print button** — find the Print button:

```jsx
<button onClick={() => window.print()} className="btn btn-primary btn-sm gap-1">
  <Printer size={14} /> Print
</button>
```

Replace with:

```jsx
<button onClick={handleShare} className="btn btn-ghost btn-sm gap-1 relative">
  <Share2 size={14} /> {copied ? <span className="text-green-600 font-semibold">Copied!</span> : 'Share'}
</button>
<button onClick={() => window.print()} className="btn btn-primary btn-sm gap-1">
  <Printer size={14} /> Print
</button>
```

- [ ] **Step 1.4: Run tests to verify they pass**

```bash
npx vitest run src/tests/ScoresheetPage.share.test.jsx
```

Expected: all 4 tests PASS

- [ ] **Step 1.5: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS

- [ ] **Step 1.6: Commit**

```bash
git add src/pages/ScoresheetPage.jsx src/tests/ScoresheetPage.share.test.jsx
git commit -m "feat: share scoresheet as text summary via Web Share API"
```

---

## Self-Review Checklist

- [x] `formatShareText` produces: header, date/type, final score, per-batter H/AB/HR/RBI/AVG
- [x] Share button visible next to Print in scoresheet header
- [x] Uses `navigator.share` when available (iOS Safari, Android Chrome)
- [x] Falls back to `navigator.clipboard` when share not supported
- [x] "Copied!" toast shown after clipboard write
- [x] No crash when both `navigator.share` and `navigator.clipboard` are unavailable
- [x] All behaviour tested before implementation
