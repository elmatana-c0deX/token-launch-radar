// Token Launch Radar — the model (radar-3).
//
// One sealed snapshot of the protocol universe in, one ranked board out. The board covers every
// slug in the snapshot's watchlist (the floor, never a ceiling) and adds every pre-token protocol
// below the floor that passes the same exclusion rule the house used to build the watchlist: no
// versioned product of another protocol, no wrapped/staked/bridged product of a token that
// already trades, no exchange entry, no child whose parent protocol's token already trades.
//
// What radar-3 changes versus the median-multiple model it replaces:
//
//   fitted, not tabulated — implied value comes from a size curve fitted to the snapshot's own
//     tokenized protocols (log market cap on log TVL), with shrunken per-category offsets and,
//     when the data supports them, growth and age terms. Every candidate term set is priced
//     blind: five seeded 60/40 splits of the tokenized set, fitted on one side and tested on
//     the other, and only the set with the lowest held-out error prices the board. The errors
//     ship with the entry (dashboard method section), so the claim is checkable from the page.
//   odds, from the peers' record — a logistic model fitted on all 758 protocols (has a token
//     been recorded?) over log TVL, years listed and 7-day growth gives each board row the
//     share of look-alike protocols that already record a token.
//   verdicts, netted — each farm plan is costed to the dollar (gas plus the carry on its
//     capital) and netted against the launch it farms: the verdict states the crowd size at
//     which the plan breaks even, and grades the row FARM, THIN or SKIP.
//   rank ranges — the chosen model is refitted on 80 bootstrap resamples of the tokenized set;
//     each row's range is the 10th–90th percentile of its ranks across those refits.
//
// Everything is deterministic: the splits, the bootstrap and the optimiser run on seeded
// generators or fixed iteration counts, so two runs of the program write the same board.

/** The snapshot's protocol entry: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
}

/** The whole snapshot document. */
export interface Snapshot {
  as_of: string;
  source: string;
  floor_usd: number;
  protocols: SnapshotProtocol[];
  watchlist: string[];
}

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-3 (fitted comps, blind-tested)';

/** Blind splits used to price every candidate term set. */
export const FIT_SPLITS = 5;

/** Bootstrap refits behind each row's rank range. */
export const BOOTSTRAP_REFITS = 80;

/** The share of a launch assumed to reach early users, stated wherever a verdict is computed. */
export const COMMUNITY_ALLOCATION = 0.05;

/** Verdict breaks on the break-even crowd: at or above FARM_CROWD a plan is a FARM, at or above THIN_CROWD a THIN. */
export const FARM_CROWD = 25_000;
export const THIN_CROWD = 2_500;

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string;
  cost: string;
  time: string;
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  gecko_id: string | null;
  symbol: string | null;
  token_status: 'pre-token';
  age_days: number | null;
  implied_value_usd: number;
  model: {
    effective_multiple: number;
    comparables: number;
    multiple_source: string;
    growth_multiplier: number;
    age_multiplier: number;
    odds_pct: number;
    plan_cost_usd: number;
    breakeven_crowd: number;
    verdict: 'FARM' | 'THIN' | 'SKIP';
    rank_low: number;
    rank_high: number;
  };
  farm_steps: string[];
}

/** The dashboard's compact view of one row. */
export interface RadarRow {
  rank: number;
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  change_7d: number | null;
  mcap_usd: number | null;
  listed_at: string | null;
  age_days: number | null;
  implied_value_usd: number;
  effective_multiple: number;
  comparables: number;
  multiple_source: string;
  growth_multiplier: number;
  age_multiplier: number;
  odds_pct: number;
  plan_cost_usd: number;
  breakeven_crowd: number;
  verdict: 'FARM' | 'THIN' | 'SKIP';
  rank_low: number;
  rank_high: number;
  watchlist: boolean;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string;
  name: string;
  category: string | null;
  chains: string[];
  tvl_usd: number;
  mcap_usd: number | null;
  change_7d: number | null;
  multiple: number | null;
}

/** How each candidate term set did on the blind splits, and which one prices the board. */
export interface FitReport {
  trained_on: number;
  splits: number;
  candidates: { terms: string; heldout_error_pct: number }[];
  chosen_terms: string;
  chosen_error_pct: number;
  baseline_error_pct: number;
  bootstrap_refits: number;
}

/** The odds model, as the dashboard states it. */
export interface OddsReport {
  base_rate_pct: number;
  auc: number;
  trained_on: number;
}

/** Every protocol in the snapshot, accounted for: where it went, and why. */
export interface Accounting {
  total: number;
  tokenized_priced: number;
  token_recorded_unpriced: number;
  pre_token: number;
  board_rows: number;
  watchlist_covered: number;
  excluded_category: number;
  versioned_name: number;
  wrapped_name: number;
  exchange_name: number;
  child_of_tokenized: number;
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model_version: string;
  global_multiple: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
  fit: FitReport;
  odds: OddsReport;
  accounting: Accounting;
  verdicts: { farm: number; thin: number; skip: number };
  rows: RadarRow[];
  live: LiveRow[];
}

/** Why the snapshot is not one this model can score. */
export class SnapshotError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SnapshotError';
  }
}

const DAY_MS = 86_400_000;

/** A whole day count from `from` to `to`, clamped at zero; null when either date is absent or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const a = Date.parse(`${asOf}T00:00:00Z`);
  const b = Date.parse(`${listedAt}T00:00:00Z`);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  return Math.max(0, Math.floor((a - b) / DAY_MS));
}

const round4 = (n: number): number => Math.round(n * 1e4) / 1e4;
const round1 = (n: number): number => Math.round(n * 10) / 10;

/** The median of a non-empty list. */
function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? s[mid]! : (s[mid - 1]! + s[mid]!) / 2;
}

