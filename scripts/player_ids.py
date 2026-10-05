#!/usr/bin/env python3
"""Map Baseball-Reference player IDs to MLB IDs, which the site uses for headshots.

Usage (from the repo root, after scrape.py):

    python scripts/player_ids.py

Reads the Chadwick Bureau register (16 CSVs on GitHub, cached in .cache/)
and writes public/data/mlbam.json: {"judgeaa01": 592450, ...} for every
player in player-seasons.csv. Players without a match just show no photo.
"""

from __future__ import annotations

import csv
import io
import json
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache"
OUT = ROOT / "public" / "data" / "mlbam.json"
REGISTER = "https://raw.githubusercontent.com/chadwickbureau/register/master/data/people-{}.csv"


def register_part(shard: str) -> str:
    cached = CACHE / f"chadwick-people-{shard}.csv"
    if not cached.exists():
        r = requests.get(REGISTER.format(shard), timeout=60)
        r.raise_for_status()
        CACHE.mkdir(exist_ok=True)
        cached.write_text(r.text)
    return cached.read_text()


def main() -> None:
    with open(ROOT / "player-seasons.csv", newline="") as fh:
        wanted = {row["bref_id"] for row in csv.DictReader(fh)}

    ids: dict[str, int] = {}
    for shard in "0123456789abcdef":
        for row in csv.DictReader(io.StringIO(register_part(shard))):
            if row["key_bbref"] in wanted and row["key_mlbam"]:
                ids[row["key_bbref"]] = int(row["key_mlbam"])

    OUT.write_text(json.dumps(dict(sorted(ids.items())), separators=(",", ":")))
    print(f"Matched {len(ids)} of {len(wanted)} players; wrote {OUT.relative_to(ROOT)}")
    if missing := sorted(wanted - ids.keys()):
        print("No MLB ID for:", ", ".join(missing[:20]), "..." if len(missing) > 20 else "")


if __name__ == "__main__":
    main()
