import { lazy, Suspense, useState, useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import { AnimatePresence } from "framer-motion";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import PulseFlowLayout from "./components/PulseFlowLayout";
import { PageTransition } from "./components/PageTransition";
import { SplashScreen } from "./components/SplashScreen";
import { KeyboardShortcuts } from "./components/KeyboardShortcuts";
import { OfflineBanner } from "./components/OfflineBanner";

// Deferred, non-critical chrome — kept off the initial render path.
// CommandPalette only appears on Ctrl/Cmd+K; the achievement overlay is
// idle until an achievement fires. Loading them lazily trims the main bundle.
const CommandPalette = lazy(() => import("./components/CommandPalette").then(m => ({ default: m.CommandPalette })));
const AchievementOverlay = lazy(() => import("./components/Confetti").then(m => ({ default: m.AchievementOverlay })));

// ─── Lazy-loaded Pages ────────────────────────────────────────────────────────
const HomeDashboard = lazy(() => import("./pages/HomeDashboard"));

// India Market Module
const IndiaDashboard = lazy(() => import("./pages/india/IndiaDashboard"));
const IndiaSectors = lazy(() => import("./pages/india/IndiaSectors"));
const IndiaScanner = lazy(() => import("./pages/india/IndiaScanner"));

// Crypto Market Module
const CryptoDashboard = lazy(() => import("./pages/crypto/CryptoDashboard"));
const CryptoScanner = lazy(() => import("./pages/crypto/CryptoScanner"));

// US Market Module
const USDashboard = lazy(() => import("./pages/us/USDashboard"));

// Shared / Cross-market pages
const Assets = lazy(() => import("./pages/Assets"));
const Watchlists = lazy(() => import("./pages/Watchlists"));
const Alerts = lazy(() => import("./pages/Alerts"));
const Historical = lazy(() => import("./pages/Historical"));
const Journal = lazy(() => import("./pages/Journal"));
const Commodities = lazy(() => import("./pages/Commodities"));
const Profile = lazy(() => import("./pages/Profile"));
const Settings = lazy(() => import("@/pages/settings/Settings"));
const Notifications = lazy(() => import("@/pages/Notifications"));
const PatternScanner = lazy(() => import("@/pages/PatternScanner"));

// Legacy redirects
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SectorRotation = lazy(() => import("./pages/SectorRotation"));
const Scanner = lazy(() => import("./pages/Scanner"));

// ─── Page Loading Skeleton ────────────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="p-4 md:p-6 space-y-5 animate-pulse">
      {/* Header row: title/subtitle + action — matches every page's top bar */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <div className="h-6 w-56 bg-surface-2 rounded-md" />
          <div className="h-3.5 w-80 bg-surface-2 rounded-md" />
        </div>
        <div className="h-8 w-24 bg-surface-2 rounded-md shrink-0" />
      </div>
      {/* Compact stat/index strip — mirrors dashboards' above-the-fold row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[0, 1, 2, 3].map(i => (
          <div key={i} className="h-14 bg-surface-2 rounded-lg" />
        ))}
      </div>
      {/* Primary content */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-48 bg-surface-2 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {[0, 1].map(i => (
          <div key={i} className="h-64 bg-surface-2 rounded-lg" />
        ))}
      </div>
    </div>
  );
}

// ─── Router with Transitions ──────────────────────────────────────────────────
function Router() {
  const [location] = useLocation();

  return (
    <PulseFlowLayout>
      <AnimatePresence mode="wait">
        <PageTransition key={location}>
          <Suspense fallback={<PageSkeleton />}>
            <Switch>
              {/* Home */}
              <Route path="/" component={HomeDashboard} />

              {/* India Market Module */}
              <Route path="/india" component={IndiaDashboard} />
              <Route path="/india/sectors" component={IndiaSectors} />
              <Route path="/india/scanner" component={IndiaScanner} />

              {/* Crypto Market Module */}
              <Route path="/crypto" component={CryptoDashboard} />
              <Route path="/crypto/scanner" component={CryptoScanner} />

              {/* US Market Module */}
              <Route path="/us" component={USDashboard} />

              {/* Shared / Cross-market */}
              <Route path="/assets" component={Assets} />
              <Route path="/assets/:symbol" component={Assets} />
              <Route path="/watchlists" component={Watchlists} />
              <Route path="/alerts" component={Alerts} />
              <Route path="/historical" component={Historical} />
              <Route path="/journal" component={Journal} />
              <Route path="/commodities" component={Commodities} />
              <Route path="/profile" component={Profile} />
              <Route path="/settings" component={Settings} />
              <Route path="/settings/:section" component={Settings} />
              <Route path="/notifications" component={Notifications} />
              <Route path="/patterns" component={PatternScanner} />

              {/* Legacy redirects */}
              <Route path="/dashboard" component={Dashboard} />
              <Route path="/sectors" component={SectorRotation} />
              <Route path="/scanner" component={Scanner} />

              {/* 404 */}
              <Route path="/404" component={NotFound} />
              <Route component={NotFound} />
            </Switch>
          </Suspense>
        </PageTransition>
      </AnimatePresence>
    </PulseFlowLayout>
  );
}

// ─── App with Splash Screen ──────────────────────────────────────────────────
function App() {
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <SplashScreen isVisible={showSplash} />
          {!showSplash && (
            <>
              <Toaster />
              <OfflineBanner />
              <Suspense fallback={null}>
                <AchievementOverlay />
                <CommandPalette />
              </Suspense>
              <KeyboardShortcuts />
              <Router />
            </>
          )}
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
