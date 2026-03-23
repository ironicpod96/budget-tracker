"use client";

import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useBudgetStore } from "@/stores/budget-store";
import { useSosComputation } from "@/lib/hooks/use-sos-computation";
import { FONT_STYLES } from "@/lib/constants/typography";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { toLocalDateString } from "@/lib/utils";

interface SosSheetProps {
  open: boolean;
  onClose: () => void;
  isWeekly: boolean;
}

export function SosSheet({ open, onClose, isWeekly }: SosSheetProps) {
  const applyTrim = useBudgetStore((s) => s.applyTrim);
  const {
    budget,
    overspentCategories,
    donorTakes,
    shortfall,
  } = useSosComputation(isWeekly);

  function handleTrim() {
    applyTrim(donorTakes, overspentCategories);
    onClose();

    // Persist adjustments to Supabase (fire-and-forget)
    const adjustmentsAfterTrim = useBudgetStore.getState().dailyAdjustments;
    const today = toLocalDateString(new Date());
    const supabase = createClient();

    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) return;

      const rows = Object.entries(adjustmentsAfterTrim)
        .filter(([, amt]) => amt !== 0)
        .map(([envelopeId, amount]) => ({
          profile_id: user.id,
          envelope_id: envelopeId,
          adjustment_date: today,
          amount,
        }));

      if (rows.length === 0) return;

      const { error } = await supabase
        .from("envelope_adjustments")
        .upsert(rows, { onConflict: "profile_id,envelope_id,adjustment_date" });
      if (error) console.error("Failed to persist trim adjustments:", error.message);
    })();
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent
        side="bottom"
        className="h-auto rounded-t-2xl border-0 bg-surface-bg px-6 pt-6 pb-8"
      >
        {overspentCategories.length > 0 && (
          <div className="space-y-5">
            <h3 className={`text-2xl ${FONT_STYLES.displayValue}`}>You&apos;re overspending</h3>

            {/* Overspent categories */}
            <div className="space-y-3">
              {overspentCategories.map((item) => (
                <div key={item.id} className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-lg">
                    <span className="text-2xl leading-none">{item.icon}</span>
                    <span className="font-medium">{item.name}</span>
                  </span>
                  <span className="text-lg font-bold" style={{ color: "var(--accent-red)" }}>
                    -RM {item.displayAmount}
                  </span>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-surface-card p-4">
              {donorTakes.length > 0 && (
                <>
                  <p className="mb-3 text-base text-muted-foreground">
                    Trim from:
                  </p>
                  <div className="space-y-3">
                    {donorTakes.map((donor) => (
                      <div key={donor.id} className="flex items-center justify-between text-base">
                        <span className="flex items-center gap-2">
                          <span className="text-xl leading-none">{donor.icon}</span>
                          <span>{donor.name}</span>
                        </span>
                        <span className="flex items-center gap-1.5 font-bold text-muted-foreground">
                          RM {Math.round(donor.remainingAmount)}
                          <ArrowRight size={14} strokeWidth={2.5} />
                          RM {Math.round(donor.after)}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {shortfall > 0 && (
                <div className="mt-3 flex items-center justify-between text-base">
                  <span className="flex items-center gap-2">
                    <span className="text-xl leading-none">💸</span>
                    <span>Tomorrow&apos;s Cash</span>
                  </span>
                  <span className="flex items-center gap-1.5 font-bold text-muted-foreground">
                    RM {Math.round(budget)}
                    <ArrowRight size={14} strokeWidth={2.5} />
                    RM {Math.round(budget - shortfall)}
                  </span>
                </div>
              )}

              <Button
                type="button"
                onClick={handleTrim}
                className="mt-4 h-11 w-full bg-accent-yellow text-white hover:bg-accent-yellow/90"
              >
                Trim
              </Button>
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
