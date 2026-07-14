import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TrackerPage from '../pages/TrackerPage'

beforeEach(() => localStorage.clear())

const roster = [
  { id: 1, name: 'Alice', type: 'BBH', active: true },
  { id: 2, name: 'Bob', type: 'SBH', active: true },
]

const setup = {
  home: 'Home Team',
  away: 'Away Team',
  innings: 7,
  weAreHome: true,
  roster,
  battingOrder: ['Alice', 'Bob'],
  fieldingLineup: {},
  playerPositions: {},
}

function seededGameState() {
  return {
    inning: 1,
    half: 'bottom', // we're home and batting
    outs: 0,
    balls: 0,
    strikes: 0,
    bases: [false, false, false],
    batterIndex: 0,
    homeScore: 0,
    awayScore: 0,
    atBats: [],
    playLog: [],
    fieldingLog: {},
    done: false,
    inningScores: [{ home: 0, away: 0 }],
  }
}

describe('TrackerPage manual RBI edit', () => {
  it('increases the run counter when RBI is manually incremented', () => {
    render(
      <TrackerPage
        setup={setup}
        savedState={{ gameState: seededGameState(), battingOrder: setup.battingOrder }}
        onEnd={() => {}}
        onBack={() => {}}
      />
    )

    // Record a home run so the batter scores a run (rbi: 1, homeScore: 1).
    fireEvent.click(screen.getByRole('button', { name: /^HRHome Run$/ }))
    fireEvent.click(screen.getByRole('button', { name: 'Skip' }))

    expect(screen.getByTitle('Increase RBI').closest('span').textContent).toBe('1 RBI−+')
    const scoreSpansBefore = document.querySelectorAll('.text-4xl.font-black')
    expect(scoreSpansBefore[1].textContent).toBe('1')

    // Manually bump the RBI count on that play.
    fireEvent.click(screen.getByTitle('Increase RBI'))

    expect(screen.getByTitle('Increase RBI').closest('span').textContent).toBe('2 RBI−+')
    // Home score should now reflect the extra run credited by the RBI bump.
    const scoreSpansAfter = document.querySelectorAll('.text-4xl.font-black')
    expect(scoreSpansAfter[1].textContent).toBe('2')
  })
})
