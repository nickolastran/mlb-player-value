#!/usr/bin/env python3
"""Train the two salary models on player-seasons.csv and write the JSON the site reads.

Usage (from the repo root):

    python scripts/scrape.py       # slow: refresh stats and salaries (cached)
    python scripts/build_data.py   # fast: train models, write data/

Models (random forests, one pair for hitters and one for pitchers), predicting
salary as a share of that season's luxury-tax (CBT) threshold:

    market      stats + age + service time. Learns how MLB actually pays:
                near-minimum pre-arbitration deals, arbitration raises, free agency.
    production  stats only. Closer to pure on-field worth.

Seasons before the latest are split 80/20 into train/test. The latest season
is never trained on, so it's fully out-of-sample.

Output:
    data/<season>-<model>.json   one file per season and model
    data/seasons.json            seasons, models, thresholds and teams
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import r2_score
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "player-seasons.csv"
DATA_DIR = ROOT / "data"

# Competitive balance tax threshold by season, in dollars. MLB has no salary
# cap; this is the closest thing, and it puts every season on one scale.
CBT = {
    2016: 189_000_000,
    2017: 195_000_000,
    2018: 197_000_000,
    2019: 206_000_000,
    2021: 210_000_000,
    2022: 230_000_000,
    2023: 233_000_000,
    2024: 237_000_000,
    2025: 241_000_000,
    2026: 244_000_000,
}

FEATURES = {
    "H": ["G", "PA", "WAR", "HR", "SB", "BA", "OBP", "SLG", "OPS_plus"],
    "P": ["G", "GS", "IP", "WAR", "SV", "ERA", "ERA_plus", "FIP", "WHIP", "SO"],
}
MODELS = {
    "market": {"label": "Market value", "short": "Market", "extra": ["Age", "Service"],
               "description": "Age- and service-aware. Learns how MLB actually pays."},
    "production": {"label": "Production value", "short": "Production", "extra": [],
                   "description": "Stats only. Closer to pure on-field worth."},
}
MIN_PA, MIN_IP = 300, 50


def num(value, digits: int | None = None):
    """JSON-safe number: NaN becomes null, optional rounding."""
    if value is None or (isinstance(value, float) and math.isnan(value)):
        return None
    return int(round(value)) if digits is None else round(float(value), digits)


def train(df: pd.DataFrame) -> tuple[pd.DataFrame, dict[str, float]]:
    """Adds pred_<model> columns (share of CBT) and a split column; returns test R² per model."""
    latest = df["Season"].max()
    df["split"] = "projection"
    # Train and score only on salaries Baseball-Reference lists, not our pre-arb estimates.
    known = df[(df["Season"] < latest) & df["Salary"].notna() & ~df["Salary_est"]].index
    tr, te = train_test_split(known, test_size=0.2, random_state=42)
    df.loc[tr, "split"], df.loc[te, "split"] = "train", "test"
    df.loc[df["split"].eq("projection") & (df["Season"] < latest), "split"] = None  # no salary to learn from

    r2 = {}
    for model, spec in MODELS.items():
        df[f"pred_{model}"] = np.nan
        for role, cols in FEATURES.items():
            cols = cols + spec["extra"]
            rows = df["Role"] == role
            fit = df.index.isin(tr) & rows
            rf = RandomForestRegressor(n_estimators=400, min_samples_leaf=10, random_state=42, n_jobs=-1)
            rf.fit(df.loc[fit, cols], df.loc[fit, "share"])
            df.loc[rows, f"pred_{model}"] = rf.predict(df.loc[rows, cols])
        test = df.index.isin(te)
        r2[model] = round(r2_score(df.loc[test, "share"], df.loc[test, f"pred_{model}"]), 2)
    return df, r2


def records(df: pd.DataFrame, season: int, model: str) -> list[dict]:
    cbt = CBT[season]
    rows = df[df["Season"] == season].copy()
    rows["pred"] = rows[f"pred_{model}"] * cbt
    rows["surplus"] = rows["pred"] - rows["Salary"]
    rows["surplus_rank"] = rows["surplus"].rank(ascending=False, method="min")
    rows["pred_rank"] = rows["pred"].rank(ascending=False, method="min")
    out = []
    for _, r in rows.sort_values("pred", ascending=False).iterrows():
        paid = pd.notna(r["Salary"])
        rec = {
            "id": r["bref_id"], "player": r["Player"], "team": r["Team"], "pos": r["Pos"],
            "role": r["Role"], "age": num(r["Age"]), "service": num(r["Service"], 2),
            "g": num(r["G"]), "war": num(r["WAR"], 1),
            "salary": num(r["Salary"]), "salary_est": bool(r["Salary_est"]),
            "salary_pct": num(r["Salary"] / cbt, 5) if paid else None,
            "pred": num(r["pred"]), "pred_pct": num(r["pred"] / cbt, 5),
            "residual_pct": num(-r["surplus"] / cbt, 5) if paid else None,
            "surplus": num(r["surplus"]) if paid else None,
            "surplus_pct": num(r["surplus"] / cbt, 5) if paid else None,
            "surplus_rank": num(r["surplus_rank"]) if paid else None,
            "pred_rank": num(r["pred_rank"]),
            "split": r["split"] if isinstance(r["split"], str) else None,
        }
        if r["Role"] == "H":
            rec.update(pa=num(r["PA"]), hr=num(r["HR"]), sb=num(r["SB"]), avg=num(r["BA"], 3),
                       obp=num(r["OBP"], 3), slg=num(r["SLG"], 3), ops_plus=num(r["OPS_plus"]))
        else:
            rec.update(ip=num(r["IP"], 1), gs=num(r["GS"]), sv=num(r["SV"]), era=num(r["ERA"], 2),
                       era_plus=num(r["ERA_plus"]), so=num(r["SO"]), whip=num(r["WHIP"], 2))
        out.append(rec)
    return out


def main() -> None:
    df = pd.read_csv(SRC)
    missing = sorted(set(df["Season"]) - set(CBT))
    if missing:
        sys.exit(f"No CBT threshold for season(s) {missing}. Add them to CBT in scripts/build_data.py")
    dupes = df.duplicated(["Season", "bref_id"])
    if dupes.any():
        sys.exit(f"{dupes.sum()} duplicate player-season rows in {SRC.name}")
    # Below the league minimum means a partial or bonus-only entry, not a season salary.
    df.loc[df["Salary"] < 400_000, "Salary"] = np.nan
    df["share"] = df["Salary"] / df["Season"].map(CBT)

    df, r2 = train(df)
    print(f"Test R²: {r2}")

    DATA_DIR.mkdir(exist_ok=True)
    for old in DATA_DIR.glob("*.json"):
        old.unlink()
    seasons = []
    for season in sorted(df["Season"].unique()):
        s = df[df["Season"] == season]
        for model in MODELS:
            recs = records(df, int(season), model)
            # residual and surplus are the same gap, opposite signs
            assert all(r["surplus"] is None or abs(r["residual_pct"] + r["surplus_pct"]) < 1e-4 for r in recs)
            (DATA_DIR / f"{season}-{model}.json").write_text(json.dumps(recs, separators=(",", ":"), ensure_ascii=False, allow_nan=False))
        seasons.append({
            "season": int(season), "label": str(season), "cap": CBT[season], "players": len(s),
            "has_salary": bool(s["Salary"].notna().any()), "salary_source": None,
            "splits": sorted(s["split"].dropna().unique().tolist()),
        })
        print(f"  {season}: {len(s)} players, {s['Salary'].isna().sum()} without a salary")

    manifest = {
        "generated": pd.Timestamp.now(tz="UTC").strftime("%Y-%m-%d"),
        "min_pa": MIN_PA, "min_ip": MIN_IP,
        "seasons": seasons,
        "models": [{"id": k, "label": v["label"], "short": v["short"], "r2": r2[k], "description": v["description"]}
                   for k, v in MODELS.items()],
        "teams": sorted(df["Team"].dropna().unique().tolist()),
        "files": "data/{season}-{model}.json",
    }
    (DATA_DIR / "seasons.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False))
    print(f"Wrote {len(seasons) * len(MODELS)} season files and data/seasons.json")


if __name__ == "__main__":
    main()
