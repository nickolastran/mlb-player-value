import { useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { normalize, type Db, type Player } from "./lib";
import { Headshot, TeamLogo } from "./ui";

// Combobox over every qualifying player.
export function Search({ db, season, onPick }: { db: Db; season: number; onPick: (id: string, season: number) => void }) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listRef = useRef<HTMLUListElement>(null);

  const matches = useMemo<Player[]>(() => {
    const nq = normalize(q.trim());
    if (!nq) return [];
    const words = nq.split(/\s+/);
    const last = (p: Player) => p.seasons[p.seasons.length - 1];
    return [...db.players.values()]
      .filter((p) => words.every((w) => p.key.split(" ").some((part) => part.startsWith(w)) || p.key.includes(w)))
      .sort((a, b) => (a.key.startsWith(nq) ? 0 : 1) - (b.key.startsWith(nq) ? 0 : 1) || last(b) - last(a) || a.name.localeCompare(b.name))
      .slice(0, 8);
  }, [db, q]);

  const shown = open && q.trim() !== "";

  const choose = (i: number) => {
    const p = matches[i];
    if (!p) return;
    setQ(p.name);
    setOpen(false);
    onPick(p.id, p.seasons.includes(season) ? season : p.seasons[p.seasons.length - 1]);
  };

  const move = (i: number) => {
    setActive(i);
    listRef.current?.children[i]?.scrollIntoView({ block: "nearest" });
  };

  return (
    <div className="relative mb-5 max-w-[560px]">
      <label htmlFor="player-search" className="sr-only">Search players</label>
      <svg aria-hidden viewBox="0 0 20 20" className="pointer-events-none absolute left-4 top-1/2 size-[18px] -translate-y-1/2 text-muted">
        <circle cx="8.5" cy="8.5" r="5.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
        <path d="m13 13 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <input
        id="player-search"
        type="search"
        autoComplete="off"
        spellCheck={false}
        placeholder="Search a player, e.g. Aaron Judge"
        role="combobox"
        aria-expanded={shown}
        aria-controls="search-results"
        aria-autocomplete="list"
        aria-activedescendant={shown && matches.length ? `sr-${active}` : undefined}
        value={q}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={(e) => {
          if (!shown) return;
          if (e.key === "ArrowDown") { e.preventDefault(); move(Math.min(active + 1, matches.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); move(Math.max(active - 1, 0)); }
          else if (e.key === "Enter") { e.preventDefault(); choose(active); }
          else if (e.key === "Escape") setOpen(false);
        }}
        className="h-12 w-full rounded-xl border border-line-strong bg-panel pl-11 pr-4 text-[1.0625rem] text-chalk placeholder:text-muted transition-colors hover:border-ink-2 focus:border-bulb focus:outline-none"
      />
      <AnimatePresence>
        {shown && (
          <motion.ul
            ref={listRef}
            id="search-results"
            role="listbox"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98, transition: { duration: 0.12 } }}
            transition={{ duration: 0.18 }}
            className="absolute inset-x-0 top-[calc(100%+6px)] z-30 max-h-[360px] origin-top overflow-y-auto rounded-xl border border-line-strong bg-panel-2 p-1.5 shadow-[0_18px_44px_rgba(3,8,15,0.55)]"
          >
            {matches.length === 0 && (
              <li className="px-3 py-2.5 text-ink-2">
                No qualifying player by that name. Hitters need {db.manifest.min_pa}+ PA and pitchers {db.manifest.min_ip}+ IP in a season.
              </li>
            )}
            {matches.map((p, i) => {
              const first = p.seasons[0], last = p.seasons[p.seasons.length - 1];
              const team = db.find(last, "market", p.id)?.team ?? "";
              return (
                <li
                  key={p.id}
                  id={`sr-${i}`}
                  role="option"
                  aria-selected={i === active}
                  onMouseDown={(e) => { e.preventDefault(); choose(i); }}
                  onMouseEnter={() => setActive(i)}
                  className={`flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 ${i === active ? "bg-line" : ""}`}
                >
                  <span className="flex items-center gap-3">
                    <Headshot db={db} id={p.id} size={34} />
                    {p.name}
                  </span>
                  <span className="flex items-center gap-1.5 whitespace-nowrap text-sm text-muted">
                    {team && <TeamLogo code={team} size={18} />}
                    {team}&ensp;{first === last ? db.label(first) : `${db.label(first)} to ${db.label(last)}`}
                  </span>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
