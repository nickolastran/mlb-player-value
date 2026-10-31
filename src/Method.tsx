import { useMemo, type ReactNode } from "react";
import { featureLabel, money, type Db, type ModelId } from "./lib";
import { Accuracy } from "./Charts";
import { SectionHead } from "./ui";

const Ref = ({ to, id }: { to: string; id: string }) => (
  <sup><a href={`#fn-${to}`} id={id} className="px-px font-semibold text-chalk no-underline">{to}</a></sup>
);

function Fact({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div>
      <dt className="font-semibold">{term}</dt>
      <dd className="mt-1 text-[0.9375rem] text-ink-2">{children}</dd>
    </div>
  );
}

// How much each stat moves predictions on average: the mean size of its SHAP value over every
// player-season, scaled to the latest season's tax threshold so old seasons count the same.
function Importance({ db }: { db: Db }) {
  const seasons = db.manifest.seasons;
  const latest = seasons[seasons.length - 1];
  const panels = useMemo(() => db.manifest.models.flatMap((m) => (["H", "P"] as const).map((role) => {
    const total = new Map<string, number>();
    let n = 0;
    for (const s of seasons)
      for (const r of db.recs(s.season, m.id)) {
        if (r.role !== role) continue;
        n++;
        for (const [k, v] of r.why) total.set(k, (total.get(k) ?? 0) + (Math.abs(v) / s.cap) * latest.cap);
      }
    const rows = [...total].map(([k, v]): [string, number] => [featureLabel(k), v / n]).sort((a, b) => b[1] - a[1]);
    return { title: `${m.label}, ${role === "H" ? "hitters" : "pitchers"}`, rows };
  })), [db, seasons, latest]);
  const max = Math.max(...panels.flatMap((p) => p.rows.map(([, v]) => v)));

  return (
    <div className="mt-7 border-t border-line pt-[22px]">
      <h3 className="text-[1.625rem] font-bold">What the models value</h3>
      <p className="mt-1 max-w-[62ch] text-ink-2">
        How far each stat moves a prediction up or down, on average across every player-season, in {latest.label} dollars.
        Bars share one scale across all four panels.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-x-7 gap-y-5 max-[760px]:grid-cols-1">
        {panels.map((p) => (
          <section key={p.title} aria-label={p.title}>
            <h4 className="text-sm font-semibold">{p.title}</h4>
            {/* Fixed label and value columns, so every panel's bars get the same track and the shared scale holds */}
            <dl className="mt-2 grid grid-cols-[9.5rem_1fr_3.5rem] items-center gap-x-3 gap-y-1.5 text-sm tabular-nums">
              {p.rows.map(([k, v]) => (
                <div key={k} className="contents">
                  <dt className="text-ink-2">{k}</dt>
                  <dd aria-hidden><span className="block h-2.5 rounded-r-sm bg-ink-2" style={{ width: `${(v / max) * 100}%` }} /></dd>
                  <dd className="text-right">{money(v)}</dd>
                </div>
              ))}
            </dl>
          </section>
        ))}
      </div>
    </div>
  );
}

