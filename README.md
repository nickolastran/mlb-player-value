# MLB Player Value

What MLB players *should* earn based on their production, next to what they're actually paid, for 2016 through 2026 (2020 left out).


## What's in the folder

| Path | What it is |
|---|---|
| `src/` | The site: React + TypeScript (`.tsx`), styled with Tailwind, animated with Motion, charts with Plotly |
| `player-seasons.csv` | Source data: one row per qualifying player-season, with stats, salary and service time |
| `public/data/<season>-<model>.json` | One file per season and model, read by the site |
| `public/data/seasons.json` | Seasons, models (with test R²), tax thresholds and teams |
| `public/data/mlbam.json` | Baseball-Reference ID → MLB ID, used for player headshots |
| `scripts/scrape.py` | Downloads stats and salaries from Baseball-Reference into `player-seasons.csv` |
| `scripts/build_data.py` | Trains the models and writes everything in `public/data/` |
| `scripts/player_ids.py` | Maps players to MLB IDs via the Chadwick Bureau register, for headshots |

## Updating the data

You need Python 3.9+ with `pip install pandas scikit-learn shap requests`.

```bash
python scripts/scrape.py       # slow the first time: ~2,000 player pages at 4 s each
python scripts/build_data.py   # about a minute
python scripts/player_ids.py   # seconds; only needed when new players appear
```

`scrape.py` caches every page in `.cache/`, so reruns only fetch what's missing. It waits 4 seconds between requests because Baseball-Reference blocks clients that go over about 20 a minute. To refresh a page (say, a season still in progress), delete its file from `.cache/`.

### Adding a season

1. Add it to `SEASONS` in `scripts/scrape.py` and its tax threshold to `CBT` in `scripts/build_data.py`.
2. Run the three scripts, commit `player-seasons.csv` and `public/data/`, push, then `npm run deploy`.

The newest season is always held out of training, so it's shown as fully out-of-sample.

## Running it locally

You need Node 20+.

```bash
npm install
npm run dev   # then open http://localhost:5173
```

## Deploying

The site is on GitHub Pages at <https://nickolastran.github.io/mlb-player-value>.

```bash
npm run deploy
```

This builds with the `/mlb-player-value/` base path, copies `index.html` to `404.html` so `/players` loads the app instead of a 404, and pushes `dist/` to the `gh-pages` branch, which Pages serves (Settings → Pages → Deploy from branch `gh-pages`). The CSV and scripts stay out of the deployment.

Player headshots and team logos load from MLB's image servers (`img.mlbstatic.com`, `www.mlbstatic.com`) and belong to MLB; fine for a non-commercial project, but check MLB's terms before using them commercially.

## Methodology in brief

- **Market value model.** Random forests (one for hitters, one for pitchers) on season stats, WAR, hitter position (as the standard positional adjustment: C highest, DH lowest), age, service time and track record (last season's WAR and the last five seasons' total, from the league pages, so seasons that didn't qualify still count). Predicts salary as a share of the season's competitive balance tax threshold.
- **Production value model.** The same without age, service time and track record. The gap between the two is the *service-time discount*: what pre-arbitration and arbitration rules save teams.
- **Who's included.** Hitters with 300+ PA, pitchers with 50+ IP. Two-way players count as hitters with both WARs added.
- **Salaries.** From Baseball-Reference player pages. Pre-arbitration years it skips are estimated at the league minimum (shown as ≈, never trained on) for drafted players under 3 years of service; `python scripts/test_fill_gap.py` checks that rule. A salary listed under a team the player didn't play for (usually an option buyout) is dropped.
- **Why this prediction.** SHAP values (TreeExplainer) split each prediction into what every stat added or took off, starting from the average hitter or pitcher.
- **80% range.** The 10th–90th percentile of the 400 trees' guesses, stretched per model and role so 80% of test-set salaries fall inside (the raw spread covers about half), floored at the season's lowest salary.
- **Residual.** `(actual − predicted) / CBT threshold`. Positive means overpaid relative to the model.
- **Train/test.** 80/20 random split of 2016–2025; 2026 is never trained on.
