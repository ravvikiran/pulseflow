import { trpc } from "@/lib/trpc";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TRPCClientError, httpBatchLink } from "@trpc/client";
import { createRoot } from "react-dom/client";
import superjson from "superjson";
import App from "./App";
import "./index.css";

/** Don't retry client errors (bad input, not found, rate limited); they won't succeed. */
function shouldRetry(failureCount: number, error: unknown): boolean {
  if (error instanceof TRPCClientError) {
    const status = error.data?.httpStatus as number | undefined;
    if (status && status >= 400 && status < 500) return false;
  }
  return failureCount < 2;
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Server caches Yahoo quotes for 60s; refetching more often than that is wasted work.
      staleTime: 30_000,
      retry: shouldRetry,
    },
    mutations: {
      retry: false,
    },
  },
});

const trpcClient = trpc.createClient({
  links: [
    httpBatchLink({
      url: "/api/trpc",
      transformer: superjson,
      fetch(input, init) {
        return globalThis.fetch(input, {
          ...(init ?? {}),
          credentials: "include",
        });
      },
    }),
  ],
});

createRoot(document.getElementById("root")!).render(
  <trpc.Provider client={trpcClient} queryClient={queryClient}>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </trpc.Provider>
);

// Register the service worker in production builds only. In dev it would
// cache Vite's unbundled modules and interfere with HMR.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
} else if (import.meta.env.DEV && "serviceWorker" in navigator) {
  // Clean up any worker left over from an earlier production run on this origin.
  navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
}
