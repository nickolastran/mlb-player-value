import { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Config, Data, Layout, PlotMouseEvent } from "plotly.js-dist-min";
import {
  C, escapeHtml, FONT, inPos, POSITIONS, jitter, money, pct, scopeLabel, seasonColor, teamColor, teamLogo, teamName,
  type Db, type ModelId, type Rec, type Unit,
} from "./lib";
import { EASE, Segmented } from "./ui";

// Plotly is ~1MB gzipped, so it loads after the page is up.
type PlotlyLib = (typeof import("plotly.js-dist-min"))["default"];
let plotlyP: Promise<PlotlyLib> | null = null;
const getPlotly = () => (plotlyP ??= import("plotly.js-dist-min").then((m) => m.default));

const plotConfig: Partial<Config> = {
  responsive: true,
  scrollZoom: true,
  displaylogo: false,
  doubleClick: "reset+autosize",
  modeBarButtonsToRemove: ["select2d", "lasso2d", "autoScale2d"],
  toImageButtonOptions: { format: "png", filename: "mlb-player-value", scale: 2 },
};

type Pick = (id: string, season: number) => void;
type PlotEl = HTMLDivElement & { on?: (ev: string, fn: (e: PlotMouseEvent) => void) => void };

function Plot({ data, layout, onPick, className, label }: {
  data: Data[];
  layout: Partial<Layout>;
  onPick?: Pick;
  className: string;
  label: string;
}) {
  const ref = useRef<PlotEl>(null);
  const pick = useRef(onPick);
  pick.current = onPick;
  const wired = useRef(false);

  useEffect(() => {
    let alive = true;
    getPlotly().then((P) => {
      const el = ref.current;
      if (!alive || !el) return;
      P.react(el, data, layout, plotConfig);
      if (!wired.current && el.on) {
        wired.current = true;
        el.on("plotly_click", (ev) => {
          const cd = ev.points?.[0]?.customdata as unknown;
          if (Array.isArray(cd)) pick.current?.(cd[0] as string, cd[1] as number);
        });
      }
    });
    return () => { alive = false; };
  }, [data, layout]);

  useEffect(() => () => {
    const el = ref.current;
    if (el) getPlotly().then((P) => P.purge(el));
  }, []);

  return <div ref={ref} className={className} role="img" aria-label={label} />;
}

function Empty({ message, className }: { message: string; className: string }) {
  return (
    <div className={`${className} flex items-center justify-center`}>
      <p className="max-w-[46ch] p-6 text-center text-ink-2">{message}</p>
    </div>
  );
}

function baseLayout(extra: Partial<Layout> = {}): Partial<Layout> {
  return {
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    font: { family: FONT, color: C.text2, size: 13 },
    margin: { l: 64, r: 16, t: 12, b: 56 },
    hovermode: "closest",
    hoverdistance: 24,
    dragmode: "zoom",
    hoverlabel: { bgcolor: C.panel2, bordercolor: C.lineStrong, font: { family: FONT, color: C.text, size: 13 }, align: "left" },
    legend: {
      orientation: "h", x: 0, xanchor: "left", y: -0.16, yanchor: "top",
      font: { size: 12, color: C.text2 }, itemclick: "toggle", itemdoubleclick: "toggleothers",
      bgcolor: "rgba(0,0,0,0)",
    },
    ...extra,
  };
}
function axis(title: string, extra: Record<string, unknown> = {}) {
  return {
    title: { text: title, font: { size: 13, color: C.text2 }, standoff: 10 },
    gridcolor: C.line, linecolor: C.lineStrong, zerolinecolor: C.lineStrong, zerolinewidth: 1,
    tickfont: { color: C.muted, size: 12 }, automargin: true,
    ...extra,
  };
}
const corner = (text: string, x: number, y: number, xanchor: "left" | "right", yanchor: "top" | "bottom") =>
  ({ text, x, y, xref: "paper" as const, yref: "paper" as const, xanchor, yanchor, showarrow: false, font: { size: 12, color: C.muted } });

