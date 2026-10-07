import type { ReactNode } from "react";
import type { Db } from "./lib";
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

export function Method({ db }: { db: Db }) {
  const seasons = db.manifest.seasons;
  const latest = seasons[seasons.length - 1];
  const r2 = (id: "market" | "production") => db.model(id).r2.toFixed(2);
  const sourced = seasons.filter((s) => s.salary_source).map((s) => ` ${s.label} salaries are from ${s.salary_source}.`).join("");

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
          Random forests trained on each player's season stats plus his age and MLB service time, one for hitters and one for
          pitchers. They predict salary as a share of that season's luxury-tax threshold. Because they know service time, they
          learn how the league actually pays: near-minimum salaries for three years, arbitration raises until six, then free
          agency.<Ref to="a" id="ref-a1" />
        </>)}
        {model("Production value", "production", <>
          The same models with age and service time removed. They can only price what a player does on the field, so they
          explain much less of real salaries (most MLB contracts were signed on past seasons, not this one) but sit closer to
          pure on-field worth.<Ref to="a" id="ref-a2" /> The gap between the two predictions is the <em>service-time discount</em> shown
          on each player card.
        </>)}
      </div>

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
          Hitters: games, PA, WAR, HR, SB, AVG, OBP, SLG, OPS+. Pitchers: games, starts, innings, WAR, saves, ERA, ERA+, FIP, WHIP,
          strikeouts.
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
