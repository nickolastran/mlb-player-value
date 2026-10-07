import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { inPos, money, scopeLabel, SORTS, teamLogo, type Db, type ModelId, type Rec, type SortDir, type SortKey } from "./lib";
import { Headshot, Select, TeamLogo } from "./ui";

const BOARD_ROWS = 17;

const link = "cursor-pointer text-[0.9375rem] text-ink-2 underline decoration-line-strong underline-offset-[3px] transition-colors hover:text-chalk hover:decoration-chalk";

const dirText = (dir: SortDir) => (dir === "desc" ? "High to low" : "Low to high");

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

  // Every row the filters and sort give, not just the ones shown. The BOM keeps accents intact in Excel.
  const download = () => {
    const esc = (v: unknown) => {
      const t = v == null ? "" : String(v);
      return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
    };
    const head = ["Rank", "Player", "Team", "Pos", "Age", "Service", "WAR", "Salary", "Salary estimated", "Predicted", "Surplus", ...(tag ? ["Note"] : [])];
    const lines = [head, ...rows.map((r, i) => [
      i + 1, r.player, r.team, r.pos, r.age, r.service, r.war, r.salary, r.salary_est, r.pred, r.surplus, ...(tag ? [tag(r)] : []),
    ])].map((l) => l.map(esc).join(","));
    const name = [heading ?? `players ${season}`, db.model(model).short, team !== "all" && team, pos !== "all" && pos]
      .filter(Boolean).join(" ").toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv" }));
    a.download = `mlb-${name}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

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