function Figure({ title, note, children }: { title?: string; note?: string; children: React.ReactNode }) {
  return (
    <figure className="mb-5 rounded-xl border border-line bg-panel px-3 pb-2 pt-4">
      {(title || note) && (
        <figcaption className="px-2 pb-1">
          {title && <h3 className="text-[1.0625rem] font-semibold">{title}</h3>}
          {note && <p className="mt-1 text-[0.9375rem] text-ink-2">{note}</p>}
        </figcaption>
      )}
      {children}
    </figure>
  );
}

// ---------- Scatters ----------

type Row = Rec & { season: number };

export function Scatters({ db, season, model, team, pos, picked, unit, onPicked, onUnit, onPick }: {
  db: Db;
  season: number;
  model: ModelId;
  team: string;
  pos: string;
  picked: number[];
  unit: Unit;
  onPicked: (s: number[]) => void;
  onUnit: (u: Unit) => void;
  onPick: Pick;
}) {
  const modelInfo = db.model(model);
  const bySeason = picked.length > 1;
  const scope = scopeLabel(team, pos);
  const teamScope = scope ? ` ${scope[0].toUpperCase()}${scope.slice(1)} only.` : "";

  const rows = useMemo<Row[]>(() => {
    const out: Row[] = [];
    for (const s of [...picked].sort())
      for (const r of db.recs(s, model)) if ((team === "all" || r.team === team) && inPos(r, pos) && r.salary != null) out.push({ ...r, season: s });
    return out;
  }, [db, picked, model, team, pos]);

  const plots = useMemo(() => {
    if (!rows.length) return null;
    const usd = unit === "usd";
    const groups = new Map<string | number, Row[]>();
    for (const r of rows) {
      const k = bySeason ? r.season : r.team;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k)!.push(r);
    }
    const keys = [...groups.keys()].sort((a, b) => (bySeason ? (a as number) - (b as number) : String(a).localeCompare(String(b))));
    const gs = keys.map((k) => ({
      name: bySeason ? db.label(k as number) : (k as string),
      color: bySeason ? seasonColor(db.salarySeasons, k as number) : teamColor(k as string),
      rows: groups.get(k)!,
    }));

    const hover = (r: Row) => [
      `<b>${escapeHtml(r.player)}</b>  ${escapeHtml(r.team)}, ${db.label(r.season)}`,
      `${r.pos}, age ${r.age}, ${r.war.toFixed(1)} WAR, ${r.role === "H" ? `${r.hr} HR, ${r.ops_plus} OPS+` : `${r.ip} IP, ${r.era?.toFixed(2) ?? "—"} ERA`}`,
      r.salary_est ? `Actual <b>≈${money(r.salary)}</b> (estimated league minimum)` : `Actual <b>${money(r.salary)}</b> (${pct(r.salary_pct)} of CBT)`,
      `Predicted <b>${money(r.pred)}</b> (${pct(r.pred_pct)})`,
      `Surplus <b>${money(r.surplus, true)}</b> ${r.surplus! >= 0 ? "underpaid" : "overpaid"}`,
    ].join("<br>");

    const xVal = (r: Row) => (usd ? r.pred / 1e6 : r.pred_pct * 100);
    const yVal = (r: Row) => (usd ? r.salary! / 1e6 : r.salary_pct! * 100);
    const unitWord = usd ? "$M" : "% of CBT";
    // d3 currency format puts the minus sign before the $ (−$5M, not $−5M)
    const fmtTick = usd ? { tickformat: "$,~f", ticksuffix: "M" } : { tickformat: ",~f", ticksuffix: "%" };
    // Many seasons at once means thousands of dots: shrink them so the overlap stays readable.
    const many = picked.length > 3;
    const marker = (color: string) => ({ color, size: many ? 7 : 9, opacity: many ? 0.8 : 0.9, line: { color: "rgba(22,36,27,0.45)", width: 1 } }); // ink edge keeps pale team colors visible on the paper
    const points = (g: (typeof gs)[number], x: (r: Row) => number, y: (r: Row) => number): Data => ({
      type: "scatter",
      mode: "markers",
      name: g.name,
      x: g.rows.map(x),
      y: g.rows.map(y),
      customdata: g.rows.map((r) => [r.id, r.season]),
      text: g.rows.map(hover),
      hovertemplate: "%{text}<extra></extra>",
      marker: marker(g.color),
    }) as Data;

    const max = Math.max(...rows.map((r) => Math.max(xVal(r), yVal(r)))) * 1.04;
    const pay = {
      data: [
        { x: [0, max], y: [0, max], mode: "lines", name: "Paid exactly as predicted", line: { color: C.muted, width: 1.5, dash: "dot" }, hoverinfo: "skip", showlegend: false } as Data,
        ...gs.map((g) => points(g, xVal, yVal)),
      ],
      layout: baseLayout({
        xaxis: axis(`${modelInfo.label} prediction (${unitWord})`, { rangemode: "tozero", ...fmtTick }),
        yaxis: axis(`Actual salary (${unitWord})`, { rangemode: "tozero", ...fmtTick }),
        annotations: [corner("Overpaid", 0.01, 0.99, "left", "top"), corner("Underpaid", 0.99, 0.02, "right", "bottom")],
        showlegend: true,
      }),
    };

    const resVal = (r: Row) => (usd ? (r.salary! - r.pred) / 1e6 : r.residual_pct! * 100);
    const age = {
      data: gs.map((g) => points(g, (r) => r.age + jitter(r.id + r.season), resVal)),
      layout: baseLayout({
        xaxis: axis("Age", { dtick: 2, zeroline: false }),
        yaxis: axis(`Actual − predicted (${unitWord})`, { zeroline: true, zerolinecolor: C.text2, ...fmtTick }),
        annotations: [corner("Paid more than predicted", 0.01, 0.99, "left", "top"), corner("Paid less than predicted", 0.01, 0.01, "left", "bottom")],
        showlegend: true,
      }),
    };
    return { pay, age };
  }, [db, rows, unit, bySeason, picked.length, modelInfo]);

  const empty = picked.length === 0
    ? db.hasSalary(season)
      ? "Pick at least one season above to plot."
      : `${db.label(season)} doesn't have actual salaries in the data yet, so there's nothing to compare predictions against. Pick earlier seasons above.`
    : "No qualifying players match these filters in the selected seasons.";

  const toggle = (s: number) => {
    const next = picked.includes(s) ? picked.filter((x) => x !== s) : [...picked, s];
    onPicked(next);
  };
  const colorNote = bySeason
    ? "Colored by season, darker is more recent."
    : "Colored by team. Click a legend entry to hide it, double-click to show only that one.";
  const plotCls = "h-[520px] w-full max-sm:h-[560px]";

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <fieldset className="min-w-0">
          <legend className="mb-1.5 text-[0.8125rem] text-muted">Seasons on the charts</legend>
          <div className="flex flex-wrap gap-1.5">
            {db.manifest.seasons.map((s) => {
              const on = picked.includes(s.season);
              return (
                <label
                  key={s.season}
                  title={s.has_salary ? undefined : "No salaries for this season yet"}
                  className={`relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-chalk ${on ? "border-ink-2 bg-panel-2 text-chalk" : "border-line-strong text-ink-2"} ${s.has_salary ? "cursor-pointer hover:text-chalk" : "opacity-45"}`}
                >
                  <input type="checkbox" className="sr-only" checked={on} disabled={!s.has_salary} onChange={() => toggle(s.season)} />
                  <AnimatePresence initial={false}>
                    {on && bySeason && (
                      <motion.i
                        aria-hidden
                        className="block size-[9px] rounded-full"
                        style={{ background: seasonColor(db.salarySeasons, s.season) }}
                        initial={{ width: 0, opacity: 0 }}
                        animate={{ width: 9, opacity: 1 }}
                        exit={{ width: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: EASE }}
                      />
                    )}
                  </AnimatePresence>
                  {s.label}
                </label>
              );
            })}
            <button type="button" onClick={() => onPicked(db.salarySeasons)} className="cursor-pointer rounded-full px-2 py-1 text-sm text-muted transition-colors hover:text-chalk">
              All seasons
            </button>
            <button type="button" onClick={() => onPicked(db.hasSalary(season) ? [season] : [])} className="cursor-pointer rounded-full px-2 py-1 text-sm text-muted transition-colors hover:text-chalk">
              Just the selected season
            </button>
          </div>
        </fieldset>
        <Segmented id="unit" label="Units" small value={unit} onChange={onUnit} options={[{ value: "usd", label: "Dollars" }, { value: "pct", label: "% of CBT" }]} />
      </div>

      <Figure
        title="Actual salary vs. predicted salary"
        note={`Dots above the line are paid more than the ${modelInfo.label.toLowerCase()} model predicts; dots below are bargains. ${colorNote}${teamScope}`}
      >
        {plots
          ? <Plot data={plots.pay.data} layout={plots.pay.layout} onPick={onPick} className={plotCls} label="Scatter plot of actual salary against predicted salary" />
          : <Empty message={empty} className={plotCls} />}
      </Figure>
      <Figure
        title="Over- or underpaid, by age"
        note={`Actual minus predicted salary under the ${modelInfo.label.toLowerCase()} model. Above zero means paid more than predicted.${teamScope}`}
      >
        {plots
          ? <Plot data={plots.age.data} layout={plots.age.layout} onPick={onPick} className={plotCls} label="Scatter plot of residual against player age" />
          : <Empty message={empty} className={plotCls} />}
      </Figure>
    </>
  );
}

