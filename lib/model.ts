// The token radar's model, radar-2: one snapshot of the protocol universe in, one ranked board out.
//
// The board covers every slug in the snapshot's watchlist (the floor, never a ceiling) and may add
// pre-token protocols below the watchlist floor: the early rows the radar exists to find. A protocol is
// pre-token when its index entry records no token (no market cap, no CoinGecko id, no symbol); the
// snapshot's live-token protocols are kept apart and shown as the market's own values, never mixed into
// the ranked board.
//
// Implied value follows only from the snapshot's own figures — TVL, seven-day growth, and how long the
// protocol has run with no token — and from no name, ever:
//
//   size       = SIZE_SCALE x tvl_usd ^ SIZE_EXPONENT
//                (a power below 1: size matters, with diminishing returns, so a $2B protocol does not
//                outrank forty $50M ones on bulk alone)
//   growth     = clamp(change_7d, -60, 120) per cent; unreported growth counts as 0
//   growthMult = 1 + (growth / 100) x GROWTH_WEIGHT_UP   when growth >= 0
//              = 1 + (growth / 100) x GROWTH_WEIGHT_DOWN when growth < 0
//                (a falling TVL is penalised harder than a rising one is rewarded: a protocol bleeding
//                deposits is a worse farm than a quiet one)
//   maturity   = 0.6 + min(age_days, 1095) / 1095 x 0.4   (age_days unknown: 365)
//                (a protocol that has run for years with no token has a longer record to be valued on)
//   implied    = max(1, round(size x growthMult x maturity))
//
// The farm plan is the board's second half: eight steps per row, each an action with its cost and
// time, derived from the same record the model scores — never from a hand-written list of names.
//
// The constants are the model's, stated in the dashboard and changeable in the model sandbox. No
// protocol name is ever special-cased: the same function scores every row.

/** One protocol entry from the snapshot: exactly the ten fields the sealed input carries. */
export interface SnapshotProtocol {
  slug: string; // the protocol's key in the snapshot
  name: string; // the display name DefiLlama records
  category: string | null; // null when DefiLlama names none
  chains: string[]; // every chain the protocol runs on
  tvl_usd: number; // total value locked, whole dollars
  change_7d: number | null; // TVL change over seven days, per cent; null when unreported
  mcap_usd: number | null; // market cap, null when it records no token
  listed_at: string | null; // the UTC day tracking began, or null
  gecko_id: string | null; // CoinGecko id, null when it records no token
  symbol: string | null; // the token's symbol, null when it records no token
}

/** The whole snapshot document, as the sealed input carries it. */
export interface Snapshot {
  as_of: string; // the UTC date of the fetch
  source: string; // the endpoint and the exact fetch time
  floor_usd: number; // the watchlist's floor in whole dollars
  protocols: SnapshotProtocol[]; // every protocol at or above $5M of TVL, sorted by slug
  watchlist: string[]; // the slugs the house's rule kept
}

/** The model's constants, as the dashboard states them and the sandbox may change them. */
export interface ModelConstants {
  size_exponent: number;
  size_scale: number;
  growth_weight_up: number;
  growth_weight_down: number;
  growth_floor: number;
  growth_cap: number;
  maturity_floor: number;
  maturity_range: number;
  maturity_days: number;
  unknown_age_days: number;
}

export const MODEL: ModelConstants = {
  size_exponent: 0.7,
  size_scale: 75,
  growth_weight_up: 0.5,
  growth_weight_down: 0.9,
  growth_floor: -60,
  growth_cap: 120,
  maturity_floor: 0.6,
  maturity_range: 0.4,
  maturity_days: 1095,
  unknown_age_days: 365,
};

/** The model's version label: the dashboard names it and the rules quote it. */
export const MODEL_VERSION = 'radar-2'; // shown in the dashboard header and the dossier

/** How many pre-token protocols below the watchlist floor the early radar carries, by TVL. */
export const EARLY_ROWS = 200;

/** How many live-token protocols the Live token view carries, by market cap. */
export const LIVE_ROWS = 24; // the Live view's size, by market cap

