"use client";

import { motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useBudgetStore } from "@/stores/budget-store";
import { toLocalDateString } from "@/lib/utils";
import { FONT_STYLES } from "@/lib/constants/typography";

interface WeeklySurplusCardProps {
  surplus: number;
  onCollapse: () => void;
  onTransferred: () => void;
}

export function WeeklySurplusCard({ surplus, onCollapse, onTransferred }: WeeklySurplusCardProps) {
  const { profile } = useBudgetStore();

  async function handleTransfer() {
    if (!profile) return;

    const supabase = createClient();
    const now = new Date();
    const today = toLocalDateString(now);

    const { error } = await supabase.from("weekly_savings").upsert(
      {
        profile_id: profile.id,
        week_start: today,
        week_end: today,
        weekly_budget: 0,
        weekly_spent: 0,
        remainder: surplus,
        transferred_to_savings: true,
        transferred_at: now.toISOString(),
      },
      { onConflict: "profile_id,week_start" }
    );

    if (!error) {
      onTransferred();
    }
  }

  return (
    <div className="rounded-2xl bg-accent-green px-4 py-5">
      <p className="text-xl font-medium text-black/80">
        <span className="font-bold text-black">
          RM {Math.round(surplus)}
        </span>
        {" "}saved. Transfer to Tabung soon!
      </p>

      <div className="mt-4 flex gap-3">
        <Button
          type="button"
          onClick={onCollapse}
          className="h-11 flex-1 bg-black/20 text-black hover:bg-black/30"
        >
          Back
        </Button>
        <Button
          type="button"
          onClick={handleTransfer}
          className="h-11 flex-1 bg-white text-black hover:bg-white/90"
        >
          I&apos;ve Transferred
        </Button>
      </div>
    </div>
  );
}

interface WeeklySurplusIndicatorProps {
  surplus: number;
  onTap: () => void;
  animate?: boolean;
}

export function WeeklySurplusIndicator({ surplus, onTap, animate: shouldAnimate = false }: WeeklySurplusIndicatorProps) {
  return (
    <motion.button
      key="indicator"
      className="flex justify-center cursor-pointer"
      onClick={onTap}
      initial={shouldAnimate ? { opacity: 0, scale: 0.5 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={shouldAnimate ? { type: "spring", bounce: 0, duration: 0.4 } : undefined}
    >
      <span
        className={`text-xl ${FONT_STYLES.bodyStrong} animate-pulse`}
        style={{ color: "var(--accent-green)" }}
      >
        RM{Math.round(surplus)}
      </span>
    </motion.button>
  );
}
