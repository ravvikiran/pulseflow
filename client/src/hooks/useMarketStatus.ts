import { trpc } from "@/lib/trpc";

export type MarketKey = "india" | "us" | "crypto";
export type SessionState = "open" | "pre" | "post" | "closed";

export const MARKET_LABEL: Record<MarketKey, string> = { india: "NSE", us: "US", crypto: "Crypto" };

export const SESSION_TEXT: Record<SessionState, string> = {
  open: "Open",
  pre: "Pre-market",
  post: "After hours",
  closed: "Closed",
};

/**
 * Real open/closed state of each market, from the server (Yahoo exchange data,
 * so exchange holidays are respected). `status` is null while loading or if the
 * data source is unreachable; callers must show "unavailable", never a guess.
 */
export function useMarketStatus() {
  const query = trpc.global.marketStatus.useQuery(undefined, {
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 1,
  });
  return { status: query.data ?? null, isLoading: query.isLoading, isError: query.isError };
}
