import { useEffect, useRef, useState } from "react";
import { motion, MotionConfig } from "motion/react";
import { loadDb, money, POSITIONS, SORTS, teamName, type Db, type ModelId, type Rec, type SortDir, type SortKey, type Unit } from "./lib";
import { EASE, Headshot, Segmented, Select, SectionHead, TeamLogo, Tween } from "./ui";
import { Search } from "./Search";
import { PlayerCard } from "./PlayerCard";
import { Leaderboard } from "./Leaderboard";
import { Scatters, TeamBars, TeamTrend } from "./Charts";
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
  page: "home" | "players";
  season: number;
  model: ModelId;
  team: string;
  pos: string;
  sortKey: SortKey;
  sortDir: SortDir;
  player: string | null;
  cardSeason: number | null;
  vs: string | null; // second player in compare mode
  vsSeason: number | null;
}

const PAGES = { home: "/", players: "/players" } as const;
const TITLE = "MLB Player Value";

const defaultSeason = (db: Db) => db.salarySeasons.at(-1) ?? db.manifest.seasons[db.manifest.seasons.length - 1].season;

// The season's best-value player, so the card is never empty.
function topPlayer(db: Db, season: number, model: ModelId) {
  const rows = db.recs(season, model);
  const paid = rows.filter((r) => r.surplus != null);
  return (paid.length ? paid.reduce((a, b) => (b.surplus! > a.surplus! ? b : a)) : rows[0])?.id ?? null;
}

function cardFor(db: Db, id: string, season: number) {
  const ps = db.players.get(id)!.seasons;
  return ps.includes(season) ? season : ps[ps.length - 1];
}

// The URL only carries what differs from the defaults, so a bare "/" is the default dashboard.
function initialState(db: Db): State {
  // Older links kept their state in the hash.
  const p = new URLSearchParams(location.search || location.hash.slice(1));
  const s: State = {
    page: location.pathname === PAGES.players || p.get("view") === "players" ? "players" : "home",
    season: defaultSeason(db),
    model: "market", team: "all", pos: "all", sortKey: "surplus", sortDir: "desc", player: null, cardSeason: null, vs: null, vsSeason: null,
  };
  const season = Number(p.get("season"));
  if (db.info(season)) s.season = season;
  const model = p.get("model");
  if (model === "market" || model === "production") s.model = model;
  const team = p.get("team");
  if (team && (team === "all" || db.manifest.teams.includes(team))) s.team = team;
  const pos = p.get("pos");
  if (pos && pos in POSITIONS) s.pos = pos;
  const [sk, sd] = (p.get("sort") ?? "").split("-");
  if (sk in SORTS) s.sortKey = sk as SortKey;
  if (sd === "asc" || sd === "desc") s.sortDir = sd;
  const [cmp, vs] = (p.get("compare") ?? "").split(",");
  const id = cmp || p.get("player");
  s.player = id && db.players.has(id) ? id : topPlayer(db, s.season, s.model);
  if (s.player && vs && db.players.has(vs)) {
    s.vs = vs;
    s.vsSeason = cardFor(db, vs, s.season);
  }
  if (s.player) {
    const cs = Number(p.get("card"));
    s.cardSeason = db.players.get(s.player)!.seasons.includes(cs) ? cs : cardFor(db, s.player, s.season);
  }
  return s;
}

function toUrl(db: Db, s: State) {
  const p = new URLSearchParams();
  if (s.season !== defaultSeason(db)) p.set("season", String(s.season));
  if (s.model !== "market") p.set("model", s.model);
  if (s.team !== "all") p.set("team", s.team);
  if (s.pos !== "all") p.set("pos", s.pos);
  if (s.sortKey !== "surplus" || s.sortDir !== "desc") p.set("sort", `${s.sortKey}-${s.sortDir}`);
  if (s.player && s.vs) p.set("compare", `${s.player},${s.vs}`);
  else if (s.player && s.player !== topPlayer(db, s.season, s.model)) p.set("player", s.player);
  if (s.player && s.cardSeason !== cardFor(db, s.player, s.season)) p.set("card", String(s.cardSeason));
  const q = p.toString().replace(/%2C/g, ","); // keep compare=a,b readable
  return PAGES[s.page] + (q ? `?${q}` : "");
}

// ---------- The page ----------

