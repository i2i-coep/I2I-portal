'use client'

import { useRef } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { ArrowUpRight, Sparkles } from 'lucide-react'
import { AnimatedText } from '@/components/motion-primitives'
import { MagneticButton } from '@/components/magnetic-button'
import { GradientOrbs, Particles } from '@/components/background-fx'
import { Scene3DBackground } from '@/components/scene-3d'

const easeOut = [0.16, 1, 0.3, 1] as const

export function Hero() {
  const sectionRef = useRef<HTMLElement>(null)
  const shouldReduceMotion = useReducedMotion()
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  })
  // The crystal drifts down slower than the page scrolls past it (depth
  // parallax) and fades out toward the end of the section, instead of
  // just scrolling off at the same rate as the text beside it.
  const crystalY = useTransform(scrollYProgress, [0, 1], shouldReduceMotion ? [0, 0] : [0, 140])
  const crystalOpacity = useTransform(
    scrollYProgress,
    [0, 0.8, 1],
    shouldReduceMotion ? [0.7, 0.7, 0.7] : [0.7, 0.7, 0]
  )

  return (
    <section
      ref={sectionRef}
      id="top"
      className="relative flex min-h-screen items-center overflow-hidden bg-[#050506] pt-28 pb-16"
    >
      <div className="absolute inset-0 grid-texture radial-fade opacity-60" aria-hidden="true" />
      <motion.div style={{ y: crystalY, opacity: crystalOpacity }} className="absolute inset-0">
        <Scene3DBackground variant="network" />
      </motion.div>
      <GradientOrbs />
      <Particles />

      <div className="relative mx-auto grid w-full max-w-7xl grid-cols-1 items-center gap-12 px-5 sm:px-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="flex flex-col items-start gap-7">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: easeOut }}
            className="glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-xs text-muted-foreground"
          >
            <Sparkles className="size-3.5 text-primary" />
            <span className="font-mono uppercase tracking-[0.14em]">
              Bhau Institute · COEP Technological University
            </span>
          </motion.div>

          <h1 className="text-balance font-display text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl md:text-6xl lg:text-[4.1rem]">
            <AnimatedText text="Ignited Innovators" />
            <br />
            <span className="text-gradient-amber">
              <AnimatedText text="of India" delay={0.3} />
            </span>
          </h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.55, ease: easeOut }}
            className="max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg"
          >
            The flagship innovation and entrepreneurship initiative turning bold student
            ideas into deep-tech startups. Mentorship, capital, and a founder ecosystem
            engineered for the next generation of builders.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.7, ease: easeOut }}
            className="flex flex-wrap items-center gap-3"
          >
            <MagneticButton href="/register">
              Register Now
              <ArrowUpRight className="size-4" />
            </MagneticButton>
            <MagneticButton href="#portals" variant="ghost">
              Explore Portals
            </MagneticButton>
          </motion.div>

          <motion.dl
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.9 }}
            className="mt-4 grid grid-cols-3 gap-6 border-t border-border pt-6"
          >
            {[
              { v: '1,000,000+', l: 'People impacted' },
              { v: '3,600+', l: 'Projects developed' },
              { v: '17+', l: 'Years running' },
            ].map((s) => (
              <div key={s.l} className="flex flex-col gap-1">
                <dt className="font-display text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                  {s.v}
                </dt>
                <dd className="text-xs leading-snug text-muted-foreground">{s.l}</dd>
              </div>
            ))}
          </motion.dl>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, delay: 0.4, ease: easeOut }}
          className="relative mx-auto aspect-square w-full max-w-lg"
        >
          {/* The 3D particle crystal (Scene3DBackground, mounted at section
              level) renders into this half of the frame — this column is a
              deliberate empty stage for it, not a card. The i2i mark is
              rendered inside the 3D scene itself (scene-3d-inner.tsx) via
              drei's <Html>, anchored to the crystal's own group so it tracks
              the real projected screen position at any viewport size. */}
          <div className="glass-strong absolute bottom-0 left-6 flex items-center gap-3 rounded-2xl px-4 py-3">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-70" />
              <span className="relative inline-flex size-2.5 rounded-full bg-primary" />
            </span>
            <span className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">Live ecosystem</span> · 17th year running
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}
