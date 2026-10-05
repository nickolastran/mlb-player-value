import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { animate, motion, useReducedMotion } from "motion/react";
import { headshot, teamLogo, teamName, type Db } from "./lib";

export const EASE = [0.22, 1, 0.36, 1] as const;

export function Field({ label, id, children }: { label: string; id?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[0.8125rem] text-muted" id={id}>{label}</span>
      {children}
    </div>
  );
}

export function Select({ value, onChange, children, small, label }: {
  value: string | number;
  onChange: (v: string) => void;
  children: ReactNode;
  small?: boolean;
  label: string;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[0.8125rem] text-muted">{label}</span>
      <span className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`w-full appearance-none rounded-lg border border-line-strong bg-panel pl-3 pr-9 text-chalk transition-colors hover:border-ink-2 ${small ? "h-[34px] text-sm" : "h-10 min-w-[150px]"}`}
        >
          {children}
        </select>
        <svg aria-hidden viewBox="0 0 12 12" className="pointer-events-none absolute right-3 top-1/2 size-3 -translate-y-1/2 text-ink-2">
          <path d="M2 4.5 6 8.5l4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    </label>
  );
}

// Radio group whose active pill slides between options.
export function Segmented<T extends string>({ id, label, options, value, onChange, small }: {
  id: string;
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  small?: boolean;
}) {
  return (
    <Field label={label} id={`${id}-label`}>
      <div
        role="radiogroup"
        aria-labelledby={`${id}-label`}
        className={`inline-flex rounded-lg border border-line-strong bg-panel p-[3px] ${small ? "h-[34px]" : "h-10"}`}
      >
        {options.map((o) => {
          const on = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={`relative flex-1 cursor-pointer whitespace-nowrap rounded-md transition-colors ${small ? "px-2.5 text-sm" : "px-3.5 text-[0.9375rem]"} ${on ? "font-semibold text-bulb-ink" : "text-ink-2 hover:text-chalk"}`}
            >
              {on && (
                <motion.span
                  layoutId={`${id}-pill`}
                  className="absolute inset-0 rounded-md bg-bulb"
                  transition={{ type: "spring", bounce: 0.18, duration: 0.45 }}
                />
              )}
              <span className="relative">{o.label}</span>
            </button>
          );
        })}
      </div>
    </Field>
  );
}

// A number that rolls from its previous value to the new one, like a scoreboard.
export function Tween({ value, format, className }: { value: number | null | undefined; format: (v: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const prev = useRef<number | null | undefined>(undefined);
  const fmt = useRef(format);
  fmt.current = format;
  const reduce = useReducedMotion();
  useLayoutEffect(() => {
    const el = ref.current!;
    const format = fmt.current;
    const from = prev.current;
    prev.current = value;
    if (value == null) { el.textContent = "—"; return; }
    if (reduce || from == null || from === value) { el.textContent = format(value); return; }
    const c = animate(from, value, { duration: 0.7, ease: EASE, onUpdate: (v) => { el.textContent = format(v); } });
    return () => c.stop();
  }, [value, reduce]);
  return <span ref={ref} className={className} />;
}

export function Panel({ className = "", children }: { className?: string; children: ReactNode }) {
  return <div className={`rounded-xl border border-line bg-panel ${className}`}>{children}</div>;
}

export function SectionHead({ id, title, note }: { id: string; title: string; note?: ReactNode }) {
  return (
    <div className="mb-5">
      <h2 id={id} className="text-[clamp(1.875rem,3.8vw,2.5rem)] font-bold leading-[1.05]">{title}</h2>
      {note && <p className="mt-2 max-w-[70ch] text-ink-2">{note}</p>}
    </div>
  );
}

// Round cut-out headshot. Key it by player id so a failed load doesn't stick to the next player.
export function Headshot({ db, id, size, className = "" }: { db: Db; id: string; size: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = headshot(db.mlbam[id], size * 2);
  return (
    <span className={`block flex-none overflow-hidden rounded-full bg-panel-2 ${className}`} style={{ width: size, height: size }}>
      {src && !failed && (
        <img src={src} alt="" width={size} height={size} loading="lazy" decoding="async" onError={() => setFailed(true)} className="size-full object-cover object-top" />
      )}
    </span>
  );
}

export function TeamLogo({ code, size = 18, className = "" }: { code: string; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const src = teamLogo(code);
  if (!src || failed) return null;
  return <img src={src} alt={teamName(code)} title={teamName(code)} width={size} height={size} loading="lazy" onError={() => setFailed(true)} className={`flex-none object-contain ${className}`} style={{ width: size, height: size }} />;
}