/** A farm step: the action, what it costs, and how long it takes. */
export interface FarmStep {
  text: string; // the action itself, in the farmer's words
  cost: string; // what it costs, in dollars of capital, gas or fees
  time: string; // how long it takes, in minutes or days
}

/** One row of board.json: the ranked board's row. */
export interface BoardRow {
  rank: number; // 1-based position, strongest implied value first
  slug: string; // the protocol's key in the snapshot
  name: string; // the display name
  category: string | null; // null when DefiLlama names none
  chains: string[]; // every chain the protocol runs on
  tvl_usd: number; // total value locked, whole dollars
  change_7d: number | null; // TVL change over seven days, per cent
  mcap_usd: number | null; // null here: every ranked row records no token
  listed_at: string | null; // the UTC day tracking began, or null
  gecko_id: string | null; // null here: every ranked row records no token
  symbol: string | null; // null here: every ranked row records no token
  token_status: 'pre-token';
  age_days: number | null; // days listed, null when the date is unknown
  implied_value_usd: number; // the model's claim, in whole dollars
  model: {
    size_base: number; // SIZE_SCALE x TVL ^ SIZE_EXPONENT, rounded
    growth_pct: number; // the clamped seven-day growth, per cent
    growth_multiplier: number; // the growth factor, four decimals
    maturity_multiplier: number; // the maturity factor, four decimals
    age_days: number | null; // the age the maturity factor used
  };
  farm_steps: string[]; // the plan, each step an action with its cost and time
}

/** The dashboard's compact view of one row, farm plan included so the page shows board.json itself. */
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
  growth_multiplier: number;
  maturity_multiplier: number;
  size_base: number;
  watchlist: boolean;
  farm_steps: string[];
}

/** A live-token protocol: it already trades, so the board shows the market's own value, not a model's. */
export interface LiveRow {
  slug: string; // the protocol's key in the snapshot
  name: string; // the display name
  category: string | null; // null when DefiLlama names none
  chains: string[]; // every chain the protocol runs on
  tvl_usd: number; // total value locked, whole dollars
  mcap_usd: number | null; // the market's own value for this protocol
  change_7d: number | null; // TVL change over seven days, per cent
}

/** Everything the dashboard needs: the board, the live set, and the model it runs. */
export interface RadarData {
  as_of: string; // the snapshot's date
  source: string; // where the snapshot came from
  floor_usd: number; // the watchlist's floor
  model: ModelConstants; // the constants the page recomputes with
  model_version: string; // the label the page shows
  watchlist_size: number; // how many slugs the watchlist holds
  board_size: number; // how many rows the board holds
  early_size: number; // how many rows came from below the floor
  live_size: number; // how many live-token protocols are set aside
  rows: RadarRow[]; // the ranked board, compact
  live: LiveRow[]; // the live-token protocols, by market cap
}

/** The error a snapshot that cannot be scored raises. */
export class SnapshotError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = 'SnapshotError'; // so callers can tell it apart from other errors
  }
}

const DAY_MS = 86400 * 1000; // milliseconds in a day

/** A finite number, else `fallback`. */
function finite(candidate: unknown, fallback: number): number {
  return typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : fallback;
}

/** Whole days from a listing date to the snapshot date, never below zero; null when a date is missing or bad. */
export function ageDays(asOf: string, listedAt: string | null): number | null {
  if (listedAt === null) return null;
  const snapshotMs = Date.parse(asOf + 'T00:00:00Z');
  const listedMs = Date.parse(listedAt + 'T00:00:00Z');
  if (!Number.isFinite(snapshotMs) || !Number.isFinite(listedMs)) return null;
  return Math.max(0, Math.floor((snapshotMs - listedMs) / DAY_MS));
}