/** Category families for pooling thin categories: keywords matched against the category name. */
const FAMILIES: { name: string; words: string[] }[] = [
  { name: 'lending & credit', words: ['lend', 'cdp', 'collateral', 'credit', 'loan'] },
  { name: 'trading venues', words: ['dex', 'derivative', 'perpetual', 'exchange', 'swap'] },
  { name: 'yield & vaults', words: ['yield', 'curator', 'allocator', 'aggregator', 'vault', 'farm'] },
  { name: 'staking', words: ['staking', 'restak', 'stake'] },
  { name: 'bridges', words: ['bridge'] },
  { name: 'real-world assets', words: ['rwa', 'real world', 'real-world'] },
  { name: 'stablecoins & payments', words: ['stable', 'payment'] },
  { name: 'basis & delta-neutral', words: ['basis', 'delta'] },
];

/** The family a category pools into, or null when no family's words match it. */
function familyOf(category: string | null): string | null {
  if (category === null) return null;
  const c = category.toLowerCase();
  const fam = FAMILIES.find((f) => f.words.some((w) => c.includes(w)));
  return fam === undefined ? null : fam.name;
}

export interface MultipleBook {
  /** The all-market median multiple across tokenized protocols. */
  global: number;
  /** Resolve the multiple for one category: its own median, a family pool, or the global median. */
  forCategory(category: string | null): { multiple: number; comparables: number; source: string };
}

/** The multiples the snapshot itself teaches: medians of mcap/TVL over its tokenized protocols. */
export function buildMultiples(snapshot: Snapshot, minComparables: number): MultipleBook {
  const tokenized = snapshot.protocols.filter((p) => p.mcap_usd !== null && p.tvl_usd > 0);
  const ratios = tokenized.map((p) => p.mcap_usd! / p.tvl_usd);
  const global = ratios.length > 0 ? median(ratios) : 0.2;
  const byCategory = new Map<string, number[]>();
  for (const p of tokenized) {
    if (p.category === null) continue;
    const list = byCategory.get(p.category) ?? [];
    list.push(p.mcap_usd! / p.tvl_usd);
    byCategory.set(p.category, list);
  }
  const cache = new Map<string, { multiple: number; comparables: number; source: string }>();
  return {
    global,
    forCategory(category: string | null) {
      const key = category ?? '(none)';
      const hit = cache.get(key);
      if (hit !== undefined) return hit;
      let out: { multiple: number; comparables: number; source: string };
      const own = category === null ? undefined : byCategory.get(category);
      if (own !== undefined && own.length >= minComparables) {
        out = { multiple: median(own), comparables: own.length, source: `median of ${own.length} tokenized ${category} protocols in this snapshot` };
      } else {
        const c = (category ?? '').toLowerCase();
        const family = FAMILIES.find((f) => f.words.some((w) => c.includes(w)));
        const pool: number[] = [];
        if (family !== undefined) {
          for (const p of tokenized) {
            const pc = (p.category ?? '').toLowerCase();
            if (family.words.some((w) => pc.includes(w))) pool.push(p.mcap_usd! / p.tvl_usd);
          }
        }
        if (family !== undefined && pool.length >= minComparables) {
          out = { multiple: median(pool), comparables: pool.length, source: `pooled ${family.name} family: median of ${pool.length} tokenized protocols` };
        } else {
          out = { multiple: global, comparables: ratios.length, source: `all-market median of ${ratios.length} tokenized protocols` };
        }
      }
      cache.set(key, out);
      return out;
    },
  };
}

/** mulberry32: a tiny deterministic PRNG, so the splits and bootstraps are identical on every run. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The growth feature: the 7-day TVL change, clipped to ±30 points and scaled to tens; null when unreported. */
function growthFeature(p: SnapshotProtocol): number | null {
  if (p.change_7d === null) return null;
  return Math.max(-30, Math.min(30, p.change_7d)) / 10;
}

/** The age feature: years listed, capped at 8; null when the listing date is unknown. */
function ageFeature(asOf: string, p: SnapshotProtocol): number | null {
  const d = ageDays(asOf, p.listed_at);
  return d === null ? null : Math.min(d / 365, 8);
}

/** One tokenized protocol as the fit sees it. */
interface TrainRow {
  p: SnapshotProtocol;
  logTvl: number;
  y: number;
  growth: number | null;
  ageYears: number | null;
}

/** The tokenized protocols of a snapshot (or of a resample of them), as training rows. */
function trainRows(asOf: string, protocols: SnapshotProtocol[]): TrainRow[] {
  return protocols
    .filter((p) => p.mcap_usd !== null && p.mcap_usd > 0 && p.tvl_usd > 0)
    .map((p) => ({
      p,
      logTvl: Math.log(p.tvl_usd),
      y: Math.log(p.mcap_usd!),
      growth: growthFeature(p),
      ageYears: ageFeature(asOf, p),
    }));
}

/** Ordinary least squares for y ~ 1 + x. */
function ols(xs: number[], ys: number[]): [number, number] {
  const n = xs.length;
  const mx = xs.reduce((s, v) => s + v, 0) / n;
  const my = ys.reduce((s, v) => s + v, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (xs[i]! - mx) * (ys[i]! - my);
    sxx += (xs[i]! - mx) ** 2;
  }
  const slope = sxx === 0 ? 0 : sxy / sxx;
  return [my - slope * mx, slope];
}

/** The candidate term sets, simplest first; the blind splits choose between them. */
export const TERM_SETS = ['median', 'curve', 'curve+cat', 'curve+cat+growth', 'curve+cat+growth+age'] as const;
export type TermSet = (typeof TERM_SETS)[number];

/** A fitted value model: everything needed to price one protocol, and to say where the price came from. */
export interface FittedModel {
  terms: TermSet;
  intercept: number;
  slope: number;
  catOffset: Map<string, number>;
  catCount: Map<string, number>;
  famOffset: Map<string, number>;
  famCount: Map<string, number>;
  growthCoef: number;
  ageCoef: number;
  book: MultipleBook;
  trainedOn: number;
}

