"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useTransform, animate } from "motion/react";
import { ProgressRing } from "./progress-ring";
import { CategoryBars } from "./category-bars";
import { ExpandToggleIcon } from "@/components/shared/expand-toggle-icon";
import { useBudgetStore } from "@/stores/budget-store";
import { useSosComputation } from "@/lib/hooks/use-sos-computation";
import { useToday } from "@/lib/hooks/use-today";
import { toLocalDateString } from "@/lib/utils";
import { WeeklySurplusCard, WeeklySurplusIndicator } from "./weekly-surplus-card";
import { WeeklySpendingChart } from "./weekly-spending-chart";
import { FONT_STYLES } from "@/lib/constants/typography";

const DAY_LABELS = ["M", "T", "W", "T", "F", "S", "S"];

interface MainCardProps {
  isWeekly: boolean;
  onRequestSos: () => void;
  weeklySurplus?: number;
}

export function MainCard({ isWeekly, onRequestSos, weeklySurplus = 0 }: MainCardProps) {
  const [expanded, setExpanded] = useState(false);
  const spentShouldAnimate = useRef(false);
  useEffect(() => {
    spentShouldAnimate.current = false;
    setExpanded(false);
  }, [isWeekly]);
  const [alertIndex, setAlertIndex] = useState(0);
  const [surplusCollapsed, setSurplusCollapsed] = useState(false);
  const [surplusTransferred, setSurplusTransferred] = useState(false);
  const [weeklySlide, setWeeklySlide] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  const dragX = useMotionValue(0);
  const showSurplus = isWeekly && weeklySurplus > 0 && !surplusTransferred;
  const { envelopes, dailyAdjustments, dailyBudget, transactions } = useBudgetStore();

  const {
    budget,
    remaining,
    pct,
    alertEnvelopes,
    byEnvelope,
    overspentCategories,
    sosNeedsFuture,
  } = useSosComputation(isWeekly);

  const { today, now } = useToday();

  // Daily view: "21 Mar" / "Sat"
  const dateStr = now.toLocaleDateString("en-MY", {
    month: "short",
    day: "numeric",
  });
  const dayStr = now.toLocaleDateString("en-MY", { weekday: "short" });

  // Weekly view: "16–22" / "Mar"
  const monday = useMemo(() => {
    const dayOfWeek = now.getDay();
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const m = new Date(now);
    m.setDate(now.getDate() - diffToMonday);
    return m;
  }, [today]);
  const sunday = useMemo(() => {
    const s = new Date(monday);
    s.setDate(monday.getDate() + 6);
    return s;
  }, [monday]);
  const weekRangeStr = `${monday.getDate()}–${sunday.getDate()}`;
  const weekMonthStr = now.toLocaleDateString("en-MY", { month: "short" });

  // Weekly budget: forward-looking (today → Sunday). Past days are settled.
  const { weeklyBudgetForward, weeklySpentForward } = useMemo(() => {
    const sundayStr = toLocalDateString(sunday);
    // Only count spending from today onwards
    const forwardTxns = transactions.filter(
      (t) => t.transactionDate >= today && t.transactionDate <= sundayStr
    );
    const spent = forwardTxns.reduce((sum, t) => sum + t.amount, 0);

    // Days remaining in week (today → Sunday inclusive)
    const todayDate = new Date(today + "T00:00:00");
    const sundayDate = new Date(sundayStr + "T00:00:00");
    const daysLeft = Math.max(1, Math.round((sundayDate.getTime() - todayDate.getTime()) / 86400000) + 1);
    const budget = Math.round(dailyBudget * daysLeft * 100) / 100;

    return { weeklyBudgetForward: budget, weeklySpentForward: spent };
  }, [transactions, sunday, today, dailyBudget]);
  const weeklyRemaining = Math.round((weeklyBudgetForward - weeklySpentForward) * 100) / 100;
  const weeklyPct = weeklyBudgetForward > 0
    ? Math.max(0, Math.min(1, weeklyRemaining / weeklyBudgetForward))
    : 1;

  // Weekly ring color
  const weeklyRingColor =
    weeklyRemaining < 0
      ? "var(--accent-red)"
      : weeklyRemaining === 0
        ? "var(--accent-yellow)"
        : "var(--foreground)";

  // Weekly squares: compute per-day status
  const weekDayStatuses = useMemo(() => {
    const statuses: Array<"green" | "orange" | "red" | "empty"> = [];

    // Compute cumulative deficit from past completed days
    let cumulativeDeficit = 0;
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateKey = toLocalDateString(d);
      if (dateKey >= today) break;
      const dayTxns = transactions.filter((t) => t.transactionDate === dateKey);
      if (dayTxns.length === 0) continue;
      const spent = dayTxns.reduce((sum, t) => sum + t.amount, 0);
      cumulativeDeficit += spent - dailyBudget;
    }

    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateKey = toLocalDateString(d);

      // Today or future days
      if (dateKey >= today) {
        statuses.push(cumulativeDeficit > 0 ? "red" : "empty");
        continue;
      }

      // Past days with no transactions → empty
      const dayTxns = transactions.filter((t) => t.transactionDate === dateKey);
      if (dayTxns.length === 0) {
        statuses.push("empty");
        continue;
      }

      const spent = dayTxns.reduce((sum, t) => sum + t.amount, 0);
      const dayRemaining = Math.round((dailyBudget - spent) * 100) / 100;
      if (dayRemaining < 0) statuses.push("red");
      else if (dayRemaining === 0) statuses.push("orange");
      else statuses.push("green");
    }
    return statuses;
  }, [transactions, dailyBudget, monday, today]);

  // Weekly chart data: per-day spending for Mon→Sun
  const weekChartData = useMemo(() => {
    const names = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
    return names.map((name, i) => {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const dateKey = toLocalDateString(d);
      const dayTxns = transactions.filter((t) => t.transactionDate === dateKey);
      // Today: always show (even if 0). Past: show 0 if no txns. Future: null (line stops).
      const isToday = dateKey === today;
      const isFuture = dateKey > today;
      const spent =
        dayTxns.length > 0
          ? dayTxns.reduce((sum, t) => sum + t.amount, 0)
          : isToday
            ? 0
            : isFuture
              ? null
              : 0;
      return { day: name, spent, budget: dailyBudget };
    });
  }, [transactions, dailyBudget, monday, today]);

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

  const showSosButton = !isWeekly && overspentCategories.length > 0;

  function getSquareColor(status: string) {
    switch (status) {
      case "red": return "var(--accent-red)";
      case "orange": return "var(--accent-yellow)";
      case "green": return "var(--accent-green)";
      default: return "var(--background)";
    }
  }

  return (
    <motion.div
      layout={isWeekly ? false : "position"}
      transition={{ type: "spring", bounce: 0, duration: 0.35 }}
      className={`relative rounded-2xl bg-surface-card px-4 ${isWeekly ? "pt-3 pb-3" : "pt-6 pb-5"}`}>
      {/* Daily: absolute-positioned header */}
      {!isWeekly && (
        <>
          <div className="absolute left-4 top-4">
            <p className={`text-xl ${FONT_STYLES.bodyStrong}`}>{dateStr}</p>
            <p className="text-xl text-muted-foreground">{dayStr}</p>
          </div>
          <button
            onClick={() => { spentShouldAnimate.current = true; setExpanded(!expanded); }}
            className="absolute right-3 top-3 cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
            aria-label={expanded ? "Collapse details" : "Expand details"}
          >
            <ExpandToggleIcon open={expanded} size={64} className="-translate-x-0.5 -translate-y-2" />
          </button>
        </>
      )}

      {/* Daily: surplus indicator (collapsed state) */}
      {!isWeekly && showSurplus && surplusCollapsed && (
        <div className="absolute left-1/2 top-4 -translate-x-1/2">
          <WeeklySurplusIndicator surplus={weeklySurplus} onTap={() => setSurplusCollapsed(false)} animate={surplusCollapsed} />
        </div>
      )}

      {/* Center content */}
      {isWeekly ? (
        /* Weekly: swipeable carousel */
        <>
          <div ref={carouselRef} className="overflow-hidden">
            <motion.div
              className="flex touch-pan-y gap-4"
              drag="x"
              dragSnapToOrigin={false}
              dragMomentum={false}
              dragConstraints={{
                left: -((carouselRef.current?.offsetWidth ?? 0) + 16),
                right: 0,
              }}
              dragElastic={0.2}
              style={{ x: dragX }}
              onDragEnd={(_, info) => {
                const containerWidth = carouselRef.current?.offsetWidth ?? 0;
                const swipedLeft = info.offset.x < -40 || info.velocity.x < -200;
                const swipedRight = info.offset.x > 40 || info.velocity.x > 200;
                let next = weeklySlide;
                if (swipedLeft && weeklySlide === 0) next = 1;
                else if (swipedRight && weeklySlide === 1) next = 0;
                setWeeklySlide(next);
                const gap = 16; // gap-4
                animate(dragX, -next * (containerWidth + gap), { type: "spring", bounce: 0, duration: 0.35 });
              }}
            >
              {/* Slide 1: weekly summary */}
              <div className="flex min-w-full flex-col gap-4">
                <div className="flex items-start justify-between gap-2 mt-1">
                  <div>
                    <p className={`text-xl ${FONT_STYLES.bodyStrong}`}>{weekRangeStr}</p>
                    <p className="text-xl text-muted-foreground">{weekMonthStr}</p>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 shrink-0">
                    <span
                      className={`text-xl ${FONT_STYLES.bodyStrong} leading-tight`}
                      style={{ color: weeklyRingColor }}
                    >
                      {weeklyRemaining < 0 ? "-" : ""}RM{Math.abs(Math.round(weeklyRemaining))}
                    </span>
                    <svg width="18" height="18" viewBox="0 0 20 20" className="rotate-[-90deg]">
                      <circle cx="10" cy="10" r="7" fill="none" stroke="var(--muted)" strokeWidth="3" />
                      <circle
                        cx="10" cy="10" r="7" fill="none"
                        stroke={weeklyRingColor} strokeWidth="3"
                        strokeDasharray={`${weeklyPct * 2 * Math.PI * 7} ${2 * Math.PI * 7}`}
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  {DAY_LABELS.map((label, i) => (
                    <div key={i} className="flex flex-col items-center gap-1.5">
                      <div
                        className="rounded-lg"
                        style={{
                          width: 36,
                          height: 36,
                          backgroundColor: getSquareColor(weekDayStatuses[i]),
                        }}
                      />
                      <span className="text-base font-medium text-muted-foreground">{label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Slide 2: spending chart */}
              <div className="min-w-full">
                <WeeklySpendingChart data={weekChartData} />
              </div>
            </motion.div>
          </div>

          {/* Pagination dots */}
          <div className="mt-3 flex justify-center gap-1.5">
            {[0, 1].map((i) => (
              <div
                key={i}
                className="rounded-full transition-colors duration-200"
                style={{
                  width: 6,
                  height: 6,
                  backgroundColor: weeklySlide === i ? "var(--foreground)" : "black",
                }}
              />
            ))}
          </div>
        </>
      ) : (
        /* Daily: big ring */
        <div className="flex justify-center">
          <ProgressRing percentage={pct} remaining={remaining} />
        </div>
      )}

      {!isWeekly && (
        <motion.div
          className="absolute bottom-5 left-4"
          animate={{ opacity: expanded ? 0 : 1 }}
          transition={spentShouldAnimate.current ? { duration: 0.2 } : { duration: 0 }}
          style={{ pointerEvents: expanded ? "none" : "auto" }}
        >
          <p className="text-xl text-muted-foreground">Spent</p>
          <p className={`text-xl ${FONT_STYLES.bodyStrong}`}>
            RM {Math.max(0, budget - remaining).toFixed(0)}
          </p>
        </motion.div>
      )}

      {/* Weekly surplus card (expanded state) */}
      <AnimatePresence>
        {showSurplus && !surplusCollapsed && (
          <motion.div
            key="surplus-card"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
            className="overflow-hidden"
          >
            <WeeklySurplusCard
              surplus={weeklySurplus}
              onCollapse={() => setSurplusCollapsed(true)}
              onTransferred={() => setSurplusTransferred(true)}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expanded: category bars (today only) */}
      <AnimatePresence>
        {!isWeekly && expanded && (
          <motion.div
            key="category-bars"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.35 }}
            className="overflow-hidden"
          >
            <div className="mt-6 border-t border-border pt-6">
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
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom overlay (today only, hidden when expanded) */}
      {!isWeekly && !expanded && (
      <div className="pointer-events-none absolute bottom-4 left-4 right-4 flex items-end justify-between">
        {/* Daily bottom left: alert envelope */}
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
                {alertEnvelope.remainingAmount < 0 ? "-" : ""}RM {alertEnvelope.displayAmount}
              </span>
            </div>
          )}
        </div>

        {/* Bottom right: SOS button */}
        {showSosButton ? (
          <button
            type="button"
            className="pointer-events-auto flex h-[62px] w-[62px] items-center justify-center rounded-full border-2"
            style={{
              borderColor: sosNeedsFuture ? "var(--accent-red)" : "var(--accent-yellow)",
              color: sosNeedsFuture ? "var(--accent-red)" : "var(--accent-yellow)",
            }}
            onClick={onRequestSos}
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
    </motion.div>
  );
}
