'use client';

import { useRef, useState } from 'react';
import { motion, useScroll, useTransform, useMotionValueEvent } from 'motion/react';
import { CheckIcon } from '@heroicons/react/24/solid';
import Link from 'next/link';
import {
  UserGroupIcon,
  ShieldCheckIcon,
  ArrowPathIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';

const features = [
  {
    icon: UserGroupIcon,
    title: 'Dynamic Membership',
    description:
      'Add or remove signers at any time. Each member gets a configurable voting weight that reflects their role in your organisation.',
  },
  {
    icon: ShieldCheckIcon,
    title: 'Threshold Governance',
    description:
      'Set approval thresholds that match your security needs. Require any combination of weighted votes before a transaction can proceed.',
  },
  {
    icon: ArrowPathIcon,
    title: 'Transaction Workflow',
    description:
      'Propose, approve, and execute transactions in a transparent three-step process that keeps every stakeholder in the loop.',
  },
  {
    icon: ClipboardDocumentListIcon,
    title: 'Full Audit Trail',
    description:
      'Every action is recorded on-chain. View complete event history for accountability and compliance.',
  },
];

const steps = [
  {
    number: 1,
    title: 'Create',
    description:
      'Set up your multisig account. Define members, assign weights, and choose your approval threshold.',
  },
  {
    number: 2,
    title: 'Propose',
    description:
      'Any member can propose a transaction. It enters a pending state visible to all signers.',
  },
  {
    number: 3,
    title: 'Approve & Execute',
    description:
      'Members review and approve. Once the threshold is met, anyone can execute the transaction on-chain.',
  },
];

const members = [
  { name: 'Alice', weight: 3, color: 'from-sky-400 to-blue-500' },
  { name: 'Bob', weight: 2, color: 'from-violet-400 to-purple-500' },
  { name: 'Carol', weight: 2, color: 'from-teal-400 to-emerald-500' },
  { name: 'Dave', weight: 1, color: 'from-amber-400 to-orange-500' },
  { name: 'Eve', weight: 1, color: 'from-rose-400 to-pink-500' },
];

const totalWeight = members.reduce((s, m) => s + m.weight, 0);
const threshold = 5;

const testimonials = [
  {
    quote:
      'iSafe transformed how our DAO manages its treasury. The weighted voting means our core contributors have proportional say, while still including community members.',
    name: 'Alex R.',
    role: 'Treasury Lead at MoveDAO',
  },
  {
    quote:
      "We use iSafe for our dev team's deployment keys. No single engineer can push a contract upgrade alone. The three-step workflow gives us the review process we needed.",
    name: 'Priya K.',
    role: 'Smart Contract Lead at Tanglecraft',
  },
  {
    quote:
      'Managing funds across three time zones was a nightmare before iSafe. Now our co-founders can approve transactions asynchronously, and the audit trail keeps everyone accountable.',
    name: 'Marcus W.',
    role: 'Co-founder of DistributedLabs',
  },
];

export default function Home() {
  const thresholdRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: thresholdRef,
    offset: ['start end', 'end start'],
  });
  // Map scroll to a 0→totalWeight approval weight value
  const approvalWeight = useTransform(
    scrollYProgress,
    [0.25, 0.55],
    [0, totalWeight],
  );
  const [currentWeight, setCurrentWeight] = useState(0);
  useMotionValueEvent(approvalWeight, 'change', (v) => {
    setCurrentWeight(Math.round(v * 10) / 10);
  });

  const thresholdMet = currentWeight >= threshold;

  // Compute cumulative thresholds per member to determine who has "approved"
  const memberCumulative = members.reduce<number[]>((acc, m, i) => {
    acc.push((acc[i - 1] ?? 0) + m.weight);
    return acc;
  }, []);

  const progressWidth = useTransform(
    approvalWeight,
    [0, totalWeight],
    ['0%', '100%'],
  );

  return (
    <main className="flex flex-col min-h-screen">
      {/* ───── Hero ───── */}
      <section className="hero-gradient relative min-h-[90vh] flex flex-col items-center justify-center text-center px-6 overflow-hidden">
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', duration: 0.8 }}
          className="mb-8"
        >
          <svg
            width="80"
            height="80"
            viewBox="0 0 80 80"
            fill="none"
            className="mx-auto text-foreground/80"
          >
            <rect
              x="8"
              y="20"
              width="64"
              height="48"
              rx="8"
              stroke="currentColor"
              strokeWidth="2.5"
              fill="none"
            />
            <path
              d="M40 20V12a8 8 0 0 1 16 0v8"
              stroke="currentColor"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M24 20V12a8 8 0 0 1 16 0v8"
              stroke="currentColor"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
            <circle cx="40" cy="44" r="6" stroke="currentColor" strokeWidth="2.5" fill="none" />
            <line
              x1="40"
              y1="50"
              x2="40"
              y2="58"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            />
          </svg>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.8 }}
          className="text-4xl sm:text-5xl lg:text-6xl font-bold max-w-3xl leading-tight"
        >
          Secure Your Assets with Multi-Signature Control
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.8, delay: 0.15 }}
          className="mt-6 text-lg sm:text-xl text-foreground/60 max-w-2xl"
        >
          iSafe brings dynamic multisig accounts to the IOTA blockchain. Define members, set
          thresholds, and govern transactions collectively.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', duration: 0.8, delay: 0.3 }}
          className="mt-10 flex flex-col sm:flex-row gap-4"
        >
          <Link
            href="/create"
            className="px-8 py-3 rounded-lg bg-foreground text-background font-medium hover:opacity-90 transition"
          >
            Get Started
          </Link>
          <a
            href="#features"
            className="px-8 py-3 rounded-lg border border-foreground/20 font-medium hover:bg-foreground/5 transition"
          >
            Learn More
          </a>
        </motion.div>
      </section>

      {/* ───── Features ───── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl sm:text-4xl font-bold text-center mb-4"
          >
            Why iSafe?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-foreground/50 text-center max-w-xl mx-auto mb-16"
          >
            Everything you need to manage shared assets securely on IOTA.
          </motion.p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="bg-foreground/5 backdrop-blur border border-foreground/10 rounded-xl p-6 hover:border-foreground/20 transition-all hover:shadow-lg"
              >
                <f.icon className="w-8 h-8 text-foreground/70 mb-4" />
                <h3 className="text-lg font-semibold mb-2">{f.title}</h3>
                <p className="text-foreground/50 text-sm leading-relaxed">{f.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── How It Works ───── */}
      <section className="py-24 px-6 bg-foreground/[0.02]">
        <div className="max-w-5xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl sm:text-4xl font-bold text-center mb-4"
          >
            How It Works
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-foreground/50 text-center max-w-xl mx-auto mb-16"
          >
            Three simple steps from setup to execution.
          </motion.p>

          {/* Desktop horizontal flow */}
          <div className="hidden md:block relative mb-8">
            <svg
              className="w-full h-24"
              viewBox="0 0 900 100"
              preserveAspectRatio="xMidYMid meet"
            >
              <motion.line
                x1="150"
                y1="50"
                x2="750"
                y2="50"
                stroke="currentColor"
                strokeOpacity="0.15"
                strokeDasharray="8 4"
                strokeWidth="2"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, delay: 0.2 }}
              />
              {steps.map((s, i) => {
                const cx = 150 + i * 300;
                return (
                  <motion.g
                    key={s.number}
                    initial={{ opacity: 0, scale: 0.5 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.3 + i * 0.2 }}
                  >
                    <circle
                      cx={cx}
                      cy="50"
                      r="30"
                      fill="none"
                      stroke="currentColor"
                      strokeOpacity="0.25"
                      strokeWidth="2"
                    />
                    <text
                      x={cx}
                      y="57"
                      textAnchor="middle"
                      fill="currentColor"
                      fontSize="20"
                      fontWeight="bold"
                    >
                      {s.number}
                    </text>
                  </motion.g>
                );
              })}
            </svg>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {steps.map((s, i) => (
              <motion.div
                key={s.number}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.4 + i * 0.15 }}
                className="text-center"
              >
                {/* Mobile step number */}
                <div className="md:hidden w-12 h-12 rounded-full border-2 border-foreground/20 flex items-center justify-center mx-auto mb-4 text-lg font-bold">
                  {s.number}
                </div>
                <h3 className="text-lg font-semibold mb-2">{s.title}</h3>
                <p className="text-foreground/50 text-sm leading-relaxed">{s.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Threshold Visualization ───── */}
      <section ref={thresholdRef} className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl sm:text-4xl font-bold text-center mb-4"
          >
            Weighted Approval in Action
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-foreground/50 text-center max-w-xl mx-auto mb-16"
          >
            See how members combine their voting weight to meet the approval threshold.
          </motion.p>

          {/* Members */}
          <div className="flex flex-wrap justify-center gap-6 mb-10">
            {members.map((m, i) => {
              const approved = currentWeight >= memberCumulative[i];
              return (
                <motion.div
                  key={m.name}
                  initial={{ opacity: 0, scale: 0.8 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.4, delay: i * 0.1 }}
                  className="flex flex-col items-center gap-2"
                >
                  <div className="relative">
                    <div
                      className={`w-12 h-12 rounded-full bg-gradient-to-br ${m.color} flex items-center justify-center text-white font-bold text-sm transition-opacity duration-300 ${approved ? 'opacity-100 ring-2 ring-emerald-400 ring-offset-2 ring-offset-background' : 'opacity-40'}`}
                    >
                      {m.name[0]}
                    </div>
                    {approved && (
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 flex items-center justify-center">
                        <CheckIcon className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </div>
                  <span className={`text-xs transition-colors duration-300 ${approved ? 'text-emerald-400' : 'text-foreground/60'}`}>
                    {m.name}
                  </span>
                  <span className={`text-xs font-mono px-2 py-0.5 rounded-full transition-colors duration-300 ${approved ? 'bg-emerald-500/20 text-emerald-400' : 'bg-foreground/10'}`}>
                    w:{m.weight}
                  </span>
                </motion.div>
              );
            })}
          </div>

          {/* Progress bar */}
          <div className="relative h-6 rounded-full bg-foreground/10 overflow-hidden">
            <motion.div
              className={`absolute inset-y-0 left-0 rounded-full transition-colors duration-500 ${thresholdMet ? 'bg-gradient-to-r from-emerald-400 to-green-500' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`}
              style={{ width: progressWidth }}
            />
            {/* Threshold marker */}
            <div
              className={`absolute top-0 bottom-0 w-0.5 transition-colors duration-500 ${thresholdMet ? 'bg-emerald-400' : 'bg-foreground/40'}`}
              style={{ left: `${(threshold / totalWeight) * 100}%` }}
            />
          </div>

          <div className="flex justify-between mt-2 text-xs text-foreground/40">
            <span>0</span>
            <span className={`transition-colors duration-300 ${thresholdMet ? 'text-emerald-400 font-semibold' : ''}`}>
              Threshold: {threshold}/{totalWeight}
            </span>
            <span>{totalWeight}</span>
          </div>

          {/* Threshold reached badge */}
          <div className="h-12 flex items-center justify-center mt-4">
            {thresholdMet && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', duration: 0.5 }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-500/30"
              >
                <CheckIcon className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-400">Threshold Reached — Ready to Execute</span>
              </motion.div>
            )}
          </div>

          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="mt-4 text-sm text-foreground/50 text-center max-w-lg mx-auto"
          >
            With a threshold of <strong className="text-foreground/80">{threshold}</strong>, this
            account needs approval from members whose combined weight totals at least {threshold}.
            Scroll down to see members approve one by one.
          </motion.p>
        </div>
      </section>

      {/* ───── Testimonials ───── */}
      <section className="py-24 px-6 bg-foreground/[0.02]">
        <div className="max-w-6xl mx-auto">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl sm:text-4xl font-bold text-center mb-4"
          >
            Trusted by Teams Everywhere
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-foreground/50 text-center max-w-xl mx-auto mb-16"
          >
            Hear from organisations that rely on iSafe for their most critical operations.
          </motion.p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.2 }}
                transition={{ duration: 0.5, delay: i * 0.12 }}
                whileHover={{ y: -4 }}
                className="relative bg-foreground/5 backdrop-blur border border-foreground/10 rounded-xl p-8"
              >
                {/* Decorative quote mark */}
                <svg
                  className="absolute top-4 right-4 w-10 h-10 text-foreground/[0.06]"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M4.583 17.321C3.553 16.227 3 15 3 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C9.591 11.71 11 13.148 11 15c0 1.933-1.567 3.5-3.5 3.5-1.171 0-2.28-.548-2.917-1.179zm10 0C13.553 16.227 13 15 13 13.011c0-3.5 2.457-6.637 6.03-8.188l.893 1.378c-3.335 1.804-3.987 4.145-4.247 5.621.537-.278 1.24-.375 1.929-.311C19.591 11.71 21 13.148 21 15c0 1.933-1.567 3.5-3.5 3.5-1.171 0-2.28-.548-2.917-1.179z" />
                </svg>

                <p className="text-sm leading-relaxed text-foreground/70 mb-6">
                  &ldquo;{t.quote}&rdquo;
                </p>
                <div className="border-t border-foreground/10 pt-4">
                  <p className="text-sm font-semibold">{t.name}</p>
                  <p className="text-xs text-foreground/40">{t.role}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── CTA ───── */}
      <section className="py-24 px-6 bg-gradient-to-b from-transparent to-foreground/5">
        <div className="max-w-2xl mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-3xl sm:text-4xl font-bold mb-4"
          >
            Ready to Secure Your Team&apos;s Assets?
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-foreground/50 mb-10"
          >
            Create your first iSafe multisig account in under a minute.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.2 }}
          >
            <Link
              href="/create"
              className="inline-block px-10 py-4 rounded-lg bg-foreground text-background font-medium text-lg hover:opacity-90 transition"
            >
              Create Account
            </Link>
          </motion.div>
        </div>
      </section>

      {/* ───── Footer ───── */}
      <footer className="py-8 px-6 border-t border-foreground/10 text-center text-xs text-foreground/30">
        Built on IOTA &middot; Powered by Move
      </footer>
    </main>
  );
}
