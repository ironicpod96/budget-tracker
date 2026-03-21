"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { calcAllDeductions } from "@/lib/calculations/deductions";
import { calcTakeHome } from "@/lib/calculations/budget";
import { Numpad, useNumpadAmount } from "@/components/shared/numpad";
import { Button } from "@/components/ui/button";
import { formatRM } from "@/components/shared/amount-display";
import { formatCurrencyInput } from "@/lib/currency";
import { useOnboardingStore } from "@/stores/onboarding-store";

export default function IncomePage() {
  const [loading, setLoading] = useState(false);
  const hasHydratedIncome = useRef(false);
  const router = useRouter();
  const supabase = createClient();
  const { handleInput, handleDelete } = useNumpadAmount();
  const {
    incomeAmountStr,
    incomeShowBreakdown,
    setIncomeAmountStr,
    setIncomeShowBreakdown,
  } = useOnboardingStore();

  // Load existing income if user is coming back
  useEffect(() => {
    if (hasHydratedIncome.current) return;
    hasHydratedIncome.current = true;

    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("gross_income")
        .eq("id", user.id)
        .single();
      if (
        (incomeAmountStr === "0" || incomeAmountStr.length === 0) &&
        profile?.gross_income &&
        profile.gross_income > 0
      ) {
        setIncomeAmountStr(String(profile.gross_income));
      }
    }
    load();
  }, [incomeAmountStr, setIncomeAmountStr, supabase]);

  const amount = parseFloat(incomeAmountStr) || 0;
  const deductions = calcAllDeductions(amount);
  const takeHome = calcTakeHome(amount, deductions.total);

  async function handleContinue() {
    if (!incomeShowBreakdown) {
      setIncomeShowBreakdown(true);
      return;
    }

    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("profiles")
      .update({
        gross_income: amount,
        epf_rate: 11,
      })
      .eq("id", user.id);

    await supabase.from("monthly_deductions").upsert(
      {
        profile_id: user.id,
        epf_amount: deductions.epf,
        socso_amount: deductions.socso,
        eis_amount: deductions.eis,
        pcb_amount: deductions.pcb,
      },
      { onConflict: "profile_id" }
    );

    router.push("/onboarding/fixed");
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-2">
        <p className="mb-2 text-sm text-muted-foreground">Step 1 of 4</p>
        <h1 className="text-4xl font-medium tracking-tight">
          Gross Income
        </h1>
      </div>

      <div className="my-8 text-center">
        <span className="text-muted-foreground text-3xl">RM</span>{" "}
        <span className="text-6xl font-semibold">
          {formatCurrencyInput(incomeAmountStr)}
        </span>
        <p className="mt-3 text-sm text-muted-foreground">monthly</p>
      </div>

      {incomeShowBreakdown && (
        <div className="mb-6 space-y-3 rounded-xl bg-surface-card p-4">
          <h3 className="text-sm font-medium text-muted-foreground">
            Monthly Deductions
          </h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>EPF (11%)</span>
              <span>{formatRM(deductions.epf)}</span>
            </div>
            <div className="flex justify-between">
              <span>SOCSO</span>
              <span>{formatRM(deductions.socso)}</span>
            </div>
            <div className="flex justify-between">
              <span>EIS</span>
              <span>{formatRM(deductions.eis)}</span>
            </div>
            <div className="flex justify-between">
              <span>PCB (est.)</span>
              <span>{formatRM(deductions.pcb)}</span>
            </div>
            <div className="border-t border-border pt-2 flex justify-between font-semibold">
              <span>Total Deductions</span>
              <span>{formatRM(deductions.total)}</span>
            </div>
            <div className="flex justify-between text-base font-medium pt-1">
              <span>Take-Home</span>
              <span className="text-accent-green">{formatRM(takeHome)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="mt-auto space-y-4">
        {!incomeShowBreakdown && (
          <Numpad
            onInput={(key) =>
              setIncomeAmountStr(handleInput(incomeAmountStr, key))
            }
            onDelete={() => setIncomeAmountStr(handleDelete(incomeAmountStr))}
          />
        )}
        {incomeShowBreakdown ? (
          <div className="flex gap-3">
            <Button
              variant="outline"
              onClick={() => setIncomeShowBreakdown(false)}
              className="h-12 basis-1/3 text-base font-semibold"
            >
              Back
            </Button>
            <Button
              onClick={handleContinue}
              disabled={amount === 0 || loading}
              className="h-12 flex-1 text-base font-semibold"
            >
              {loading ? "Saving..." : "Continue"}
            </Button>
          </div>
        ) : (
          <Button
            onClick={handleContinue}
            disabled={amount === 0 || loading}
            className="h-12 w-full text-base font-semibold"
          >
            See Breakdown
          </Button>
        )}
      </div>
    </div>
  );
}
