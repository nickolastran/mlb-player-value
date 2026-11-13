import type { ReactNode } from "react";

const WRAP = "mx-auto max-w-[1180px] px-[clamp(16px,4vw,32px)]";
const ISSUES = "https://github.com/nickolastran/mlb-player-value/issues";
const UPDATED = "Nov 12, 2026";

const A = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} target="_blank" rel="noreferrer" className="text-chalk underline decoration-line-strong underline-offset-[3px] hover:decoration-chalk">
    {children}
  </a>
);

const H2 = ({ children }: { children: ReactNode }) => <h2 className="mt-9 text-[1.625rem] font-bold">{children}</h2>;

function Terms() {
  return (
    <>
      <p>MLB Player Value is a free, non-commercial project. By using the site you agree to these terms.</p>
      <H2>What the numbers are</H2>
      <p>
        Predicted salaries, surplus, ranges and next-contract values are estimates from statistical models. They're for
        curiosity and discussion, not financial, betting, contract or any other professional advice. They can be wrong,
        and the README lists the known limitations.
      </p>
      <H2>Data and images</H2>
      <p>
        Stats and salaries come from <A href="https://www.baseball-reference.com/">Baseball-Reference</A>. Player headshots
        and team logos load from MLB's image servers and belong to MLB and its clubs. This site isn't affiliated with or
        endorsed by MLB, the MLBPA, any team or Baseball-Reference. Team names and logos are trademarks of their owners.
      </p>
      <H2>No warranty</H2>
      <p>
        The site is provided as is, with no guarantee that it's accurate, complete or available. To the extent the law
        allows, the author isn't liable for anything that comes from using it.
      </p>
      <H2>Changes</H2>
      <p>These terms may change; the date above shows the latest version. Questions go to <A href={ISSUES}>GitHub issues</A>.</p>
    </>
  );
}

function Privacy() {
  return (
    <>
      <p>Short version: this site collects nothing about you.</p>
      <H2>What the site itself does</H2>
      <p>
        No accounts, no cookies, no analytics, no ads, no tracking, and nothing saved in your browser. Your filters and
        selected players live only in the page's URL, so a link you share carries them and nothing else.
      </p>
      <H2>Services the page loads from</H2>
      <p>Your browser contacts these to show the page, and each sees your IP address and browser details like any web request:</p>
      <ul className="mt-3 list-disc space-y-1.5 pl-5">
        <li><A href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">GitHub Pages</A>, which hosts the site and data files</li>
        <li><A href="https://developers.google.com/fonts/faq/privacy">Google Fonts</A>, for the typeface</li>
        <li><A href="https://www.jsdelivr.com/terms/privacy-policy-jsdelivr-net">jsDelivr</A>, for the footer icons</li>
        <li><A href="https://www.mlb.com/official-information/privacy-policy">MLB</A> (mlbstatic.com), for headshots and logos</li>
      </ul>
      <p className="mt-3">Their own privacy policies cover what they do with it. Following a link off the site (GitHub, LinkedIn) is the same.</p>
      <H2>Contact</H2>
      <p>Questions go to <A href={ISSUES}>GitHub issues</A>.</p>
    </>
  );
}

const CHANGES: [string, string[]][] = [
  ["Nov 12, 2026", ["Terms, privacy policy and this changelog."]],
  ["Oct 31, 2026", [
    "Production model trained only on free agents (6+ years of service), so it reflects what the open market pays.",
    "Train/test split by time: 2016–2024 trains, 2025 tests, 2026 is never trained on.",
    "Injured seasons under the cutoff are priced, with production value scaled by playing time.",
    "Next-contract aging accounts for players who get hurt or lose their job.",
  ]],
  ["Oct 30, 2026", ["Hitter defense (dWAR) as a model feature."]],
  ["Oct 28, 2026", ["Free-agent watch with next-contract projections.", "Phone layout.", "Footer links."]],
  ["Oct 26, 2026", ["Live on GitHub Pages, with a logo.", "Contract and career surplus.", "Surplus by service class.", "Model accuracy view."]],
  ["Oct 15, 2026", [
    "Why this prediction: a per-player breakdown of what each stat added, also in Compare.",
    "Last season's stats and position as features.",
    "80% prediction ranges.",
    "What the models value.",
  ]],
  ["Oct 7, 2026", ["Compare two players.", "Team surplus over time.", "Comparable players."]],
  ["Oct 6, 2026", ["Free-agent tracker.", "CSV downloads.", "Career chart data table."]],
  ["Oct 5, 2026", ["Positions in the all-players list.", "Traded players fixed."]],
  ["Oct 4, 2026", ["Rebuilt in React and TypeScript, with headshots, team logos and motion."]],
  ["Oct 2, 2026", ["First version."]],
];

function Changelog() {
  return (
    <ol>
      {CHANGES.map(([date, items]) => (
        <li key={date} className="grid gap-x-8 border-t border-line py-5 first:border-0 first:pt-0 sm:grid-cols-[9rem_1fr]">
          <h2 className="font-semibold tabular-nums">{date}</h2>
          <ul className="list-disc space-y-1 pl-5 max-sm:mt-2">{items.map((t) => <li key={t}>{t}</li>)}</ul>
        </li>
      ))}
    </ol>
  );
}

export const DOCS = {
  terms: { title: "Terms of use", body: Terms, updated: true },
  privacy: { title: "Privacy policy", body: Privacy, updated: true },
  changelog: { title: "Changelog", body: Changelog, updated: false },
} as const;
export type DocId = keyof typeof DOCS;

export function DocPage({ id }: { id: DocId }) {
  const { title, body: Body, updated } = DOCS[id];
  return (
    <main className={`${WRAP} pt-[clamp(32px,5vw,56px)]`}>
      <nav aria-label="Breadcrumb">
        <ol className="flex items-center gap-2 text-[0.9375rem] text-muted">
          <li>
            <a href={import.meta.env.BASE_URL} className="text-ink-2 underline decoration-line-strong underline-offset-[3px] transition-colors hover:text-chalk hover:decoration-chalk">
              Dashboard
            </a>
          </li>
          <li aria-hidden>/</li>
          <li aria-current="page" className="text-chalk">{title}</li>
        </ol>
      </nav>
      <h1 className="mt-4 text-[clamp(2.5rem,5.2vw,4.5rem)] font-extrabold uppercase leading-[0.95] tracking-[-0.02em]">{title}</h1>
      {updated && <p className="mt-3 text-sm text-muted">Last updated {UPDATED}</p>}
      <div className="mt-8 max-w-[70ch] text-ink-2 [&_h2]:text-chalk">
        <Body />
      </div>
    </main>
  );
}
