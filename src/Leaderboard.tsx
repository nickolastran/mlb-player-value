import { useMemo } from "react";
import { motion } from "motion/react";
import { money, SORTS, teamLogo, teamName, type Db, type ModelId, type Rec, type SortDir, type SortKey } from "./lib";
import { Headshot, Select, TeamLogo } from "./ui";

const BOARD_ROWS = 12;

const dirText = (key: SortKey, dir: SortDir) =>
  key === "player" ? (dir === "asc" ? "A to Z" : "Z to A") : dir === "desc" ? "High to low" : "Low to high";

export function Leaderboard({ db, season, model, team, sortKey, sortDir, showAll, current, onSort, onShowAll, onPick }: {
  db: Db;
  season: number;
  model: ModelId;
  team: string;
  sortKey: SortKey; // already the effective sort
  sortDir: SortDir;
  showAll: boolean;
  current: string | null;
  onSort: (key: SortKey, dir: SortDir) => void;
  onShowAll: (v: boolean) => void;
  onPick: (id: string) => void;
}) {
  const salary = db.hasSalary(season);

  const rows = useMemo(() => {
    const all = db.recs(season, model).filter((r) => team === "all" || r.team === team);
    const get = SORTS[sortKey].get;
    const sign = sortDir === "desc" ? -1 : 1;
    // Missing values (e.g. no salary on record) always sink to the bottom.
    return [...all].sort((a, b) => {
      const va = get(a), vb = get(b);
      if (va == null || vb == null) return Number(va == null) - Number(vb == null);
      const c = typeof va === "string" ? va.localeCompare(vb as string) : va - (vb as number);
      return sign * c || b.pred - a.pred;
    });
  }, [db, season, model, team, sortKey, sortDir]);

  const shown = showAll ? rows : rows.slice(0, BOARD_ROWS);
  const title = sortKey === "surplus"
    ? sortDir === "desc" ? "Most underpaid" : "Most overpaid"
    : `By ${SORTS[sortKey].label}, ${dirText(sortKey, sortDir).toLowerCase()}`;

  const clickHead = (key: SortKey) => {
    if (SORTS[key].needsSalary && !salary) return;
    onSort(key, sortKey === key ? (sortDir === "desc" ? "asc" : "desc") : SORTS[key].natural);
  };

  const cols: { key?: SortKey; label: string; num?: boolean; salaryCol?: boolean }[] = [
    { label: "#", num: true },
    { key: "player", label: "Player" },
    { key: "age", label: "Age", num: true },
    { key: "war", label: "WAR", num: true },
    { key: "salary", label: "Salary", num: true, salaryCol: true },
    { key: "pred", label: "Predicted", num: true },
    { key: "surplus", label: "Surplus", num: true, salaryCol: true },
  ];
  const visible = cols.filter((c) => salary || !c.salaryCol);
  const cell = "px-2 first:pl-4 last:pr-4 whitespace-nowrap";

  return (
    <div className="rounded-xl border border-line bg-panel pb-2.5 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5 px-4 pb-3">
        <h3 className="text-[1.0625rem] font-semibold">
          {title}, {db.label(season)}{team === "all" ? "" : `, ${teamName(team)}`}
        </h3>
        <div className="flex items-end gap-2">
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
            className="h-[34px] cursor-pointer rounded-lg border border-line-strong bg-panel px-3 text-sm text-ink-2 transition-colors hover:border-ink-2 hover:text-chalk"
          >
            {dirText(sortKey, sortDir)}
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
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
                    className={`${cell} border-b border-line py-2 text-[0.8125rem] font-medium text-muted ${c.num ? "text-right" : "text-left"}`}
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
                layout={showAll ? false : "position"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3, layout: { type: "spring", bounce: 0.1, duration: 0.45 } }}
                tabIndex={0}
                onClick={() => onPick(r.id)}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onPick(r.id); } }}
                className={`cursor-pointer border-b border-line outline-none transition-colors hover:bg-panel-2 focus-visible:bg-panel-2 ${r.id === current ? "bg-bulb/[0.07]" : ""}`}
              >
                <td className={`${cell} py-1.5 text-right tabular-nums text-muted`}>{i + 1}</td>
                <td className={`${cell} py-1.5 ${r.id === current ? "font-semibold text-bulb" : ""}`}>
                  <span className="flex items-center gap-2.5">
                    <Headshot key={r.id} db={db} id={r.id} size={30} />
                    {r.player}
                    {teamLogo(r.team) ? <TeamLogo key={r.team} code={r.team} size={18} /> : <span className="text-sm text-muted">{r.team}</span>}
                  </span>
                </td>
                <td className={`${cell} py-1.5 text-right tabular-nums`}>{r.age}</td>
                <td className={`${cell} py-1.5 text-right tabular-nums`}>{r.war.toFixed(1)}</td>
                {salary && <td className={`${cell} py-1.5 text-right tabular-nums`}>{r.salary_est ? "≈" : ""}{money(r.salary)}</td>}
                <td className={`${cell} py-1.5 text-right tabular-nums`}>{money(r.pred)}</td>
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

      <p className="mx-4 mt-2.5 max-w-[60ch] text-[0.8125rem] text-muted">
        Surplus is predicted minus actual salary. Positive means the player is paid less than the model says he's worth. Click a column heading to sort by it.
      </p>
      {rows.length > BOARD_ROWS && (
        <button
          type="button"
          onClick={() => onShowAll(!showAll)}
          className="cursor-pointer px-4 pb-1 pt-2.5 text-[0.9375rem] text-ink-2 underline decoration-line-strong underline-offset-[3px] transition-colors hover:text-chalk hover:decoration-bulb"
        >
          {showAll ? "Show fewer" : `Show all ${rows.length} players`}
        </button>
      )}
    </div>
  );
}