// ---------- Team surplus bars ----------

export function TeamBars({ db, season, model, team, pos }: { db: Db; season: number; model: ModelId; team: string; pos: string }) {
  const reduce = useReducedMotion();
  const modelInfo = db.model(model);

  const result = useMemo(() => {
    const transition = reduce ? undefined : { duration: 500, easing: "cubic-in-out" as const };
    const who = pos === "all" ? "players" : `players (${POSITIONS[pos].label.toLowerCase()})`;
    const barStyle = (values: number[]) => ({ color: values.map((v) => (v >= 0 ? C.under : C.over)), line: { width: 0 } });

    if (team === "all") {
      if (!db.hasSalary(season)) {
        return {
          note: "Predicted minus actual salary, summed across each roster's qualifying players.",
          empty: `${db.label(season)} doesn't have actual salaries in the data yet. Pick an earlier season to see team surplus.`,
        };
      }
      const sums = new Map<string, { usd: number; pct: number; n: number }>();
      for (const r of db.recs(season, model)) {
        if (r.salary == null || r.traded || !inPos(r, pos)) continue;
        const t = sums.get(r.team) ?? { usd: 0, pct: 0, n: 0 };
        t.usd += r.surplus!; t.pct += r.surplus_pct!; t.n += 1;
        sums.set(r.team, t);
      }
      const teams = [...sums.entries()].sort((a, b) => b[1].usd - a[1].usd);
      const y = teams.map(([, v]) => v.usd / 1e6);
      return {
        note: `${modelInfo.label} prediction minus actual salary, summed across each roster's qualifying ${who} in ${db.label(season)}. Blue teams got more production than they paid for. Traded players are left out because their salary can't be split by team.`,
        data: [{
          type: "bar",
          x: teams.map(([t]) => t),
          y,
          marker: barStyle(y),
          text: teams.map(([t, v]) => `<b>${escapeHtml(teamName(t))}</b><br>Surplus <b>${money(v.usd, true)}</b> (${pct(v.pct, true)} of CBT)<br>${v.n} qualifying players`),
          hovertemplate: "%{text}<extra></extra>",
          textposition: "none",
        }] as Data[],
        layout: baseLayout({
          // Team logos stand in for tick labels; hover still names the team.
          images: teams.map(([t]) => ({
            source: teamLogo(t) ?? undefined, xref: "x", yref: "paper", x: t, y: -0.03,
            sizex: 0.8, sizey: 0.09, xanchor: "center", yanchor: "top", layer: "above",
          })),
          xaxis: axis("", { showgrid: false, showticklabels: false }),
          yaxis: axis(`Total surplus, ${db.label(season)} ($M)`, { tickformat: "$,~f", ticksuffix: "M", zeroline: true, zerolinecolor: C.text2 }),
          bargap: 0.3,
          barcornerradius: 4,
          showlegend: false,
          margin: { l: 64, r: 16, t: 12, b: 52 },
          transition,
        } as Partial<Layout>),
      };
    }

    // One team across every season with salaries, in % of CBT so seasons compare fairly.
    const vals = db.manifest.seasons.filter((s) => s.has_salary).map((s) => {
      const rows = db.recs(s.season, model).filter((r) => r.team === team && inPos(r, pos) && r.salary != null);
      return { s, n: rows.length, usd: rows.reduce((a, r) => a + r.surplus!, 0), pct: rows.reduce((a, r) => a + r.surplus_pct!, 0) };
    });
    const y = vals.map((v) => v.pct * 100);
    return {
      note: `${teamName(team)}: ${modelInfo.label.toLowerCase()} prediction minus actual salary, summed across qualifying ${who} each season, as a share of that season's tax threshold so the years compare fairly. The outlined bar is the selected season. Traded players are left out.`,
      data: [{
        type: "bar",
        x: vals.map((v) => v.s.label),
        y,
        marker: { ...barStyle(y), line: { color: vals.map((v) => (v.s.season === season ? C.text : "rgba(0,0,0,0)")), width: 2 } },
        text: vals.map((v) => `<b>${escapeHtml(teamName(team))}, ${v.s.label}</b><br>Surplus <b>${pct(v.pct, true)}</b> of CBT (${money(v.usd, true)})<br>${v.n} qualifying players`),
        hovertemplate: "%{text}<extra></extra>",
        textposition: "none",
      }] as Data[],
      layout: baseLayout({
        xaxis: axis("", { showgrid: false, type: "category" }), // "2016" etc. would otherwise plot as numbers, leaving a gap at 2020
        yaxis: axis("Total surplus (% of CBT)", { ticksuffix: "%", zeroline: true, zerolinecolor: C.text2 }),
        bargap: 0.3,
        barcornerradius: 4,
        showlegend: false,
        transition,
      } as Partial<Layout>),
    };
  }, [db, season, model, team, pos, modelInfo, reduce]);

  const cls = "h-[440px] w-full max-sm:h-[420px]";
  return (
    <>
      <p className="-mt-3 mb-5 max-w-[70ch] text-ink-2">{result.note}</p>
      <Figure>
        {"data" in result && result.data
          ? <Plot data={result.data} layout={result.layout} className={cls} label="Bar chart of total team surplus" />
          : <Empty message={result.empty!} className={cls} />}
      </Figure>
    </>
  );
}

