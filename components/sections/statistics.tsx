'use client'

import { motion } from 'framer-motion'
import { Rocket, Building2, Users, Award, GraduationCap, Handshake } from 'lucide-react'
import { Section, SectionHeader } from '@/components/section'
import { Counter } from '@/components/counter'
import { GradientOrbs } from '@/components/background-fx'
import { StaggerGroup, StaggerItem } from '@/components/motion-primitives'

const stats = [
  { icon: Users, to: 1000000, suffix: '+', label: 'People impacted', hint: 'Across 17 years of impact' },
  { icon: Rocket, to: 3600, suffix: '+', label: 'Projects developed', hint: 'Across all cohorts' },
  { icon: Building2, to: 310, suffix: '+', label: 'Colleges & institutes', hint: 'Across Maharashtra & India' },
  { icon: GraduationCap, to: 1550, suffix: '+', label: 'Alumni network', hint: 'Carrying i2i forward' },
  { icon: Handshake, to: 700, suffix: '+', label: 'Ambassadors', hint: 'Powering outreach nationwide' },
  { icon: Award, to: 17, suffix: '+', label: 'Years running', hint: 'Since inception' },
]

export function Statistics() {
  return (
    <div className="relative overflow-hidden border-y border-border">
      <GradientOrbs className="opacity-70" />
      <div className="absolute inset-0 grid-texture opacity-40" aria-hidden="true" />
      <Section className="relative">
        <SectionHeader
          eyebrow="Live Statistics"
          title="Momentum you can measure"
          description="Real outcomes from a growing ecosystem of student founders, mentors, and industry partners."
          align="center"
        />

        <StaggerGroup className="mt-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stats.map((s) => (
            <StaggerItem key={s.label}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                className="glass group h-full rounded-2xl p-6 transition-colors duration-300 hover:border-[color:color-mix(in_oklch,var(--amber)_40%,transparent)]"
              >
                <span className="grid size-11 place-items-center rounded-xl bg-primary/12 text-primary ring-1 ring-inset ring-primary/20">
                  <s.icon className="size-5" />
                </span>
                <p className="mt-5 font-display text-4xl font-semibold tracking-tight text-foreground">
                  <Counter to={s.to} suffix={s.suffix} />
                </p>
                <p className="mt-1 text-sm font-medium text-foreground">{s.label}</p>
                <p className="mt-0.5 text-xs text-muted-foreground">{s.hint}</p>
              </motion.div>
            </StaggerItem>
          ))}
        </StaggerGroup>
      </Section>
    </div>
  )
}
