import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import GameSetupPage from '../pages/GameSetupPage'
import { saveRoster } from '../storage'

beforeEach(() => localStorage.clear())

function getVisibleOrder() {
  return Array.from(document.querySelectorAll('li')).map(
    li => li.querySelectorAll('span')[1].textContent
  )
}

function reachStep3(playersInClickOrder) {
  render(<GameSetupPage draftKey="test-optimize" onStart={() => {}} onBack={() => {}} />)
  fireEvent.click(screen.getByText('Friendly'))
  fireEvent.change(screen.getByPlaceholderText('Opponent name…'), { target: { value: 'Opponents' } })
  fireEvent.click(screen.getByText('Confirm Details'))
  playersInClickOrder.forEach(name => fireEvent.click(screen.getByText(name)))
  fireEvent.click(screen.getByText('🔒 Lock Players'))
}

describe('GameSetupPage — Optimize Order button', () => {
  it('replaces the visible batting order when clicked', () => {
    saveRoster([
      { id: '1', name: 'Amy', type: 'BBH', active: true },
      { id: '2', name: 'Zoe', type: 'SBH', active: true },
    ])
    // Select Zoe then Amy, so the initial order is ['Zoe', 'Amy'] — still a
    // valid alternation, but not the order computeOptimalBattingOrder produces
    // (which always puts the BBH stream first when stream lengths are equal).
    reachStep3(['Zoe', 'Amy'])
    expect(getVisibleOrder()).toEqual(['Zoe', 'Amy'])

    fireEvent.click(screen.getByText('🧠 Optimize Order'))

    expect(getVisibleOrder()).toEqual(['Amy', 'Zoe'])
  })
})
