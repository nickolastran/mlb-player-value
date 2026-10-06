import { AnimatePresence, motion } from "motion/react";
import { money, ordinal, pct, rate, teamColor, teamName, type Db, type ModelId } from "./lib";
import { EASE, Headshot, TeamLogo, Tween } from "./ui";

const usd = (v: number) => money(v);
const usdSigned = (v: number) => money(v, true);
const share = (v: number) => pct(v);

// The broadcast stat graphic: team stripe, name, stat line, then the money.
export function PlayerCard({ db, playerId, cardSeason, season, model, onCardSeason }: {
  db: Db;
  playerId: string | null;
  cardSeason: number | null;
  season: number;
  model: ModelId;
  onCardSeason: (s: number) => void;
}) {
  const player = playerId ? db.players.get(playerId) : undefined;
  if (!player || cardSeason == null) {
    return (
      <div className="rounded-xl border border-line bg-panel px-6 py-7 text-ink-2">
        Search for a player above, or pick one from the table.
      </div>
    );
  }

  const rec = { market: db.find(cardSeason, "market", player.id)!, production: db.find(cardSeason, "production", player.id)! };
  const base = rec.market;
  const info = db.info(cardSeason)!;
  const color = teamColor(base.team);
  const service = base.service != null ? `, ${base.service.toFixed(1)} years of service` : "";

  const tags: string[] = [];
  if (!player.seasons.includes(season))
    tags.push(`Not in ${db.label(season)}: under ${db.manifest.min_pa} PA / ${db.manifest.min_ip} IP, or not in the majors.`);
  tags.push({
    train: "Training row: the models saw this season (footnote b)",
    test: "Held-out test row: the models never saw this season",
    projection: base.salary != null ? `${info.label}: a season the models never saw` : `${info.label} projection: no actual salary on record`,
  }[base.split]);

  const line: [string | number | undefined, string][] = base.role === "H"
    ? [[base.pa, "PA"], [base.hr, "HR"], [`${rate(base.avg)}/${rate(base.obp)}/${rate(base.slg)}`, "AVG/OBP/SLG"], [base.ops_plus, "OPS+"], [base.war, "WAR"]]
    : [[base.ip, "IP"], [base.era?.toFixed(2), "ERA"], [base.so, "Strikeouts"], [base.pos === "RP" ? base.sv : base.gs, base.pos === "RP" ? "Saves" : "Starts"], [base.war, "WAR"]];

  const gap = rec.production.pred - rec.market.pred;

  return (
    <article className="h-full overflow-hidden rounded-xl border border-line bg-panel" aria-live="polite">
      <div className="relative overflow-hidden border-b border-line py-5 pl-7 pr-5 max-sm:pl-6">
        {/* Team stripe and headshot re-enter whenever the player or team changes */}
        <AnimatePresence initial={false} mode="popLayout">
          <motion.div
            key={`stripe-${player.id}-${base.team}`}
            aria-hidden
            className="absolute inset-y-0 left-0 w-1.5 origin-top"
            style={{ background: color }}
            initial={{ scaleY: 0 }}
            animate={{ scaleY: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.5, ease: EASE }}
          />
        </AnimatePresence>

        <div className="relative flex items-start gap-4">
          <div className="min-w-0 flex-1">
            <p className="mb-2 flex items-center gap-2 text-sm font-medium text-ink-2">
              <TeamLogo key={base.team} code={base.team} size={22} />
              {teamName(base.team)}
            </p>
            <div className="overflow-hidden">
              <AnimatePresence initial={false} mode="popLayout">
                <motion.h3
                  key={player.id}
                  className="text-[clamp(1.875rem,4vw,2.625rem)] font-extrabold uppercase leading-[0.98] tracking-[-0.015em] [overflow-wrap:anywhere]"
                  initial={{ y: "105%" }}
                  animate={{ y: 0 }}
                  exit={{ y: "-105%" }}
                  transition={{ duration: 0.45, ease: EASE }}
                >
                  {player.name}
                </motion.h3>
              </AnimatePresence>
            </div>
            <p className="mt-2 text-ink-2">
              {base.pos}, age {base.age}{service}. {info.label} season.
            </p>
          </div>
          <AnimatePresence initial={false} mode="popLayout">
            <motion.div
              key={`photo-${player.id}`}
              className="rounded-full p-[3px]"
              style={{ background: color }}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.45, ease: EASE }}
            >
              <Headshot db={db} id={player.id} size={112} className="max-sm:!size-[76px]" />
            </motion.div>
          </AnimatePresence>
        </div>

        {player.seasons.length > 1 && (
          <div role="group" aria-label="Seasons for this player" className="relative mt-3.5 flex flex-wrap gap-1.5">
            {player.seasons.map((s) => {
              const on = s === cardSeason;
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => onCardSeason(s)}
                  className={`relative cursor-pointer rounded-full border px-2.5 py-0.5 text-[0.8125rem] transition-colors ${on ? "border-bulb font-semibold text-bulb-ink" : "border-line-strong text-ink-2 hover:border-ink-2 hover:text-chalk"}`}
                >
                  {on && (
                    <motion.span layoutId="card-season-pill" className="absolute inset-0 rounded-full bg-bulb" transition={{ type: "spring", bounce: 0.18, duration: 0.4 }} />
                  )}
                  <span className="relative">{db.label(s)}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="relative mt-3.5 flex flex-col items-start gap-1.5">
          {tags.map((t) => (
            <span key={t} className="border-l-2 border-line-strong pl-2 text-[0.8125rem] text-ink-2">{t}</span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_1fr_1.9fr_1fr_1fr] border-b border-line">
        {line.map(([v, label], i) => (
          <div key={label} className={`px-2 py-3.5 text-center max-sm:px-1 max-sm:py-3 ${i ? "border-l border-line" : ""}`}>
            <motion.span
              key={`${player.id}-${cardSeason}-${label}`}
              className={`block font-bold leading-none tabular-nums ${label === "AVG/OBP/SLG" ? "text-[1.5rem] max-sm:text-[1.0625rem]" : "text-[1.75rem] max-sm:text-[1.375rem]"}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.35, delay: i * 0.05, ease: EASE }}
            >
              {v ?? "—"}
            </motion.span>
            <span className="mt-1.5 block text-xs text-muted max-sm:text-[0.6875rem]">{label}</span>
          </div>
        ))}
      </div>

      <div className="p-5 pt-[18px] max-sm:p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
          <span className="text-ink-2">Actual salary</span>
          {base.salary != null ? (
            <span className="text-right">
              <span className="text-[1.75rem] font-bold tabular-nums">
                {base.salary_est && "≈"}<Tween value={base.salary} format={usd} />
              </span>
              <span className="ml-2 text-sm text-muted">
                {base.salary_est
                  ? "Estimated at the league minimum: a pre-arbitration year with no salary listed"
                  : `${pct(base.salary_pct)} of tax threshold`}
              </span>
            </span>
          ) : (
            <span className="text-[1.375rem] font-bold">{info.has_salary ? "Not on record" : "Not available yet"}</span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 max-sm:grid-cols-1">
          {db.manifest.models.map((m) => {
            const r = rec[m.id];
            const on = m.id === model;
            return (
              <section
                key={m.id}
                aria-label={`${m.label} model`}
                className={`relative rounded-lg border px-3.5 py-3 transition-colors duration-300 ${on ? "border-bulb bg-bulb/[0.06]" : "border-line"}`}
              >
                <h4 className={`text-sm font-semibold transition-colors duration-300 ${on ? "text-bulb" : "text-ink-2"}`}>{m.label} predicts</h4>
                <Tween value={r.pred} format={usd} className="mt-1.5 block text-[1.625rem] font-bold leading-[1.1] tabular-nums" />
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-2.5 gap-y-0.5 text-sm [&_dd]:whitespace-nowrap">
                  <dt className="text-muted">Share of CBT</dt>
                  <dd className="text-right tabular-nums"><Tween value={r.pred_pct} format={share} /></dd>
                  {r.salary != null && r.surplus != null ? (
                    <>
                      <dt className="text-muted">Surplus</dt>
                      <dd className={`text-right tabular-nums ${r.surplus >= 0 ? "text-under" : "text-over"}`}>
                        <Tween value={r.surplus} format={usdSigned} />
                      </dd>
                      <dt className="text-muted">Value rank</dt>
                      <dd className="text-right tabular-nums">
                        {ordinal(r.surplus_rank!)} of {db.recs(cardSeason, m.id).filter((x) => x.salary != null).length}
                      </dd>
                    </>
                  ) : (
                    <>
                      <dt className="text-muted">Predicted rank</dt>
                      <dd className="text-right tabular-nums">{ordinal(r.pred_rank)} of {info.players}</dd>
                    </>
                  )}
                </dl>
              </section>
            );
          })}
        </div>

        <div className="mt-3.5 flex flex-wrap items-baseline justify-between gap-x-4 rounded-lg bg-panel-2 px-3.5 py-3">
          <span className="font-semibold">Service-time discount</span>
          <Tween value={gap} format={usdSigned} className="text-[1.375rem] font-bold tabular-nums" />
          <p className="mt-1 basis-full text-sm text-ink-2">
            {gap >= 0
              ? "How much more the stats-only production model values him than the market model. MLB's service-time rules (near-minimum pay for three years, then arbitration until six) hold his price down by about this much."
              : "The market model values him above his on-field production alone, usually because free agents with six-plus years of service get paid for past performance."}
          </p>
        </div>
      </div>
    </article>
  );
}
