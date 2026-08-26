# Olexa Archive

A zero-database, GitHub-Pages-friendly archive for the Olexa YouTube channel.

## What is already built

- Search every video title, game, genre, tag, and series
- Filter by game, genre, and year
- Sort by newest, oldest, most viewed, longest, or chaos mode
- Individual game pages with chronological watch history
- Random-video buttons
- "On This Day" / random archive memory
- Most-played-games panel
- Random year time machine
- Community Museum scaffold
- YouTube Data API v3 importer
- Layered game identification from Steam App IDs, description calls-to-action, titles, and tag families
- Persistent canonical game records with aggregate Olexa coverage statistics
- Data-quality audit queues for unidentified, ambiguous, malformed, and duplicate mappings
- Game classification rules + per-video manual overrides
- GitHub Actions scheduled sync every 6 hours
- GitHub Pages deployment workflows
- No runtime backend and no API key shipped to the browser

## 1. Preview it immediately

This repository includes demo data so the UI works before the first YouTube sync.

```powershell
npm run dev
```

Open:

```text
http://localhost:4173
```

Do not double-click `index.html`; browsers block `fetch()` from local `file://` pages. Use the dev command above.

## 2. Confirm your YouTube key is available

You said the key is stored in the Windows environment variable `YOUTUBE_API_KEY`.

In a **new** PowerShell window:

```powershell
if ($env:YOUTUBE_API_KEY) { "YouTube key found" } else { "YouTube key is missing in this shell" }
```

If the variable was added after VS Code / PowerShell was opened, restart that application so it inherits the updated environment.

To inspect the persistent user-level variable without printing every environment variable:

```powershell
[Environment]::GetEnvironmentVariable("YOUTUBE_API_KEY", "User")
```

## 3. Pull the real Olexa channel

The importer defaults to the `@OlexaYT` handle and resolves the channel through the YouTube Data API.

```powershell
npm run sync
```

That refreshes the public channel archive and rebuilds all generated catalog artifacts:

- `data/videos.json` — video records and game assignments
- `data/games.json` — canonical game records and aggregate statistics
- `data/game-audit.json` — full machine-readable review queues
- `reports/data-quality.md` — human-readable coverage and audit report

Then refresh the local site:

```powershell
npm run dev
```

The importer fetches the channel's uploads playlist, walks every playlist page, then requests full video metadata in batches of 50.

## 4. Fix game classification

YouTube knows what each video is called, but it does not reliably know which *game* an Olexa video belongs to. There are two curation layers.

### Bulk rules

Edit `data/game-rules.json`:

```json
{
  "gameSlug": "mosa-lina",
  "any": ["mosa lina"]
}
```

Each phrase is checked against the video's title, description, and YouTube tags during sync.

### One weird video

Edit `data/video-overrides.json`:

```json
{
  "abc123": {
    "gameSlug": "mosa-lina",
    "series": "Mosa Lina"
  }
}
```

Overrides always beat automatic matching.

### Game metadata

Edit `data/game-curation.json` to define a canonical name, genres, Steam App ID, Steam link, or optional description:

```json
{
  "slug": "mosa-lina",
  "name": "Mosa Lina",
  "genres": ["Puzzle", "Physics"],
  "steamAppId": "2477090",
  "steamUrl": "https://store.steampowered.com/app/2477090/"
}
```

`data/games.json` is generated; do not hand-edit it. Run `npm run catalog` after changing curation, rules, or overrides. The command reclassifies the checked-in archive without using YouTube API quota. Run `npm run sync` when you also want fresh YouTube metadata.

### Review the audit

Open `reports/data-quality.md` for the before/after coverage summary and the highest-priority unresolved videos. The complete queues and candidate evidence live in `data/game-audit.json`. Ambiguous videos stay unidentified until one candidate is clearly stronger or a manual override resolves them.

## 5. Put it on GitHub Pages

1. Create a GitHub repository and push this folder to its `main` branch.
2. In GitHub: **Settings → Pages → Build and deployment → Source → GitHub Actions**.
3. In GitHub: **Settings → Secrets and variables → Actions → New repository secret**.
4. Name the secret exactly:

```text
YOUTUBE_API_KEY
```

5. Paste the API key as the secret value.
6. Open **Actions → Sync YouTube + Deploy Pages → Run workflow** once.

After that:

- normal pushes deploy the site;
- the YouTube sync runs every 6 hours;
- the sync verifies and commits the refreshed video archive, canonical games, and audit report;
- the same workflow immediately publishes the refreshed site.

## Useful commands

```powershell
npm run dev       # local website
npm run sync      # pull YouTube and rebuild all catalog data
npm run catalog   # rebuild catalog data from checked-in videos
npm run check     # syntax-check all JavaScript
npm test          # run Data Quality V2 tests
npm run validate  # verify generated game/video references and totals
npm run verify    # run syntax checks, tests, and data validation
```

## Important secret rule

Never place the YouTube API key in `index.html`, JavaScript under `js/`, `videos.json`, or a committed `.env` file. The public website needs no credentials at all. Only `scripts/sync-youtube.js` uses the key, locally or inside GitHub Actions.

## Next good additions

- Metadata curation UI for rapidly assigning games to uncategorized videos
- Multi-channel support for Olexa Games / Olextra
- Steam metadata and cover art enrichment
- Curated playlists / "if you liked this" collections
- Community art submission/moderation workflow
- Channel milestones and archive statistics
- Series pages separate from game pages
- Full-text search over descriptions
