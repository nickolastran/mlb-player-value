# MLB Player Value

What MLB players *should* earn based on their production, next to what they're actually paid, for 2016 through 2026 (2020 left out).


## What's in the folder

| Path | What it is |
|---|---|
| `index.html`, `styles.css`, `app.js` | The site |
| `player-seasons.csv` | Source data: one row per qualifying player-season, with stats, salary and service time |
| `data/<season>-<model>.json` | One file per season and model, read by the site |
| `data/seasons.json` | Seasons, models (with test R²), tax thresholds and teams |
| `scripts/scrape.py` | Downloads stats and salaries from Baseball-Reference into `player-seasons.csv` |
| `scripts/build_data.py` | Trains the models and writes everything in `data/` |

## Updating the data

You need Python 3.9+ with `pip install pandas scikit-learn requests`.

```bash
python scripts/scrape.py       # slow the first time: ~2,000 player pages at 4 s each
python scripts/build_data.py   # seconds
```

`scrape.py` caches every page in `.cache/`, so reruns only fetch what's missing. It waits 4 seconds between requests because Baseball-Reference blocks clients that go over about 20 a minute. To refresh a page (say, a season still in progress), delete its file from `.cache/`.

### Adding a season

1. Add it to `SEASONS` in `scripts/scrape.py` and its tax threshold to `CBT` in `scripts/build_data.py`.
2. Run both scripts, commit `player-seasons.csv` and `data/`, push.

The newest season is always held out of training, so it's shown as fully out-of-sample.

## Running it locally

```bash
python -m http.server 8000   # then open http://localhost:8000
```

## Deploying

`.github/workflows/static.yml` publishes the repo root to GitHub Pages on every push to `main`. Turn Pages on under Settings → Pages → Source: GitHub Actions.

## Methodology in brief

- **Market value model.** Random forests (one for hitters, one for pitchers) on season stats, WAR, age and service time. Predicts salary as a share of the season's competitive balance tax threshold.
- **Production value model.** The same without age and service time. The gap between the two is the *service-time discount*: what pre-arbitration and arbitration rules save teams.
- **Who's included.** Hitters with 300+ PA, pitchers with 50+ IP. Two-way players count as hitters with both WARs added.
- **Salaries.** From Baseball-Reference player pages. Pre-arbitration years it skips are estimated at the league minimum (shown as ≈, never trained on) for drafted players under 3 years of service; `python scripts/test_fill_gap.py` checks that rule. A salary listed under a team the player didn't play for (usually an option buyout) is dropped.
- **Residual.** `(actual − predicted) / CBT threshold`. Positive means overpaid relative to the model.
- **Train/test.** 80/20 random split of 2016–2025; 2026 is never trained on.
