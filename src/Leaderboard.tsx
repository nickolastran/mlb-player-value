import { useMemo } from "react";
import { motion } from "motion/react";
import { inPos, money, scopeLabel, SORTS, teamLogo, type Db, type ModelId, type Rec, type SortDir, type SortKey } from "./lib";
import { Headshot, Select, TeamLogo } from "./ui";

const BOARD_ROWS = 17;

const dirText = (dir: SortDir) => (dir === "desc" ? "High to low" : "Low to high");

export function Leaderboard({ db, season, model, team, pos, sortKey, sortDir, full, current, onSort, onShowAll, onPick }: {
  db: Db;
  season: number;
  model: ModelId;
  team: string;
  pos: string;
  sortKey: SortKey; // already the effective sort
  sortDir: SortDir;
  full: boolean; // the all-players page
  current: string | null;
  onSort: (key: SortKey, dir: SortDir) => void;
  onShowAll: () => void;
  onPick: (id: string) => void;
}) {
  const salary = db.hasSalary(season);

  const rows = useMemo(() => {
    const all = db.recs(season, model).filter((r) => (team === "all" || r.team === team) && inPos(r, pos));
    const get = SORTS[sortKey].get;
    const sign = sortDir === "desc" ? -1 : 1;
    // Missing values (e.g. no salary on record) always sink to the bottom.
    return [...all].sort((a, b) => {
      const va = get(a), vb = get(b);
      if (va == null || vb == null) return Number(va == null) - Number(vb == null);
      return sign * (va - vb) || b.pred - a.pred;
    });
  }, [db, season, model, team, pos, sortKey, sortDir]);

  const shown = full ? rows : rows.slice(0, BOARD_ROWS);
  const title = sortKey === "surplus"
    ? sortDir === "desc" ? "Most underpaid" : "Most overpaid"
    : `By ${SORTS[sortKey].label}, ${dirText(sortDir).toLowerCase()}`;

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
  // which also drop age, WAR, predicted and team logos; surplus and salary still imply the prediction).
  const width = (label: string) => (label === "Player" ? "w-full max-w-0" : ["Age", "WAR", "Predicted"].includes(label) ? "max-sm:hidden" : "");
  const cell = "px-2 first:pl-4 last:pr-4 whitespace-nowrap";

  return (
    <div className="flex h-full flex-col rounded-xl border border-line bg-panel pb-2.5 pt-4">
      <div className="flex items-center gap-2.5 px-4 pb-3 max-sm:flex-wrap">
        <h3 className="min-w-0 flex-1 text-[1.0625rem] font-semibold">
          {[title, db.label(season), scopeLabel(team, pos)].filter(Boolean).join(", ")}
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

      <div>
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
                        className={`inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-chalk ${c.num ? "flex-row-reverse" : ""} ${on ? "font-semibold text-bulb" : ""}`}
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
                className={`cursor-pointer border-b border-line outline-none transition-colors hover:bg-panel-2 focus-visible:bg-panel-2 ${r.id === current ? "bg-bulb/[0.07]" : ""}`}
              >
                <td className={`${cell} py-1.5 text-right tabular-nums text-muted`}>{i + 1}</td>
                <td className={`${cell} ${width("Player")} py-1.5 ${r.id === current ? "font-semibold text-bulb" : ""}`}>
                  <span className="flex items-center gap-2.5 [&>*]:flex-none">
                    <Headshot key={r.id} db={db} id={r.id} size={30} />
                    <span title={r.player} className="min-w-0 flex-initial! whitespace-normal sm:truncate">{r.player}</span>
                    <span className="max-sm:hidden">{teamLogo(r.team) ? <TeamLogo key={r.team} code={r.team} size={18} /> : <span className="text-sm text-muted">{r.team}</span>}</span>
                  </span>
                </td>
                <td className={`${cell} ${width("Age")} py-1.5 text-right tabular-nums`}>{r.age}</td>
                <td className={`${cell} ${width("WAR")} py-1.5 text-right tabular-nums`}>{r.war.toFixed(1)}</td>
                {salary && <td className={`${cell} py-1.5 text-right tabular-nums`}>{r.salary_est ? "≈" : ""}{money(r.salary)}</td>}
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
      {!full && rows.length > BOARD_ROWS && (
        <button
          type="button"
          onClick={onShowAll}
          className="cursor-pointer self-start px-4 pb-1 pt-2.5 text-[0.9375rem] text-ink-2 underline decoration-line-strong underline-offset-[3px] transition-colors hover:text-chalk hover:decoration-bulb"
        >
          Show all {rows.length} players →
        </button>
      )}
    </div>
  );
}
