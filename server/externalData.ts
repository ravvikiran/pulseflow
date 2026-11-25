/**
 * Free, key-less public data sources used alongside Yahoo Finance.
 *
 *  - Alternative.me  : crypto Fear & Greed index (current + history)
 *  - CoinGecko       : global crypto market stats, exchange volumes
 *  - NSE India       : FII / DII daily cash-market activity
 *
 * Every function returns null (or an empty array) when the source is
 * unreachable. Callers must hide the widget instead of inventing numbers.
 */

const TTL = {
  fearGreed: 10 * 60 * 1000,
  global: 5 * 60 * 1000,
  exchanges: 10 * 60 * 1000,
  fiiDii: 30 * 60 * 1000,
};

interface CacheEntry<T> {
  value: T;
  at: number;
}
const cache = new Map<string, CacheEntry<unknown>>();
const inflight = new Map<string, Promise<unknown>>();

/** Cached fetch with in-flight de-duplication. Failures are cached briefly to avoid hammering. */
async function cached<T>(key: string, ttl: number, load: () => Promise<T>, fallback: T): Promise<T> {
  const hit = cache.get(key) as CacheEntry<T> | undefined;
  if (hit && Date.now() - hit.at < ttl) return hit.value;

  const pending = inflight.get(key) as Promise<T> | undefined;
  if (pending) return pending;

  const request = load()
    .then(value => {
      cache.set(key, { value, at: Date.now() });
      return value;
    })
    .catch(error => {
      warnOnce(key, `[external] ${key} unavailable: ${(error as Error).message}`);
      // Serve stale data if we have it, otherwise cache the failure for 1 minute.
      if (hit) return hit.value;
      cache.set(key, { value: fallback, at: Date.now() - ttl + 60_000 });
      return fallback;
    })
    .finally(() => inflight.delete(key));
  inflight.set(key, request);
  return request;
}

const warned = new Map<string, number>();
function warnOnce(key: string, message: string) {
  if (Date.now() - (warned.get(key) ?? 0) < 10 * 60 * 1000) return;
  warned.set(key, Date.now());
  console.warn(message);
}

async function getJson<T>(url: string, headers: Record<string, string> = {}, timeoutMs = 10_000): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json", "User-Agent": "PulseFlow/1.0 (+local market dashboard)", ...headers },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} from ${new URL(url).host}`);
  return (await res.json()) as T;
}

export function fearGreedLabel(value: number): string {
  if (value < 25) return "Extreme Fear";
  if (value < 45) return "Fear";
  if (value < 55) return "Neutral";
  if (value < 75) return "Greed";
  return "Extreme Greed";
}

// ─── Crypto Fear & Greed (Alternative.me) ─────────────────────────────────────

export interface FearGreedPoint {
  timestamp: Date;
  value: number;
  label: string;
}

/** Newest-last list of daily Fear & Greed readings. */
export async function getFearGreedHistory(days: number): Promise<FearGreedPoint[]> {
  const limit = Math.min(Math.max(days + 1, 2), 400);
  return cached(
    `fng:${limit}`,
    TTL.fearGreed,
    async () => {
      const json = await getJson<{ data?: Array<{ value: string; timestamp: string }> }>(
        `https://api.alternative.me/fng/?limit=${limit}&format=json`
      );
      const rows = json.data ?? [];
      return rows
        .map(r => ({
          timestamp: new Date(Number(r.timestamp) * 1000),
          value: Number(r.value),
          label: fearGreedLabel(Number(r.value)),
        }))
        .filter(p => Number.isFinite(p.value))
        .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    },
    [] as FearGreedPoint[]
  );
}

export async function getFearGreedNow(): Promise<FearGreedPoint | null> {
  const history = await getFearGreedHistory(1);
  return history.length ? history[history.length - 1] : null;
}

// ─── Global crypto market (CoinGecko) ─────────────────────────────────────────

export interface CryptoGlobal {
  btcDominance: number;
  ethDominance: number;
  altDominance: number;
  totalMarketCapUsd: number;
  totalVolume24hUsd: number;
  marketCapChange24hPct: number;
}

