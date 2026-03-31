"use client";

import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Numpad, useNumpadAmount } from "@/components/shared/numpad";
import { useBudgetStore } from "@/stores/budget-store";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_ICONS } from "@/lib/constants/categories";
import { toLocalDateString } from "@/lib/utils";
import { Check } from "lucide-react";

interface AddPastExpenseSheetProps {
  open: boolean;
  onClose: () => void;
}

export function AddPastExpenseSheet({ open, onClose }: AddPastExpenseSheetProps) {
  const { envelopes, addTransaction } = useBudgetStore();
  const [selectedEnvelope, setSelectedEnvelope] = useState<string | null>(null);
  const [amountStr, setAmountStr] = useState("0");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => toLocalDateString(new Date()));
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const { handleInput, handleDelete } = useNumpadAmount();
  const supabase = createClient();

  const activeEnvelope = envelopes.find((e) => e.id === selectedEnvelope) || envelopes[0];
  const amount = parseFloat(amountStr) || 0;

  function reset() {
    setAmountStr("0");
    setDescription("");
    setSelectedEnvelope(null);
    setDate(toLocalDateString(new Date()));
    setTime(new Date().toTimeString().slice(0, 5));
  }

  function handleAdd() {
    if (amount <= 0 || !activeEnvelope) return;

    const transactionDate = date;
    const transactionTime = `${time}:00`;
    const transactionId = crypto.randomUUID();

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

    reset();
    onClose();

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
      <SheetContent side="bottom" className="h-[90vh] rounded-t-2xl bg-surface-bg border-0 px-6 pt-6 pb-8">
        {/* Amount display */}
        <div className="mt-4 mb-1">
          <div className="flex items-baseline gap-2">
            <span className="text-4xl text-muted-foreground font-normal">RM</span>
            <span className="text-6xl font-normal">{amountStr}</span>
          </div>
        </div>

        {/* Category picker */}
        <div className="relative mb-2 mt-3 -mx-6">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-6 bg-gradient-to-r from-surface-bg to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-6 bg-gradient-to-l from-surface-bg to-transparent" />
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-6">
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
        <Input
          placeholder="Add description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mb-3 bg-surface-card border-0 h-10"
        />

        {/* Date & Time */}
        <div className="mb-3 flex gap-2">
          <input
            type="date"
            value={date}
            max={toLocalDateString(new Date())}
            onChange={(e) => setDate(e.target.value)}
            className="flex-1 h-10 rounded-xl bg-surface-card px-3 text-sm text-foreground border-0 outline-none"
          />
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="w-32 h-10 rounded-xl bg-surface-card px-3 text-sm text-foreground border-0 outline-none"
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