/** Shrunken group means of residuals: a group of n pulls its offset n/(n+6) of the way to its mean. */
function shrunkenOffsets(rows: TrainRow[], resid: number[], keyOf: (p: SnapshotProtocol) => string | null): { offset: Map<string, number>; count: Map<string, number> } {
  const sums = new Map<string, { sum: number; n: number }>();
  rows.forEach((r, i) => {
    const k = keyOf(r.p);
    if (k === null) return;
    const cur = sums.get(k) ?? { sum: 0, n: 0 };
    cur.sum += resid[i]!;
    cur.n += 1;
    sums.set(k, cur);
  });
  const offset = new Map<string, number>();
  const count = new Map<string, number>();
  for (const [k, v] of sums) {
    offset.set(k, (v.n / (v.n + 6)) * (v.sum / v.n));
    count.set(k, v.n);
  }
  return { offset, count };
}

/** Fit one term set on training rows. The median set defers to the multiples book built beside it. */
export function fitValue(rows: TrainRow[], terms: TermSet, book: MultipleBook): FittedModel {
  const fit: FittedModel = {
    terms,
    intercept: 0,
    slope: 0,
    catOffset: new Map(),
    catCount: new Map(),
    famOffset: new Map(),
    famCount: new Map(),
    growthCoef: 0,
    ageCoef: 0,
    book,
    trainedOn: rows.length,
  };
  if (terms === 'median' || rows.length === 0) return fit;
  const [a, b] = ols(rows.map((r) => r.logTvl), rows.map((r) => r.y));
  fit.intercept = a;
  fit.slope = b;
  let resid = rows.map((r) => r.y - (a + b * r.logTvl));
  if (terms !== 'curve') {
    const cats = shrunkenOffsets(rows, resid, (p) => p.category);
    fit.catOffset = cats.offset;
    fit.catCount = cats.count;
    const fams = shrunkenOffsets(rows, resid, (p) => familyOf(p.category));
    fit.famOffset = fams.offset;
    fit.famCount = fams.count;
    resid = rows.map((r, i) => resid[i]! - offsetFor(fit, r.p));
  }
  if (terms === 'curve+cat+growth' || terms === 'curve+cat+growth+age') {
    let num = 0;
    let den = 0;
    rows.forEach((r, i) => {
      if (r.growth === null) return;
      num += resid[i]! * r.growth;
      den += r.growth * r.growth;
    });
    fit.growthCoef = den === 0 ? 0 : num / den;
    resid = rows.map((r, i) => resid[i]! - (r.growth === null ? 0 : fit.growthCoef * r.growth));
  }
  if (terms === 'curve+cat+growth+age') {
    let num = 0;
    let den = 0;
    rows.forEach((r, i) => {
      if (r.ageYears === null) return;
      num += resid[i]! * r.ageYears;
      den += r.ageYears * r.ageYears;
    });
    fit.ageCoef = den === 0 ? 0 : num / den;
  }
  return fit;
}

/** The category offset a protocol gets: its own category's, else its family's, else none. */
function offsetFor(fit: FittedModel, p: SnapshotProtocol): number {
  if (p.category !== null && fit.catOffset.has(p.category)) return fit.catOffset.get(p.category)!;
  const fam = familyOf(p.category);
  if (fam !== null && fit.famOffset.has(fam)) return fit.famOffset.get(fam)!;
  return 0;
}

/** The parts of one protocol's fitted log value, so a row can show its own arithmetic. */
export function valueParts(fit: FittedModel, asOf: string, p: SnapshotProtocol): { logValue: number; baseLog: number; growthMult: number; ageMult: number; comparables: number; source: string } {
  if (fit.terms === 'median') {
    const m = fit.book.forCategory(p.category);
    return {
      logValue: Math.log(p.tvl_usd * m.multiple),
      baseLog: Math.log(p.tvl_usd * m.multiple),
      growthMult: 1,
      ageMult: 1,
      comparables: m.comparables,
      source: m.source,
    };
  }
  const baseLog = fit.intercept + fit.slope * Math.log(p.tvl_usd) + offsetFor(fit, p);
  const g = growthFeature(p);
  const a = ageFeature(asOf, p);
  const growthMult = g === null ? 1 : Math.exp(fit.growthCoef * g);
  const ageMult = a === null ? 1 : Math.exp(fit.ageCoef * a);
  let comparables = fit.trainedOn;
  let source = `fitted size curve on ${fit.trainedOn} tokenized protocols`;
  if (fit.terms !== 'curve') {
    if (p.category !== null && fit.catCount.has(p.category)) {
      comparables = fit.catCount.get(p.category)!;
      source = `fitted size curve + ${p.category} offset from ${comparables} tokenized peers`;
    } else {
      const fam = familyOf(p.category);
      if (fam !== null && fit.famCount.has(fam)) {
        comparables = fit.famCount.get(fam)!;
        source = `fitted size curve + ${fam} family offset from ${comparables} tokenized protocols`;
      }
    }
  }
  return { logValue: baseLog + Math.log(growthMult) + Math.log(ageMult), baseLog, growthMult, ageMult, comparables, source };
}

/**
 * Price every candidate term set blind: five seeded splits of the tokenized protocols, each
 * fitted on 60% and tested on the other 40%. The winner is the lowest mean held-out error;
 * a simpler set keeps the board unless a richer one beats it by more than 0.1 points.
 */
