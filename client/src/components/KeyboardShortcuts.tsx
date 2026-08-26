import { useEffect } from "react";
import { useLocation } from "wouter";

/**
 * Global keyboard shortcuts handler
 * Provides power-user navigation and actions
 */
export function KeyboardShortcuts() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) {
        return;
      }

      // Navigation shortcuts (with 'g' prefix like GitHub)
      if (e.key === "g" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Wait for next key
        const handleSecondKey = (e2: KeyboardEvent) => {
          document.removeEventListener("keydown", handleSecondKey);
          switch (e2.key) {
            case "h": setLocation("/"); break;
            case "i": setLocation("/india"); break;
            case "c": setLocation("/crypto"); break;
            case "u": setLocation("/us"); break;
            case "w": setLocation("/watchlists"); break;
            case "a": setLocation("/alerts"); break;
            case "s": setLocation("/settings"); break;
            case "j": setLocation("/journal"); break;
            case "p": setLocation("/patterns"); break;
          }
        };
        document.addEventListener("keydown", handleSecondKey, { once: true });
        // Auto-remove after 1.5s if no second key pressed
        setTimeout(() => document.removeEventListener("keydown", handleSecondKey), 1500);
        return;
      }

      // Quick actions
      if (e.key === "?" && !e.metaKey && !e.ctrlKey) {
        // Could show help dialog in future
      }

      // Escape to go home
      if (e.key === "Escape" && !e.metaKey && !e.ctrlKey) {
        // Close any open modals/drawers (handled by individual components)
      }

      // Refresh data with 'r'
      if (e.key === "r" && !e.metaKey && !e.ctrlKey && !e.altKey) {
        // Trigger refetch (broadcast event)
        window.dispatchEvent(new CustomEvent("pulseflow:refresh"));
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [setLocation]);

  return null;
}
