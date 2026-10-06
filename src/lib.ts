// Data types, loading, formatting and colour helpers shared by every component.

export type ModelId = "market" | "production";
export type Unit = "usd" | "pct";
export type SortKey = "surplus" | "pred" | "salary" | "war" | "age";
export type SortDir = "asc" | "desc";

export interface Rec {
  id: string;
  player: string;
  team: string; // last team played for
  traded: boolean;
  pos: string;
  role: "H" | "P";
  age: number;
  service: number | null;
  g: number;
  war: number;
  salary: number | null;
  salary_est: boolean;
  salary_pct: number | null;
  pred: number;
  pred_pct: number;
  residual_pct: number | null;
  surplus: number | null;
  surplus_pct: number | null;
  surplus_rank: number | null;
  pred_rank: number;
  split: "train" | "test" | "projection";
  // Hitters
  pa?: number;
  hr?: number;
  sb?: number;
  avg?: number;
  obp?: number;
  slg?: number;
  ops_plus?: number;
  // Pitchers
  ip?: number;
  gs?: number;
  sv?: number;
  era?: number | null;
  era_plus?: number;
  so?: number;
  whip?: number;
}

export interface SeasonInfo {
  season: number;
  label: string;
  cap: number;
  players: number;
  has_salary: boolean;
  salary_source: string | null;
}

export interface ModelInfo {
  id: ModelId;
  label: string;
  short: string;
  r2: number;
}

export interface Manifest {
  generated: string;
  min_pa: number;
  min_ip: number;
  seasons: SeasonInfo[];
  models: ModelInfo[];
  teams: string[];
  files: string;
}

export interface Player {
  id: string;
  name: string;
  key: string;
  seasons: number[];
}

export interface Db {
  manifest: Manifest;
  players: Map<string, Player>;
  info: (season: number) => SeasonInfo | undefined;
  label: (season: number) => string;
  hasSalary: (season: number) => boolean;
  model: (id: ModelId) => ModelInfo;
  recs: (season: number, model: ModelId) => Rec[];
  find: (season: number, model: ModelId, id: string) => Rec | undefined;
  salarySeasons: number[];
  mlbam: Record<string, number>;
}

export async function loadDb(): Promise<Db> {
  const getJson = async <T,>(path: string): Promise<T> => {
    const r = await fetch(new URL(path, location.origin)); // absolute, so it works from /players too
    if (!r.ok) throw new Error(`Couldn't load ${path} (${r.status})`);
    return r.json();
  };
  const manifest = await getJson<Manifest>("data/seasons.json");
  // Photos are optional: without scripts/player_ids.py output the site just shows none.
  const mlbam = await getJson<Record<string, number>>("data/mlbam.json").catch(() => ({}));
  const data: Record<number, Record<string, Rec[]>> = {};
  await Promise.all(
    manifest.seasons.flatMap((s) =>
      manifest.models.map(async (m) => {
        const path = manifest.files.replace("{season}", String(s.season)).replace("{model}", m.id);
        (data[s.season] ??= {})[m.id] = await getJson<Rec[]>(path);
      }),
    ),
  );

  const recs = (season: number, model: ModelId) => data[season]?.[model] ?? [];
  const index = new Map<string, Rec>();
  for (const s of manifest.seasons)
    for (const m of manifest.models) for (const r of recs(s.season, m.id)) index.set(`${s.season}|${m.id}|${r.id}`, r);

  const players = new Map<string, Player>();
  for (const s of manifest.seasons) {
    for (const r of recs(s.season, "market")) {
      if (!players.has(r.id)) players.set(r.id, { id: r.id, name: r.player, key: normalize(r.player), seasons: [] });
      players.get(r.id)!.seasons.push(s.season);
    }
  }

  const info = (season: number) => manifest.seasons.find((x) => x.season === season);
  return {
    manifest,
    players,
    info,
    label: (s) => info(s)?.label ?? String(s),
    hasSalary: (s) => !!info(s)?.has_salary,
    model: (id) => manifest.models.find((m) => m.id === id)!,
    recs,
    find: (season, model, id) => index.get(`${season}|${model}|${id}`),
    salarySeasons: manifest.seasons.filter((s) => s.has_salary).map((s) => s.season),
    mlbam,
  };
}

