"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calcAllDeductions } from "@/lib/calculations/deductions";
import { calcTakeHome, calcVariablePool } from "@/lib/calculations/budget";
import { Button } from "@/components/ui/button";
import { formatRM } from "@/components/shared/amount-display";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { Minus, Plus } from "lucide-react";

export default function SavingsPage() {
  const [takeHome, setTakeHome] = useState(0);
  const [fixedTotal, setFixedTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const hasHydratedSavings = useRef(false);
  const router = useRouter();
  const supabase = createClient();
  const {
    savingsMode,
    savingsValue,
    savingsComputedAmountOverride,
    setSavingsDraft,
    setSavingsComputedAmountOverride,
  } = useOnboardingStore();

  useEffect(() => {
    if (hasHydratedSavings.current) return;
    hasHydratedSavings.current = true;

    async function loadProfile() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("gross_income, epf_rate")
        .eq("id", user.id)
        .single();
      if (!profile) return;

      const deductions = calcAllDeductions(
        profile.gross_income,
        profile.epf_rate
      );
      setTakeHome(calcTakeHome(profile.gross_income, deductions.total));

      const { data: fixedExpenses } = await supabase
        .from("fixed_expenses")
        .select("amount")
        .eq("profile_id", user.id);

      setFixedTotal(
        (fixedExpenses || []).reduce(
          (sum, item) => sum + item.amount,
          0
        )
      );

      // Load existing savings target if user is coming back
      const { data: existing } = await supabase
        .from("savings_target")
        .select("mode, value")
        .eq("profile_id", user.id)
        .single();
      if (
        existing &&
        savingsMode === "percentage" &&
        savingsValue === 20
      ) {
        setSavingsDraft(
          existing.mode as "percentage" | "amount",
          existing.value
        );
      }
    }
    loadProfile();
  }, [savingsMode, savingsValue, setSavingsDraft, supabase]);

  const computedAmount =
    savingsComputedAmountOverride ??
    (savingsMode === "percentage"
      ? Math.round(takeHome * (savingsValue / 100) * 100) / 100
      : savingsValue);
  const roundedComputedAmount = Math.round(computedAmount);
  const computedPct =
    savingsMode === "amount" && takeHome > 0
      ? Math.round((savingsValue / takeHome) * 100)
      : savingsValue;
  const variableExpenses = calcVariablePool(
    takeHome,
    fixedTotal,
    roundedComputedAmount
  );

  function switchMode(nextMode: "percentage" | "amount") {
    if (nextMode === savingsMode) return;

    if (nextMode === "amount") {
      setSavingsComputedAmountOverride(null);
      setSavingsDraft("amount", roundedComputedAmount);
      return;
    }

    const nextPercentage =
      takeHome > 0 ? Math.round((savingsValue / takeHome) * 100) : 0;
    setSavingsComputedAmountOverride(null);
    setSavingsDraft("percentage", nextPercentage);
  }

  async function handleContinue() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from("savings_target").upsert(
      {
        profile_id: user.id,
        mode: savingsMode,
        value: savingsValue,
        computed_amount:
          savingsMode === "percentage" ? roundedComputedAmount : savingsValue,
      },
      { onConflict: "profile_id" }
    );

    router.push("/onboarding/variable");
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-2">
        <p className="mb-2 text-sm text-muted-foreground">Step 3 of 4</p>
        <h1 className="text-4xl font-medium tracking-tight">Savings target</h1>
      </div>

      <div className="mt-5 mb-8 text-center">
        <div className="mb-6 grid grid-cols-2 rounded-lg bg-background p-1">
          <button
            onClick={() => switchMode("percentage")}
            className={`rounded-md py-2 text-sm font-medium shadow-sm ${
              savingsMode === "percentage"
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:text-white"
            }`}
          >
            Percentage
          </button>
          <button
            onClick={() => switchMode("amount")}
            className={`rounded-md py-2 text-sm font-medium shadow-sm ${
              savingsMode === "amount"
                ? "bg-foreground text-background"
                : "bg-secondary text-muted-foreground hover:text-white"
            }`}
          >
            Amount
          </button>
        </div>

        <div className="flex items-center justify-center gap-4">
          <button
            onClick={() =>
              setSavingsDraft(
                savingsMode,
                Math.max(
                  0,
                  savingsValue - (savingsMode === "percentage" ? 1 : 50)
                )
              )
            }
            className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-white active:text-white"
          >
            <Minus size={28} strokeWidth={2.5} />
          </button>
          <div className="min-w-[120px]">
            <span className="text-5xl font-semibold">
              {savingsMode === "percentage"
                ? `${Math.round(savingsValue)}%`
                : formatRM(Math.round(savingsValue))}
            </span>
          </div>
          <button
            onClick={() =>
              setSavingsDraft(
                savingsMode,
                savingsValue + (savingsMode === "percentage" ? 1 : 50)
              )
            }
            className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-white active:text-white"
          >
            <Plus size={28} strokeWidth={2.5} />
          </button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          {savingsMode === "percentage"
            ? `${formatRM(roundedComputedAmount)} / month`
            : `${computedPct}%`}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">
          Take-home: {formatRM(Math.round(takeHome))}
        </p>
      </div>

      <div className="mt-auto space-y-4">
        <div className="rounded-xl bg-surface-card px-4 py-3">
          <div className="flex justify-between text-lg font-medium">
            <span className="text-muted-foreground">Variable expenses</span>
            <span className="text-lg">{formatRM(variableExpenses)}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/onboarding/fixed")}
            className="h-12 basis-1/3 text-base font-semibold"
          >
            Back
          </Button>
          <Button
            onClick={handleContinue}
            disabled={loading}
            className="h-12 flex-1 text-base font-semibold"
          >
            {loading ? "Saving..." : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}