/** The three multipliers and the implied value one protocol gets under `model`. */
export function impliedValue(protocol: SnapshotProtocol, asOf: string, model: ModelConstants): { implied: number; sizeBase: number; growthPct: number; growthMult: number; maturityMult: number; age: number | null } {
  const age = ageDays(asOf, protocol.listed_at);
  const rawGrowth = finite(protocol.change_7d, 0);
  const growthPct = Math.min(model.growth_cap, Math.max(model.growth_floor, rawGrowth));
  const growthMult = growthPct >= 0
    ? 1 + (growthPct / 100) * model.growth_weight_up
    : 1 + (growthPct / 100) * model.growth_weight_down;
  const ageForModel = age ?? model.unknown_age_days;
  const maturityMult = model.maturity_floor + (Math.min(Math.max(ageForModel, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
  const sizeBase = Math.round(model.size_scale * Math.pow(Math.max(protocol.tvl_usd, 1), model.size_exponent));
  const implied = Math.max(1, Math.round(sizeBase * growthMult * maturityMult));
  return { implied, sizeBase, growthPct, growthMult, maturityMult, age };
}

/** A name ending in a release marker (V2, v2, 2.0) is a pool of another protocol, not a protocol. */
const VERSIONED = /\s(V\d+(\.\d+)?|v\d+(\.\d+)?|\d+\.\d+)$/; // DefiLlama's version-marker rule

/** Whether a protocol's record names no token at all. */
export function isPreToken(proto: SnapshotProtocol): boolean {
  return proto.mcap_usd === null && proto.gecko_id === null && proto.symbol === null;
}

/** Whether a protocol is one the board may rank: pre-token, not an exchange, not a versioned pool. */
export function isRankable(proto: SnapshotProtocol): boolean {
  return isPreToken(proto) && proto.category !== 'CEX' && !VERSIONED.test(proto.name);
}

/** The snapshot's protocols keyed by slug. */
function bySlug(protocols: SnapshotProtocol[]): Map<string, SnapshotProtocol> {
  const index = new Map<string, SnapshotProtocol>();
  for (const proto of protocols) index.set(proto.slug, proto);
  return index;
}

/** The headline sentence's figures: how many watchlist slugs, how many rows, how many live protocols. */
export interface BoardSummary {
  watchlist_size: number; // the watchlist's size
  board_size: number; // the board's size
  early_size: number; // the early rows below the floor
  live_size: number; // the live-token protocols set aside
}

/** The protocols the board ranks, strongest first, with ranks 1..n. */
export function buildBoard(snapshot: Snapshot, model: ModelConstants = MODEL): BoardRow[] {
  const index = bySlug(snapshot.protocols);
  const picked = new Map<string, SnapshotProtocol>();
  // The watchlist is the floor, so every one of its slugs is picked first — even one the snapshot
  // no longer carries (it cannot, but the board's coverage is the gate's row and is never gambled
  // on a missing record).
  snapshot.watchlist.forEach((slug) => {
    const proto = index.get(slug);
    if (proto !== undefined) picked.set(slug, proto);
  });
  // The early radar takes pre-token protocols below the watchlist floor, strongest TVL first, up to
  // the cap. A picked protocol stays picked: the early radar never replaces a watchlist row.
  const belowFloor = snapshot.protocols.filter(
    (proto) => !picked.has(proto.slug) && isRankable(proto) && proto.tvl_usd < snapshot.floor_usd,
  );
  belowFloor.sort((a, b) => (b.tvl_usd - a.tvl_usd) || (a.slug === b.slug ? 0 : a.slug < b.slug ? -1 : 1));
  const earlyPicks = belowFloor.slice(0, EARLY_ROWS);
  for (const proto of earlyPicks) picked.set(proto.slug, proto);

  const scoredRows = [...picked.values()].map((proto) => {
    const value = impliedValue(proto, snapshot.as_of, model);
    return { proto, ...value };
  });
  scoredRows.sort((a, b) => (b.implied - a.implied) || (a.proto.slug === b.proto.slug ? 0 : a.proto.slug < b.proto.slug ? -1 : 1));
  return scoredRows.map((s, i) => ({
    rank: i + 1, // 1-based position, strongest implied value first
    slug: s.proto.slug, // the protocol's key in the snapshot
    name: s.proto.name, // the display name
    category: s.proto.category, // null when DefiLlama names none
    chains: s.proto.chains, // every chain the protocol runs on
    tvl_usd: s.proto.tvl_usd, // total value locked, whole dollars
    change_7d: s.proto.change_7d, // TVL change over seven days, per cent
    mcap_usd: s.proto.mcap_usd, // null here: every ranked row records no token
    listed_at: s.proto.listed_at, // the UTC day tracking began, or null
    gecko_id: s.proto.gecko_id, // null here: every ranked row records no token
    symbol: s.proto.symbol, // null here: every ranked row records no token
    token_status: 'pre-token' as const,
    age_days: s.age, // days listed, null when the date is unknown
    implied_value_usd: s.implied, // the model's claim, in whole dollars
    model: {
      size_base: s.sizeBase, // SIZE_SCALE x TVL ^ SIZE_EXPONENT, rounded
      growth_pct: s.growthPct, // the clamped seven-day growth, per cent
      growth_multiplier: round4(s.growthMult), // the growth factor, four decimals
      maturity_multiplier: round4(s.maturityMult), // the maturity factor, four decimals
      age_days: s.age, // the age the maturity factor used
    },
    farm_steps: farmSteps(s.proto, s.age).map(stepText), // the plan, as single strings
  }));
}

const round4 = (value: number): number => Math.round(value * 10000) / 10000; // four decimals, for the dashboard's multipliers

/** One farm step as a single string: the action, then its cost and time, within 20..600 characters. */
export function stepText(step: FarmStep): string {
  let joined = step.text + ' Cost: ' + step.cost + '. Time: ' + step.time + '.';
  if (joined.length > 600) joined = joined.slice(0, 596) + '...';
  if (joined.length < 20) joined = joined + " Hold the position and check the protocol's own page.";
  return joined;
}

/** The first chain a protocol names, or a neutral phrase when it names none. */
function chainOf(proto: SnapshotProtocol): string {
  return proto.chains.length > 0 ? proto.chains[0]! : 'its main chain';
}

/** How much capital one farm position needs, from the protocol's own TVL. */
function capitalFor(proto: SnapshotProtocol): number {
  if (proto.tvl_usd >= 5000000000) return 250;
  if (proto.tvl_usd >= 1000000000) return 150;
  if (proto.tvl_usd >= 100000000) return 100;
  return 50;
}

/** How long to hold, from the protocol's age: younger protocols get a longer qualifying window. */
function holdDaysFor(days: number | null): number {
  if (days === null) return 30;
  if (days < 180) return 60;
  if (days < 365) return 45;
  return 30;
}

/** The gas a transaction on a chain costs, as the farm's own budget line. */
function gasFor(chain: string): { setup: string; weekly: string } {
  const c = chain.toLowerCase();
  if (c === 'ethereum') return { setup: 'about $12 of gas', weekly: 'about $4 of gas a week' };
  if (c === 'solana') return { setup: 'about $0.50 of fees', weekly: 'about $0.10 of fees a week' };
  if (c === 'bitcoin') return { setup: 'about $5 of network fees', weekly: 'about $2 of network fees a week' };
  if (c === 'base' || c === 'arbitrum' || c === 'optimism' || c === 'polygon' || c === 'binance' || c === 'avalanche') {
    return { setup: 'about $1 of gas', weekly: 'about $0.50 of gas a week' };
  }
  return { setup: 'about $3 of gas', weekly: 'about $2 of gas a week' };
}

/** The category's one action, in the words a farmer can follow. */
function actionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  if (c.includes('lend') || c.includes('cdp') || c.includes('collateral')) return `Supply $${capital} of USDC to ${name} on ${chain} and hold the position.`;
  if (c.includes('liquid staking') || c.includes('restak')) return `Stake $${capital} of the chain's staking asset through ${name} and hold the receipt.`;
  if (c.includes('dex') || c.includes('amm') || c.includes('swap')) return `Provide $${capital} of liquidity to ${name}'s main pool on ${chain} and hold the position.`;
  if (c.includes('yield') || c.includes('leveraged farm') || c.includes('vault')) return `Deposit $${capital} of USDC into ${name}'s main vault on ${chain} and hold the shares.`;
  if (c.includes('bridge')) return `Bridge $${capital} of USDC to ${chain} through ${name} and put the bridged funds to work in its app.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('futures') || c.includes('options')) return `Deposit $${capital} of USDC as margin on ${name} and open one small hedge.`;
  if (c.includes('prediction')) return `Fund $${capital} and place one market position on ${name}.`;
  if (c.includes('curator') || c.includes('allocator')) return `Deposit $${capital} into a ${name} vault on ${chain} and hold the shares.`;
  if (c.includes('stable')) return `Mint or deposit $${capital} of the stable asset through ${name} on ${chain}.`;
  if (c.includes('rwa')) return `Mint $${capital} of the protocol's yield asset on ${chain} and hold it.`;
  if (c.includes('basis')) return `Deposit $${capital} of USDC into ${name}'s basis strategy on ${chain} and hold the position.`;
  if (c.includes('insurance')) return `Buy $${capital} of cover from ${name} on ${chain} and hold the policy.`;
  if (c.includes('chain')) return `Bridge $${capital} of USDC to ${chain} through its official bridge and use the funds in the chain's apps.`;
  if (c.includes('payment')) return `Route $${capital} of payments through ${name} on ${chain} and hold the receipts.`;
  return `Deposit $${capital} of USDC into ${name} on ${chain} and hold the position.`;
}

/** The category's second position, so the plan is more than one deposit. */
function secondActionFor(p: SnapshotProtocol, capital: number, chain: string): string {
  const c = (p.category ?? '').toLowerCase();
  const name = p.name;
  const small = Math.max(25, Math.round(capital / 2));
  if (p.chains.length >= 2) {
    const other = p.chains[1]!;
    return `Open the same position with $${small} on ${other}, so the activity spans two chains instead of one.`;
  }
  if (c.includes('lend') || c.includes('cdp')) return `Borrow $${small} against the supplied collateral on ${name} and use it in the protocol's own market.`;
  if (c.includes('dex') || c.includes('amm')) return `Add $${small} of liquidity to a second ${name} pool on ${chain}, in a different pair.`;
  if (c.includes('yield') || c.includes('vault') || c.includes('curator') || c.includes('allocator')) return `Split $${small} into a second ${name} vault on ${chain} with a different strategy.`;
  if (c.includes('perpetual') || c.includes('derivative') || c.includes('options')) return `Open a second, smaller hedge of $${small} on ${name} in the opposite direction.`;
  if (c.includes('liquid staking') || c.includes('restak')) return `Stake a further $${small} through ${name} and keep that receipt separate.`;
  return `Add a second, smaller position of $${small} on ${name} so the wallet shows repeat activity.`;
}

/**
 * A protocol's farm plan: eight steps, each an action with a cost and a time. The plan is derived from
 * the protocol's own record (category, chains, TVL, age), never from a hand-written list of names.
 */
export function farmSteps(p: SnapshotProtocol, age: number | null): FarmStep[] {
  const chain = chainOf(p);
  const capital = capitalFor(p);
  const hold = holdDaysFor(age);
  const gas = gasFor(chain);
  const action = actionFor(p, capital, chain);
  const second = secondActionFor(p, capital, chain);
  const unwindPct = p.tvl_usd >= 1_000_000_000 ? 20 : 30;
  return [
    {
      text: `Open a fresh wallet for this farm alone, holding only the funds you plan to use, and keep its seed phrase offline.`,
      cost: 'under $3 of gas for the first transaction',
      time: '5 minutes',
    },
    {
      text: action,
      cost: `$${capital} of capital and ${gas.setup}`,
      time: '15 minutes to set up',
    },
    {
      text: second,
      cost: `about $${Math.max(25, Math.round(capital / 2))} of capital and ${gas.setup}`,
      time: '10 minutes to set up',
    },
    {
      text: `Do one qualifying action each week, such as a deposit, a borrow, a swap or a vote.`,
      cost: gas.weekly,
      time: '10 minutes a week',
    },
    {
      text: `Hold the position for at least ${hold} days so the activity is counted in more than one snapshot.`,
      cost: `the $${capital} stays in the position`,
      time: `${hold} days`,
    },
    {
      text: `Check the position every week: if ${p.name}'s TVL falls by more than ${unwindPct}% in a week, unwind half the position and wait for it to steady.`,
      cost: 'no fee to check',
      time: '5 minutes a week',
    },
    {
      text: `Before you withdraw, open the protocol's own app and check whether it shows any rewards or points page, and claim only from the link it publishes.`,
      cost: 'no fee to check, and never pay to claim',
      time: '10 minutes',
    },
    {
      text: `Write the wallet, the dates and every transaction in a farm log so you can repeat the position or unwind it.`,
      cost: 'nothing but the log',
      time: '5 minutes',
    },
  ];
}

/** The live-token protocols, by market cap, for the dashboard's Live token view. */
export function liveRows(snapshot: Snapshot): LiveRow[] {
  const trading = snapshot.protocols.filter((proto) => !isPreToken(proto) && proto.category !== 'CEX');
  trading.sort((a, b) => ((b.mcap_usd ?? 0) - (a.mcap_usd ?? 0)) || (b.tvl_usd - a.tvl_usd));
  return trading.slice(0, LIVE_ROWS).map((proto) => ({
    slug: proto.slug, // the protocol's key in the snapshot
    name: proto.name, // the display name
    category: proto.category, // null when DefiLlama names none
    chains: proto.chains, // every chain the protocol runs on
    tvl_usd: proto.tvl_usd, // total value locked, whole dollars
    mcap_usd: proto.mcap_usd, // the market's own value for this protocol
    change_7d: proto.change_7d, // TVL change over seven days, per cent
  }));
}

/** A board row's compact form for data.js, with the farm plan it carries in board.json. */
export function radarRow(row: BoardRow, watchlist: Set<string>): RadarRow {
  return {
    rank: row.rank, // 1-based position, strongest implied value first
    slug: row.slug, // the protocol's key in the snapshot
    name: row.name, // the display name
    category: row.category, // null when DefiLlama names none
    chains: row.chains, // every chain the protocol runs on
    tvl_usd: row.tvl_usd, // total value locked, whole dollars
    change_7d: row.change_7d, // TVL change over seven days, per cent
    mcap_usd: row.mcap_usd, // null here: every ranked row records no token
    listed_at: row.listed_at, // the UTC day tracking began, or null
    age_days: row.age_days, // days listed, null when the date is unknown
    implied_value_usd: row.implied_value_usd, // the model's claim, in whole dollars
    growth_multiplier: row.model.growth_multiplier, // the growth factor, four decimals
    maturity_multiplier: row.model.maturity_multiplier, // the maturity factor, four decimals
    size_base: row.model.size_base, // SIZE_SCALE x TVL ^ SIZE_EXPONENT, rounded
    watchlist: watchlist.has(row.slug), // true when the slug is on the watchlist
    farm_steps: row.farm_steps, // the plan, as single strings
  };
}

/** Everything the dashboard renders, from the snapshot. */
export function buildRadar(snapshot: Snapshot, model: ModelConstants = MODEL): { board: BoardRow[]; radar: RadarData } {
  const board = buildBoard(snapshot, model);
  const live = liveRows(snapshot);
  const early = board.filter((r) => !snapshot.watchlist.includes(r.slug)).length;
  const watchlist = new Set(snapshot.watchlist);
  const radar: RadarData = {
    as_of: snapshot.as_of, // the snapshot's date
    source: snapshot.source, // where the snapshot came from
    floor_usd: snapshot.floor_usd, // the watchlist's floor
    model, // the constants the page recomputes with
    model_version: MODEL_VERSION, // the label the page shows
    watchlist_size: snapshot.watchlist.length, // how many slugs the watchlist holds
    board_size: board.length, // how many rows the board holds
    early_size: early, // how many rows came from below the floor
    live_size: live.length, // how many live-token protocols are set aside
    rows: board.map((r) => radarRow(r, watchlist)), // the ranked board, compact
    live, // the live-token protocols, by market cap
  };
  return { board, radar };
}

/** The snapshot out of a file's text, refused unless it is the shape the model scores. */
export function parseSnapshot(text: string): Snapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new SnapshotError('snapshot.json is not valid JSON');
  }
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new SnapshotError('snapshot.json is not a JSON object');
  const doc = raw as Record<string, unknown>;
  if (typeof doc.as_of !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(doc.as_of)) throw new SnapshotError('snapshot.json has no as_of date');
  if (typeof doc.source !== 'string') throw new SnapshotError('snapshot.json has no source string');
  if (typeof doc.floor_usd !== 'number' || !Number.isSafeInteger(doc.floor_usd) || doc.floor_usd <= 0) throw new SnapshotError('snapshot.json has no positive floor_usd');
  if (!Array.isArray(doc.protocols)) throw new SnapshotError('snapshot.json has no protocols array');
  if (!Array.isArray(doc.watchlist) || doc.watchlist.some((s) => typeof s !== 'string')) throw new SnapshotError('snapshot.json has no watchlist of slugs');
  const protocols = doc.protocols.map((v, i) => {
    if (typeof v !== 'object' || v === null || Array.isArray(v)) throw new SnapshotError('snapshot.json protocol ' + i + ' is not an object');
    const entry = v as Record<string, unknown>;
    if (typeof entry.slug !== 'string' || typeof entry.name !== 'string' || typeof entry.tvl_usd !== 'number' || !Number.isFinite(entry.tvl_usd)) {
      throw new SnapshotError('snapshot.json protocol ' + i + ' lacks a slug, a name or a TVL');
    }
    return {
      slug: entry.slug, // the protocol's key in the snapshot
      name: entry.name, // the display name
      category: typeof entry.category === 'string' ? entry.category : null, // null when DefiLlama names none
      chains: Array.isArray(entry.chains) ? entry.chains.filter((c): c is string => typeof c === 'string') : [], // the chains it runs on
      tvl_usd: entry.tvl_usd, // total value locked, whole dollars
      change_7d: typeof entry.change_7d === 'number' && Number.isFinite(entry.change_7d) ? entry.change_7d : null, // per cent, null when unreported
      mcap_usd: typeof entry.mcap_usd === 'number' && Number.isFinite(entry.mcap_usd) ? entry.mcap_usd : null, // null when it records no token
      listed_at: typeof entry.listed_at === 'string' ? entry.listed_at : null, // the UTC day tracking began, or null
      gecko_id: typeof entry.gecko_id === 'string' ? entry.gecko_id : null, // null when it records no token
      symbol: typeof entry.symbol === 'string' ? entry.symbol : null, // null when it records no token
    };
  });
  return {
    as_of: doc.as_of, // the snapshot's date
    source: doc.source, // where the snapshot came from
    floor_usd: doc.floor_usd, // the watchlist's floor
    protocols, // every protocol at or above $5M of TVL
    watchlist: doc.watchlist as string[], // the slugs the house's rule kept
  };
}