export function evaluateTerms(snapshot: Snapshot): { report: FitReport; chosen: TermSet } {
  const rows = trainRows(snapshot.as_of, snapshot.protocols);
  const candidates: { terms: string; heldout_error_pct: number }[] = [];
  let chosen: TermSet = 'median';
  let best = Number.POSITIVE_INFINITY;
  for (const terms of TERM_SETS) {
    const errs: number[] = [];
    for (let s = 0; s < FIT_SPLITS; s++) {
      const rand = prng(20261120 + s * 977);
      const idx = rows.map((_, i) => i);
      for (let i = idx.length - 1; i > 0; i--) {
        const j = Math.floor(rand() * (i + 1));
        [idx[i], idx[j]] = [idx[j]!, idx[i]!];
      }
      const cut = Math.floor(idx.length * 0.6);
      const trainIdx = idx.slice(0, cut);
      const testIdx = idx.slice(cut);
      const trainProtocols = trainIdx.map((i) => rows[i]!.p);
      const book = buildMultiples({ ...snapshot, protocols: trainProtocols }, 3);
      const fit = fitValue(trainIdx.map((i) => rows[i]!), terms, book);
      const abs: number[] = [];
      for (const i of testIdx) {
        const r = rows[i]!;
        const pred = valueParts(fit, snapshot.as_of, r.p).logValue;
        abs.push(Math.abs(pred - r.y));
      }
      errs.push((Math.exp(median(abs)) - 1) * 100);
    }
    const mean = errs.reduce((s, v) => s + v, 0) / errs.length;
    candidates.push({ terms, heldout_error_pct: round1(mean) });
    if (mean < best - 0.1) {
      best = mean;
      chosen = terms;
    }
  }
  const baseline = candidates.find((c) => c.terms === 'median')!;
  const winner = candidates.find((c) => c.terms === chosen)!;
  return {
    chosen,
    report: {
      trained_on: rows.length,
      splits: FIT_SPLITS,
      candidates,
      chosen_terms: chosen,
      chosen_error_pct: winner.heldout_error_pct,
      baseline_error_pct: baseline.heldout_error_pct,
      bootstrap_refits: BOOTSTRAP_REFITS,
    },
  };
}

/** The odds model: a logistic fit over every protocol in the snapshot. */
export interface OddsModel {
  weights: [number, number, number, number];
  mean: [number, number, number];
  sd: [number, number, number];
  report: OddsReport;
}

/** The odds features of one protocol: log TVL, years listed (mean-imputed when unknown), clipped 7-day growth. */
function oddsFeatures(asOf: string, p: SnapshotProtocol, ageMean: number): [number, number, number] {
  const age = ageFeature(asOf, p);
  return [
    Math.log(Math.max(1, p.tvl_usd)),
    age === null ? ageMean : age,
    p.change_7d === null ? 0 : Math.max(-50, Math.min(100, p.change_7d)),
  ];
}

const sigmoid = (z: number): number => (z >= 0 ? 1 / (1 + Math.exp(-z)) : Math.exp(z) / (1 + Math.exp(z)));

/**
 * Fit the odds of "a token has been recorded" on all 758 protocols by full-batch gradient
 * descent — fixed step count, no randomness, the same weights on every run. The report's AUC
 * is the rank-sum statistic over the whole set: how well the score separates the protocols
 * that record a token from those that do not.
 */
export function fitOdds(snapshot: Snapshot): OddsModel {
  const ps = snapshot.protocols;
  const knownAges = ps.map((p) => ageFeature(snapshot.as_of, p)).filter((a): a is number => a !== null);
  const ageMean = knownAges.length > 0 ? knownAges.reduce((s, v) => s + v, 0) / knownAges.length : 0;
  const feats = ps.map((p) => oddsFeatures(snapshot.as_of, p, ageMean));
  const labels = ps.map((p) => (isPreToken(p) ? 0 : 1));
  const mean: [number, number, number] = [0, 0, 0];
  const sd: [number, number, number] = [1, 1, 1];
  for (let k = 0; k < 3; k++) {
    mean[k] = feats.reduce((s, f) => s + f[k]!, 0) / feats.length;
    const varSum = feats.reduce((s, f) => s + (f[k]! - mean[k]) ** 2, 0) / feats.length;
    sd[k] = Math.sqrt(varSum) > 0 ? Math.sqrt(varSum) : 1;
  }
  const z = feats.map((f): [number, number, number] => [
    (f[0] - mean[0]) / sd[0],
    (f[1] - mean[1]) / sd[1],
    (f[2] - mean[2]) / sd[2],
  ]);
  const w: [number, number, number, number] = [0, 0, 0, 0];
  const n = ps.length;
  for (let iter = 0; iter < 600; iter++) {
    const grad: [number, number, number, number] = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) {
      const zi = z[i]!;
      const pred = sigmoid(w[0] + w[1] * zi[0] + w[2] * zi[1] + w[3] * zi[2]);
      const err = pred - labels[i]!;
      grad[0] += err;
      grad[1] += err * zi[0];
      grad[2] += err * zi[1];
      grad[3] += err * zi[2];
    }
    w[0] -= 0.5 * (grad[0] / n);
    for (let k = 1; k < 4; k++) w[k] -= 0.5 * (grad[k] / n + 1e-4 * w[k]);
  }
  const scores = z.map((zi) => sigmoid(w[0] + w[1] * zi[0] + w[2] * zi[1] + w[3] * zi[2]));
  // Rank-sum AUC with average ranks for ties.
  const order = scores.map((s, i) => ({ s, i })).sort((a, b) => a.s - b.s);
  const ranks = new Array<number>(n);
  for (let i = 0; i < n; ) {
    let j = i;
    while (j + 1 < n && order[j + 1]!.s === order[i]!.s) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) ranks[order[k]!.i] = avg;
    i = j + 1;
  }
  const pos = labels.filter((l) => l === 1).length;
  const neg = n - pos;
  let rankSumPos = 0;
  labels.forEach((l, i) => {
    if (l === 1) rankSumPos += ranks[i]!;
  });
  const auc = pos > 0 && neg > 0 ? (rankSumPos - (pos * (pos + 1)) / 2) / (pos * neg) : 0.5;
  return {
    weights: w,
    mean,
    sd,
    report: {
      base_rate_pct: round1((pos / n) * 100),
      auc: Math.round(auc * 100) / 100,
      trained_on: n,
    },
  };
}