export async function getCryptoGlobal(): Promise<CryptoGlobal | null> {
  return cached<CryptoGlobal | null>(
    "coingecko-global",
    TTL.global,
    async () => {
      const json = await getJson<{
        data?: {
          market_cap_percentage?: Record<string, number>;
          total_market_cap?: Record<string, number>;
          total_volume?: Record<string, number>;
          market_cap_change_percentage_24h_usd?: number;
        };
      }>("https://api.coingecko.com/api/v3/global");
      const d = json.data;
      const btc = d?.market_cap_percentage?.btc;
      const eth = d?.market_cap_percentage?.eth;
      const cap = d?.total_market_cap?.usd;
      const vol = d?.total_volume?.usd;
      if (btc == null || eth == null || cap == null || vol == null) throw new Error("unexpected response shape");
      return {
        btcDominance: round2(btc),
        ethDominance: round2(eth),
        altDominance: round2(100 - btc - eth),
        totalMarketCapUsd: cap,
        totalVolume24hUsd: vol,
        marketCapChange24hPct: round2(d?.market_cap_change_percentage_24h_usd ?? 0),
      };
    },
    null
  );
}

export interface ExchangeVolume {
  exchange: string;
  volume24hBtc: number;
  trustScore: number | null;
}

/** Top spot exchanges by 24h volume (in BTC). Caller converts to USD with a live BTC price. */
export async function getTopExchanges(limit = 6): Promise<ExchangeVolume[]> {
  return cached<ExchangeVolume[]>(
    `coingecko-exchanges:${limit}`,
    TTL.exchanges,
    async () => {
      const rows = await getJson<Array<{ name: string; trade_volume_24h_btc: number; trust_score: number | null }>>(
        `https://api.coingecko.com/api/v3/exchanges?per_page=${limit}&page=1`
      );
      return rows
        .filter(r => r.name && Number.isFinite(r.trade_volume_24h_btc))
        .map(r => ({ exchange: r.name, volume24hBtc: r.trade_volume_24h_btc, trustScore: r.trust_score ?? null }))
        .sort((a, b) => b.volume24hBtc - a.volume24hBtc);
    },
    []
  );
}

// ─── NSE FII / DII activity ───────────────────────────────────────────────────

export interface InstitutionalFlow {
  grossBuy: number;
  grossSell: number;
  netBuy: number;
}

export interface FiiDiiActivity {
  date: string;
  fii: InstitutionalFlow;
  dii: InstitutionalFlow;
  /** Values are in INR crore, as published by NSE. */
  unit: "INR crore";
}

const NSE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

export async function getFiiDiiActivity(): Promise<FiiDiiActivity | null> {
  return cached<FiiDiiActivity | null>(
    "nse-fii-dii",
    TTL.fiiDii,
    async () => {
      type Row = { category: string; date: string; buyValue: string; sellValue: string; netValue: string };
      const url = "https://www.nseindia.com/api/fiidiiTradeReact";
      const referer = "https://www.nseindia.com/reports/fii-dii";

      let rows: Row[];
      try {
        rows = await getJson<Row[]>(url, { ...NSE_HEADERS, Referer: referer }, 12_000);
      } catch {
        // Some networks need the session cookie NSE sets on its home page.
        const home = await fetch("https://www.nseindia.com", {
          headers: { ...NSE_HEADERS, Accept: "text/html" },
          signal: AbortSignal.timeout(12_000),
        });
        const cookie = (home.headers.getSetCookie?.() ?? []).map(c => c.split(";")[0]).join("; ");
        await home.body?.cancel().catch(() => undefined);
        rows = await getJson<Row[]>(url, { ...NSE_HEADERS, Cookie: cookie, Referer: referer }, 12_000);
      }

      const toFlow = (r: { buyValue: string; sellValue: string; netValue: string }): InstitutionalFlow => ({
        grossBuy: Number(r.buyValue),
        grossSell: Number(r.sellValue),
        netBuy: Number(r.netValue),
      });
      const fii = rows.find(r => /fii|fpi/i.test(r.category));
      const dii = rows.find(r => /dii/i.test(r.category) && !/fii|fpi/i.test(r.category));
      if (!fii || !dii) throw new Error("unexpected response shape");

      const result: FiiDiiActivity = { date: fii.date, fii: toFlow(fii), dii: toFlow(dii), unit: "INR crore" };
      const values = [...Object.values(result.fii), ...Object.values(result.dii)];
      if (values.some(v => !Number.isFinite(v))) throw new Error("non-numeric values");
      return result;
    },
    null
  );
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
