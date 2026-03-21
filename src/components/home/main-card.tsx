"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ProgressRing } from "./progress-ring";
import { CategoryBars, getCategoryBarColor } from "./category-bars";
import { ExpandToggleIcon } from "@/components/shared/expand-toggle-icon";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { useBudgetStore } from "@/stores/budget-store";
import { CATEGORY_ICONS } from "@/lib/constants/categories";
import { FONT_STYLES } from "@/lib/constants/typography";
import { X } from "lucide-react";

interface MainCardProps {
  isWeekly: boolean;
}

export function MainCard({ isWeekly }: MainCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [alertIndex, setAlertIndex] = useState(0);
  const [showSos, setShowSos] = useState(false);
  const [dailyAdjustments, setDailyAdjustments] = useState<Record<string, number>>({});
  const {
    dailyBudget,
    remainingToday,
    weeklyBudget,
    remainingThisWeek,
    envelopes,
    transactions,
  } = useBudgetStore();

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-MY", {
    month: "short",
    day: "numeric",
  });
  const dayStr = now.toLocaleDateString("en-MY", { weekday: "short" });

  const remaining = isWeekly ? remainingThisWeek : remainingToday;
  const budget = isWeekly ? weeklyBudget : dailyBudget;
  const pct = budget > 0 ? Math.max(0, Math.min(1, remaining / budget)) : 1;

  // Compute spending by envelope for category bars
  const today = now.toISOString().split("T")[0];
  const weekStart = (() => {
    const d = new Date(now);
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    return d.toISOString().split("T")[0];
  })();

  const relevantTxns = transactions.filter((t) =>
    isWeekly ? t.transactionDate >= weekStart : t.transactionDate === today
  );
  const byEnvelope = useMemo(() => {
    const next: Record<string, number> = {};
    relevantTxns.forEach((t) => {
      next[t.envelopeId] = (next[t.envelopeId] || 0) + t.amount;
    });
    return next;
  }, [relevantTxns]);

  const categoryStates = useMemo(
    () =>
      envelopes
        .map((env) => {
          const baseBudget = Math.round(budget * (env.percentage / 100) * 100) / 100;
          const adjustedBudget = Math.max(
            0,
            Math.round((baseBudget + (dailyAdjustments[env.id] || 0)) * 100) / 100
          );
          const spent = byEnvelope[env.id] || 0;
          const remainingAmount = Math.round((adjustedBudget - spent) * 100) / 100;
          const color = getCategoryBarColor(remainingAmount, adjustedBudget);

          return {
            id: env.id,
            name: env.name,
            icon: CATEGORY_ICONS[env.icon] || "📦",
            baseBudget,
            adjustedBudget,
            spent,
            remainingAmount,
            displayAmount: Math.round(Math.abs(remainingAmount)),
            color,
          };
        })
        .sort((a, b) => a.remainingAmount - b.remainingAmount),
    [budget, byEnvelope, dailyAdjustments, envelopes]
  );

  const alertEnvelopes = useMemo(
    () =>
      categoryStates.filter(
        (item) =>
          item.color === "var(--accent-yellow)" ||
          item.color === "var(--accent-red)"
      ),
    [categoryStates]
  );

  useEffect(() => {
    if (expanded || alertEnvelopes.length <= 1) return;

    const interval = window.setInterval(() => {
      setAlertIndex((current) => (current + 1) % alertEnvelopes.length);
    }, 5000);

    return () => window.clearInterval(interval);
  }, [alertEnvelopes.length, expanded]);
  const alertEnvelope =
    alertEnvelopes.length > 0
      ? alertEnvelopes[alertIndex % alertEnvelopes.length]
      : null;
  const showSosButton = !isWeekly && alertEnvelopes.length > 0;

  const sosTarget = alertEnvelope
    ? categoryStates.find((item) => item.id === alertEnvelope.id) ?? null
    : null;
  const sosDonors = categoryStates.filter(
    (item) => item.id !== sosTarget?.id && item.remainingAmount > 0
  );
  const donorCapacity = sosDonors.reduce(
    (sum, item) => sum + item.remainingAmount,
    0
  );
  const topUpNeed = sosTarget
    ? Math.max(0, Math.round((sosTarget.baseBudget - sosTarget.remainingAmount) * 100) / 100)
    : 0;
  const sosNeedsFuture = !!sosTarget && topUpNeed > 0 && donorCapacity <= 0;

  function distributeTrimAmounts(targetId: string) {
    setDailyAdjustments((current) => {
      const next = { ...current };
      const currentStates = envelopes.map((env) => {
        const baseBudget = Math.round(budget * (env.percentage / 100) * 100) / 100;
        const adjustedBudget = Math.max(
          0,
          Math.round((baseBudget + (current[env.id] || 0)) * 100) / 100
        );
        const spent = byEnvelope[env.id] || 0;
        const remainingAmount = Math.round((adjustedBudget - spent) * 100) / 100;

        return {
          id: env.id,
          baseBudget,
          adjustedBudget,
          remainingAmount,
        };
      });

      const target = currentStates.find((item) => item.id === targetId);
      if (!target) return current;

      let remainingNeedCents = Math.round(
        Math.max(0, target.baseBudget - target.remainingAmount) * 100
      );
      if (remainingNeedCents <= 0) return current;

      const donors = currentStates
        .filter((item) => item.id !== targetId && item.remainingAmount > 0)
        .map((item) => ({
          id: item.id,
          capacityCents: Math.round(item.remainingAmount * 100),
        }));

      while (remainingNeedCents > 0) {
        const activeDonors = donors.filter((donor) => donor.capacityCents > 0);
        if (activeDonors.length === 0) break;

        const share = Math.max(1, Math.floor(remainingNeedCents / activeDonors.length));

        for (const donor of activeDonors) {
          if (remainingNeedCents <= 0) break;

          const donationCents = Math.min(donor.capacityCents, share, remainingNeedCents);
          donor.capacityCents -= donationCents;
          remainingNeedCents -= donationCents;

          const donation = donationCents / 100;
          next[donor.id] = Math.round(((next[donor.id] || 0) - donation) * 100) / 100;
          next[targetId] = Math.round(((next[targetId] || 0) + donation) * 100) / 100;
        }
      }

      return next;
    });
  }

  function borrowFromFuture(targetId: string) {
    setDailyAdjustments((current) => {
      const target = categoryStates.find((item) => item.id === targetId);
      if (!target) return current;

      const remainingNeed = Math.max(
        0,
        Math.round((target.baseBudget - target.remainingAmount) * 100) / 100
      );
      if (remainingNeed <= 0) return current;

      return {
        ...current,
        [targetId]: Math.round(((current[targetId] || 0) + remainingNeed) * 100) / 100,
      };
    });
    setShowSos(false);
  }

  return (
    <div className="relative rounded-2xl bg-surface-card px-4 pt-6 pb-5">
      <div className="absolute left-4 top-4">
        <div>
          <p className={`text-xl ${FONT_STYLES.bodyStrong}`}>{dateStr}</p>
          <p className="text-xl text-muted-foreground">{dayStr}</p>
        </div>
      </div>

      <button
        onClick={() => setExpanded(!expanded)}
        className="absolute right-3 top-3 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
        aria-label={expanded ? "Collapse details" : "Expand details"}
      >
        <ExpandToggleIcon open={expanded} size={64} barScale={0.4375} />
      </button>

      <div className="flex justify-center">
        <ProgressRing percentage={pct} remaining={remaining} />
      </div>

      {expanded && (
        <div className="mt-3 border-t border-border pt-4">
          <CategoryBars
            envelopes={envelopes.map((e) => ({
              id: e.id,
              name: e.name,
              icon: e.icon,
              percentage: e.percentage,
            }))}
            transactionsByEnvelope={byEnvelope}
            sliceBudget={budget}
            budgetAdjustments={dailyAdjustments}
          />
        </div>
      )}

      {!expanded && (
        <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-end justify-between">
          <div className="min-h-[24px]">
            {alertEnvelope && (
              <div className="flex flex-col items-start gap-2">
                <div className="relative h-8 w-8 overflow-visible">
                  <AnimatePresence initial={false}>
                    <motion.span
                      key={alertEnvelope.id}
                      className="absolute inset-0 block text-3xl leading-none"
                      initial={{ scale: 0.82, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      exit={{ scale: 0.72, opacity: 0 }}
                      transition={{
                        type: "spring",
                        bounce: 0,
                        duration: 0.26,
                      }}
                    >
                      {alertEnvelope.icon}
                    </motion.span>
                  </AnimatePresence>
                </div>
                <span
                  className="rounded-sm px-2 py-0.5 text-base font-semibold text-primary"
                  style={{
                    backgroundColor: alertEnvelope.color,
                    paddingTop: "1px",
                    paddingBottom: "1px",
                  }}
                >
                  RM {alertEnvelope.displayAmount}
                </span>
              </div>
            )}
          </div>
          {showSosButton ? (
            <button
              type="button"
              className="pointer-events-auto flex h-[62px] w-[62px] items-center justify-center rounded-full border-2"
              style={{
                borderColor: sosNeedsFuture ? "var(--accent-red)" : "var(--accent-yellow)",
                color: sosNeedsFuture ? "var(--accent-red)" : "var(--accent-yellow)",
              }}
              onClick={() => setShowSos(true)}
              aria-label="Open SOS"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
              >
                <path d="M12 8a2 2 0 0 1 2 2v4a2 2 0 1 1-4 0v-4a2 2 0 0 1 2-2m5 7c.345.6 1.258 1 2 1a2 2 0 1 0 0-4a2 2 0 1 1 0-4c.746 0 1.656.394 2 1M3 15c.345.6 1.258 1 2 1a2 2 0 1 0 0-4a2 2 0 1 1 0-4c.746 0 1.656.394 2 1" />
              </svg>
            </button>
          ) : (
            <div />
          )}
        </div>
      )}

      <Sheet open={showSos} onOpenChange={setShowSos}>
        <SheetContent
          side="bottom"
          className="h-auto rounded-t-2xl border-0 bg-surface-bg px-6 pt-6 pb-8"
        >
          <button
            type="button"
            onClick={() => setShowSos(false)}
            className="absolute right-4 top-4 rounded-full p-2 text-muted-foreground hover:text-white"
            aria-label="Close SOS"
          >
            <X size={24} />
          </button>

          {sosTarget && (
            <div className="space-y-5">
              <div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl leading-none">{sosTarget.icon}</span>
                  <h3 className={`text-2xl ${FONT_STYLES.displayValue}`}>SOS</h3>
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  {sosTarget.name} is running low today.
                </p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Left now:{" "}
                  <span style={{ color: sosTarget.color }}>
                    {sosTarget.remainingAmount < 0 ? "-RM " : "RM "}
                    {Math.abs(Math.round(sosTarget.remainingAmount))}
                  </span>
                </p>
              </div>

              {donorCapacity > 0 ? (
                <div className="rounded-2xl bg-surface-card p-4">
                  <p className="text-sm text-muted-foreground">
                    Trim today&apos;s remaining money equally from the other categories first.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => distributeTrimAmounts(sosTarget.id)}
                    className="mt-3 h-11 w-full"
                  >
                    Trim from other categories
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl bg-surface-card p-4">
                  <p className="text-sm text-muted-foreground">
                    The other categories are already depleted. Borrow from future to top up today.
                  </p>
                  <Button
                    type="button"
                    onClick={() => borrowFromFuture(sosTarget.id)}
                    className="mt-3 h-11 w-full bg-accent-red text-white hover:bg-accent-red/90"
                  >
                    Borrow from future
                  </Button>
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
