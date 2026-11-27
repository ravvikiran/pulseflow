import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the Yahoo client so this test is deterministic and never touches the network.
const quote = vi.fn();
vi.mock("yahoo-finance2", () => ({
  default: class {
    quote = quote;
    chart = vi.fn();
  },
}));

const row = (ticker: string, price: number) => ({
  symbol: ticker,
  regularMarketPrice: price,
  regularMarketChange: 1,
  regularMarketChangePercent: 1,
  regularMarketVolume: 1000,
});

const respondWith = (price: number) =>
  quote.mockImplementation(async (tickers: string | string[]) =>
    (Array.isArray(tickers) ? tickers : [tickers]).map(t => row(t, price))
  );

describe("quote cache (stale-while-revalidate)", () => {
  const t0 = new Date("2026-01-05T10:00:00Z").getTime();

  beforeEach(() => {
    vi.resetModules();
    quote.mockReset();
    // Fake only the clock; real timers still drive the request pacing inside the client.
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(t0);
  });
  afterEach(() => vi.useRealTimers());

  it("serves a fresh entry from cache without calling Yahoo again", async () => {
    respondWith(100);
    const { getQuotes } = await import("./yahooFinance");
    expect((await getQuotes(["TCS"])).get("TCS")?.price).toBe(100);
    vi.setSystemTime(t0 + 30_000);
    expect((await getQuotes(["TCS"])).get("TCS")?.price).toBe(100);
    expect(quote).toHaveBeenCalledTimes(1);
  });

  it("returns a slightly stale entry immediately and refreshes it in the background", async () => {
    respondWith(100);
    const { getQuotes } = await import("./yahooFinance");
    await getQuotes(["TCS"]);

    respondWith(200);
    vi.setSystemTime(t0 + 2 * 60_000); // past the 60s fresh window, inside the 15 min stale window
    const during = await getQuotes(["TCS"]);
    expect(during.get("TCS")?.price).toBe(100); // instant, old value

    await vi.waitFor(() => expect(quote).toHaveBeenCalledTimes(2)); // background refresh ran
    await vi.waitFor(async () => expect((await getQuotes(["TCS"])).get("TCS")?.price).toBe(200));
  });

  it("does not start a second background refresh while one is already running", async () => {
    respondWith(100);
    const { getQuotes } = await import("./yahooFinance");
    await getQuotes(["TCS"]);

    let release: () => void = () => {};
    quote.mockImplementation(
      () => new Promise(resolve => { release = () => resolve([row("TCS.NS", 150)]); })
    );
    vi.setSystemTime(t0 + 2 * 60_000);
    await getQuotes(["TCS"]);
    await getQuotes(["TCS"]);
    await getQuotes(["TCS"]);
    await vi.waitFor(() => expect(quote).toHaveBeenCalledTimes(2));
    expect(quote).toHaveBeenCalledTimes(2); // 1 initial + exactly 1 refresh
    release();
  });

  it("waits for a live fetch once an entry is older than the stale window", async () => {
    respondWith(100);
    const { getQuotes } = await import("./yahooFinance");
    await getQuotes(["TCS"]);

    respondWith(300);
    vi.setSystemTime(t0 + 20 * 60_000);
    expect((await getQuotes(["TCS"])).get("TCS")?.price).toBe(300);
  });

  it("omits symbols Yahoo has no data for instead of inventing a value", async () => {
    quote.mockImplementation(async () => []);
    const { getQuotes } = await import("./yahooFinance");
    expect((await getQuotes(["TCS"])).has("TCS")).toBe(false);
  });
});
