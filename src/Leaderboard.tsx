import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { inPos, money, scopeLabel, SORTS, teamLogo, type Db, type ModelId, type Rec, type SortDir, type SortKey } from "./lib";
import { Headshot, Segmented, Select, TeamLogo } from "./ui";

const BOARD_ROWS = 17;

const link = "cursor-pointer text-[0.9375rem] text-ink-2 underline decoration-line-strong underline-offset-[3px] transition-colors hover:text-chalk hover:decoration-chalk";

const dirText = (dir: SortDir) => (dir === "desc" ? "High to low" : "Low to high");

// Saves rows as mlb-<name parts>.csv. The BOM keeps accents intact in Excel.
function downloadCsv(name: (string | false)[], lines: unknown[][]) {
  const esc = (v: unknown) => {
    const t = v == null ? "" : String(v);
    return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob(["﻿" + lines.map((l) => l.map(esc).join(",")).join("\n")], { type: "text/csv" }));
  a.download = `mlb-${name.filter(Boolean).join(" ").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function Leaderboard({ db, season, model, team, pos, sortKey, sortDir, full, fill, current, onSort, onShowAll, onPick, only, title: heading, tag }: {
  db: Db;
  season: number;
  model: ModelId;
  team: string;
  pos: string;
  sortKey: SortKey; // already the effective sort
  sortDir: SortDir;
  full: boolean; // the all-players page
  fill?: boolean; // fill the parent's height, clipping rows that don't fit
  current: string | null;
  onSort: (key: SortKey, dir: SortDir) => void;
  onShowAll: () => void;
  onPick: (id: string) => void;
  only?: (r: Rec) => boolean; // a subset of the season, e.g. free agents
  title?: string; // replaces the sort-based title
  tag?: (r: Rec) => string | null | undefined; // a note beside the name
}) {
  const salary = db.hasSalary(season);

  const rows = useMemo(() => {
    const all = db.recs(season, model).filter((r) => (team === "all" || r.team === team) && inPos(r, pos) && (!only || only(r)));
    const get = SORTS[sortKey].get;
    const sign = sortDir === "desc" ? -1 : 1;
    // Missing values (e.g. no salary on record) always sink to the bottom.
    return [...all].sort((a, b) => {
      const va = get(a), vb = get(b);
      if (va == null || vb == null) return Number(va == null) - Number(vb == null);
      return sign * (va - vb) || b.pred - a.pred;
    });
  }, [db, season, model, team, pos, sortKey, sortDir, only]);

  // In fill mode, show as many whole rows as the box has room for. Uses the average row height,
  // so a box sized by its own content (stacked on phones) settles where it started instead of growing.
  const box = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(BOARD_ROWS);
  useEffect(() => {
    const el = box.current;
    if (!fill || !el) return;
    const ro = new ResizeObserver(() => {
      const body = el.querySelector("tbody")!, n = body.rows.length;
      if (n) setFit(Math.max(1, Math.floor((el.clientHeight - el.querySelector("thead")!.offsetHeight) / (body.offsetHeight / n))));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [fill]);
  const shown = full ? rows : rows.slice(0, fill ? fit : BOARD_ROWS);
  const title = sortKey === "surplus"
    ? sortDir === "desc" ? "Most underpaid" : "Most overpaid"
    : `By ${SORTS[sortKey].label}, ${dirText(sortDir).toLowerCase()}`;

  // Every row the filters and sort give, not just the ones shown.
  const download = () => downloadCsv([heading ?? `players ${season}`, db.model(model).short, team !== "all" && team, pos !== "all" && pos], [
    ["Rank", "Player", "Team", "Pos", "Age", "Service", "WAR", "Salary", "Salary estimated", "Predicted", "Predicted low (80%)", "Predicted high (80%)", "Surplus", ...(tag ? ["Note"] : [])],
    ...rows.map((r, i) => [
      i + 1, r.player, r.team, r.pos, r.age, r.service, r.war, r.salary, r.salary_est, r.pred, r.pred_lo, r.pred_hi, r.surplus, ...(tag ? [tag(r)] : []),
    ]),
  ]);

  const clickHead = (key: SortKey) => {
    if (SORTS[key].needsSalary && !salary) return;
    onSort(key, sortKey === key ? (sortDir === "desc" ? "asc" : "desc") : SORTS[key].natural);
  };

  const cols: { key?: SortKey; label: string; num?: boolean; salaryCol?: boolean }[] = [
    { label: "#", num: true },
    { label: "Player" },
    { key: "age", label: "Age", num: true },
    { key: "war", label: "WAR", num: true },
    { key: "salary", label: "Salary", num: true, salaryCol: true },
    { key: "pred", label: "Predicted", num: true },
    { key: "surplus", label: "Surplus", num: true, salaryCol: true },
  ];
  const visible = cols.filter((c) => salary || !c.salaryCol);
  // No sideways scrolling: the player column takes what's left and long names truncate (wrap on phones,
  // which also drop age, WAR, predicted and team logos; any two of salary, predicted and surplus imply the third).
  // The sorted column always stays; salary makes room for it.
  const sorted = cols.find((c) => c.key === sortKey)?.label;
  const mobileHidden = ["Age", "WAR", "Predicted"].map((l) => (l === sorted ? "Salary" : l));
  const width = (label: string) => (label === "Player" ? "w-full max-w-0" : mobileHidden.includes(label) ? "max-sm:hidden" : "");
  const cell = "px-2 first:pl-4 last:pr-4 whitespace-nowrap";

  return (
    <div className="flex h-full flex-col rounded-xl border border-line bg-panel pb-2.5 pt-4">
      <div className="flex items-center gap-2.5 px-4 pb-3 max-sm:flex-wrap">
        <h3 className="min-w-0 flex-1 text-[1.0625rem] font-semibold">
          {[heading ?? `${title}, ${db.label(season)}`, scopeLabel(team, pos)].filter(Boolean).join(", ")}
        </h3>
        <div className="flex flex-none items-end gap-2 max-sm:w-full max-sm:[&>label]:flex-1">
          <Select small label="Sort by" value={sortKey} onChange={(v) => onSort(v as SortKey, SORTS[v as SortKey].natural)}>
            {(Object.keys(SORTS) as SortKey[]).map((k) => (
              <option key={k} value={k} disabled={!salary && SORTS[k].needsSalary}>
                {k === "surplus" ? "Surplus (predicted − actual)" : SORTS[k].label[0].toUpperCase() + SORTS[k].label.slice(1)}
              </option>
            ))}
          </Select>
          <button
            type="button"
            aria-label="Reverse sort order"
            onClick={() => onSort(sortKey, sortDir === "desc" ? "asc" : "desc")}
            className="h-[34px] w-[6.5rem] cursor-pointer rounded-lg border border-line-strong bg-panel px-3 text-sm text-ink-2 transition-colors hover:border-ink-2 hover:text-chalk"
          >
            {dirText(sortDir)}
          </button>
        </div>
      </div>

      <div ref={box} className={fill ? "min-h-0 flex-1 overflow-hidden" : ""}>
        <table className="w-full border-collapse text-[0.9375rem]">
          <thead>
            <tr>
              {visible.map((c) => {
                const on = c.key === sortKey;
                return (
                  <th
                    key={c.label}
                    scope="col"
                    aria-sort={on ? (sortDir === "asc" ? "ascending" : "descending") : undefined}
                    className={`${cell} ${width(c.label)} border-b border-line py-2 text-[0.8125rem] font-medium text-muted ${c.num ? "text-right" : "text-left"}`}
                  >
                    {c.key ? (
                      <button
                        type="button"
                        onClick={() => clickHead(c.key!)}
                        className={`inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-chalk ${c.num ? "flex-row-reverse" : ""} ${on ? "rounded-sm bg-bulb px-1 font-semibold text-bulb-ink" : ""}`}
                      >
                        {c.label}
                        {on && <span aria-hidden>{sortDir === "desc" ? "↓" : "↑"}</span>}
                      </button>
                    ) : c.label}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {shown.map((r: Rec, i) => (
              <motion.tr
                key={r.id}
                layout={full ? false : "position"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, layout: { type: "spring", bounce: 0.1, duration: 0.45 } }}
                tabIndex={0}
                onClick={() => onPick(r.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(r.id); } }}
                className={`cursor-pointer border-b border-line outline-none transition-colors hover:bg-panel-2 focus-visible:bg-panel-2 ${r.id === current ? "bg-bulb/45" : ""}`}
              >
                <td className={`${cell} py-1.5 text-right tabular-nums text-muted`}>{i + 1}</td>
                <td className={`${cell} ${width("Player")} py-1.5 ${r.id === current ? "font-semibold" : ""}`}>
                  <span className="flex items-center gap-2.5 [&>*]:flex-none">
                    <Headshot key={r.id} db={db} id={r.id} size={30} />
                    <span title={r.player} className="min-w-0 flex-initial! whitespace-normal sm:truncate">
                      {r.player}
                      {tag?.(r) && <span className="ml-1.5 inline-block whitespace-nowrap rounded border border-line-strong px-1.5 text-xs font-normal text-muted">{tag(r)}</span>}
                    </span>
                    <span className="max-sm:hidden">{teamLogo(r.team) ? <TeamLogo key={r.team} code={r.team} size={18} /> : <span className="text-sm text-muted">{r.team}</span>}</span>
                  </span>
                </td>
                <td className={`${cell} ${width("Age")} py-1.5 text-right tabular-nums`}>{r.age}</td>
                <td className={`${cell} ${width("WAR")} py-1.5 text-right tabular-nums`}>{r.war.toFixed(1)}</td>
                {salary && <td className={`${cell} ${width("Salary")} py-1.5 text-right tabular-nums`}>{r.salary_est ? "≈" : ""}{money(r.salary)}</td>}
                <td className={`${cell} ${width("Predicted")} py-1.5 text-right tabular-nums`}>{money(r.pred)}</td>
                {salary && (
                  <td className={`${cell} py-1.5 text-right tabular-nums ${r.surplus == null ? "" : r.surplus >= 0 ? "text-under" : "text-over"}`}>
                    {r.surplus != null ? money(r.surplus, true) : "—"}
                  </td>
                )}
              </motion.tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mx-4 mt-auto max-w-[60ch] pt-2.5 text-[0.8125rem] text-muted">
        Surplus is predicted minus actual salary. Positive means the player is paid less than the model says he's worth. Click a column heading to sort by it.
      </p>
      <div className="flex flex-wrap gap-x-5 px-4 pb-1 pt-2.5">
        {!full && rows.length > BOARD_ROWS && (
          <button type="button" onClick={onShowAll} className={link}>
            Show all {rows.length} players →
          </button>
        )}
        {rows.length > 0 && (
          <button type="button" onClick={download} className={link}>
            Download CSV
          </button>
        )}
      </div>
    </div>
  );
}

interface Span {
  key: string;
  id: string;
  player: string;
  team: string; // the stint's team, or the last one in a career
  first: number;
  last: number;
  n: number;
  war: number;
  salary: number;
  pred: number;
  surplus: number;
}

// Surplus added up over several seasons: a whole career, or each stint with one team (the closest
// the data gets to a contract; leaving and coming back starts a new stint). Only seasons with a
// salary count, each scaled to the latest season's tax threshold so a 2016 dollar counts as much as a 2026 one.
export type CareerBy = "career" | "stint";

export function CareerBoard({ db, model, team, pos, by, dir, current, onView, onPick }: {
  db: Db;
  model: ModelId;
  team: string;
  pos: string;
  by: CareerBy;
  dir: SortDir;
  current: string | null;
  onView: (by: CareerBy, dir: SortDir) => void;
  onPick: (id: string, season: number) => void;
}) {
  const [all, setAll] = useState(false);
  const seasons = db.manifest.seasons;
  const latest = seasons[seasons.length - 1];

  const rows = useMemo(() => {
    const spans = new Map<string, Span>();
    const open = new Map<string, Span>(); // player id -> their latest span
    for (const s of seasons)
      for (const r of db.recs(s.season, model)) {
        if (r.surplus_pct == null || r.salary_pct == null || !(team === "all" || r.team === team) || !inPos(r, pos)) continue;
        let sp = open.get(r.id);
        if (!sp || (by === "stint" && sp.team !== r.team)) {
          sp = { key: `${r.id}|${s.season}`, id: r.id, player: r.player, team: r.team, first: s.season, last: s.season, n: 0, war: 0, salary: 0, pred: 0, surplus: 0 };
          open.set(r.id, sp);
          spans.set(sp.key, sp);
        }
        sp.team = r.team;
        sp.last = s.season;
        sp.n++;
        sp.war += r.war;
        sp.salary += r.salary_pct * latest.cap;
        sp.pred += r.pred_pct * latest.cap;
        sp.surplus += r.surplus_pct * latest.cap;
      }
    const sign = dir === "desc" ? -1 : 1;
    return [...spans.values()].filter((sp) => sp.n >= 2).sort((a, b) => sign * (a.surplus - b.surplus));
  }, [db, seasons, latest, model, team, pos, by, dir]);

  const shown = all ? rows : rows.slice(0, BOARD_ROWS);
  const cell = "px-2 first:pl-4 last:pr-4 whitespace-nowrap py-1.5 text-right tabular-nums";
  const what = by === "career" ? "careers" : "stints with one team";

  return (
    <div className="flex h-full flex-col rounded-xl border border-line bg-panel pb-2.5 pt-4">
      <div className="flex items-end gap-2.5 px-4 pb-3 max-sm:flex-wrap">
        <h3 className="min-w-0 flex-1 self-center text-[1.0625rem] font-semibold">
          {[`${dir === "desc" ? "Most underpaid" : "Most overpaid"} ${what}`, scopeLabel(team, pos)].filter(Boolean).join(", ")}
        </h3>
        <Segmented id="career-by" label="Add up" small value={by} onChange={(v) => onView(v, dir)}
          options={[{ value: "career", label: "Career" }, { value: "stint", label: "With one team" }]} />
        <Segmented id="career-dir" label="Show" small value={dir} onChange={(v) => onView(by, v)}
          options={[{ value: "desc", label: "Best value" }, { value: "asc", label: "Worst value" }]} />
      </div>

      <table className="w-full border-collapse text-[0.9375rem]">
        <thead>
          <tr className="text-[0.8125rem] text-muted">
            {["#", "Player", "Seasons", "WAR", "Paid", "Predicted", "Surplus"].map((l) => (
              <th key={l} scope="col" className={`${cell} border-b border-line py-2 font-medium ${l === "Player" ? "w-full max-w-0 text-left!" : ""} ${["Seasons", "WAR", "Predicted"].includes(l) ? "max-sm:hidden" : ""}`}>
                {l}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((sp, i) => (
            <tr
              key={sp.key}
              tabIndex={0}
              onClick={() => onPick(sp.id, sp.last)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(sp.id, sp.last); } }}
              className={`cursor-pointer border-b border-line outline-none transition-colors hover:bg-panel-2 focus-visible:bg-panel-2 ${sp.id === current ? "bg-bulb/45" : ""}`}
            >
              <td className={`${cell} text-muted`}>{i + 1}</td>
              <td className={`${cell} w-full max-w-0 text-left! ${sp.id === current ? "font-semibold" : ""}`}>
                <span className="flex items-center gap-2.5 [&>*]:flex-none">
                  <Headshot key={sp.id} db={db} id={sp.id} size={30} />
                  <span title={sp.player} className="min-w-0 flex-initial! whitespace-normal sm:truncate">{sp.player}</span>
                  <span className="max-sm:hidden">{teamLogo(sp.team) ? <TeamLogo key={sp.team} code={sp.team} size={18} /> : <span className="text-sm text-muted">{sp.team}</span>}</span>
                </span>
              </td>
              <td className={`${cell} max-sm:hidden`}>{sp.first === sp.last ? sp.first : `${sp.first}–${String(sp.last).slice(2)}`} · {sp.n}</td>
              <td className={`${cell} max-sm:hidden`}>{sp.war.toFixed(1)}</td>
              <td className={cell}>{money(sp.salary)}</td>
              <td className={`${cell} max-sm:hidden`}>{money(sp.pred)}</td>
              <td className={`${cell} ${sp.surplus >= 0 ? "text-under" : "text-over"}`}>{money(sp.surplus, true)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className="mx-4 mt-auto max-w-[70ch] pt-2.5 text-[0.8125rem] text-muted">
        Every season from {seasons[0].label} to {latest.label} with a salary on record, in {latest.label} dollars (scaled by the tax threshold).
        At least two seasons. Seasons below {db.manifest.min_pa} PA or {db.manifest.min_ip} IP, often injured ones, aren't counted, so the worst
        contracts look better than they were.
      </p>
      <div className="flex flex-wrap gap-x-5 px-4 pb-1 pt-2.5">
        {!all && rows.length > BOARD_ROWS && (
          <button type="button" onClick={() => setAll(true)} className={link}>Show all {rows.length} {by === "career" ? "careers" : "stints"} →</button>
        )}
        {rows.length > 0 && (
          <button
            type="button"
            className={link}
            onClick={() => downloadCsv([by === "career" ? "careers" : "stints", dir === "desc" ? "best" : "worst", db.model(model).short, team !== "all" && team, pos !== "all" && pos], [
              ["Rank", "Player", "Team", "First season", "Last season", "Seasons", "WAR", `Paid (${latest.label} $)`, `Predicted (${latest.label} $)`, `Surplus (${latest.label} $)`],
              ...rows.map((sp, i) => [i + 1, sp.player, sp.team, sp.first, sp.last, sp.n, +sp.war.toFixed(1), Math.round(sp.salary), Math.round(sp.pred), Math.round(sp.surplus)]),
            ])}
          >
            Download CSV
          </button>
        )}
      </div>
    </div>
  );
}
