import { Button } from "@/components/ui/button";
import { Home, ArrowLeft, Activity } from "lucide-react";
import { useLocation } from "wouter";
import { motion } from "framer-motion";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-[80vh] w-full flex items-center justify-center p-4">
      <motion.div
        className="text-center max-w-md"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        {/* Animated 404 */}
        <motion.div
          className="relative mb-8"
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ duration: 0.5, type: "spring" }}
        >
          <div className="text-[120px] font-bold leading-none text-transparent bg-clip-text bg-gradient-to-b from-primary/40 to-primary/5 select-none">
            404
          </div>
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="w-14 h-14 rounded-xl bg-gradient-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <Activity className="w-7 h-7 text-white" />
            </div>
          </motion.div>
        </motion.div>

        <h1 className="text-xl font-bold text-foreground mb-2">Page Not Found</h1>
        <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
          This market data point doesn't exist. It may have been moved or is no longer available.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => window.history.back()}
            variant="outline"
            className="gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </Button>
          <Button
            onClick={() => setLocation("/")}
            className="gap-2"
          >
            <Home className="w-4 h-4" />
            Home Dashboard
          </Button>
        </div>

        {/* Keyboard shortcut hint */}
        <p className="text-[10px] text-muted-foreground mt-6">
          Tip: Press <kbd className="px-1.5 py-0.5 bg-surface-2 rounded text-foreground font-mono">Ctrl+K</kbd> to quickly navigate anywhere
        </p>
      </motion.div>
    </div>
  );
}