// ---------- Teams ----------

// Name, chart colour, MLB team ID (for logos).
const TEAMS: Record<string, [string, string, number]> = {
  ARI: ["Arizona Diamondbacks", "#e3526a", 109],
  ATH: ["Athletics", "#2e9d6a", 133],
  ATL: ["Atlanta Braves", "#d8435a", 144],
  BAL: ["Baltimore Orioles", "#f2792b", 110],
  BOS: ["Boston Red Sox", "#e0464f", 111],
  CHC: ["Chicago Cubs", "#4a7fe0", 112],
  CHW: ["Chicago White Sox", "#c4c9ce", 145],
  CIN: ["Cincinnati Reds", "#e8384a", 113],
  CLE: ["Cleveland Guardians", "#d95064", 114],
  COL: ["Colorado Rockies", "#9c84d6", 115],
  DET: ["Detroit Tigers", "#fa7a3c", 116],
  HOU: ["Houston Astros", "#f28a3a", 117],
  KCR: ["Kansas City Royals", "#4f8fd8", 118],
  LAA: ["Los Angeles Angels", "#e04257", 108],
  LAD: ["Los Angeles Dodgers", "#3b84e0", 119],
  MIA: ["Miami Marlins", "#28b6e8", 146],
  MIL: ["Milwaukee Brewers", "#ffc52f", 158],
  MIN: ["Minnesota Twins", "#d64b62", 142],
  NYM: ["New York Mets", "#ff7c2b", 121],
  NYY: ["New York Yankees", "#8fa6c9", 147],
  PHI: ["Philadelphia Phillies", "#e8455a", 143],
  PIT: ["Pittsburgh Pirates", "#fdb827", 134],
  SDP: ["San Diego Padres", "#c9a36a", 135],
  SEA: ["Seattle Mariners", "#2fa39b", 136],
  SFG: ["San Francisco Giants", "#fd6a2b", 137],
  STL: ["St. Louis Cardinals", "#e04b5a", 138],
  TBR: ["Tampa Bay Rays", "#8fbce6", 139],
  TEX: ["Texas Rangers", "#4d7fd6", 140],
  TOR: ["Toronto Blue Jays", "#3d8be0", 141],
  WSN: ["Washington Nationals", "#e2465a", 120],
};
export const teamName = (code: string) => TEAMS[code]?.[0] ?? code;

// Position filter, in menu order. Options with a `group` sit under that heading.
const IF = ["1B", "2B", "3B", "SS"], OF = ["LF", "CF", "RF"];
export const POSITIONS: Record<string, { label: string; has: string[]; group?: string }> = {
  all: { label: "All positions", has: [] },
  H: { label: "Batters", has: ["C", ...IF, ...OF, "DH"] },
  P: { label: "Pitchers", has: ["SP", "RP"] },
  SP: { label: "Starting pitchers", has: ["SP"], group: "Pitching" },
  RP: { label: "Relief pitchers", has: ["RP"], group: "Pitching" },
  IF: { label: "Infielders", has: IF, group: "Infield" },
  "1B": { label: "First base", has: ["1B"], group: "Infield" },
  "2B": { label: "Second base", has: ["2B"], group: "Infield" },
  "3B": { label: "Third base", has: ["3B"], group: "Infield" },
  SS: { label: "Shortstop", has: ["SS"], group: "Infield" },
  OF: { label: "Outfielders", has: OF, group: "Outfield" },
  LF: { label: "Left field", has: ["LF"], group: "Outfield" },
  CF: { label: "Center field", has: ["CF"], group: "Outfield" },
  RF: { label: "Right field", has: ["RF"], group: "Outfield" },
  C: { label: "Catcher", has: ["C"], group: "Other" },
  DH: { label: "Designated hitter", has: ["DH"], group: "Other" },
};
export const inPos = (r: Rec, pos: string) => pos === "all" || POSITIONS[pos].has.includes(r.pos);
// "New York Yankees, catcher" — whichever filters are on, for titles and notes.
export const scopeLabel = (team: string, pos: string) =>
  [team !== "all" && teamName(team), pos !== "all" && POSITIONS[pos].label.toLowerCase()].filter(Boolean).join(", ");