function Explorer({ db }: { db: Db }) {
  const [s, setS] = useState(() => initialState(db));
  const set = (patch: Partial<State>) => setS((prev) => ({ ...prev, ...patch }));
  const [picked, setPicked] = useState<number[]>(() => (db.hasSalary(s.season) ? [s.season] : []));
  const [unit, setUnit] = useState<Unit>("usd");
  const [faSort, setFaSort] = useState<[SortKey, SortDir]>(["pred", "desc"]);
  const [faAll, setFaAll] = useState(false);
  const [picking, setPicking] = useState(false);
  const comparing = picking || s.vs != null;
  const cardRef = useRef<HTMLDivElement>(null);
  const scrollToCard = useRef(false);

  useEffect(() => {
    // Switching pages gets a history entry so the back button works; everything else just updates the URL.
    history[location.pathname === PAGES[s.page] ? "replaceState" : "pushState"](null, "", toUrl(db, s));
    document.title = s.page === "players" ? `All players · ${TITLE}` : TITLE;
  }, [db, s]);

  useEffect(() => {
    const onPop = () => setS(initialState(db));
    addEventListener("popstate", onPop);
    return () => removeEventListener("popstate", onPop);
  }, [db]);

  // A new page starts at the top, unless we came here to open a player's card.
  useEffect(() => {
    if (scrollToCard.current) cardRef.current?.scrollIntoView({ block: "start" });
    else window.scrollTo(0, 0);
    scrollToCard.current = false;
  }, [s.page]);

  // Salary-based sorts fall back to predicted salary for a season without salaries,
  // without forgetting the user's choice.
  const sortKey = SORTS[s.sortKey].needsSalary && !db.hasSalary(s.season) ? "pred" : s.sortKey;

  const setPickedSeasons = (next: number[]) => {
    setPicked(next);
    setUnit(next.length > 1 ? "pct" : "usd");
  };
  const setSeason = (season: number) => {
    const has = (id: string | null) => id != null && db.players.get(id)!.seasons.includes(season);
    set({ season, ...(has(s.player) ? { cardSeason: season } : {}), ...(has(s.vs) ? { vsSeason: season } : {}) });
    setPickedSeasons(db.hasSalary(season) ? [season] : []);
  };
  const openPlayer = (id: string, season: number, scroll: boolean) => {
    const ps = db.players.get(id)?.seasons;
    if (!ps) return;
    set({ page: "home", player: id, cardSeason: ps.includes(season) ? season : ps[ps.length - 1] });
    if (!scroll) return;
    if (s.page === "home") cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    else scrollToCard.current = true;
  };

  const seasons = db.manifest.seasons;
  const latest = seasons[seasons.length - 1];
  const teams = [...db.manifest.teams].sort((a, b) => teamName(a).localeCompare(teamName(b)));

  // The season's two extremes, shown in the masthead.
  const paid = db.recs(s.season, s.model).filter((r) => r.surplus != null);
  const best = paid.length ? paid.reduce((a, b) => (b.surplus! > a.surplus! ? b : a)) : null;
  const worst = paid.length ? paid.reduce((a, b) => (b.surplus! < a.surplus! ? b : a)) : null;
  const board = (full: boolean) => (
    <Leaderboard
      db={db}
      season={s.season}
      model={s.model}
      team={s.team}
      pos={s.pos}
      sortKey={sortKey}
      sortDir={s.sortDir}
      full={full}
      current={s.player}
      onSort={(k, d) => set({ sortKey: k, sortDir: d })}
      onShowAll={() => set({ page: "players" })}
      onPick={(id) => openPlayer(id, s.season, true)}
    />
  );
  // Contract status only exists for the newest season, so this section only shows there.
  const faYear = s.season + 1;
  const isFa = (r: Rec) => r.fa === faYear;
  const hasFa = db.recs(s.season, s.model).some(isFa);
  const rise = {
    hidden: { opacity: 0, y: 14 },
    show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: EASE } },
  };

  return (
    <>
      {s.page === "players" ? (
        <header className={`${WRAP} pb-[clamp(24px,3vw,36px)] pt-[clamp(32px,5vw,56px)]`}>
          <nav aria-label="Breadcrumb">
            <ol className="flex items-center gap-2 text-[0.9375rem] text-muted">
              <li>
                <a
                  href={toUrl(db, { ...s, page: "home" })}
                  onClick={(e) => { if (e.button || e.metaKey || e.ctrlKey || e.shiftKey) return; e.preventDefault(); set({ page: "home" }); }}
                  className="text-ink-2 underline decoration-line-strong underline-offset-[3px] transition-colors hover:text-chalk hover:decoration-bulb"
                >
                  Dashboard
                </a>
              </li>
              <li aria-hidden>/</li>
              <li aria-current="page" className="text-chalk">All players</li>
            </ol>
          </nav>
          <h1 className="mt-4 text-[clamp(2.5rem,5.2vw,4.5rem)] font-extrabold uppercase leading-[0.95] tracking-[-0.02em]">All players</h1>
        </header>
      ) : (
      /* The one orchestrated moment: the headline rises line by line, then the rest settles in. */
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
      )}

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
          <Select label="Team" value={s.team} onChange={(team) => set({ team })}>
            <option value="all">All teams</option>
            {teams.map((t) => <option key={t} value={t}>{teamName(t)}</option>)}
          </Select>
          <div className="max-sm:col-span-2">
          <Select label="Position" value={s.pos} onChange={(pos) => set({ pos })}>
            {Object.entries(POSITIONS).filter(([, p]) => !p.group).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
            {[...new Set(Object.values(POSITIONS).map((p) => p.group).filter(Boolean))].map((g) => (
              <optgroup key={g} label={g}>
                {Object.entries(POSITIONS).filter(([, p]) => p.group === g).map(([k, p]) => <option key={k} value={k}>{p.label}</option>)}
              </optgroup>
            ))}
          </Select>
          </div>
        </div>
      </motion.nav>

      {s.page === "players" ? (
        <main className={`${WRAP} pt-[clamp(24px,3vw,36px)]`}>{board(true)}</main>
      ) : (
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
          <div className="flex items-start gap-3">
            <Search
              db={db}
              season={s.season}
              onPick={(id, season) => (comparing ? set({ vs: id, vsSeason: season }) : openPlayer(id, season, false))}
              placeholder={comparing && s.player ? `Compare ${db.players.get(s.player)!.name} with…` : undefined}
            />
            {s.player && (
              <button
                type="button"
                onClick={() => {
                  if (comparing) { setPicking(false); set({ vs: null, vsSeason: null }); }
                  else { setPicking(true); document.getElementById("player-search")?.focus(); }
                }}
                className="h-12 flex-none cursor-pointer rounded-xl border border-line-strong bg-panel px-4 font-semibold text-ink-2 transition-colors hover:border-ink-2 hover:text-chalk"
              >
                {comparing ? "Done comparing" : "Compare"}
              </button>
            )}
          </div>
          <div className={`grid gap-5 max-[900px]:grid-cols-1 ${comparing ? "grid-cols-2" : "grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]"}`}>
            <div ref={cardRef} className="min-w-0 scroll-mt-24">
              <PlayerCard
                db={db}
                playerId={s.player}
                cardSeason={s.cardSeason}
                season={s.season}
                model={s.model}
                onCardSeason={(cardSeason) => set({ cardSeason })}
              />
            </div>
            {comparing ? (
              <div className="min-w-0">
                <PlayerCard
                  db={db}
                  playerId={s.vs}
                  cardSeason={s.vsSeason}
                  season={s.season}
                  model={s.model}
                  onCardSeason={(vsSeason) => set({ vsSeason })}
                />
              </div>
            ) : board(false)}
          </div>
          {comparing && <div className="mt-5">{board(false)}</div>}
        </motion.section>

        {hasFa && (
          <section id="free-agents" aria-labelledby="fa-title" className={SECTION}>
            <SectionHead
              id="fa-title"
              title="Free-agent watch"
              note={`Players whose contracts run out after ${db.label(s.season)}, per Baseball-Reference. Predicted is what the model says this season was worth, a rough guide to the next contract. An option for ${faYear} can keep a player off the market.`}
            />
            <Leaderboard
              db={db}
              season={s.season}
              model={s.model}
              team={s.team}
              pos={s.pos}
              sortKey={faSort[0]}
              sortDir={faSort[1]}
              full={faAll}
              current={s.player}
              onSort={(k, d) => setFaSort([k, d])}
              onShowAll={() => setFaAll(true)}
              onPick={(id) => openPlayer(id, s.season, true)}
              only={isFa}
              title={`Free agents after ${db.label(s.season)}`}
              tag={(r) => r.fa_option && `${r.fa_option} option`}
            />
          </section>
        )}

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
            pos={s.pos}
            picked={picked}
            unit={unit}
            onPicked={setPickedSeasons}
            onUnit={setUnit}
            onPick={(id, season) => openPlayer(id, season, true)}
          />
        </section>

        <section id="teams" aria-labelledby="teams-title" className={SECTION}>
          <SectionHead id="teams-title" title="Team surplus" />
          <TeamBars db={db} season={s.season} model={s.model} team={s.team} pos={s.pos} />
          <TeamTrend db={db} season={s.season} model={s.model} team={s.team} pos={s.pos} />
        </section>

        <Method db={db} />
      </main>
      )}

      <Footer db={db} />
    </>
  );
}
