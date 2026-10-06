import type { Db } from "./lib";

// Icon files from simple-icons (pinned: later versions drop LinkedIn) and Lucide, used as masks so they take the text colour.
const LINKS = [
  { label: "Source on GitHub", href: "https://github.com/nickolastran/mlb-player-value", icon: "https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/github.svg" },
  { label: "LinkedIn", href: "https://www.linkedin.com/in/nickolas-tran/", icon: "https://cdn.jsdelivr.net/npm/simple-icons@13.21.0/icons/linkedin.svg" },
  { label: "Website", href: "https://nickolastran.vercel.app/", icon: "https://cdn.jsdelivr.net/npm/lucide-static@1.52.0/icons/globe.svg" },
];

export function Footer({ db }: { db: Db }) {
  const seasons = db.manifest.seasons;
  const latest = seasons[seasons.length - 1];

  return (
    <footer className="mt-[72px] border-t border-line text-xs uppercase tracking-[0.06em] text-muted">
      <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-4 px-[clamp(16px,4vw,32px)] py-6">
        <div>
          <span>© {new Date().getFullYear()} Nickolas Tran · MLB Player Value</span>
          <p className="mt-1.5 text-[0.6875rem] text-muted/80">
            Data: Baseball-Reference. Not affiliated with MLB. Data through {latest.label}, updated {db.manifest.generated}.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          {LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 border border-line-strong px-2 py-1 transition-colors hover:border-bulb hover:text-chalk"
            >
              <span aria-hidden className="size-[13px] bg-current" style={{ mask: `url(${l.icon}) center / contain no-repeat` }} />
              {l.label}
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