export const teamColor = (code: string) => TEAMS[code]?.[1] ?? "#7c8894";
export const teamLogo = (code: string) =>
  TEAMS[code] ? `https://www.mlbstatic.com/team-logos/team-cap-on-dark/${TEAMS[code][2]}.svg` : null;
// Transparent cut-out headshot; MLB serves a generic silhouette when a player has none.
export const headshot = (mlbam: number | undefined, width = 240) =>
  mlbam
    ? `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:silo:current.png/w_${width},q_auto:best/v1/people/${mlbam}/headshot/silo/current`
    : null;

// Chart colours (Plotly needs literal values, not CSS variables).
export const C = {
  text: "#eef2f7",
  text2: "#a9b8ca",
  muted: "#7f93ab",
  line: "#1f3a5c",
  lineStrong: "#2d4d74",
  panel: "#11233a",
  panel2: "#17304d",
  accent: "#f5b83d",
  under: "#3987e5",
  over: "#e66767",
};
export const FONT = '"Libre Franklin", "Franklin Gothic", system-ui, -apple-system, "Segoe UI", sans-serif';

// Ordinal ramp for seasons (one hue, dark-surface steps 550 -> 100).
// Newest season is lightest; colour follows the season, never its rank in the selection.
const SEASON_RAMP = ["#1c5cab", "#256abf", "#2a78d6", "#3987e5", "#5598e7", "#6da7ec", "#86b6ef", "#9ec5f4", "#b7d3f6", "#cde2fb"];
export function seasonColor(salarySeasons: number[], season: number) {
  const i = salarySeasons.indexOf(season);
  if (i < 0) return C.text2;
  const t = salarySeasons.length === 1 ? 1 : i / (salarySeasons.length - 1);
  const x = t * (SEASON_RAMP.length - 1);
  const k = Math.min(Math.floor(x), SEASON_RAMP.length - 2);
  const f = x - k;
  const rgb = (h: string) => {
    const n = parseInt(h.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  const a = rgb(SEASON_RAMP[k]), b = rgb(SEASON_RAMP[k + 1]);
  const c = a.map((v, j) => Math.round(v + (b[j] - v) * f));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}

// ---------- Formatting ----------

export function money(v: number | null | undefined, signed = false) {
  if (v == null || Number.isNaN(v)) return "—";
  const sign = v < 0 ? "−" : signed && v > 0 ? "+" : "";
  const a = Math.abs(v);
  return sign + (a >= 1e6 ? `$${(a / 1e6).toFixed(1)}M` : `$${Math.round(a / 1e3)}K`);
}
export function pct(v: number | null | undefined, signed = false) {
  if (v == null || Number.isNaN(v)) return "—";
  const sign = v < 0 ? "−" : signed && v > 0 ? "+" : "";
  return `${sign}${Math.abs(v * 100).toFixed(1)}%`;
}
export const rate = (v?: number | null) => (v == null ? "—" : v.toFixed(3).replace(/^0/, ""));
export function ordinal(n: number) {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}
export function normalize(s: string) {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9 ]/g, "");
}
export function escapeHtml(s: string | number) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// Small deterministic jitter so players of the same age don't stack into one column.
export function jitter(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 1000) / 1000 - 0.5) * 0.5;
}

// ---------- Leaderboard sorts ----------

// `natural` is the direction a fresh click uses.
export const SORTS: Record<SortKey, { label: string; natural: SortDir; needsSalary?: boolean; get: (r: Rec) => number | null }> = {
  surplus: { label: "surplus", natural: "desc", needsSalary: true, get: (r) => r.surplus },
  pred: { label: "predicted salary", natural: "desc", get: (r) => r.pred },
  salary: { label: "actual salary", natural: "desc", needsSalary: true, get: (r) => r.salary },
  war: { label: "WAR", natural: "desc", get: (r) => r.war },
  age: { label: "age", natural: "asc", get: (r) => r.age },
};
