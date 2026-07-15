# Player Cards: Own Tab in Season Stats — Design

**Goal:** Move mid-season player cards out of a per-row 🃏 button buried in the Season Stats → Players table, into their own **🃏 Cards** tab — a gallery of every player's card front, tap to open the full flip card.

**Context:** `computePlayerCard` (storage.js), `PlayerCardModal.jsx` (flip-card UI with download/print), and the Players-tab wiring were implemented in `docs/superpowers/plans/2026-07-14-player-cards.md`. That plan wired card access as a small 🃏 icon-button next to each player's name in the Players tab. This design supersedes that entry point only — the data layer and modal internals are unchanged.

## Tab placement

`SeasonStatsPage.jsx`'s tab bar gains a 5th tab, ordered: Batting, Team, Players, **Cards**, Trends.

## Cards tab content

- Population: every player in `stats` (`computeSeasonStats()` — the same set the Players tab already lists, qualifying and non-qualifying alike).
- Order: alphabetical by name. This is intentionally decoupled from the Players tab's `sortCol`/`sortAsc` state — a gallery shouldn't reshuffle based on a stat sort applied elsewhere.
- Layout: `grid grid-cols-2 gap-3`. Each cell is a scaled-down, non-interactive preview of the card's **front face** (pose art + headline stat + strength badge) — reusing the existing `CardFront` component unchanged, wrapped in a fixed 140×200 container with `transform: scale(0.5)` (source card face is 280×400). No new front-face rendering logic.
- Tap target: the whole grid cell. Tapping sets `viewCardPlayer` (existing state in `SeasonStatsPage.jsx`, currently set by the 🃏 button) to that player's name, opening the existing, unmodified `PlayerCardModal`.

## What moves out

- The 🃏 icon-button and its `onClick={() => setViewCardPlayer(p.name)}` in the Players tab table row (`SeasonStatsPage.jsx`, in the `activeTab === 'players'` block) is deleted. The Players tab reverts to being just the stats table — no card-view affordance there.

## What's unchanged

- `computePlayerCard` (storage.js) — data/business logic untouched.
- `PlayerCardModal.jsx`'s flip animation, `CardBack`, download-stacked-PNG, and print behavior — untouched.
- `viewCardPlayer` state and its `{viewCardPlayer && <PlayerCardModal ... />}` render — untouched, just re-triggered from a new place.

## New export

- `CardFront` becomes a named export from `PlayerCardModal.jsx` (currently a private function) so `SeasonStatsPage.jsx` can render it in the grid. `computePlayerCard(name)` is called once per grid player to build the `card` prop, same as the modal already does.

## Testing

- Update/replace the existing Players-tab test(s) that assert the 🃏 button opens `PlayerCardModal` — that behavior moves to the Cards tab.
- Add a test asserting the Cards tab renders one grid cell per player in `stats` and that tapping a cell opens `PlayerCardModal` for that player.
- Add a test asserting the Players tab table no longer renders a card-view control.
