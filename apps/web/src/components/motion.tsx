'use client';

/**
 * Reusable motion primitives for the Mehfil "vibrant dark + glassmorphism" UI.
 * All components are client-side (framer-motion) and respect prefers-reduced-motion
 * via the global CSS media query.
 */

import { motion, useInView, AnimatePresence, type Variants } from 'framer-motion';
import { useRef, type ReactNode } from 'react';
import { cn } from '@/lib/cn';

/* ------------------------------ Easing tokens ----------------------------- */

export const springSoft = { type: 'spring', stiffness: 260, damping: 26 } as const;
export const springBouncy = { type: 'spring', stiffness: 400, damping: 17 } as const;
export const easeOut = [0.22, 1, 0.36, 1] as const;

/* ------------------------------ AuroraBackground ------------------------- */

/**
 * Animated aurora: three drifting, blurred color orbs. Purely decorative and
 * non-interactive; sits behind hero sections and auth screens.
 */
export function AuroraBackground({
  className,
  intensity = 1,
}: {
  className?: string;
  intensity?: number;
}) {
  const orbs = [
    { color: 'rgba(16,185,129,0.55)', size: '38rem', top: '-8%', left: '6%', dur: 20, delay: 0 },
    { color: 'rgba(168,85,247,0.5)', size: '34rem', top: '4%', right: '2%', dur: 24, delay: 2 },
    { color: 'rgba(245,158,11,0.4)', size: '30rem', bottom: '-12%', left: '38%', dur: 28, delay: 4 },
  ];
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}
      style={{ opacity: intensity }}
    >
      {orbs.map((o, i) => (
        <motion.span
          key={i}
          className="aurora-orb"
          style={{
            background: o.color,
            width: o.size,
            height: o.size,
            top: o.top,
            left: o.left,
            right: o.right,
            bottom: o.bottom,
          }}
          animate={{
            x: [0, 40, -30, 0],
            y: [0, -34, 26, 0],
            scale: [1, 1.15, 0.92, 1],
          }}
          transition={{ duration: o.dur, delay: o.delay, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </div>
  );
}

/* ---------------------------------- Reveal -------------------------------- */

/** Fade + rise into view when the element scrolls into the viewport. */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 18,
  once = true,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  once?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, margin: '-40px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      initial={{ opacity: 0, y }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y }}
      transition={{ duration: 0.55, delay, ease: easeOut }}
    >
      {children}
    </motion.div>
  );
}

/* --------------------------------- Stagger -------------------------------- */

const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07, delayChildren: 0.05 } },
};

const staggerChild: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.5, ease: easeOut } },
};

/** Container that staggers its <StaggerItem> children into view. */
export function Stagger({
  children,
  className,
  once = true,
}: {
  children: ReactNode;
  className?: string;
  once?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once, margin: '-40px' });
  return (
    <motion.div
      ref={ref}
      className={className}
      variants={staggerParent}
      initial="hidden"
      animate={inView ? 'show' : 'hidden'}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} variants={staggerChild}>
      {children}
    </motion.div>
  );
}

/* ------------------------------- AnimatedPage ----------------------------- */

/** Route-level enter transition (fade + subtle rise). Wrap page content. */
export function AnimatedPage({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.4, ease: easeOut }}
    >
      {children}
    </motion.div>
  );
}

export { AnimatePresence };

/* ------------------------------- GradientText ----------------------------- */

/** Headline with an animated multi-stop gradient sweep. */
export function GradientText({
  children,
  className,
  as: As = 'span',
}: {
  children: ReactNode;
  className?: string;
  as?: 'span' | 'h1' | 'h2' | 'h3' | 'p';
}) {
  return <As className={cn('gradient-text-animated', className)}>{children}</As>;
}

/* --------------------------------- GlowCard -------------------------------- */

/**
 * Glass card that tilts slightly and brightens its glow on hover. Uses CSS 3D
 * transforms driven by framer-motion springs.
 */
export function TiltCard({
  children,
  className,
  glow = 'rgba(16,185,129,0.35)',
}: {
  children: ReactNode;
  className?: string;
  glow?: string;
}) {
  return (
    <motion.div
      className={cn('glass relative rounded-3xl', className)}
      whileHover={{ y: -4, rotateX: 2, rotateY: -2, scale: 1.01 }}
      transition={springSoft}
      style={{ transformStyle: 'preserve-3d' }}
    >
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-3xl opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={{ boxShadow: `0 0 40px -6px ${glow}` }}
      />
      {children}
    </motion.div>
  );
}

/* --------------------------------- FloatOrb -------------------------------- */

/** Small floating decorative orb. */
export function FloatOrb({
  className,
  color = 'rgba(16,185,129,0.5)',
  size = 90,
  delay = 0,
}: {
  className?: string;
  color?: string;
  size?: number;
  delay?: number;
}) {
  return (
    <motion.span
      aria-hidden
      className={cn('pointer-events-none absolute rounded-full blur-2xl', className)}
      style={{ background: color, width: size, height: size }}
      animate={{ y: [0, -18, 0], opacity: [0.5, 0.9, 0.5] }}
      transition={{ duration: 7, delay, repeat: Infinity, ease: 'easeInOut' }}
    />
  );
}
