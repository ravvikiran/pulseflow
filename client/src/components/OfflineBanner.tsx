import { motion, AnimatePresence } from "framer-motion";
import { WifiOff } from "lucide-react";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

export function OfflineBanner() {
  const isOnline = useOnlineStatus();

  return (
    <AnimatePresence>
      {!isOnline && (
        <motion.div
          className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center gap-2 py-2 bg-destructive text-destructive-foreground text-xs font-medium"
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
        >
          <WifiOff className="w-3.5 h-3.5" />
          You're offline. Some features may be unavailable.
        </motion.div>
      )}
    </AnimatePresence>
  );
}