export function Method({ db, model: modelId }: { db: Db; model: ModelId }) {
  const seasons = db.manifest.seasons;
  const latest = seasons[seasons.length - 1];
  const r2 = (id: "market" | "production") => db.model(id).r2.toFixed(2);
  const sourced = seasons.filter((s) => s.salary_source).map((s) => ` ${s.label} salaries are from ${s.salary_source}.`).join("");
  // Share of the never-trained season's listed salaries inside the range, per model and role: [lowest, highest] %.
  const covered = useMemo(() => {
    const pcts = db.manifest.models.flatMap((m) => (["H", "P"] as const).map((role) => {
      const rows = db.recs(latest.season, m.id).filter((r) => r.role === role && r.salary != null && !r.salary_est);
      return rows.length ? (100 * rows.filter((r) => r.pred_lo <= r.salary! && r.salary! <= r.pred_hi).length) / rows.length : NaN;
    })).filter((p) => !isNaN(p));
    return pcts.length ? [Math.round(Math.min(...pcts)), Math.round(Math.max(...pcts))] : null;
  }, [db, latest]);

  const model = (title: string, id: "market" | "production", body: ReactNode) => (
    <div className="border-t-[3px] border-line-strong pt-3.5">
      <h3 className="text-[1.625rem] font-bold">{title}</h3>
      <p className="mt-1 text-muted">
        <span className="mr-1 text-[2rem] font-extrabold text-chalk">{r2(id)}</span> test R²
      </p>
      <p className="mt-3 max-w-[62ch] text-ink-2">{body}</p>
    </div>
  );

  return (
    <section className="mx-auto max-w-[1180px] px-[clamp(16px,4vw,32px)] pt-[clamp(32px,5vw,56px)]" aria-labelledby="method-title">
      <SectionHead id="method-title" title="How the models work" />

      <div className="grid grid-cols-2 gap-5 max-[760px]:grid-cols-1">
        {model("Market value", "market", <>
          Random forests trained on each player's season stats and, for hitters, his position and defensive WAR, plus his age, MLB service time and track record (last season's
          WAR and his total over the last five), one for hitters and one for pitchers. They predict salary as a share of that season's luxury-tax threshold. Because they know service time, they
          learn how the league actually pays: near-minimum salaries for three years, arbitration raises until six, then free
          agency, where contracts are priced on the seasons before them.<Ref to="a" id="ref-a1" />
        </>)}
        {model("Production value", "production", <>
          The same models with age, service time and track record removed. They can only price what a player does on the field, so they
          explain much less of real salaries (most MLB contracts were signed on past seasons, not this one) but sit closer to
          pure on-field worth.<Ref to="a" id="ref-a2" /> The gap between the two predictions is the <em>service-time discount</em> shown
          on each player card.
        </>)}
      </div>

      <Importance db={db} />
      <Accuracy db={db} model={modelId} />

      <dl className="mt-7 grid grid-cols-3 gap-x-7 max-[900px]:grid-cols-2 max-[560px]:grid-cols-1 gap-y-[18px] border-t border-line pt-[22px]">
        <Fact term="Data">
          Season stats, WAR, salaries and service time from{" "}
          <a href="https://www.baseball-reference.com/" rel="noopener" className="underline decoration-line-strong underline-offset-[3px] hover:decoration-chalk">Baseball-Reference</a>,{" "}
          {seasons[0].label} through {latest.label}. 2020 is left out: a 60-game season with prorated pay doesn't compare.
          Baseball-Reference skips many pre-arbitration years; for drafted players under 3 years of service those are estimated
          at the league minimum (marked ≈) and left out of training.{sourced}
        </Fact>
        <Fact term="Who's included">
          Hitters with at least {db.manifest.min_pa} plate appearances and pitchers with at least {db.manifest.min_ip} innings in a
          season. Two-way players count as hitters, with their pitching WAR added in.
        </Fact>
        <Fact term="Stats used">
          Hitters: games, PA, WAR, HR, SB, AVG, OBP, SLG, OPS+, position, defensive WAR. Pitchers: games, starts, innings, WAR, saves, ERA, ERA+,
          FIP, WHIP, strikeouts. The market model adds age, service time, last season's WAR and total WAR over the last five.
        </Fact>
        <Fact term="80% range">
          Each forest is 400 trees, each with its own guess. The range is the middle 80% of those guesses, stretched so that 80% of
          held-out salaries land inside it (the raw spread caught only about half) and floored at the league minimum.
          {covered && ` On ${latest.label}, which the models never saw, it catches ${covered[0]}% to ${covered[1]}% depending on model and role.`}
        </Fact>
        <Fact term="Residual">
          (Actual salary − predicted salary) ÷ that season's tax threshold. Positive means overpaid relative to the model. Surplus
          is the same gap with the sign flipped, in dollars.
        </Fact>
        <Fact term="Why % of CBT">
          MLB has no salary cap, so the competitive balance tax threshold stands in for one. It rose from $189M in 2016 to $244M in
          2026, so the same dollar figure means different things across seasons.
        </Fact>
        <Fact term="Train / test">
          80% of 2016 to 2025 player-seasons trained the models; the other 20% were held out to measure the R² above. The models
          never saw {latest.label} at all, so it's a true out-of-sample season.
          {!latest.has_salary && " Its salaries aren't in the data yet, so it shows predictions only."}
          <Ref to="b" id="ref-b" />
        </Fact>
      </dl>

      <ol className="mt-7 grid grid-cols-2 gap-x-5 border-t border-line pt-[18px] text-sm text-ink-2 max-[760px]:grid-cols-1">
        <li id="fn-a" className="mb-2.5 flex gap-2.5 target:text-chalk">
          <span className="w-[1ch] flex-none font-bold text-chalk">a</span>
          <span>
            The market model reflects how MLB actually pays, including the pre-arbitration and arbitration years set by service
            time. The production model is blind to age and service time and closer to pure on-field worth. Salaries are as
            Baseball-Reference lists them. Signing bonuses and deferred money aren't always in the listed figure, so a few
            contracts look cheaper than they are (Nick Pivetta's 2025, for one). A salary listed under a team the player didn't
            play for that season (usually an option buyout) is treated as not on record.{" "}
            <a href="#ref-a1" aria-label="Back to text">↩</a>
          </span>
        </li>
        <li id="fn-b" className="mb-2.5 flex gap-2.5 target:text-chalk">
          <span className="w-[1ch] flex-none font-bold text-chalk">b</span>
          <span>
            The 2016 to 2025 seasons are in-sample: the models trained on that data, so historical residuals look slightly better
            than the models would do on new seasons. Rows marked “held-out” on a player card are the exception.{" "}
            <a href="#ref-b" aria-label="Back to text">↩</a>
          </span>
        </li>
      </ol>
    </section>
  );
}
