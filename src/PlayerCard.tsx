import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { C, money, ordinal, pct, rate, teamColor, teamName, type Db, type ModelId, type Rec } from "./lib";
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
        {base.comps && base.comps.length > 0 && <Comps db={db} comps={base.comps} cardSeason={cardSeason} />}
        {player.seasons.length > 1 && (
          <Career key={player.id} db={db} id={player.id} seasons={player.seasons} cardSeason={cardSeason} model={model} onCardSeason={onCardSeason} />
        )}
      </div>
    </article>
  );
}

// What the closest stat lines from other seasons were actually paid.
function Comps({ db, comps, cardSeason }: { db: Db; comps: [string, number][]; cardSeason: number }) {
  const rows = comps.map(([id, s]) => db.find(s, "market", id)!);
  // Median share of that season's tax threshold, scaled to this season's, so old salaries compare fairly.
  const shares = rows.map((r) => r.salary_pct!).sort((a, b) => a - b);
  const mid = shares.length >> 1;
  const median = (shares.length % 2 ? shares[mid] : (shares[mid - 1] + shares[mid]) / 2) * db.info(cardSeason)!.cap;

  return (
    <section aria-label="Comparable players" className="mt-3.5 rounded-lg border border-line px-3.5 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h4 className="font-semibold">Players like him were paid</h4>
        <span className="text-sm text-ink-2">
          median <span className="text-lg font-bold tabular-nums text-chalk">{usd(median)}</span>
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-2">
        The closest stat lines and ages from other players' seasons. The median is scaled to the {db.label(cardSeason)} tax threshold.
      </p>
      <ul className="mt-2">
        {rows.map((r, i) => {
          const s = comps[i][1];
          const stat = r.role === "H" ? `${r.ops_plus} OPS+` : `${r.era?.toFixed(2)} ERA`;
          return (
            <li key={r.id} className="flex items-center gap-3 border-t border-line py-2 first:border-0">
              <Headshot db={db} id={r.id} size={34} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{r.player}</span>
                <span className="flex items-center gap-1.5 text-xs text-muted tabular-nums">
                  <TeamLogo code={r.team} size={14} />
                  {db.label(s)}, age {r.age}, {r.war.toFixed(1)} WAR, {stat}
                </span>
              </span>
              <span className="flex-none font-semibold tabular-nums">{usd(r.salary!)}</span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Actual vs. predicted salary across every qualifying season. Hover reads out a season, click opens it.
function Career({ db, id, seasons, cardSeason, model, onCardSeason }: {
  db: Db;
  id: string;
  seasons: number[];
  cardSeason: number;
  model: ModelId;
  onCardSeason: (s: number) => void;
}) {
  const [hover, setHover] = useState<number | null>(null);
  // x is the index in the manifest, so the skipped 2020 isn't a gap but a season he didn't qualify in is.
  const all = db.manifest.seasons.map((s) => s.season);
  const pts = seasons.map((s) => ({ s, x: all.indexOf(s), r: db.find(s, model, id)! }));
  const paid = pts.filter((p) => p.r.surplus != null);
  const total = paid.reduce((a, p) => a + p.r.surplus!, 0);

  const W = 400, H = 120, L = 14, R = 14, T = 18, B = 22;
  const x0 = pts[0].x, x1 = pts[pts.length - 1].x;
  const peak = Math.max(...pts.map((p) => Math.max(p.r.pred, p.r.salary ?? 0)));
  const step = peak > 2e7 ? 1e7 : peak > 5e6 ? 5e6 : 1e6;
  const top = Math.ceil(peak / step) * step;
  const colW = (W - L - R) / (x1 - x0);
  const X = (x: number) => L + (x - x0) * colW;
  const Y = (v: number) => T + (1 - v / top) * (H - T - B);
  const path = (get: (r: Rec) => number | null) => {
    let d = "", prev: number | null = null;
    for (const p of pts) {
      const v = get(p.r);
      if (v == null) { prev = null; continue; }
      d += `${prev != null && p.x === prev + 1 ? "L" : "M"}${X(p.x)},${Y(v)}`;
      prev = p.x;
    }
    return d;
  };

  const shown = pts.find((p) => p.s === (hover ?? cardSeason)) ?? pts[pts.length - 1];
  const sr = shown.r;

  return (
    <section aria-label="Career" className="mt-3.5 rounded-lg border border-line px-3.5 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h4 className="font-semibold">Career</h4>
        {paid.length > 0 && (
          <span className="text-sm text-ink-2">
            Surplus over {paid.length} paid season{paid.length > 1 ? "s" : ""}{" "}
            <span className={`text-lg font-bold tabular-nums ${total >= 0 ? "text-under" : "text-over"}`}>{usdSigned(total)}</span>
          </span>
        )}
      </div>
      <p aria-live="off" className="mt-1 text-sm tabular-nums text-ink-2">
        <span className="font-semibold text-chalk">{db.label(shown.s)}</span>
        {" · "}Paid {sr.salary != null ? `${sr.salary_est ? "≈" : ""}${usd(sr.salary)}` : "—"}
        {" · "}Predicted {usd(sr.pred)}
        {sr.surplus != null && (
          <>{" · "}<span className={`whitespace-nowrap ${sr.surplus >= 0 ? "text-under" : "text-over"}`}>{usdSigned(sr.surplus)}</span></>
        )}
      </p>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="mt-1 block w-full"
        role="img"
        aria-label={`Actual and predicted salary for each season from ${db.label(pts[0].s)} to ${db.label(pts[pts.length - 1].s)}`}
        onMouseLeave={() => setHover(null)}
      >
        {[0, top].map((v) => (
          <g key={v}>
            <line x1={0} x2={W} y1={Y(v)} y2={Y(v)} stroke={v ? C.line : C.lineStrong} />
            {v > 0 && <text x={0} y={Y(v) - 4} fontSize={12} fill={C.muted}>{usd(v)}</text>}
          </g>
        ))}
        {pts.map((p) => (
          <rect
            key={p.s}
            x={X(p.x) - colW / 2}
            y={T - 6}
            width={colW}
            height={H - T - B + 6}
            fill={p.s === cardSeason ? C.accent : p.s === hover ? C.panel2 : "transparent"}
            fillOpacity={p.s === cardSeason ? 0.12 : 1}
          />
        ))}
        <path d={path((r) => r.pred)} fill="none" stroke={C.text2} strokeWidth={2} strokeDasharray="5 4" />
        <path d={path((r) => r.salary)} fill="none" stroke={C.text} strokeWidth={2} />
        {pts.map((p) => (
          <g key={p.s}>
            <circle cx={X(p.x)} cy={Y(p.r.pred)} r={3.5} fill={C.text2} stroke={C.panel} strokeWidth={2} />
            {p.r.salary != null && (
              <circle cx={X(p.x)} cy={Y(p.r.salary)} r={4} fill={p.r.salary_est ? C.panel : C.text} stroke={p.r.salary_est ? C.text : C.panel} strokeWidth={2} />
            )}
            <text x={X(p.x)} y={H - 6} fontSize={12} textAnchor="middle" fill={p.s === cardSeason ? C.text : C.muted} fontWeight={p.s === cardSeason ? 600 : 400}>
              {colW < 34 ? `'${db.label(p.s).slice(-2)}` : db.label(p.s)}
            </text>
          </g>
        ))}
        {/* Hit targets on top: a whole column per season, wider than any mark. Keyboard users have the season pills. */}
        {pts.map((p) => (
          <rect
            key={p.s}
            x={X(p.x) - colW / 2}
            y={0}
            width={colW}
            height={H}
            fill="transparent"
            className="cursor-pointer"
            onMouseEnter={() => setHover(p.s)}
            onClick={() => onCardSeason(p.s)}
          />
        ))}
      </svg>
      <div aria-hidden className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
        <span className="flex items-center gap-1.5"><span className="inline-block h-0.5 w-5 bg-chalk" />Actual salary</span>
        <span className="flex items-center gap-1.5"><span className="inline-block w-5 border-t-2 border-dashed border-ink-2" />{db.model(model).label} prediction</span>
      </div>
    </section>
  );
}
