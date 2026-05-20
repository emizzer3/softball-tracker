# Softball Tracker PWA — Claude Context

## What this is
A PWA for tracking mixed recreational slow-pitch softball games. Installed on iPhone via Safari "Add to Home Screen". Works 100% offline after first load.

**Live URL:** https://emizzer3.github.io/softball-tracker/
**Repo:** https://github.com/emizzer3/softball-tracker

## Stack
- Vite + React (JSX, no TypeScript)
- Tailwind CSS v4 (`@tailwindcss/vite`)
- localStorage for all persistence — no server, no database
- Service Worker cache-first (`public/sw.js`)
- GitHub Actions auto-deploy to GitHub Pages on push to `main`

## Key domain rules
- Mixed co-ed **slow-pitch** softball
- Batting order must **strictly alternate BBH / SBH** (Big Bat Hitter / Small Bat Hitter) — this is a team rule, enforced at setup
- 11 fielding positions: P, C, 1B, 2B, 3B, SS, LF, LC, RC, RF, EF
- Default admin PIN: `1234`

## Features
- **Game Setup** (4 steps): game details → select players → batting order → fielding lineup
  - Friendly: free-text team names; League: managed dropdown; Tournament: free-text + remembered tournament name
- **Live Tracker**: balls/strikes, 12 outcomes, base diamond, stolen bases, substitutions, undo
  - K auto-logs putout to catcher; F/G opens PutoutModal to record fielder PO + optional assist
- **Scoresheet**: classic diamond grid (innings × batters), fielding card, print to PDF
- **Summary**: batting + fielding stats per game
- **Season Stats**: cumulative G/AB/H/2B/3B/HR/RBI/BB/K/SB/AVG/OBP/PO/A/E across all games
- **Admin** (PIN-locked): league division name, opponent teams list, roster management, change PIN

## localStorage keys
| Key | Contents |
|-----|----------|
| `sft_roster` | `[{ id, name, type, active }]` |
| `sft_games` | completed game objects |
| `sft_active_game` | in-progress game state |
| `sft_pin` | admin PIN |
| `sft_division` | league/division name |
| `sft_teams` | opponent team names |
| `sft_tournaments` | remembered tournament names (recent first, max 10) |

## Game object shape
```js
{
  id, date, gameType, tournamentName, home, away, innings,
  battingOrder,     // string[] — reflects mid-game substitutions
  roster,           // player objects for this game
  fieldingLineup,   // { position: playerName }
  playerPositions,  // { playerName: position } reverse map
  atBats,           // [{ id, batter, inning, half, outcome, rbi, bases }]
  playLog,          // [{ type, fielder, assister, batter, inning, half, outCode }]
  fieldingLog,      // { "1-top": { position: playerName } } mid-game changes
  inningScores,     // [{ home, away }] per inning
  homeScore, awayScore
}
```

## Dev workflow
```bash
npm run dev      # http://localhost:5173/softball-tracker/
npm run build    # verify no errors before pushing
git push         # triggers auto-deploy, live in ~2 min
```

## Planned / future features
- **Data backup/export** — user wants a way to back up localStorage data remotely for safety
  - Phase 1: Export/Import JSON file in Admin (download all data, re-import on new device)
  - Phase 2: Optional Supabase free-tier cloud sync when internet is available
  - Don't build until user asks — just keep in mind when touching Admin or storage

## What NOT to do
- Don't suggest server-side solutions unless user explicitly asks for backup/sync feature
- Don't add TypeScript — keep it plain JSX
- Don't change the BBH/SBH alternation rule — it's a hard team requirement
