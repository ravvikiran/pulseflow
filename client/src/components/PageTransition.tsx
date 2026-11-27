import { motion } from "framer-motion";
import type { ReactNode } from "react";

// Short and cheap: a quick fade with a small rise on enter, a faster fade on exit.
// (Previously 300ms in + 300ms out with a blur filter, about 0.6s before each page showed.)
const pageVariants = {
  initial: { opacity: 0, y: 6 },
  animate: { opacity: 1, y: 0, transition: { type: "tween" as const, ease: [0.2, 0, 0, 1] as [number, number, number, number], duration: 0.18 } },
  exit: { opacity: 0, transition: { type: "tween" as const, ease: "easeIn" as const, duration: 0.08 } },
};
export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <motion.div
      initial="initial"
      animate="animate"
      exit="exit"
      variants={pageVariants}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}
