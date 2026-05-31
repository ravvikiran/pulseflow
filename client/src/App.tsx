import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import PulseFlowLayout from "./components/PulseFlowLayout";

// ─── Pages ────────────────────────────────────────────────────────────────────
import HomeDashboard from "./pages/HomeDashboard";

// India Market Module
import IndiaDashboard from "./pages/india/IndiaDashboard";
import IndiaSectors from "./pages/india/IndiaSectors";
import IndiaScanner from "./pages/india/IndiaScanner";

// Crypto Market Module
import CryptoDashboard from "./pages/crypto/CryptoDashboard";
import CryptoScanner from "./pages/crypto/CryptoScanner";

// US Market Module
import USDashboard from "./pages/us/USDashboard";

// Shared / Cross-market pages
import Assets from "./pages/Assets";
import Watchlists from "./pages/Watchlists";
import Alerts from "./pages/Alerts";
import Historical from "./pages/Historical";
import Profile from "./pages/Profile";
import Settings from "@/pages/settings/Settings";
import Notifications from "@/pages/Notifications";
import PatternScanner from "@/pages/PatternScanner";
// Legacy redirects (these redirect to new module pages)
import Dashboard from "./pages/Dashboard";
import SectorRotation from "./pages/SectorRotation";
import Scanner from "./pages/Scanner";

function Router() {
  return (
    <PulseFlowLayout>
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
    </PulseFlowLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="dark">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