/**
 * One protocol's launch odds under the fitted model, as a percentage. A protocol with no
 * listing date gets the fit's own mean age — the mean stored in the model is over the
 * imputed feature, so it is exactly the value the fit used for unknown ages.
 */
export function oddsPct(model: OddsModel, asOf: string, p: SnapshotProtocol): number {
  const age = ageFeature(asOf, p);
  const f: [number, number, number] = [
    Math.log(Math.max(1, p.tvl_usd)),
    age === null ? model.mean[1] : age,
    p.change_7d === null ? 0 : Math.max(-50, Math.min(100, p.change_7d)),
  ];
  const z: [number, number, number] = [
    (f[0] - model.mean[0]) / model.sd[0],
    (f[1] - model.mean[1]) / model.sd[1],
    (f[2] - model.mean[2]) / model.sd[2],
  ];
  const w = model.weights;
  return round1(sigmoid(w[0] + w[1] * z[0] + w[2] * z[1] + w[3] * z[2]) * 100);
}

/** DefiLlama's version-marker rule: a name ending in a release is a pool of another protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/;

/** Categories the watchlist rule keeps off the board: products of tokens that already trade. */
const EXCLUDED_CATEGORIES = new Set(['Bridge', 'Canonical Bridge', 'Liquid Staking', 'Liquid Restaking', 'Restaked BTC', 'CEX']);

/** Names that begin with an exchange's name are exchange entries, not launches. */
const EXCHANGE_PREFIX = /^(Binance|Coinbase|Bybit|Kraken|Bitget|OKX|Bitfinex|Gemini)\b/;

/** Whether a protocol records no token at all. */
export function isPreToken(p: SnapshotProtocol): boolean {
  return p.mcap_usd === null && p.gecko_id === null && p.symbol === null;
}

/** The base name a versioned product would carry: the name with any version marker stripped. */
function baseName(name: string): string {
  return name.replace(VERSIONED, '').trim().toLowerCase();
}

/** The first exclusion reason that keeps a pre-token protocol off the board, or null when it may be ranked. */
export function exclusionReason(p: SnapshotProtocol, tokenizedNames: Set<string>): string | null {
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return 'excluded_category';
  if (VERSIONED.test(p.name)) return 'versioned_name';
  if (/\b(wrapped|staked|staking)\b/i.test(p.name)) return 'wrapped_name';
  if (EXCHANGE_PREFIX.test(p.name)) return 'exchange_name';
  if (tokenizedNames.has(baseName(p.name))) return 'child_of_tokenized';
  return null;
}

/**
 * Whether a protocol is one the board may rank: pre-token, and not a product of a token that
 * already trades — the watchlist's own exclusion rule, applied below its floor.
 */
