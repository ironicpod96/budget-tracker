"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useBudgetStore } from "@/stores/budget-store";

interface WeeklySurplusCardProps {
  surplus: number;
}

export function WeeklySurplusCard({ surplus }: WeeklySurplusCardProps) {
  const [transferred, setTransferred] = useState(false);
  const [loading, setLoading] = useState(false);
  const { profile } = useBudgetStore();

  if (surplus <= 0 || transferred) return null;

  async function handleTransfer() {
    if (!profile || transferred) return;
    setLoading(true);

    const supabase = createClient();
    const now = new Date();
    const today = now.toISOString().split("T")[0];

    const { error } = await supabase.from("weekly_savings").insert({
      profile_id: profile.id,
      week_start: today,
      week_end: today,
      weekly_budget: 0,
      weekly_spent: 0,
      remainder: surplus,
      transferred_to_savings: true,
      transferred_at: now.toISOString(),
    });

    if (!error) {
      setTransferred(true);
    }
    setLoading(false);
  }

  return (
    <div className="mb-4 rounded-2xl bg-accent-green px-4 py-5">
      <p className="text-2xl font-medium text-black/80">
        <span className="font-bold text-black">
          RM {Math.round(surplus)}
        </span>
        {" "}saved. Transfer to Tabung soon!
      </p>

      <div className="mt-4">
        <Button
          type="button"
          onClick={handleTransfer}
          disabled={loading}
          className="h-11 w-full bg-white text-black hover:bg-white/90"
        >
          I&apos;ve Transferred
        </Button>
      </div>
    </div>
  );
}
