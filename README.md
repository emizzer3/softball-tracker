# ⚾ Softball Tracker PWA

Mixed recreational slow-pitch softball live tracker. Installable on iPhone/Android, works fully offline.

## Features

- **Game Setup** — date, teams, select players, batting order with strict BBH/SBH alternation enforced
- **Live At-Bats Tracker** — balls/strikes, all outcomes (1B/2B/3B/HR/BB/K/F/G/E/FC/SAC), base diamond, stolen bases, mid-game substitutions, fielding positions per inning, error logging
- **Classic Scoresheet** — traditional diamond grid (innings × batters), score by inning, print to PDF via browser
- **Season Stats** — cumulative stats across all saved games, game history
- **Admin (PIN-locked)** — add/remove players, toggle active/inactive, BBH ↔ SBH, change PIN (default: `1234`)
- **PWA** — install to home screen, works offline after first load

## Deploy to GitHub Pages (free)

1. Push this repo to GitHub as `softball-tracker`
2. Go to **Settings → Pages → Source → GitHub Actions**
3. Push to `main` — the workflow auto-builds and deploys
4. Your URL: `https://<your-username>.github.io/softball-tracker/`
5. Open that URL on your phone, tap the share icon, then **Add to Home Screen**

## Local dev

```bash
npm install
npm run dev        # http://localhost:5173/softball-tracker/
npm run build      # production build → dist/
```

Requires Node 18+. No server, no database — all data lives in the browser's localStorage.

## Default PIN

`1234` — change it in Admin after first install.

## Data

All data is stored in `localStorage` under the key prefix `sft_`. Clearing browser storage will erase game history. The app works fully offline once installed — no internet needed during games.
