"use client";

import { useState } from "react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Numpad, useNumpadAmount } from "@/components/shared/numpad";
import { useBudgetStore } from "@/stores/budget-store";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_ICONS } from "@/lib/constants/categories";
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
  const [loading, setLoading] = useState(false);
  const { handleInput, handleDelete } = useNumpadAmount();
  const supabase = createClient();

  const activeEnvelope = envelopes.find((e) => e.id === selectedEnvelope) || envelopes[0];
  const amount = parseFloat(amountStr) || 0;

  function reset() {
    setAmountStr("0");
    setDescription("");
    setSelectedEnvelope(null);
  }

  async function handleAdd() {
    if (amount <= 0 || !activeEnvelope) return;

    setLoading(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const now = new Date();
      const transactionDate = now.toISOString().split("T")[0];
      const transactionTime = now.toTimeString().split(" ")[0];
      const transactionId = crypto.randomUUID();

      const { error } = await supabase
        .from("transactions")
        .insert({
          id: transactionId,
          profile_id: user.id,
          envelope_id: activeEnvelope.id,
          amount,
          description: description || null,
          transaction_date: transactionDate,
          transaction_time: transactionTime,
        });

      if (!error) {
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
      }
    } finally {
      setLoading(false);
    }
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

        {/* Category picker */}
        <div className="mb-2 mt-3 grid grid-cols-5 gap-2">
          {envelopes.map((env) => (
            <button
              key={env.id}
              onClick={() => setSelectedEnvelope(env.id)}
              className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs transition-colors ${
                (selectedEnvelope || envelopes[0]?.id) === env.id
                  ? "bg-foreground text-background"
                  : "bg-surface-card"
              }`}
            >
              <span className="text-lg">{CATEGORY_ICONS[env.icon] || "📦"}</span>
              <span className="truncate">{env.name}</span>
            </button>
          ))}
        </div>

        {/* Description */}
        <Input
          placeholder="Add description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mb-4 bg-surface-card border-0 h-10"
        />

        {/* Numpad */}
        <Numpad
          onInput={(key) => setAmountStr((prev) => handleInput(prev, key))}
          onDelete={() => setAmountStr((prev) => handleDelete(prev))}
        />

        {/* Submit */}
        <Button
          onClick={handleAdd}
          disabled={amount <= 0 || loading}
          className="mt-4 h-12 w-full text-base font-semibold"
        >
          <Check size={18} className="mr-2" />
          {loading ? "Adding..." : "Add Expense"}
        </Button>
      </SheetContent>
    </Sheet>
  );
}
