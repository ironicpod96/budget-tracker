"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { createClient } from "@/lib/supabase/client";
import { FIXED_EXPENSE_SUGGESTIONS } from "@/lib/constants/categories";
import { Button } from "@/components/ui/button";
import { CurrencyInput } from "@/components/shared/currency-input";
import { Input } from "@/components/ui/input";
import { formatRM } from "@/components/shared/amount-display";
import { X, Plus } from "lucide-react";
import {
  type OnboardingFixedExpenseDraft,
  useOnboardingStore,
} from "@/stores/onboarding-store";

export default function FixedExpensesPage() {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const { fixedExpenses, setFixedExpenses } = useOnboardingStore();

  // Load existing fixed expenses if user is coming back
  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from("fixed_expenses")
        .select("name, amount, icon")
        .eq("profile_id", user.id)
        .order("created_at");
      if (fixedExpenses.length === 0 && data && data.length > 0) {
        setFixedExpenses(
          data.map((e) => ({
            name: e.name,
            amount: String(e.amount),
            icon: e.icon || "📝",
          }))
        );
      }
    }
    load();
  }, [fixedExpenses.length, setFixedExpenses, supabase]);

  const total = fixedExpenses.reduce(
    (sum, e) => sum + (parseFloat(e.amount) || 0),
    0
  );

  function addExpense(name: string = "", icon: string = "📝") {
    setFixedExpenses([...fixedExpenses, { name, amount: "", icon }]);
  }

  function removeExpense(index: number) {
    setFixedExpenses(fixedExpenses.filter((_, i) => i !== index));
  }

  function updateExpense(index: number, field: "name" | "amount", value: string) {
    const updated: OnboardingFixedExpenseDraft[] = [...fixedExpenses];
    updated[index] = { ...updated[index], [field]: value };
    setFixedExpenses(updated);
  }

  function updateExpenseIcon(index: number, value: string) {
    const updated: OnboardingFixedExpenseDraft[] = [...fixedExpenses];
    updated[index] = { ...updated[index], icon: value || "📝" };
    setFixedExpenses(updated);
  }

  async function handleContinue() {
    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    // Clear existing and insert new
    await supabase.from("fixed_expenses").delete().eq("profile_id", user.id);

    const validExpenses = fixedExpenses.filter(
      (e) => e.name.trim() && parseFloat(e.amount) > 0
    );

    if (validExpenses.length > 0) {
      await supabase.from("fixed_expenses").insert(
        validExpenses.map((e) => ({
          profile_id: user.id,
          name: e.name.trim(),
          amount: parseFloat(e.amount),
          icon: e.icon,
        }))
      );
    }

    router.push("/onboarding/savings");
  }

  const unusedSuggestions = FIXED_EXPENSE_SUGGESTIONS.filter(
    (s) => !fixedExpenses.some((e) => e.name === s.name)
  );

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-2">
        <p className="mb-2 text-sm text-muted-foreground">Step 2 of 4</p>
        <h1 className="text-4xl font-medium tracking-tight">Fixed expenses</h1>
      </div>

      <div className="my-4 space-y-3">
        {fixedExpenses.map((expense, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={expense.icon}
              onChange={(e) => updateExpenseIcon(i, e.target.value)}
              maxLength={2}
              className="h-10 w-12 bg-surface-card px-0 text-center text-xl"
              aria-label="Expense emoji"
            />
            <Input
              placeholder="Name"
              value={expense.name}
              onChange={(e) => updateExpense(i, "name", e.target.value)}
              className="flex-1 h-10 bg-surface-card"
            />
            <CurrencyInput
              value={expense.amount}
              onChange={(value) => updateExpense(i, "amount", value)}
              className="h-10 w-28 bg-surface-card"
            />
            <button
              onClick={() => removeExpense(i)}
              className="p-1 text-muted-foreground hover:text-foreground"
            >
              <X size={16} />
            </button>
          </div>
        ))}
      </div>

      <div className="mb-4 flex flex-wrap gap-2">
        <AnimatePresence initial={false} mode="popLayout">
          {unusedSuggestions.map((s) => (
            <motion.button
              key={s.name}
              type="button"
              onClick={() => addExpense(s.name, s.icon)}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.7 }}
              transition={{ type: "spring", bounce: 0, duration: 0.16 }}
              className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted"
            >
              <span>{s.icon}</span> {s.name}
            </motion.button>
          ))}
          <motion.button
            key="custom-add"
            type="button"
            onClick={() => addExpense()}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            transition={{ type: "spring", bounce: 0, duration: 0.16 }}
            className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted"
          >
            <Plus size={14} /> Add
          </motion.button>
        </AnimatePresence>
      </div>

      <div className="mt-auto space-y-4 pt-6">
        <div className="rounded-xl bg-surface-card px-4 py-3">
          <div className="flex justify-between text-lg font-medium">
            <span className="text-muted-foreground">Total fixed expenses</span>
            <span className="text-lg">{formatRM(total)}</span>
          </div>
        </div>
        <div className="flex gap-3">
          <Button
            variant="outline"
            onClick={() => router.push("/onboarding/income")}
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
