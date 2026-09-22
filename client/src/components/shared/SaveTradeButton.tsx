import { useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogAction, AlertDialogCancel,
} from "@/components/ui/alert-dialog";

type Market = "india" | "crypto" | "us" | "commodities";

/**
 * Shared "Save Trade" button used by every scanner.
 * Enforces one OPEN trade per symbol: if the server reports a duplicate,
 * it shows a blocking dialog with "Go to Journal" and "Cancel" instead of
 * silently creating a second position.
 */
export function SaveTradeButton({ result, defaultMarket = "india", defaultExchange = "NSE" }: {
  result: any;
  defaultMarket?: Market;
  defaultExchange?: string;
}) {
  const [, setLocation] = useLocation();
  const [dupOpen, setDupOpen] = useState(false);
  const utils = trpc.useUtils();

  const saveMutation = trpc.journal.save.useMutation({
    onSuccess: (res) => {
      if (res.success) {
        utils.journal.all.invalidate();
        utils.journal.stats.invalidate();
        utils.journal.reliability.invalidate();
        toast.success(`${result.symbol} saved to journal`);
      } else if (res.duplicate) {
        // An open trade for this symbol already exists — block and prompt.
        setDupOpen(true);
      }
    },
    onError: () => toast.error("Failed to save trade"),
  });

  const market = (result.marketDomain ?? defaultMarket) as Market;

  const handleSave = () => saveMutation.mutate({
    symbol: result.symbol,
    name: result.name,
    sector: result.sector ?? "",
    exchange: result.exchange ?? defaultExchange,
    market,
    scanType: result.scanType ?? "ema_alignment",
    entryPrice: result.price,
    entryDate: new Date().toISOString(),
    stopLoss: result.stopLoss ?? result.price * 0.95,
    target: result.target ?? result.price * 1.10,
    riskReward: result.riskReward ?? "1:2",
    qualityScore: result.qualityScore ?? 50,
    confidence: result.confidence ?? "medium",
    signals: result.signals ?? [],
  });

  return (
    <>
      <button
        onClick={handleSave}
        disabled={saveMutation.isPending}
        className="text-3xs px-2 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 font-medium transition-colors focus-ring disabled:opacity-50"
      >
        {saveMutation.isPending ? "Saving..." : "📌 Save Trade"}
      </button>

      <AlertDialog open={dupOpen} onOpenChange={setDupOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Trade already taken
            </AlertDialogTitle>
            <AlertDialogDescription>
              You already have an <span className="font-semibold text-foreground">open</span> trade
              for <span className="font-semibold text-foreground">{result.symbol}</span>.
              Close it first, or review it in the journal before adding another position.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => setLocation("/journal")}>
              Go to trade in Journal
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
