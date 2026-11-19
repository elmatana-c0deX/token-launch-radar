// Token Launch Radar — the model.
//
// One sealed snapshot of the protocol universe in, one ranked board out. The board covers every slug
// in the snapshot's watchlist (the floor, never a ceiling) and adds pre-token protocols below the
// floor that pass the same exclusion rule the house used to build the watchlist: no versioned
// product of another protocol, no wrapped/staked/bridged product of a token that already trades,
// no exchange entry, no child whose parent protocol's token already trades.
//
// Implied value is derived only from the snapshot's own figures — never from a list of names:
//
//   multiple   = the median market-cap/TVL ratio of the snapshot's own tokenized protocols in the
//                same category (pooled family median when a category has fewer than 3 tokenized
//                peers, the all-market median when no family applies)
//   growthMult = clamp(1 + change_7d x 0.02, 0.75, 1.40)     (change_7d unreported: 1.00)
//   ageMult    = 1 + 0.05 x min(years listed, 5)             (listed_at unknown: 1.00)
//   implied    = round(tvl_usd x multiple x growthMult x ageMult)
//
// The growth term prices momentum the market can see this week; the age term is a seasoning
// premium — a protocol that has held its TVL for years with no token has proven the demand a
// launch would price. Every row carries its own inputs, so the board, the page and this code agree.

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

/** The model's constants, as the dashboard states them. */
export interface ModelConstants {
  growth_weight: number;
  growth_floor: number;
  growth_cap: number;
  age_step: number;
  age_cap_years: number;
  min_comparables: number;
}

export const MODEL: ModelConstants = {
  growth_weight: 0.02,
  growth_floor: 0.75,
  growth_cap: 1.4,
  age_step: 0.05,
  age_cap_years: 5,
  min_comparables: 3,
};

/** The model's version label: the dashboard names it. */
export const MODEL_VERSION = 'radar-2 (category multiples)';

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 140;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24;

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
    category_multiple: number;
    comparables: number;
    multiple_source: string;
    growth_pct: number | null;
    growth_multiplier: number;
    age_multiplier: number;
    age_days: number | null;
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
  category_multiple: number;
  comparables: number;
  multiple_source: string;
  growth_multiplier: number;
  age_multiplier: number;
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

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string;
  source: string;
  floor_usd: number;
  model: ModelConstants;
  model_version: string;
  global_multiple: number;
  watchlist_size: number;
  board_size: number;
  early_size: number;
  live_size: number;
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
  { name: 'stablecoins & payments', words: ['stable', 'payment', 'cdp'] },
  { name: 'basis & delta-neutral', words: ['basis', 'delta'] },
];

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

/** The multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(
  protocol: SnapshotProtocol,
  asOf: string,
  model: ModelConstants,
  book: MultipleBook,
): { implied: number; multiple: number; comparables: number; source: string; growthPct: number | null; growthMult: number; ageMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const m = book.forCategory(protocol.category);
  const growthPct = protocol.change_7d;
  const growthMult = growthPct === null ? 1 : Math.min(model.growth_cap, Math.max(model.growth_floor, 1 + growthPct * model.growth_weight));
  const ageMult = age === null ? 1 : 1 + model.age_step * Math.min(age / 365, model.age_cap_years);
  const implied = Math.max(1, Math.round(protocol.tvl_usd * m.multiple * growthMult * ageMult));
  return { implied, multiple: m.multiple, comparables: m.comparables, source: m.source, growthPct, growthMult, ageMult, age };
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

/**
 * Whether a protocol is one the board may rank: pre-token, and not a product of a token that
 * already trades — the watchlist's own exclusion rule, applied below its floor.
 */
export function isRankable(p: SnapshotProtocol, tokenizedNames: Set<string>): boolean {
  if (!isPreToken(p)) return false;
  if (p.category !== null && EXCLUDED_CATEGORIES.has(p.category)) return false;
  if (VERSIONED.test(p.name)) return false;
  if (/\b(wrapped|staked|staking)\b/i.test(p.name)) return false;
  if (EXCHANGE_PREFIX.test(p.name)) return false;
  if (tokenizedNames.has(baseName(p.name))) return false;
  return true;
}