export function isRankable(p: SnapshotProtocol, tokenizedNames: Set<string>): boolean {
  return isPreToken(p) && exclusionReason(p, tokenizedNames) === null;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks: the whole watchlist, plus every other rankable pre-token protocol, at any TVL. */
export function selectProtocols(snapshot: Snapshot): SnapshotProtocol[] {
  const index = bySlug(snapshot.protocols);
  const tokenizedNames = new Set(snapshot.protocols.filter((p) => !isPreToken(p)).map((p) => baseName(p.name)));
  const chosen = new Map<string, SnapshotProtocol>();
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  for (const p of snapshot.protocols) {
    if (chosen.has(p.slug)) continue;
    if (isRankable(p, tokenizedNames)) chosen.set(p.slug, p);
  }
  return [...chosen.values()];
}

/** Every protocol accounted for: token side split by priced/unpriced, pre-token split by board or exclusion reason. */
export function buildAccounting(snapshot: Snapshot, boardSize: number): Accounting {
  const tokenizedNames = new Set(snapshot.protocols.filter((p) => !isPreToken(p)).map((p) => baseName(p.name)));
  const watchlist = new Set(snapshot.watchlist);
  const acc: Accounting = {
    total: snapshot.protocols.length,
    tokenized_priced: 0,
    token_recorded_unpriced: 0,
    pre_token: 0,
    board_rows: boardSize,
    watchlist_covered: 0,
    excluded_category: 0,
    versioned_name: 0,
    wrapped_name: 0,
    exchange_name: 0,
    child_of_tokenized: 0,
  };
  for (const p of snapshot.protocols) {
    if (!isPreToken(p)) {
      if (p.mcap_usd !== null && p.mcap_usd > 0) acc.tokenized_priced += 1;
      else acc.token_recorded_unpriced += 1;
      continue;
    }
    acc.pre_token += 1;
    if (watchlist.has(p.slug)) {
      acc.watchlist_covered += 1;
      continue;
    }
    const reason = exclusionReason(p, tokenizedNames);
    if (reason === 'excluded_category') acc.excluded_category += 1;
    else if (reason === 'versioned_name') acc.versioned_name += 1;
    else if (reason === 'wrapped_name') acc.wrapped_name += 1;
    else if (reason === 'exchange_name') acc.exchange_name += 1;
    else if (reason === 'child_of_tokenized') acc.child_of_tokenized += 1;
  }
  return acc;
}

/** An integer with thousands separators, spelled the same on every machine. */
function fmtInt(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** Gas for one transaction on the protocol's first chain, in words: mainnet costs real money, L2s do not. */
function gasFor(p: SnapshotProtocol): string {
  return chainOf(p) === 'Ethereum' ? '$6–15 of ETH gas per transaction' : '$0.10–2 of gas per transaction';
}

/** The midpoint gas price the costing uses, matching the ranges the steps quote. */
function gasUsd(p: SnapshotProtocol): number {
  return chainOf(p) === 'Ethereum' ? 10 : 1;
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(p: SnapshotProtocol): number {
  if (p.tvl_usd >= 5_000_000_000) return 500;
  if (p.tvl_usd >= 1_000_000_000) return 250;
  if (p.tvl_usd >= 100_000_000) return 150;
  if (p.tvl_usd >= 10_000_000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(age: number | null): number {
  if (age === null) return 45;
  if (age < 180) return 60;
  if (age < 365) return 45;
  return 30;
}

/** What one wallet's plan costs all-in: setup and weekly gas, plus a 5% annual carry on the capital it parks. */
export function planCost(p: SnapshotProtocol, age: number | null): { capital: number; holdDays: number; totalUsd: number } {
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasUsd(p);
  const transactions = 3 + Math.ceil(hold / 7);
  const carry = capital * 0.05 * (hold / 365);
  return { capital, holdDays: hold, totalUsd: Math.max(1, Math.round(transactions * gas + carry)) };
}

/**
 * Net a plan against the launch it farms. If the token launches (the row's odds) and 5% of its
 * implied value reaches early users, the pool one wallet shares is implied × odds × 5%; the
 * break-even crowd is how many wallets farming the same way that pool can pay the plan's cost for.
 */
export function verdictFor(implied: number, odds: number, costUsd: number): { breakevenCrowd: number; verdict: 'FARM' | 'THIN' | 'SKIP' } {
  const pool = implied * (odds / 100) * COMMUNITY_ALLOCATION;
  const crowd = Math.max(1, Math.round(pool / Math.max(1, costUsd)));
  return { breakevenCrowd: crowd, verdict: crowd >= FARM_CROWD ? 'FARM' : crowd >= THIN_CROWD ? 'THIN' : 'SKIP' };
}

/** The category's core position, in words a farmer can follow. */
function coreAction(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const n = p.name;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} of USDC into a ${n} vault on ${chain} — pick the vault whose strategy and curator fee are shown on its page — and hold the vault shares in the same wallet.`;
  if (c.includes('lend') || c.includes('collateral')) return `Supply $${capital} of USDC to ${n} on ${chain}, then borrow no more than 30% against it once, so the wallet shows both sides of the market.`;
  if (c.includes('cdp')) return `Open a small ${n} vault on ${chain}: deposit $${capital} of collateral and mint the stablecoin at a conservative ratio above 200%.`;
  if (c.includes('dex')) return `Add $${capital} of liquidity to ${n}'s highest-volume stable or ETH pool on ${chain} and keep the LP position open.`;
  if (c.includes('perpetual') || c.includes('derivative')) return `Deposit $${capital} of USDC margin on ${n} and trade one small hedged pair (long and short of equal size) so volume registers without directional risk.`;
  if (c.includes('restak')) return `Restake $${capital} of ETH or LST through ${n} on ${chain} and hold the restaking receipt token in the same wallet.`;
  if (c.includes('staking')) return `Stake $${capital} of the chain's native asset through ${n} and keep the staking receipt in the wallet.`;
  if (c.includes('rwa') || c.includes('real world')) return `Mint $${capital} of ${n}'s yield-bearing asset on ${chain} after its onboarding check, and hold the asset to a distribution date.`;
  if (c.includes('basis') || c.includes('delta')) return `Deposit $${capital} of USDC into ${n}'s delta-neutral vault on ${chain} and leave the hedged position untouched.`;
  if (c.includes('payment')) return `Route one real payment of about $${Math.max(25, capital / 4)} through ${n} and keep $${capital} of working balance in the app for a month.`;
  if (c.includes('insurance')) return `Buy $${capital} of protocol cover from ${n} on ${chain} for the longest term offered and keep the policy active.`;
  if (c.includes('chain')) return `Bridge $${capital} to ${n}'s chain, then make one swap and one contract interaction a week so the wallet is a real chain user.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of ${n}'s stable asset on ${chain} and park it in the protocol's own savings vault.`;
  if (c.includes('yield') || c.includes('aggregator') || c.includes('farm')) return `Deposit $${capital} of USDC into ${n}'s main vault on ${chain} and leave auto-compounding on.`;
  if (c.includes('governance')) return `Hold $${capital} of ${n}'s incentive asset on ${chain} and vote in every governance poll it opens while you hold it.`;
  if (c.includes('privacy')) return `Shield $${capital} through ${n} on ${chain}, keep it private for two weeks, then unshield part of it so both actions register.`;
  return `Deposit $${capital} of USDC into ${n} on ${chain} through its main product page and keep the position open.`;
}

/** The weekly qualifying action that fits the category. */
function weeklyAction(p: SnapshotProtocol): string {
  const c = (p.category ?? '').toLowerCase();
  if (c.includes('dex') || c.includes('perpetual') || c.includes('derivative')) return 'one small swap or trade a week, sized under $25, so the wallet stays an active trader rather than a one-off depositor';
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return 'one supply, borrow or repay action a week, even $10, so every weekly snapshot catches the wallet mid-position';
  if (c.includes('chain')) return 'two transactions a week on the chain — a swap and any contract call — spread across different days';
  if (c.includes('governance')) return 'one vote a week whenever a poll is open, and claim any incentive the protocol issues for voting';
  return 'one deposit top-up or claim a week, even $10, so the wallet appears in every weekly snapshot the team publishes';
}

/**
 * A protocol's farm plan: five working steps and a verdict step that nets the plan's cost
 * against the launch it farms. The plan is derived from the protocol's own record (category,
 * chains, TVL, age) and the model's own outputs (implied value, odds) — never from a
 * hand-written list of names; the same generator writes every row.
 */
export function farmSteps(
  p: SnapshotProtocol,
  age: number | null,
  net: { verdict: 'FARM' | 'THIN' | 'SKIP'; costUsd: number; breakevenCrowd: number; odds: number },
): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(p);
  const verdictStep: FarmStep =
    net.verdict === 'FARM'
      ? {
          text: `Verdict: FARM. Netted against the launch: the plan costs about $${net.costUsd} all-in, and at ${net.odds}% launch odds with 5% of implied value reaching early users, it pays for itself unless more than ${fmtInt(net.breakevenCrowd)} wallets farm it the same way.`,
          cost: 'already counted in the steps above',
          time: 'one read before you start',
        }
      : net.verdict === 'THIN'
        ? {
            text: `Verdict: THIN. The plan costs about $${net.costUsd} all-in and breaks even at a crowd of roughly ${fmtInt(net.breakevenCrowd)} wallets (at ${net.odds}% launch odds and a 5% community allocation) — worth it only on cheap gas, with capital you can park for months.`,
            cost: 'already counted in the steps above',
            time: 'one read before you start',
          }
        : {
            text: `Verdict: SKIP for most wallets. The plan costs about $${net.costUsd} all-in but pays for itself only if fewer than about ${fmtInt(net.breakevenCrowd)} wallets farm it (at ${net.odds}% launch odds and a 5% community allocation), and a launch this size rarely draws a crowd that small.`,
            cost: 'already counted in the steps above',
            time: 'one read before you start',
          };
  return [
    {
      text: `Set up one fresh wallet for ${p.name} alone, fund it from an exchange withdrawal (never from another farm wallet), and keep its seed phrase offline.`,
      cost: 'one exchange withdrawal fee, about $1–5',
      time: '10 minutes',
    },
    {
      text: coreAction(p, capital, chain),
      cost: `$${capital} of capital, plus ${gas}`,
      time: '15 minutes to set up',
    },
    {
      text: `Repeat ${weeklyAction(p)}.`,
      cost: `${gas} each week`,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days without withdrawing below half the deposit, so the activity spans more than one snapshot or season.`,
      cost: `the $${capital} stays in the position; smart-contract risk is the real cost`,
      time: `${hold} days`,
    },
    {
      text: `Check ${p.name}'s official site and its verified social account weekly for a points, season or testnet announcement; claim only through links those channels publish, never through a search ad or a DM.`,
      cost: 'nothing to check; never pay a fee to claim an airdrop',
      time: '5 minutes a week',
    },
    verdictStep,
  ];
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** Rank ranges from bootstrap refits of the chosen model: each selected protocol's 10th–90th percentile rank. */
function bootstrapRanges(snapshot: Snapshot, terms: TermSet, selected: SnapshotProtocol[]): Map<string, [number, number]> {
  const rows = trainRows(snapshot.as_of, snapshot.protocols);
  const seen = new Map<string, number[]>();
  for (const p of selected) seen.set(p.slug, []);
  for (let b = 0; b < BOOTSTRAP_REFITS; b++) {
    const rand = prng(777000 + b * 131);
    const sample: SnapshotProtocol[] = [];
    for (let i = 0; i < rows.length; i++) sample.push(rows[Math.floor(rand() * rows.length)]!.p);
    const book = buildMultiples({ ...snapshot, protocols: sample }, 3);
    const fit = fitValue(trainRows(snapshot.as_of, sample), terms, book);
    const vals = selected.map((p) => ({ slug: p.slug, v: Math.exp(valueParts(fit, snapshot.as_of, p).logValue), tvl: p.tvl_usd }));
    vals.sort((x, y) => y.v - x.v || y.tvl - x.tvl || (x.slug < y.slug ? -1 : x.slug > y.slug ? 1 : 0));
    vals.forEach((v, i) => seen.get(v.slug)!.push(i + 1));
  }
  const out = new Map<string, [number, number]>();
  for (const [slug, rs] of seen) {
    const s = [...rs].sort((a, b) => a - b);
    out.set(slug, [s[Math.floor(0.1 * (s.length - 1))]!, s[Math.ceil(0.9 * (s.length - 1))]!]);
  }
  return out;
}

/** The protocols the board ranks, strongest first, with ranks 1..n, priced by the blind-chosen term set. */
export function buildBoard(snapshot: Snapshot, chosen: TermSet): BoardRow[] {
  const book = buildMultiples(snapshot, 3);
  const fit = fitValue(trainRows(snapshot.as_of, snapshot.protocols), chosen, book);
  const odds = fitOdds(snapshot);
  const selected = selectProtocols(snapshot);
  const scored = selected.map((p) => {
    const parts = valueParts(fit, snapshot.as_of, p);
    const implied = Math.max(1, Math.round(Math.exp(parts.logValue)));
    const age = ageDays(snapshot.as_of, p.listed_at);
    const o = oddsPct(odds, snapshot.as_of, p);
    const cost = planCost(p, age);
    const net = verdictFor(implied, o, cost.totalUsd);
    return { p, parts, implied, age, odds: o, cost, net };
  });
  scored.sort((a, b) => b.implied - a.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  const ranges = bootstrapRanges(snapshot, chosen, selected);
  return scored.map((s, i) => {
    const range = ranges.get(s.p.slug) ?? [i + 1, i + 1];
    return {
      rank: i + 1,
      slug: s.p.slug,
      name: s.p.name,
      category: s.p.category,
      chains: s.p.chains,
      tvl_usd: s.p.tvl_usd,
      change_7d: s.p.change_7d,
      mcap_usd: s.p.mcap_usd,
      listed_at: s.p.listed_at,
      gecko_id: s.p.gecko_id,
      symbol: s.p.symbol,
      token_status: 'pre-token' as const,
      age_days: s.age,
      implied_value_usd: s.implied,
      model: {
        effective_multiple: round4(Math.exp(s.parts.baseLog) / s.p.tvl_usd),
        comparables: s.parts.comparables,
        multiple_source: s.parts.source,
        growth_multiplier: round4(s.parts.growthMult),
        age_multiplier: round4(s.parts.ageMult),
        odds_pct: s.odds,
        plan_cost_usd: s.cost.totalUsd,
        breakeven_crowd: s.net.breakevenCrowd,
        verdict: s.net.verdict,
        rank_low: range[0],
        rank_high: range[1],
      },
      farm_steps: farmSteps(s.p, s.age, { verdict: s.net.verdict, costUsd: s.cost.totalUsd, breakevenCrowd: s.net.breakevenCrowd, odds: s.odds }).map(stepText),
    };
  });
}

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  return snapshot.protocols
    .filter((p) => !isPreToken(p) && p.category !== 'CEX')
    .sort((a, b) => (b.mcap_usd ?? 0) - (a.mcap_usd ?? 0) || b.tvl_usd - a.tvl_usd)
    .slice(0, LIVE_ROWS)
    .map((p) => ({
      slug: p.slug,
      name: p.name,
      category: p.category,
      chains: p.chains,
      tvl_usd: p.tvl_usd,
      mcap_usd: p.mcap_usd,
      change_7d: p.change_7d,
      multiple: p.mcap_usd !== null && p.tvl_usd > 0 ? round4(p.mcap_usd / p.tvl_usd) : null,
    }));
}

/** A board row's compact form for data.js. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank,
    slug: row.slug,
    name: row.name,
    category: row.category,
    chains: row.chains,
    tvl_usd: row.tvl_usd,
    change_7d: row.change_7d,
    mcap_usd: row.mcap_usd,
    listed_at: row.listed_at,
    age_days: row.age_days,
    implied_value_usd: row.implied_value_usd,
    effective_multiple: row.model.effective_multiple,
    comparables: row.model.comparables,
    multiple_source: row.model.multiple_source,
    growth_multiplier: row.model.growth_multiplier,
    age_multiplier: row.model.age_multiplier,
    odds_pct: row.model.odds_pct,
    plan_cost_usd: row.model.plan_cost_usd,
    breakeven_crowd: row.model.breakeven_crowd,
    verdict: row.model.verdict,
    rank_low: row.model.rank_low,
    rank_high: row.model.rank_high,
    watchlist: watchlist.has(row.slug),
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot): { board: BoardRow[]; radar: RadarData } {
  const { report, chosen } = evaluateTerms(snapshot);
  const board = buildBoard(snapshot, chosen);
  const live = liveRows(snapshot);
  const book = buildMultiples(snapshot, 3);
  const oddsModel = fitOdds(snapshot);
  const watchlist = new Set(snapshot.watchlist);
  const early = board.filter((r) => !watchlist.has(r.slug)).length;
  const verdicts = { farm: 0, thin: 0, skip: 0 };
  for (const r of board) {
    if (r.model.verdict === 'FARM') verdicts.farm += 1;
    else if (r.model.verdict === 'THIN') verdicts.thin += 1;
    else verdicts.skip += 1;
  }
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model_version: MODEL_VERSION,
    global_multiple: round4(book.global),
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
    fit: report,
    odds: oddsModel.report,
    accounting: buildAccounting(snapshot, board.length),
    verdicts,
    rows: board.map((r) => radarRow(r, watchlist)),
    live,
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const o = raw as Record<string, unknown>;
  if (typeof o.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(o.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof o.source !== 'string') throw new SnapshotError('snapshot.json has no source');
  if (typeof o.floor_usd !== 'number' || !Number.isSafeInteger(o.floor_usd) || o.floor_usd <= 0) throw new SnapshotError('snapshot.json has no floor_usd');
  if (!Array.isArray(o.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(o.watchlist) || o.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = o.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError(`snapshot.json's protocol ${i} is not an object`);
    const p = v as Record<string, unknown>;
    if (typeof p.slug !== 'string' || typeof p.name !== 'string' || typeof p.tvl_usd !== 'number' || !Number.isFinite(p.tvl_usd)) {
      throw new SnapshotError(`snapshot.json's protocol ${i} lacks a slug, a name or a TVL`);
    }
    return {
      slug: p.slug,
      name: p.name,
      category: typeof p.category === 'string' ? p.category : null,
      chains: Array.isArray(p.chains) ? p.chains.filter((c): c is string => typeof c === 'string') : [],
      tvl_usd: p.tvl_usd,
      change_7d: typeof p.change_7d === 'number' && Number.isFinite(p.change_7d) ? p.change_7d : null,
      mcap_usd: typeof p.mcap_usd === 'number' && Number.isFinite(p.mcap_usd) ? p.mcap_usd : null,
      listed_at: typeof p.listed_at === 'string' ? p.listed_at : null,
      gecko_id: typeof p.gecko_id === 'string' ? p.gecko_id : null,
      symbol: typeof p.symbol === 'string' ? p.symbol : null,
    };
  });
  return {
    as_of: o.as_of,
    source: o.source,
    floor_usd: o.floor_usd,
    protocols,
    watchlist: o.watchlist as string[],
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return `the board misses ${missing.length} watchlist slug${missing.length === 1 ? '' : 's'}: ${missing.slice(0, 5).join(', ')}`;
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return `rank ${i + 1} is ${ranks[i]}`;
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return `row ${i + 1} outranks row ${i} on implied value`;
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return `all ${board.length} rows share the same implied value $${board[0]!.implied_value_usd}: a board that ranks nothing by value is not a ranking`;
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return `${r.slug} has ${steps.length} farm steps`;
    for (const s of steps) if (s.length < 20 || s.length > 600) return `${r.slug} has a farm step of ${s.length} characters`;
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return `${r.slug} has implied value ${r.implied_value_usd}`;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return `window.RADAR=${JSON.stringify(radar)};\n`;
}
