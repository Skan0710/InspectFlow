"use client";

import React from "react";
import { motion, useReducedMotion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

export type AnimatedButtonProps = Omit<HTMLMotionProps<"button">, "children"> & {
  children?: React.ReactNode;
};

const MASK =
  "linear-gradient(-75deg, white calc(var(--mask-x) + 20%), rgba(255,255,255,0.55) calc(var(--mask-x) + 30%), white calc(var(--mask-x) + 100%))";

/**
 * AnimatedButton, adapted from VengeanceUI (animated-button).
 * Spring press feedback plus a periodic shine sweep over the label and border.
 * The sweep is disabled when the user prefers reduced motion.
 */
export const AnimatedButton = React.forwardRef<HTMLButtonElement, AnimatedButtonProps>(
  ({ children, className, disabled, ...rest }, ref) => {
    const reduce = useReducedMotion();
    const animated = !reduce && !disabled;

    return (
      <motion.button
        ref={ref}
        disabled={disabled}
        whileHover={animated ? { scale: 1.02 } : undefined}
        whileTap={animated ? { scale: 0.97 } : undefined}
        transition={{ type: "spring", stiffness: 500, damping: 30, mass: 0.5 }}
        className={cn(
          "group relative inline-flex cursor-pointer select-none items-center justify-center overflow-hidden",
          "font-medium text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "[--shine:rgba(255,255,255,.7)]",
          className,
        )}
        {...rest}
      >
        <motion.span
          className="relative z-10 flex h-full w-full items-center justify-center gap-[inherit]"
          style={animated ? { WebkitMaskImage: MASK, maskImage: MASK } : undefined}
          initial={animated ? ({ "--mask-x": "100%" } as never) : undefined}
          animate={animated ? ({ "--mask-x": "-100%" } as never) : undefined}
          transition={{ repeat: Infinity, duration: 1, ease: "linear", repeatDelay: 2 }}
        >
          {children}
        </motion.span>

        {animated && (
          <motion.span
            aria-hidden
            className="pointer-events-none absolute inset-0 block rounded-[inherit] p-px"
            style={{
              background: "linear-gradient(-75deg, transparent 30%, var(--shine) 50%, transparent 70%)",
              backgroundSize: "200% 100%",
              mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              maskComposite: "exclude",
              WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
              WebkitMaskComposite: "xor",
            }}
            initial={{ backgroundPosition: "100% 0", opacity: 0 }}
            animate={{ backgroundPosition: ["100% 0", "0% 0"], opacity: [0, 1, 0] }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear", repeatDelay: 2 }}
          />
        )}
      </motion.button>
    );
  },
);

AnimatedButton.displayName = "AnimatedButton";

export default AnimatedButton;
