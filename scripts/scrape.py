#!/usr/bin/env python3
"""Download season stats and salaries from Baseball-Reference into player-seasons.csv.

Usage (from the repo root):

    python scripts/scrape.py

Per season it reads two league pages (standard batting, standard pitching),
then one page per qualifying player for the salary and service-time table.
Every page is cached in .cache/, so a rerun only fetches what's new. Requests
are spaced 4 seconds apart to stay under Baseball-Reference's rate limit
(about 20 per minute; going over blocks you for an hour).

Output: player-seasons.csv, one row per qualifying player-season.
"""

from __future__ import annotations

import csv
import html
import re
import sys
import time
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
CACHE = ROOT / ".cache"
OUT = ROOT / "player-seasons.csv"
BASE = "https://www.baseball-reference.com"

# 2020 is left out: a 60-game season with prorated pay doesn't compare.
SEASONS = [2016, 2017, 2018, 2019, 2021, 2022, 2023, 2024, 2025, 2026]
MIN_PA = 300   # hitters
MIN_IP = 50    # pitchers
DELAY = 4.0

TEAM_ALIASES = {"OAK": "ATH"}  # Oakland -> Athletics (2025 on), so the franchise is one team
# League minimum salary by season, used for pre-arb years with no salary listed.
MIN_SALARY = {2016: 507_500, 2017: 535_000, 2018: 545_000, 2019: 555_000, 2021: 570_500,
              2022: 700_000, 2023: 720_000, 2024: 740_000, 2025: 760_000, 2026: 780_000}
# Salary tables name teams in full; codes match the stats pages (after TEAM_ALIASES).
TEAM_CODES = {
    "Arizona Diamondbacks": "ARI", "Atlanta Braves": "ATL", "Baltimore Orioles": "BAL", "Boston Red Sox": "BOS",
    "Chicago Cubs": "CHC", "Chicago White Sox": "CHW", "Cincinnati Reds": "CIN", "Cleveland Indians": "CLE",
    "Cleveland Guardians": "CLE", "Colorado Rockies": "COL", "Detroit Tigers": "DET", "Houston Astros": "HOU",
    "Kansas City Royals": "KCR", "Los Angeles Angels": "LAA", "Los Angeles Dodgers": "LAD", "Miami Marlins": "MIA",
    "Milwaukee Brewers": "MIL", "Minnesota Twins": "MIN", "New York Mets": "NYM", "New York Yankees": "NYY",
    "Oakland Athletics": "ATH", "Athletics": "ATH", "Philadelphia Phillies": "PHI", "Pittsburgh Pirates": "PIT",
    "San Diego Padres": "SDP", "Seattle Mariners": "SEA", "San Francisco Giants": "SFG", "St. Louis Cardinals": "STL",
    "Tampa Bay Rays": "TBR", "Texas Rangers": "TEX", "Toronto Blue Jays": "TOR", "Washington Nationals": "WSN",
}
POSITIONS = {"1": "P", "2": "C", "3": "1B", "4": "2B", "5": "3B", "6": "SS", "7": "LF", "8": "CF", "9": "RF", "D": "DH"}

_last = 0.0


def fetch(path: str) -> str:
    """Page HTML, from cache if we have it. HTML comments are unwrapped because
    Baseball-Reference hides some tables inside them."""
    global _last
    cached = CACHE / (path.strip("/").replace("/", "_"))
    if cached.exists():
        return cached.read_text()
    for attempt in range(5):
        wait = DELAY - (time.time() - _last)
        if wait > 0:
            time.sleep(wait)
        _last = time.time()
        r = requests.get(BASE + path, headers={"User-Agent": "Mozilla/5.0 (mlb-player-value)"}, timeout=30)
        if r.status_code == 429:
            print("  rate limited, waiting 10 minutes", flush=True)
            time.sleep(600)
            continue
        if r.status_code == 404:
            text = ""
            break
        r.raise_for_status()
        text = r.content.decode("utf-8").replace("<!--", "").replace("-->", "")
        break
    else:
        raise SystemExit(f"Gave up on {path}")
    CACHE.mkdir(exist_ok=True)
    cached.write_text(text)
    return text


