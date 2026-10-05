import { useEffect, useRef, useState } from "react";
import { motion, MotionConfig } from "motion/react";
import { isTraded, loadDb, money, SORTS, teamName, type Db, type ModelId, type SortDir, type SortKey, type Unit } from "./lib";
import { EASE, Headshot, Segmented, Select, SectionHead, TeamLogo, Tween } from "./ui";
import { Search } from "./Search";
import { PlayerCard } from "./PlayerCard";
import { Leaderboard } from "./Leaderboard";
import { Scatters, TeamBars } from "./Charts";
import { Method } from "./Method";
import { Footer } from "./Footer";

const WRAP = "mx-auto max-w-[1180px] px-[clamp(16px,4vw,32px)]";
const SECTION = `${WRAP} pt-[clamp(32px,5vw,56px)]`;

export default function App() {
  const [db, setDb] = useState<Db | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    loadDb().then(setDb, (e: Error) => setError(`${e.message}. Start the site with npm run dev so the data files can load.`));
  }, []);

  return (
    <MotionConfig reducedMotion="user">
      <a href="#lookup" className="absolute -top-12 left-3 z-50 rounded-md bg-bulb px-3 py-2 font-semibold text-bulb-ink focus:top-3">
        Skip to player lookup
      </a>
      {db ? <Explorer db={db} /> : (
        <div className={`${WRAP} py-24`}>
          <h1 className="text-[clamp(2.75rem,6.5vw,5rem)] font-extrabold uppercase leading-[0.95] tracking-[-0.02em]">Who's worth the money?</h1>
          <p className="mt-5 text-ink-2" role="status">{error ?? "Loading player data…"}</p>
        </div>
      )}
    </MotionConfig>
  );
}

// ---------- URL hash (shareable state) ----------

interface State {
  season: number;
  model: ModelId;
  team: string;
  sortKey: SortKey;
  sortDir: SortDir;
  player: string | null;
  cardSeason: number | null;
}

function initialState(db: Db): State {
  const seasons = db.manifest.seasons;
  const s: State = {
    season: db.salarySeasons.at(-1) ?? seasons[seasons.length - 1].season,
    model: "market", team: "all", sortKey: "surplus", sortDir: "desc", player: null, cardSeason: null,
  };
  const p = new URLSearchParams(location.hash.slice(1));
  const season = Number(p.get("season"));
  if (db.info(season)) s.season = season;
  const model = p.get("model");
  if (model === "market" || model === "production") s.model = model;
  const team = p.get("team");
  if (team && (team === "all" || db.manifest.teams.includes(team))) s.team = team;
  const [sk, sd] = (p.get("sort") ?? "").split("-");
  if (sk in SORTS) s.sortKey = sk as SortKey;
  if (sd === "asc" || sd === "desc") s.sortDir = sd;
  const id = p.get("player");
  if (id && db.players.has(id)) {
    s.player = id;
    const cs = Number(p.get("card"));
    if (db.players.get(id)!.seasons.includes(cs)) s.cardSeason = cs;
  }
  if (!s.player) {
    // Start on the season's best-value player so the card is never empty.
    const rows = db.recs(s.season, s.model);
    const paid = rows.filter((r) => r.surplus != null);
    const top = paid.length ? paid.reduce((a, b) => (b.surplus! > a.surplus! ? b : a)) : rows[0];
    if (top) s.player = top.id;
  }
  if (s.player && s.cardSeason == null) {
    const ps = db.players.get(s.player)!.seasons;
    s.cardSeason = ps.includes(s.season) ? s.season : ps[ps.length - 1];
  }
  return s;
}

// ---------- The page ----------

