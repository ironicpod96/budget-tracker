"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calcAllDeductions } from "@/lib/calculations/deductions";
import { calcTakeHome, calcVariablePool } from "@/lib/calculations/budget";
import {
  DEFAULT_CATEGORIES,
  CATEGORY_ICONS,
  getSuggestedPercentages,
} from "@/lib/constants/categories";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRM } from "@/components/shared/amount-display";
import { useOnboardingStore } from "@/stores/onboarding-store";
import { toLocalDateString } from "@/lib/utils";

export default function VariablePage() {
  const [takeHomeAmount, setTakeHomeAmount] = useState(0);
  const [variablePool, setVariablePool] = useState(0);
  const [savingsAmount, setSavingsAmount] = useState(0);
  const [baselinePercentages, setBaselinePercentages] = useState<number[]>([]);
  const [savingsBoostAmount, setSavingsBoostAmount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [grossIncome, setGrossIncome] = useState<number | null>(null);
  const [resolution, setResolution] = useState<null | "put_back" | "use_savings">(null);
  const router = useRouter();
  const supabase = createClient();
  const {
    savingsMode,
    setSavingsDraft,
    setSavingsComputedAmountOverride,
    variableCategories,
    setVariableCategories,
    variableDirty,
    setVariableDirty,
    resetOnboardingDrafts,
  } = useOnboardingStore();

  useEffect(() => {
    async function loadData() {
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

      setGrossIncome(profile.gross_income);

      const deductions = calcAllDeductions(
        profile.gross_income,
        profile.epf_rate
      );
      const takeHome = calcTakeHome(profile.gross_income, deductions.total);
      setTakeHomeAmount(takeHome);

      const { data: fixed } = await supabase
        .from("fixed_expenses")
        .select("amount")
        .eq("profile_id", user.id);
      const fixedTotal = (fixed || []).reduce(
        (sum: number, item: { amount: number }) => sum + item.amount,
        0
      );

      const { data: savings } = await supabase
        .from("savings_target")
        .select("computed_amount")
        .eq("profile_id", user.id)
        .single();
      const savingsAmount = savings?.computed_amount || 0;
      setSavingsAmount(savingsAmount);

      setVariablePool(calcVariablePool(takeHome, fixedTotal, savingsAmount));

      const { data: existingEnvelopes } = await supabase
        .from("envelopes")
        .select("name, icon, percentage")
        .eq("profile_id", user.id)
        .order("sort_order");

      if (variableCategories.length > 0) return;

      if (existingEnvelopes && existingEnvelopes.length > 0) {
        const nextCategories = existingEnvelopes.map((item) => ({
            name: item.name,
            icon: item.icon,
            percentage: item.percentage,
          }));
        setVariableCategories(nextCategories);
        setBaselinePercentages(nextCategories.map((item) => item.percentage));
        setVariableDirty(false);
        return;
      }

      const suggested = getSuggestedPercentages(profile.gross_income);
      const nextCategories = DEFAULT_CATEGORIES.map((category) => ({
          name: category.name,
          icon: category.icon,
          percentage: suggested[category.name] || category.defaultPercentage,
        }));
      setVariableCategories(nextCategories);
      setBaselinePercentages(nextCategories.map((item) => item.percentage));
      setVariableDirty(false);
    }

    loadData();
  }, [
    setVariableCategories,
    setVariableDirty,
    supabase,
    variableCategories.length,
  ]);

  const totalPct = variableCategories.reduce(
    (sum, category) => sum + category.percentage,
    0
  );
  const isUnderAllocated = totalPct < 100;
  const differencePct = Math.abs(100 - totalPct);
  const differenceAmount = Math.round(variablePool * (differencePct / 100));
  const needsRemainderChoice = variableDirty && totalPct !== 100;
  const canContinue = totalPct === 100 || resolution !== null;
  const protectedIndexes = new Set(
    variableCategories
      .map((category, index) =>
        category.percentage > (baselinePercentages[index] ?? 0) ? index : -1
      )
      .filter((index) => index >= 0)
  );
  const trimmableCategoriesPct = variableCategories.reduce(
    (sum, category, index) =>
      protectedIndexes.has(index) ? sum : sum + category.percentage,
    0
  );
  const trimmableCategoriesAmount = Math.round(
    variablePool * (trimmableCategoriesPct / 100)
  );
  const remainingAfterTrimAmount = Math.max(
    0,
    differenceAmount - trimmableCategoriesAmount
  );
  const canTrimOthers =
    totalPct > 100 &&
    trimmableCategoriesPct > 0 &&
    remainingAfterTrimAmount === 0;
  const canUseSavings =
    totalPct > 100 && remainingAfterTrimAmount <= Math.round(savingsAmount);
  const canResolveOverflow =
    totalPct <= 100 ||
    canTrimOthers ||
    canUseSavings;
  const displayVariablePool = variablePool + savingsBoostAmount;

  function updatePercentage(index: number, nextValue: number) {
    const updated = [...variableCategories];
    updated[index] = {
      ...updated[index],
      percentage: Math.max(0, Math.min(100, nextValue)),
    };
    setVariableCategories(updated);
    setVariableDirty(true);
    setResolution(null);
    setSavingsBoostAmount(0);
  }

  function suggestDistribution() {
    if (!grossIncome) return;

    const suggested = getSuggestedPercentages(grossIncome);
    setVariableCategories(
      DEFAULT_CATEGORIES.map((category) => ({
        name: category.name,
        icon: category.icon,
        percentage: suggested[category.name] || category.defaultPercentage,
      }))
    );
    setBaselinePercentages(
      DEFAULT_CATEGORIES.map(
        (category) => suggested[category.name] || category.defaultPercentage
      )
    );
    setVariableDirty(false);
    setResolution(null);
    setSavingsBoostAmount(0);
  }

  function adjustCategoriesEvenly(targetTotal: number) {
    const adjusted = variableCategories.map((category) => ({ ...category }));
    let currentTotal = adjusted.reduce(
      (sum, category) => sum + category.percentage,
      0
    );

    while (currentTotal !== targetTotal) {
      const activeIndexes = adjusted
        .map((category, index) => ({ category, index }))
        .filter(({ category }) =>
          currentTotal < targetTotal ? true : category.percentage > 0
        )
        .map(({ index }) => index);

      if (activeIndexes.length === 0) break;

      for (const index of activeIndexes) {
        if (currentTotal === targetTotal) break;

        if (currentTotal < targetTotal) {
          adjusted[index].percentage += 1;
          currentTotal += 1;
        } else if (adjusted[index].percentage > 0) {
          adjusted[index].percentage -= 1;
          currentTotal -= 1;
        }
      }
    }

    setVariableCategories(adjusted);
    setVariableDirty(false);
    setResolution(null);
  }

  function spreadRemainder() {
    adjustCategoriesEvenly(100);
    setSavingsBoostAmount(0);
  }

  function trimOthers() {
    const adjusted = variableCategories.map((category) => ({ ...category }));
    let currentTotal = adjusted.reduce(
      (sum, category) => sum + category.percentage,
      0
    );

    while (currentTotal > 100) {
      const activeIndexes = adjusted
        .map((category, index) => ({ category, index }))
        .filter(
          ({ category, index }) =>
            !protectedIndexes.has(index) && category.percentage > 0
        )
        .map(({ index }) => index);

      if (activeIndexes.length === 0) break;

      for (const index of activeIndexes) {
        if (currentTotal <= 100) break;
        if (adjusted[index].percentage > 0) {
          adjusted[index].percentage -= 1;
          currentTotal -= 1;
        }
      }
    }

    setVariableCategories(adjusted);
    setVariableDirty(true);
    setResolution(null);
    setSavingsBoostAmount(0);
  }

  function applyUseSavings() {
    if (!canUseSavings || totalPct <= 0) return;

    const normalized = variableCategories.map((category) => ({
      ...category,
      percentage: Math.round((category.percentage / totalPct) * 100),
    }));

    let normalizedTotal = normalized.reduce(
      (sum, category) => sum + category.percentage,
      0
    );

    while (normalizedTotal !== 100) {
      const orderedIndexes = normalized
        .map((category, index) => ({ index, percentage: category.percentage }))
        .sort((a, b) => b.percentage - a.percentage)
        .map(({ index }) => index);

      for (const index of orderedIndexes) {
        if (normalizedTotal === 100) break;

        if (normalizedTotal < 100) {
          normalized[index].percentage += 1;
          normalizedTotal += 1;
        } else if (normalized[index].percentage > 0) {
          normalized[index].percentage -= 1;
          normalizedTotal -= 1;
        }
      }
    }

    const nextSavingsAmount = Math.max(0, savingsAmount - differenceAmount);

    setVariableCategories(normalized);
    setResolution("use_savings");
    setSavingsBoostAmount(differenceAmount);
    setSavingsAmount(nextSavingsAmount);
    setSavingsDraft(
      savingsMode,
      savingsMode === "percentage"
        ? takeHomeAmount > 0
          ? Math.round((nextSavingsAmount / takeHomeAmount) * 100)
          : 0
        : Math.round(nextSavingsAmount)
    );
    setSavingsComputedAmountOverride(Math.round(nextSavingsAmount));
    setBaselinePercentages(normalized.map((category) => category.percentage));
  }

  async function handleContinue() {
    if (!canContinue) return;

    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const finalCategories = variableCategories.map((category) => ({ ...category }));
    const finalVariablePool =
      totalPct > 100 && resolution === "use_savings"
        ? variablePool + savingsBoostAmount
        : variablePool;

    const envelopes = finalCategories.map((category, index) => ({
      profile_id: user.id,
      name: category.name,
      icon: category.icon,
      percentage: category.percentage,
      monthly_budget:
        Math.round(finalVariablePool * (category.percentage / 100) * 100) / 100,
      sort_order: index,
    }));

    if (totalPct < 100 && resolution === "put_back") {
      const remainderAmount =
        Math.round(variablePool * ((100 - totalPct) / 100) * 100) / 100;

      const { data: existing } = await supabase
        .from("savings_target")
        .select("mode, value, computed_amount")
        .eq("profile_id", user.id)
        .single();

      const newComputed = (existing?.computed_amount || 0) + remainderAmount;
      await supabase.from("savings_target").upsert(
        {
          profile_id: user.id,
          mode: "amount",
          value: newComputed,
          computed_amount: newComputed,
        },
        { onConflict: "profile_id" }
      );
    }

    if (totalPct > 100 && resolution === "use_savings") {
      const shortageAmount = savingsBoostAmount;

      const { data: existing } = await supabase
        .from("savings_target")
        .select("computed_amount")
        .eq("profile_id", user.id)
        .single();

      const newComputed = Math.max(
        0,
        (existing?.computed_amount || 0) - shortageAmount
      );
      await supabase.from("savings_target").upsert(
        {
          profile_id: user.id,
          mode: "amount",
          value: newComputed,
          computed_amount: newComputed,
        },
        { onConflict: "profile_id" }
      );
    }

    await supabase.from("envelopes").delete().eq("profile_id", user.id);
    await supabase.from("envelopes").insert(envelopes);

    await supabase
      .from("profiles")
      .update({ onboarding_complete: true })
      .eq("id", user.id);

    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const daysInMonth = endDate.getDate();

    await supabase.from("budget_periods").insert({
      profile_id: user.id,
      start_date: toLocalDateString(startDate),
      end_date: toLocalDateString(endDate),
      total_variable_budget: finalVariablePool,
      days_in_period: daysInMonth,
    });

    resetOnboardingDrafts();
    router.push("/");
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-2">
        <p className="mb-2 text-sm text-muted-foreground">Step 4 of 4</p>
        <h1 className="text-4xl font-medium tracking-tight">
          Variable expenses
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {formatRM(displayVariablePool)} split into {variableCategories.length} categories.
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <Button
          variant="ghost"
          onClick={suggestDistribution}
          className="h-10 px-0 text-sm font-medium text-muted-foreground"
        >
          Auto Fill
        </Button>

        <div
          className={`text-sm font-medium ${
            totalPct === 100 ? "text-muted-foreground" : "text-accent-red"
          }`}
        >
          Total: {totalPct}%
        </div>
      </div>

      <div className="mb-4 mt-2 overflow-hidden rounded-2xl bg-surface-card">
        {variableCategories.map((category, index) => (
          <div
            key={category.name}
          >
            <div className="grid grid-cols-[1.4fr_1fr_92px] items-center gap-3 px-4 py-3">
              <div className="flex items-center gap-2">
                <span>{CATEGORY_ICONS[category.icon] || "📦"}</span>
                <span className="font-medium">{category.name}</span>
              </div>
              <span className="text-sm font-semibold">
                {formatRM(
                  Math.round(displayVariablePool * (category.percentage / 100) * 100) /
                    100
                )}
              </span>
              <div className="relative">
                <Input
                  type="number"
                  min="0"
                  max="100"
                  value={category.percentage}
                  onChange={(e) =>
                    updatePercentage(index, parseInt(e.target.value || "0", 10))
                  }
                  className="h-10 bg-background pr-8 text-right"
                />
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  %
                </span>
              </div>
            </div>
            <div className="px-4 pb-3">
              <input
                type="range"
                min="0"
                max="100"
                value={category.percentage}
                onChange={(e) =>
                  updatePercentage(index, parseInt(e.target.value, 10))
                }
                className="budget-slider w-full"
                style={{
                  ["--slider-progress" as string]: `${category.percentage}%`,
                }}
              />
            </div>
          </div>
        ))}
      </div>

      {needsRemainderChoice && (
        <div className="mt-4 rounded-2xl bg-surface-card p-4">
          <p className="text-sm text-muted-foreground">
            {isUnderAllocated
              ? `You have ${formatRM(differenceAmount)} extra.`
              : `You need ${formatRM(differenceAmount)} more.`}
          </p>
          <div className="mt-3 flex gap-3">
            {isUnderAllocated ? (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={spreadRemainder}
                  className="h-11 flex-1"
                >
                  Spread
                </Button>
                <Button
                  type="button"
                  variant={resolution === "put_back" ? "default" : "outline"}
                  onClick={() => setResolution("put_back")}
                  className="h-11 flex-1"
                >
                  Put back in Savings
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  onClick={trimOthers}
                  disabled={!canTrimOthers}
                  className="h-11 flex-1"
                >
                  Trim others
                </Button>
                <Button
                  type="button"
                  variant={resolution === "use_savings" ? "default" : "outline"}
                  onClick={applyUseSavings}
                  disabled={!canUseSavings}
                  className="h-11 flex-1"
                >
                  Use savings
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <div className="mt-auto space-y-4 pt-6">
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/onboarding/savings")}
            className="h-12 basis-1/3 text-base font-semibold"
          >
            Back
          </Button>
          <Button
            onClick={handleContinue}
            disabled={!canContinue || !canResolveOverflow || loading}
            className="h-12 flex-1 text-base font-semibold"
          >
            {loading ? "Setting up..." : "Start Budgeting"}
          </Button>
        </div>
      </div>
    </div>
  );
}