// ---------- Team surplus over time ----------

// One line per team in % of CBT so seasons compare fairly. Thirty lines are unreadable,
// so only the selected team, or the three best and worst on average, get color.
export function TeamTrend({ db, season, model, team, pos }: { db: Db; season: number; model: ModelId; team: string; pos: string }) {
  const seasons = useMemo(() => db.manifest.seasons.filter((s) => s.has_salary), [db]);

  const { lines, best, worst } = useMemo(() => {
    const lines = db.manifest.teams.map((t) => {
      const vals = seasons.map((s) => {
        const rows = db.recs(s.season, model).filter((r) => r.team === t && r.salary != null && !r.traded && inPos(r, pos));
        return rows.length ? rows.reduce((a, r) => a + r.surplus_pct!, 0) : null;
      });
      const got = vals.filter((v) => v != null);
      return { team: t, vals, avg: got.length ? got.reduce((a, v) => a + v, 0) / got.length : 0 };
    }).sort((a, b) => b.avg - a.avg);
    return { lines, best: new Set(lines.slice(0, 3).map((l) => l.team)), worst: new Set(lines.slice(-3).map((l) => l.team)) };
  }, [db, seasons, model, pos]);

  const plot = useMemo(() => {
    const color = (t: string) =>
      team !== "all" ? (t === team ? C.text : null) : best.has(t) ? C.under : worst.has(t) ? C.over : null;
    const x = seasons.map((s) => s.label);
    // Grey lines first so the colored ones draw on top.
    const ordered = [...lines].sort((a, b) => Number(color(a.team) != null) - Number(color(b.team) != null));
    const data = ordered.map((l): Data => {
      const c = color(l.team);
      const end = l.vals.findLastIndex((v) => v != null);
      return {
        type: "scatter",
        mode: c ? "lines+markers+text" : "lines",
        x,
        y: l.vals.map((v) => (v == null ? null : v * 100)),
        line: { color: c ?? C.lineStrong, width: 2 },
        marker: { color: c ?? C.lineStrong, size: 8, line: { color: C.panel, width: 2 } },
        opacity: c ? 1 : 0.7,
        hovertext: l.vals.map((v, i) => `<b>${escapeHtml(teamName(l.team))}, ${x[i]}</b><br>Surplus <b>${pct(v, true)}</b> of CBT<br>Average ${pct(l.avg, true)}`),
        hovertemplate: "%{hovertext}<extra></extra>",
        // Team code at the end of each colored line, so identity isn't color alone.
        text: l.vals.map((_, i) => (i === end ? l.team : "")),
        textposition: "middle right",
        textfont: { size: 12, color: C.text },
        cliponaxis: false,
        connectgaps: true,
        showlegend: false,
      } as Data;
    });
    const sel = seasons.findIndex((s) => s.season === season);
    return {
      data,
      layout: baseLayout({
        xaxis: axis("", { showgrid: false, type: "category" }),
        yaxis: axis("Total surplus (% of CBT)", { ticksuffix: "%", zeroline: true, zerolinecolor: C.text2 }),
        // Category index, not the label: a shape reads "2026" as index 2026.
        shapes: sel >= 0 ? [{ type: "line", xref: "x", yref: "paper", x0: sel, x1: sel, y0: 0, y1: 1, line: { color: C.text, width: 1, dash: "dot" } }] : [],
        margin: { l: 64, r: 48, t: 12, b: 40 },
      } as Partial<Layout>),
    };
  }, [lines, best, worst, seasons, season, team]);

  const who = pos === "all" ? "players" : `players (${POSITIONS[pos].label.toLowerCase()})`;
  const key = team === "all"
    ? "Blue lines are the three teams with the best average surplus, red the three worst."
    : `The black line is the ${teamName(team)}.`;
  const cls = "h-[440px] w-full max-sm:h-[420px]";
  return (
    <Figure
      title="Team surplus over time"
      note={`${db.model(model).label} prediction minus actual salary, summed across each roster's qualifying ${who}, as a share of each season's tax threshold. ${key} Grey lines are the other teams; hover any line to name it. Traded players are left out.`}
    >
      <Plot data={plot.data} layout={plot.layout} className={cls} label="Line chart of each team's total surplus by season" />
      <details className="px-2 pb-2 text-[0.9375rem]">
        <summary className="cursor-pointer text-ink-2 hover:text-chalk">Show as a table</summary>
        <div className="mt-2 overflow-x-auto">
          <table className="w-full border-collapse tabular-nums">
            <thead>
              <tr className="text-left text-muted">
                <th scope="col" className="py-1 pr-3 font-medium">Team</th>
                {seasons.map((s) => <th key={s.season} scope="col" className="py-1 pr-3 text-right font-medium">{s.label}</th>)}
                <th scope="col" className="py-1 text-right font-medium">Average</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l) => (
                <tr key={l.team} className="border-t border-line">
                  <th scope="row" className="py-1 pr-3 text-left font-medium">{teamName(l.team)}</th>
                  {l.vals.map((v, i) => <td key={i} className="py-1 pr-3 text-right">{pct(v, true)}</td>)}
                  <td className="py-1 text-right font-semibold">{pct(l.avg, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </Figure>
  );
}