def cell_text(raw: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", "", raw)).replace("\xa0", " ").strip()


def table_rows(page: str, table_id: str) -> list[dict]:
    start = page.find(f'id="{table_id}"')
    if start < 0:
        return []
    body = page[start:page.find("</table>", start)]
    rows = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", body, re.S):
        row = {}
        for attrs, raw in re.findall(r"<t[dh]([^>]*)>(.*?)</t[dh]>", tr, re.S):
            stat = re.search(r'data-stat="([^"]+)"', attrs)
            if not stat:
                continue
            row[stat.group(1)] = cell_text(raw)
            pid = re.search(r'data-append-csv="([^"]+)"', attrs)
            if pid:
                row["id"] = pid.group(1)
        if row:
            rows.append(row)
    return rows


def f(v) -> float | None:
    try:
        return float(str(v).replace(",", "").replace("$", ""))
    except ValueError:
        return None


def innings(ip) -> float | None:
    """Baseball-Reference writes 50.2 for 50 2/3 innings."""
    v = f(ip)
    if v is None:
        return None
    whole = int(v)
    return whole + round((v - whole) * 10) / 3


def main_position(summary: str) -> str:
    """'*6/H' -> 'SS': the first position code in Baseball-Reference's summary."""
    for ch in summary.replace("*", ""):
        if ch in POSITIONS:
            return POSITIONS[ch]
    return "UT"


def salaries(pid: str, played_for: dict[int, str]) -> tuple[dict[int, tuple[float | None, float | None]], bool]:
    """({year: (salary, service years)}, drafted) from a player's page.

    A salary listed under a team the player never played for that season is
    dropped: those are option buyouts or stale entries (e.g. Brandon Lowe's
    $500K from Tampa Bay in a season he played for Pittsburgh).
    """
    page = fetch(f"/players/{pid[0]}/{pid}.shtml")
    out: dict[int, tuple[float | None, float | None]] = {}
    for r in table_rows(page, "br-salaries"):
        year = f(r.get("year_ID", "")[:4])
        if not year:
            continue
        sal = f(r.get("Salary", "")) if r.get("Salary") else None
        team = played_for.get(int(year), "")
        if sal is not None and team in TEAM_CODES.values() and TEAM_CODES.get(r.get("team_name")) != team:
            sal = None
        srv = r.get("service_time", "")
        service = None
        if re.fullmatch(r"\d+\.\d{3}", srv):
            yrs, days = srv.split(".")
            service = int(yrs) + int(days) / 172  # 172 days = one service year
        prev = out.get(int(year), (None, None))
        total = (prev[0] or 0) + sal if sal is not None else prev[0]
        out[int(year)] = (total, prev[1] if prev[1] is not None else service)
    return out, "Drafted by" in page


def fill_gap(pay: dict, drafted: bool, season: int) -> tuple[float | None, float | None, bool]:
    """(salary, service, estimated) for a season, filling the pre-arbitration
    years Baseball-Reference often skips.

    Service time is carried from the nearest listed year. A missing salary is
    estimated at the league minimum only for a player on the usual pre-arb path:
    under 3 years of service and either drafted or with every listed pre-arb
    salary near the minimum. That rules out stars signed from Japan or Korea
    (Yamamoto, Murakami), who are paid millions from day one.
    """
    salary, service = pay.get(season, (None, None))
    if service is None:
        known = [(y, s) for y, (_, s) in pay.items() if s is not None]
        if known:
            y, s = min(known, key=lambda k: abs(k[0] - season))
            service = max(0.0, s + season - y)
    if salary is not None:
        return salary, service, False
    prearb = [sal for sal, s in pay.values() if s is not None and s < 3 and sal]
    near_min = all(sal <= 1_500_000 for sal in prearb)
    if (service is None or service < 3) and near_min and (drafted or prearb):
        return MIN_SALARY[season], service, True
    return None, service, False


def first_rows(page: str, table_id: str) -> dict[str, dict]:
    """{player id: row}. A traded player's first row is his season total (2TM)."""
    out: dict[str, dict] = {}
    for r in table_rows(page, table_id):
        if "id" in r:
            out.setdefault(r["id"], r)
    return out


def season_rows(season: int) -> list[dict]:
    bat = first_rows(fetch(f"/leagues/majors/{season}-standard-batting.shtml"), "players_standard_batting")
    pit = first_rows(fetch(f"/leagues/majors/{season}-standard-pitching.shtml"), "players_standard_pitching")
    if not bat or not pit:
        raise SystemExit(f"No stats tables found for {season}; the page layout may have changed")

    out = []
    for pid in sorted(set(bat) | set(pit)):
        b, p = bat.get(pid, {}), pit.get(pid, {})
        pa, ip = f(b.get("b_pa")) or 0, innings(p.get("p_ip")) or 0
        if pa < MIN_PA and ip < MIN_IP:
            continue
        hitter = pa >= MIN_PA  # two-way players (Ohtani) count as hitters, with both WARs
        src = b if hitter else p
        if not hitter:
            b = {k: v for k, v in b.items() if k == "b_war"}  # a pitcher's few at-bats aren't his stat line
        g, gs = f(p.get("p_g")) or 0, f(p.get("p_gs")) or 0
        team = src.get("team_name_abbr", "")
        out.append({
            "Season": season,
            "bref_id": pid,
            "Player": src["name_display"].rstrip("*#+ "),
            "Team": TEAM_ALIASES.get(team, team),
            "Role": "H" if hitter else "P",
            "Pos": main_position(b.get("pos", "")) if hitter else ("SP" if gs >= g / 2 else "RP"),
            "Age": f(src.get("age")),
            "G": f(b.get("b_games")) if hitter else g,
            "WAR": round((f(b.get("b_war")) or 0) + (f(p.get("p_war")) or 0), 2),
            "PA": pa or None, "HR": f(b.get("b_hr")), "SB": f(b.get("b_sb")),
            "BA": f(b.get("b_batting_avg")), "OBP": f(b.get("b_onbase_perc")),
            "SLG": f(b.get("b_slugging_perc")), "OPS_plus": f(b.get("b_onbase_plus_slugging_plus")),
            "IP": round(ip, 2) or None, "GS": gs if p else None, "SV": f(p.get("p_sv")),
            "ERA": f(p.get("p_earned_run_avg")), "ERA_plus": f(p.get("p_earned_run_avg_plus")),
            "FIP": f(p.get("p_fip")), "WHIP": f(p.get("p_whip")), "SO": f(p.get("p_so")),
        })
    return out


def main() -> None:
    rows = []
    for season in SEASONS:
        got = season_rows(season)
        print(f"{season}: {len(got)} qualifying players", flush=True)
        rows += got

    ids = sorted({r["bref_id"] for r in rows})
    print(f"Fetching salaries for {len(ids)} players (cached pages are instant)", flush=True)
    played_for: dict[str, dict[int, str]] = {}
    for r in rows:
        played_for.setdefault(r["bref_id"], {})[r["Season"]] = r["Team"]
    pay = {}
    for i, pid in enumerate(ids, 1):
        pay[pid] = salaries(pid, played_for[pid])
        if i % 50 == 0:
            print(f"  {i}/{len(ids)}", flush=True)

    for r in rows:
        r["Salary"], r["Service"], r["Salary_est"] = fill_gap(*pay[r["bref_id"]], r["Season"])
        if r["Service"] is not None:
            r["Service"] = round(r["Service"], 3)

    with OUT.open("w", newline="") as fh:
        w = csv.DictWriter(fh, fieldnames=list(rows[0]))
        w.writeheader()
        w.writerows(rows)
    missing = sum(r["Salary"] is None for r in rows)
    est = sum(r["Salary_est"] for r in rows)
    print(f"Wrote {OUT.name}: {len(rows)} player-seasons, {est} pre-arb salaries estimated, {missing} without a salary")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        sys.exit(1)