function Explorer({ db }: { db: Db }) {
  const [s, setS] = useState(() => initialState(db));
  const set = (patch: Partial<State>) => setS((prev) => ({ ...prev, ...patch }));
  const [showAll, setShowAll] = useState(false);
  const [picked, setPicked] = useState<number[]>(() => (db.hasSalary(s.season) ? [s.season] : []));
  const [unit, setUnit] = useState<Unit>("usd");
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const p = new URLSearchParams({ season: String(s.season), model: s.model, team: s.team });
    if (s.sortKey !== "surplus" || s.sortDir !== "desc") p.set("sort", `${s.sortKey}-${s.sortDir}`);
    if (s.player) { p.set("player", s.player); p.set("card", String(s.cardSeason)); }
    history.replaceState(null, "", `#${p}`);
  }, [s]);

  // Salary-based sorts fall back to predicted salary for a season without salaries,
  // without forgetting the user's choice.
  const sortKey = SORTS[s.sortKey].needsSalary && !db.hasSalary(s.season) ? "pred" : s.sortKey;

  const setPickedSeasons = (next: number[]) => {
    setPicked(next);
    setUnit(next.length > 1 ? "pct" : "usd");
  };
  const setSeason = (season: number) => {
    const ps = s.player ? db.players.get(s.player)!.seasons : [];
    set({ season, ...(ps.includes(season) ? { cardSeason: season } : {}) });
    setShowAll(false);
    setPickedSeasons(db.hasSalary(season) ? [season] : []);
  };
  const openPlayer = (id: string, season: number, scroll: boolean) => {
    const ps = db.players.get(id)?.seasons;
    if (!ps) return;
    set({ player: id, cardSeason: ps.includes(season) ? season : ps[ps.length - 1] });
    if (scroll) cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const seasons = db.manifest.seasons;
  const latest = seasons[seasons.length - 1];
  const teams = db.manifest.teams.filter((t) => !isTraded(t)).sort((a, b) => teamName(a).localeCompare(teamName(b)));

  // The season's two extremes, shown in the masthead.
  const paid = db.recs(s.season, s.model).filter((r) => r.surplus != null);
  const best = paid.length ? paid.reduce((a, b) => (b.surplus! > a.surplus! ? b : a)) : null;
  const worst = paid.length ? paid.reduce((a, b) => (b.surplus! < a.surplus! ? b : a)) : null;
  const rise = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
  };

  return (
    <>
      {/* The one orchestrated moment: the headline rises line by line, then the rest settles in. */}
      <motion.header
        className={`${WRAP} grid items-end gap-x-12 gap-y-8 pb-[clamp(24px,3vw,36px)] pt-[clamp(32px,5vw,56px)] ${best && worst ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,480px)]" : ""}`}
        initial="hidden"
        animate="show"
        variants={{ show: { transition: { staggerChildren: 0.09 } } }}
      >
        <div>
          <h1 className="text-[clamp(2.5rem,5.2vw,4.5rem)] font-extrabold uppercase leading-[0.95] tracking-[-0.02em] lg:whitespace-nowrap">
            {["Who's worth", "the money?"].map((line) => (
              <span key={line} className="block overflow-hidden pb-[0.04em]">
                <motion.span className="block" variants={{ hidden: { y: "105%" }, show: { y: 0, transition: { duration: 0.75, ease: EASE } } }}>
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p variants={rise} className="mt-4 max-w-[58ch] text-[1.0625rem] text-ink-2">
            Two models read every qualifying player's stat line and predict what he should earn. The gap between that prediction
            and his real salary is his surplus. Covers {seasons[0].label} to {latest.label}.
          </motion.p>
        </div>

        {best && worst && (
          <motion.div variants={rise} className="overflow-hidden rounded-xl border border-line bg-panel">
            <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3">
              <h2 className="font-semibold">{db.label(s.season)} at the extremes</h2>
              <span className="text-sm text-muted">{db.model(s.model).label} model</span>
            </div>
            {([["Best value", best, true], ["Biggest overpay", worst, false]] as const).map(([kind, r, under]) => (
              <button
                key={kind}
                type="button"
                onClick={() => openPlayer(r.id, s.season, true)}
                className="flex w-full cursor-pointer items-center gap-3.5 border-b border-line px-4 py-3.5 text-left transition-colors last:border-0 hover:bg-panel-2"
              >
                <Headshot key={r.id} db={db} id={r.id} size={56} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[0.8125rem] text-muted">{kind}</span>
                  <span className="block truncate text-lg font-bold">{r.player}</span>
                  <span className="flex items-center gap-1.5 text-sm text-ink-2 sm:whitespace-nowrap">
                    <TeamLogo key={r.team} code={r.team} size={18} />
                    Paid {money(r.salary)} vs. {money(r.pred)} predicted
                  </span>
                </span>
                <span className="flex-none text-right">
                  <Tween value={Math.abs(r.surplus!)} format={money} className={`block text-2xl font-extrabold tabular-nums ${under ? "text-under" : "text-over"}`} />
                  <span className="text-xs text-muted">{under ? "under prediction" : "over prediction"}</span>
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </motion.header>

      <motion.nav
        aria-label="Filters for the whole page"
        className="sticky top-0 z-20 border-y border-line bg-night/85 backdrop-blur-md max-sm:static max-sm:bg-night max-sm:backdrop-blur-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.35 }}
      >
        <div className={`${WRAP} flex flex-wrap items-end gap-x-6 gap-y-3 py-3 max-sm:grid max-sm:grid-cols-2`}>
          <Select label="Season" value={s.season} onChange={(v) => setSeason(Number(v))}>
            {[...seasons].reverse().map((x) => (
              <option key={x.season} value={x.season}>{x.has_salary ? x.label : `${x.label} (projection)`}</option>
            ))}
          </Select>
          <div className="max-sm:order-3 max-sm:col-span-2 max-sm:[&_[role=radiogroup]]:flex">
            <Segmented
              id="model"
              label="Model"
              value={s.model}
              onChange={(model) => set({ model })}
              options={[{ value: "market", label: "Market value" }, { value: "production", label: "Production value" }]}
            />
          </div>
          <Select label="Team" value={s.team} onChange={(team) => { set({ team }); setShowAll(false); }}>
            <option value="all">All teams</option>
            {teams.map((t) => <option key={t} value={t}>{teamName(t)}</option>)}
          </Select>
        </div>
      </motion.nav>

      <main>
        <motion.section
          id="lookup"
          aria-labelledby="lookup-title"
          className={SECTION}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45, ease: EASE }}
        >
          <SectionHead
            id="lookup-title"
            title="Player lookup"
            note={`Search any hitter with ${db.manifest.min_pa}+ plate appearances or pitcher with ${db.manifest.min_ip}+ innings in a season, or click a dot on the charts below.`}
          />
          <Search db={db} season={s.season} onPick={(id, season) => openPlayer(id, season, false)} />
          <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] items-start gap-5 max-[900px]:grid-cols-1">
            <div ref={cardRef} className="scroll-mt-24">
              <PlayerCard
                db={db}
                playerId={s.player}
                cardSeason={s.cardSeason}
                season={s.season}
                model={s.model}
                onCardSeason={(cardSeason) => set({ cardSeason })}
              />
            </div>
            <Leaderboard
              db={db}
              season={s.season}
              model={s.model}
              team={s.team}
              sortKey={sortKey}
              sortDir={s.sortDir}
              showAll={showAll}
              current={s.player}
              onSort={(k, d) => { set({ sortKey: k, sortDir: d }); setShowAll(false); }}
              onShowAll={setShowAll}
              onPick={(id) => openPlayer(id, s.season, true)}
            />
          </div>
        </motion.section>

        <section id="charts" aria-labelledby="charts-title" className={SECTION}>
          <SectionHead
            id="charts-title"
            title="Pay vs. production"
            note="Drag to zoom, shift-drag or use the toolbar to pan, double-click to reset. Click a dot to open that player."
          />
          <Scatters
            db={db}
            season={s.season}
            model={s.model}
            team={s.team}
            picked={picked}
            unit={unit}
            onPicked={setPickedSeasons}
            onUnit={setUnit}
            onPick={(id, season) => openPlayer(id, season, true)}
          />
        </section>

        <section id="teams" aria-labelledby="teams-title" className={SECTION}>
          <SectionHead id="teams-title" title="Team surplus" />
          <TeamBars db={db} season={s.season} model={s.model} team={s.team} />
        </section>

        <Method db={db} />
      </main>

      <Footer db={db} />
    </>
  );
}