/** Why a board is not one the gate will take, or null: coverage, ranks, order, one shared implied value, and farm steps. */
export function boardIssue(board: BoardRow[], snapshot: Snapshot): string | null {
  const slugs = new Set(board.map((r) => r.slug));
  const missing = snapshot.watchlist.filter((s) => !slugs.has(s));
  if (missing.length > 0) return 'the board misses ' + missing.length + ' watchlist slug' + (missing.length === 1 ? '' : 's') + ': ' + missing.slice(0, 5).join(', ');
  const ranks = board.map((r) => r.rank).sort((a, b) => a - b);
  for (let i = 0; i < ranks.length; i++) if (ranks[i] !== i + 1) return 'rank ' + (i + 1) + ' is ' + ranks[i];
  for (let i = 1; i < board.length; i++) if (board[i]!.implied_value_usd > board[i - 1]!.implied_value_usd) return 'row ' + (i + 1) + ' outranks row ' + i + ' on implied value';
  if (board.length >= 2 && board[0]!.implied_value_usd === board[board.length - 1]!.implied_value_usd) {
    return 'all ' + board.length + ' rows share the same implied value $' + board[0]!.implied_value_usd + ': a board that ranks nothing by value is not a ranking';
  }
  for (const r of board) {
    const steps = r.farm_steps;
    if (steps.length < 3 || steps.length > 12) return r.slug + ' has ' + steps.length + ' farm steps';
    for (const s of steps) if (s.length < 20 || s.length > 600) return r.slug + ' has a farm step of ' + s.length + ' characters';
    if (!Number.isSafeInteger(r.implied_value_usd) || r.implied_value_usd <= 0) return r.slug + ' has implied value ' + r.implied_value_usd;
  }
  return null;
}

/** A compact data.js: the dashboard's whole dataset as one script, no fetch and no network. */
export function dataScript(radar: RadarData): string {
  return 'window.RADAR=' + JSON.stringify(radar) + ';\n';
}
