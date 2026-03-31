"use client";

import { useState } from "react";
import { useHorizontalScroll } from "@/lib/hooks/use-horizontal-scroll";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Numpad, useNumpadAmount } from "@/components/shared/numpad";
import { DescriptionPicker } from "@/components/shared/description-picker";
import { useBudgetStore } from "@/stores/budget-store";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_ICONS } from "@/lib/constants/categories";
import { toLocalDateString } from "@/lib/utils";
import { Check } from "lucide-react";

interface AddExpenseSheetProps {
  open: boolean;
  onClose: () => void;
}

export function AddExpenseSheet({ open, onClose }: AddExpenseSheetProps) {
  const { envelopes, addTransaction } = useBudgetStore();
  const [selectedEnvelope, setSelectedEnvelope] = useState<string | null>(null);
  const [amountStr, setAmountStr] = useState("0");
  const [description, setDescription] = useState("");
  const { handleInput, handleDelete } = useNumpadAmount();
  const { ref: categoryRef, onWheel: categoryWheel } = useHorizontalScroll();
  const supabase = createClient();

  const activeEnvelope = envelopes.find((e) => e.id === selectedEnvelope) || envelopes[0];
  const amount = parseFloat(amountStr) || 0;

  function reset() {
    setAmountStr("0");
    setDescription("");
    setSelectedEnvelope(null);
  }

  function handleAdd() {
    if (amount <= 0 || !activeEnvelope) return;

    const now = new Date();
    const transactionDate = toLocalDateString(now);
    const transactionTime = now.toTimeString().split(" ")[0];
    const transactionId = crypto.randomUUID();

    // Optimistic: update store + close immediately
    addTransaction({
      id: transactionId,
      envelopeId: activeEnvelope.id,
      envelopeName: activeEnvelope.name,
      envelopeIcon: activeEnvelope.icon,
      amount,
      description: description || undefined,
      transactionDate,
      transactionTime,
    });

    // Check if any envelope is now overspent
    const state = useBudgetStore.getState();
    const todayTxns = state.transactions.filter(
      (t) => t.transactionDate === transactionDate
    );
    const byEnv: Record<string, number> = {};
    todayTxns.forEach((t) => {
      byEnv[t.envelopeId] = (byEnv[t.envelopeId] || 0) + t.amount;
    });
    const hasOverspend = state.envelopes.some((env) => {
      const envBudget =
        Math.round(state.dailyBudget * (env.percentage / 100) * 100) / 100;
      const adjusted = Math.max(
        0,
        Math.round(
          (envBudget + (state.dailyAdjustments[env.id] || 0)) * 100
        ) / 100
      );
      return (byEnv[env.id] || 0) > adjusted;
    });
    if (hasOverspend) {
      state.setSosPending(true);
    }

    reset();
    onClose();

    // Persist to Supabase in background (fire-and-forget)
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      await supabase.from("transactions").insert({
        id: transactionId,
        profile_id: user.id,
        envelope_id: activeEnvelope.id,
        amount,
        description: description || null,
        transaction_date: transactionDate,
        transaction_time: transactionTime,
      });
    })();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl bg-surface-bg border-0 px-6 pt-6 pb-8">
        {/* Amount display */}
        <div className="mt-4 mb-1">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl text-muted-foreground font-normal">RM</span>
            <span className="text-6xl font-normal">{amountStr}</span>
          </div>
        </div>

        {/* Category picker — horizontal scroll with edge fade */}
        <div className="relative mb-2 mt-3 -mx-6">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-surface-bg to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-surface-bg to-transparent" />
          <div ref={categoryRef} onWheel={categoryWheel} className="no-scrollbar flex gap-2 overflow-x-auto px-6">
            {envelopes.map((env) => (
              <button
                key={env.id}
                onClick={() => setSelectedEnvelope(env.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  (selectedEnvelope || envelopes[0]?.id) === env.id
                    ? "bg-foreground text-background"
                    : "bg-surface-card"
                }`}
              >
                <span className="text-xl">{CATEGORY_ICONS[env.icon] || "📦"}</span>
                <span>{env.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div className="mb-4">
          <DescriptionPicker
            envelopeId={activeEnvelope?.id}
            value={description}
            onChange={setDescription}
          />
        </div>

        {/* Numpad */}
        <Numpad
          onInput={(key) => setAmountStr((prev) => handleInput(prev, key))}
          onDelete={() => setAmountStr((prev) => handleDelete(prev))}
        />

        {/* Submit */}
        <Button
          onClick={handleAdd}
          disabled={amount <= 0}
          className="mt-4 h-12 w-full text-base font-semibold"
        >
          <Check size={18} className="mr-2" />
          Add Expense
        </Button>
      </SheetContent>
    </Sheet>
  );
}