/** The snapshot's protocol by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  return new Map(protocols.map((p) => [p.slug, p]));
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const book = buildMultiples(snapshot, model.min_comparables);
  const tokenizedNames = new Set(snapshot.protocols.filter((p) => !isPreToken(p)).map((p) => baseName(p.name)));
  const chosen = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor: every slug, whatever the exclusion rule says about it.
  for (const slug of snapshot.watchlist) {
    const p = index.get(slug);
    if (p !== undefined) chosen.set(slug, p);
  }
  // The early radar: pre-token protocols below the watchlist floor that pass the same rule, by TVL.
  const early = snapshot.protocols
    .filter((p) => !chosen.has(p.slug) && isRankable(p, tokenizedNames) && p.tvl_usd < snapshot.floor_usd)
    .sort((a, b) => b.tvl_usd - a.tvl_usd || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .slice(0, EARLY_ROWS);
  for (const p of early) chosen.set(p.slug, p);

  const scored = [...chosen.values()].map((p) => ({ p, ...impliedValue(p, snapshot.as_of, model, book) }));
  scored.sort((a, b) => b.implied - a.implied || b.p.tvl_usd - a.p.tvl_usd || (a.p.slug < b.p.slug ? -1 : a.p.slug > b.p.slug ? 1 : 0));
  return scored.map((s, i) => ({
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
    token_status: 'pre-token',
    age_days: s.age,
    implied_value_usd: s.implied,
    model: {
      category_multiple: round4(s.multiple),
      comparables: s.comparables,
      multiple_source: s.source,
      growth_pct: s.growthPct,
      growth_multiplier: round4(s.growthMult),
      age_multiplier: round4(s.ageMult),
      age_days: s.age,
    },
    farm_steps: farmSteps(s.p, s.age).map(stepText),
  }));
}

/** A step as one string: its action, then its cost and time, within the gate's 20..600 characters. */
export function stepText(step: FarmStep): string {
  let s = `${step.text} Cost: ${step.cost}. Time: ${step.time}.`;
  if (s.length > 600) s = `${s.slice(0, 596)}...`;
  if (s.length < 20) s = `${s} Hold the position and check the protocol's own page.`;
  return s;
}

/** The first chain a protocol names, or a neutral phrase. */
function chainOf(p: SnapshotProtocol): string {
  return p.chains.length > 0 ? p.chains[0]! : 'its main chain';
}

/** Gas for one transaction on the protocol's first chain: mainnet costs real money, L2s do not. */
function gasFor(p: SnapshotProtocol): string {
  return chainOf(p) === 'Ethereum' ? '$6–15 of ETH gas per transaction' : '$0.10–2 of gas per transaction';
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
 * A protocol's farm plan: five steps, each an action with a cost and a time. The plan is derived
 * from the protocol's own record (category, chains, TVL, age), never from a hand-written list of
 * names — the same generator writes every row, and the detail view shows it whole.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(p);
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
  ];
}

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
    category_multiple: row.model.category_multiple,
    comparables: row.model.comparables,
    multiple_source: row.model.multiple_source,
    growth_multiplier: row.model.growth_multiplier,
    age_multiplier: row.model.age_multiplier,
    watchlist: watchlist.has(row.slug),
    farm_steps: row.farm_steps,
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const book = buildMultiples(snapshot, model.min_comparables);
  const watchlist = new Set(snapshot.watchlist);
  const early = board.filter((r) => !watchlist.has(r.slug)).length;
  const radar: RadarData = {
    as_of: snapshot.as_of,
    source: snapshot.source,
    floor_usd: snapshot.floor_usd,
    model,
    model_version: MODEL_VERSION,
    global_multiple: round4(book.global),
    watchlist_size: snapshot.watchlist.length,
    board_size: board.length,
    early_size: early,
    live_size: live.length,
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
