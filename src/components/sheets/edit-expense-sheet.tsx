"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Numpad, useNumpadAmount } from "@/components/shared/numpad";
import { DescriptionPicker } from "@/components/shared/description-picker";
import { useBudgetStore, type Transaction } from "@/stores/budget-store";
import { createClient } from "@/lib/supabase/client";
import { CATEGORY_ICONS } from "@/lib/constants/categories";
import { toLocalDateString } from "@/lib/utils";
import { useHorizontalScroll } from "@/lib/hooks/use-horizontal-scroll";
import { Check } from "lucide-react";

interface EditExpenseSheetProps {
  transaction: Transaction | null;
  onClose: () => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function formatDisplayDate(d: Date) {
  return d.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
}

export function EditExpenseSheet({ transaction, onClose }: EditExpenseSheetProps) {
  const { envelopes, updateTransaction } = useBudgetStore();
  const [selectedEnvelope, setSelectedEnvelope] = useState<string | null>(null);
  const [amountStr, setAmountStr] = useState("0");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState<Date>(new Date());
  const [hour, setHour] = useState("00");
  const [minute, setMinute] = useState("00");
  const [showCal, setShowCal] = useState(false);
  const [showTime, setShowTime] = useState(false);
  const { handleInput, handleDelete } = useNumpadAmount();
  const { ref: categoryRef, onWheel: categoryWheel } = useHorizontalScroll();
  const supabase = createClient();

  const today = new Date();
  today.setHours(23, 59, 59, 999);

  // Populate from transaction whenever it changes
  useEffect(() => {
    if (!transaction) return;
    setSelectedEnvelope(transaction.envelopeId);
    setAmountStr(String(transaction.amount));
    setDescription(transaction.description ?? "");
    const [y, m, d] = transaction.transactionDate.split("-").map(Number);
    setDate(new Date(y, m - 1, d));
    setHour(transaction.transactionTime.slice(0, 2));
    setMinute(transaction.transactionTime.slice(3, 5));
    setShowCal(false);
    setShowTime(false);
  }, [transaction]);

  const activeEnvelope =
    envelopes.find((e) => e.id === selectedEnvelope) ||
    envelopes.find((e) => e.id === transaction?.envelopeId) ||
    envelopes[0];
  const amount = parseFloat(amountStr) || 0;

  function handleSave() {
    if (!transaction || amount <= 0 || !activeEnvelope) return;

    const updated: Transaction = {
      ...transaction,
      envelopeId: activeEnvelope.id,
      envelopeName: activeEnvelope.name,
      envelopeIcon: activeEnvelope.icon,
      amount,
      description: description || undefined,
      transactionDate: toLocalDateString(date),
      transactionTime: `${hour}:${minute}:00`,
    };

    updateTransaction(updated);
    onClose();

    (async () => {
      await supabase.from("transactions").update({
        envelope_id: activeEnvelope.id,
        amount,
        description: description || null,
        transaction_date: toLocalDateString(date),
        transaction_time: `${hour}:${minute}:00`,
      }).eq("id", transaction.id);
    })();
  }

  return (
    <Sheet open={!!transaction} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="h-[92vh] rounded-t-2xl bg-surface-bg border-0 px-6 pt-6 pb-8 overflow-y-auto">
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
          <div ref={categoryRef} onWheel={categoryWheel} className="no-scrollbar flex gap-2 overflow-x-auto px-6">
            {envelopes.map((env) => (
              <button
                key={env.id}
                onClick={() => setSelectedEnvelope(env.id)}
                className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeEnvelope?.id === env.id
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
        <div className="mb-3">
          <DescriptionPicker
            envelopeId={activeEnvelope?.id}
            value={description}
            onChange={setDescription}
          />
        </div>

        {/* Date / time row */}
        <div className="mb-3 flex gap-2">
          <button
            onClick={() => { setShowCal((v) => !v); setShowTime(false); }}
            className="flex-1 h-10 rounded-xl bg-surface-card px-3 text-sm text-left transition-colors"
          >
            {formatDisplayDate(date)}
          </button>
          <button
            onClick={() => { setShowTime((v) => !v); setShowCal(false); }}
            className="w-24 h-10 rounded-xl bg-surface-card px-3 text-sm text-center transition-colors"
          >
            {hour}:{minute}
          </button>
        </div>

        <AnimatePresence initial={false}>
          {showCal && (
            <motion.div
              key="cal"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="overflow-hidden mb-3"
            >
              <div className="flex justify-center rounded-2xl bg-surface-card py-2">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={(d) => { if (d) { setDate(d); setShowCal(false); } }}
                  disabled={(d) => d > today}
                  initialFocus
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence initial={false}>
          {showTime && (
            <motion.div
              key="time"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.3 }}
              className="overflow-hidden mb-3"
            >
              <div className="flex items-center gap-2 rounded-2xl bg-surface-card px-4 py-3">
                <select
                  value={hour}
                  onChange={(e) => setHour(e.target.value)}
                  className="flex-1 h-10 rounded-xl bg-background px-3 text-sm text-foreground border-0 outline-none text-center"
                >
                  {HOURS.map((h) => <option key={h} value={h}>{h}</option>)}
                </select>
                <span className="text-lg font-semibold text-muted-foreground">:</span>
                <select
                  value={minute}
                  onChange={(e) => setMinute(e.target.value)}
                  className="flex-1 h-10 rounded-xl bg-background px-3 text-sm text-foreground border-0 outline-none text-center"
                >
                  {MINUTES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <Numpad
          onInput={(key) => setAmountStr((prev) => handleInput(prev, key))}
          onDelete={() => setAmountStr((prev) => handleDelete(prev))}
        />

        <Button
          onClick={handleSave}
          disabled={amount <= 0}
          className="mt-4 h-12 w-full text-base font-semibold"
        >
          <Check size={18} className="mr-2" />
          Save Changes
        </Button>
      </SheetContent>
    </Sheet>
  );
}
