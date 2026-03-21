"use client";

import { useEffect, useRef, useState } from "react";
import { useBudgetStore, type Transaction } from "@/stores/budget-store";
import { CATEGORY_ICONS } from "@/lib/constants/categories";
import { FONT_STYLES } from "@/lib/constants/typography";
import { createClient } from "@/lib/supabase/client";
import { useToday } from "@/lib/hooks/use-today";
import { toLocalDateString } from "@/lib/utils";
import { Trash2 } from "lucide-react";

interface TransactionListProps {
  isWeekly: boolean;
}

export function TransactionList({ isWeekly }: TransactionListProps) {
  const { transactions } = useBudgetStore();
  const [activeSwipeId, setActiveSwipeId] = useState<string | null>(null);

  const { today, weekStart } = useToday();

  const filtered = transactions.filter((t) =>
    isWeekly ? t.transactionDate >= weekStart : t.transactionDate === today
  );

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;

      const insideRow =
        target instanceof Element &&
        target.closest("[data-transaction-row='true']");

      if (!insideRow) {
        setActiveSwipeId(null);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
    };
  }, []);

  if (!isWeekly) {
    if (filtered.length === 0) {
      return (
        <div className="flex items-center justify-center rounded-lg bg-surface-card px-4 py-3 opacity-55">
          <span className={`text-lg text-muted-foreground ${FONT_STYLES.transactionText}`}>
            No transactions today
          </span>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        {filtered.map((t) => (
          <TransactionRow
            key={t.id}
            transaction={t}
            open={activeSwipeId === t.id}
            setOpenId={setActiveSwipeId}
          />
        ))}
      </div>
    );
  }

  // Weekly: group by date, most recent first, with date captions
  const grouped = new Map<string, typeof filtered>();
  for (const t of filtered) {
    const list = grouped.get(t.transactionDate) || [];
    list.push(t);
    grouped.set(t.transactionDate, list);
  }

  // Build list of dates from today back to weekStart (descending)
  const dates: string[] = [];
  const d = new Date(today + "T00:00:00");
  const ws = new Date(weekStart + "T00:00:00");
  while (d >= ws) {
    dates.push(toLocalDateString(d));
    d.setDate(d.getDate() - 1);
  }

  function formatDateCaption(dateStr: string) {
    if (dateStr === today) return "Today";
    const date = new Date(dateStr + "T00:00:00");
    return date.toLocaleDateString("en-MY", { day: "numeric", month: "short" });
  }

  return (
    <div className="space-y-4">
      {dates.map((dateStr) => {
        const txns = grouped.get(dateStr);
        return (
          <div key={dateStr}>
            <p className={`mb-2 text-sm text-muted-foreground ${FONT_STYLES.bodyRegular}`}>
              {formatDateCaption(dateStr)}
            </p>
            {txns && txns.length > 0 ? (
              <div className="space-y-3">
                {txns.map((t) => (
                  <TransactionRow
                    key={t.id}
                    transaction={t}
                    open={activeSwipeId === t.id}
                    setOpenId={setActiveSwipeId}
                  />
                ))}
              </div>
            ) : (
              <div className="flex items-center justify-center rounded-lg bg-surface-card px-4 py-3 opacity-55">
                <span className={`text-lg text-muted-foreground ${FONT_STYLES.transactionText}`}>
                  No transactions
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TransactionRow({
  transaction,
  open,
  setOpenId,
}: {
  transaction: Transaction;
  open: boolean;
  setOpenId: (id: string | null) => void;
}) {
  const [dragOffset, setDragOffset] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const currentOffsetRef = useRef(0);
  const { removeTransaction } = useBudgetStore();
  const supabase = createClient();

  const time = transaction.transactionTime.slice(0, 5);
  const ampm =
    parseInt(time.split(":")[0]) >= 12 ? "PM" : "AM";
  const hour12 = parseInt(time.split(":")[0]) % 12 || 12;
  const displayTime = `${hour12}:${time.split(":")[1]} ${ampm}`;
  const revealWidth = 96;
  const resolvedOffset = dragOffset ?? (open ? -revealWidth : 0);

  useEffect(() => {
    currentOffsetRef.current = resolvedOffset;
  }, [resolvedOffset]);

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabase
      .from("transactions")
      .delete()
      .eq("id", transaction.id);

    if (!error) {
      removeTransaction(transaction.id);
      return;
    }

    setDeleting(false);
    setOpenId(null);
    setDragOffset(null);
  }

  function clampOffset(nextOffset: number) {
    return Math.max(-revealWidth, Math.min(0, nextOffset));
  }

  function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) {
    const startX = event.clientX;
    const startOffset = open ? -revealWidth : 0;
    if (!open) {
      setOpenId(null);
    }
    setDragging(true);
    setDragOffset(startOffset);
    currentOffsetRef.current = startOffset;

    const handleMove = (moveEvent: PointerEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const nextOffset = clampOffset(startOffset + deltaX);
      currentOffsetRef.current = nextOffset;
      setDragOffset(nextOffset);
    };

    const handleEnd = () => {
      setDragging(false);
      const currentOffset = currentOffsetRef.current;
      setOpenId(currentOffset <= -48 ? transaction.id : null);
      setDragOffset(null);
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleEnd);
      window.removeEventListener("pointercancel", handleEnd);
    };

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleEnd);
    window.addEventListener("pointercancel", handleEnd);
  }

  return (
    <div
      data-transaction-row="true"
      className="relative overflow-hidden rounded-lg bg-surface-card"
    >
      <div className="pointer-events-none absolute inset-0 rounded-lg bg-surface-card" />
      <div className="absolute bottom-px right-px top-px flex w-[92px] items-center justify-center rounded-r-md bg-accent-red">
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.stopPropagation();
            void handleDelete();
          }}
          disabled={deleting}
          className="flex h-full w-full cursor-pointer items-center justify-center text-white outline-none focus-visible:outline-none focus-visible:ring-0 disabled:opacity-60"
          style={{ WebkitTapHighlightColor: "transparent" }}
          aria-label="Delete transaction"
        >
          <Trash2 size={16} />
        </button>
      </div>

      <div
        onPointerDown={handlePointerDown}
        className={`flex cursor-pointer items-center justify-between rounded-lg bg-surface-card px-4 py-3 touch-pan-y select-none ${
          dragging ? "" : "transition-transform duration-200 ease-out"
        }`}
        style={{
          transform: `translateX(${resolvedOffset}px)`,
          boxShadow: "0 0 0 1px var(--color-surface-card)",
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
      >
        <div className="flex items-center gap-3">
          <span className="w-20 text-base text-muted-foreground">{displayTime}</span>
          <span className={`text-lg ${FONT_STYLES.transactionText}`}>
            {CATEGORY_ICONS[transaction.envelopeIcon] || ""}{" "}
            {transaction.envelopeName}
          </span>
        </div>
        <span className={`text-lg ${FONT_STYLES.transactionText}`}>
          RM {transaction.amount}
        </span>
      </div>
    </div>
  );
}
