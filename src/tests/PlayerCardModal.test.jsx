import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import PlayerCardModal from '../components/PlayerCardModal'
import { saveGame } from '../storage'

beforeEach(() => localStorage.clear())

function seedQualifyingPlayer() {
  const atBats = [
    ...Array.from({ length: 6 }, (_, i) => ({ id: `h${i}`, batter: 'Amy', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [false, false, false] })),
    ...Array.from({ length: 4 }, (_, i) => ({ id: `o${i}`, batter: 'Amy', inning: 1, half: 'bottom', outcome: 'K', rbi: 0, bases: [false, false, false] })),
  ]
  saveGame({
    id: 'g1', date: '2024-05-01', gameType: 'League', home: 'Renegades', away: 'Bulls',
    homeScore: 1, awayScore: 0, result: 'W',
    roster: [{ id: '1', name: 'Amy', type: 'BBH', active: true }],
    atBats, playLog: [],
  })
}

describe('PlayerCardModal', () => {
  it('renders the front face by default and flips to the back face on tap', () => {
    seedQualifyingPlayer()
    render(<PlayerCardModal name="Amy" onClose={() => {}} />)
    // "MID-SEASON CARD" is a JSX literal following an interpolated type-emoji prefix
    // (renders as e.g. "⚾ BBH · MID-SEASON CARD"), so it must be matched with a regex,
    // not an exact string. Use getAllByText().at(0), not getByText: Task 4 mounts a
    // second, visually hidden copy of the same front/back content for print/download
    // capture, so by the end of this plan the same text exists twice in the DOM —
    // getByText would then throw "multiple elements found." getAllByText stays valid
    // both before and after that change.
    expect(screen.getAllByText(/MID-SEASON CARD/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('SEASON STATS').length).toBeGreaterThan(0) // present in DOM (back face), just not visually flipped

    const frontFace = screen.getAllByText(/MID-SEASON CARD/)[0]
    fireEvent.click(frontFace.closest('.pc-wrap'))
    // After flipping, the wrapper carries the 'flipped' class (visual-only change; both faces stay mounted)
    expect(document.querySelector('.pc-wrap.flipped')).toBeInTheDocument()
  })

  it('shows the not-enough-at-bats message for a cold-start player instead of tips', () => {
    saveGame({
      id: 'g2', date: '2024-05-01', gameType: 'League', home: 'Renegades', away: 'Bulls',
      homeScore: 1, awayScore: 0, result: 'W',
      roster: [{ id: '1', name: 'Rookie', type: 'BBH', active: true }],
      atBats: [{ id: 'h0', batter: 'Rookie', inning: 1, half: 'bottom', outcome: '1B', rbi: 0, bases: [false, false, false] }],
      playLog: [],
    })
    render(<PlayerCardModal name="Rookie" onClose={() => {}} />)
    // getAllByText, not getByText — see note above (Task 4 duplicates this text into a hidden capture copy).
    expect(screen.getAllByText(/not enough at-bats yet/i).length).toBeGreaterThan(0)
  })

  it('calls onClose when the Close button is clicked', () => {
    seedQualifyingPlayer()
    let closed = false
    render(<PlayerCardModal name="Amy" onClose={() => { closed = true }} />)
    fireEvent.click(screen.getByText('Close'))
    expect(closed).toBe(true)
  })
})

describe('PlayerCardModal — download and print', () => {
  it('renders Download and Print buttons', () => {
    seedQualifyingPlayer()
    render(<PlayerCardModal name="Amy" onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /download/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /print/i })).toBeInTheDocument()
  })

  it('calls window.print when Print is clicked', () => {
    seedQualifyingPlayer()
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {})
    render(<PlayerCardModal name="Amy" onClose={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: /print/i }))
    expect(printSpy).toHaveBeenCalledOnce()
    printSpy.mockRestore()
  })
})
