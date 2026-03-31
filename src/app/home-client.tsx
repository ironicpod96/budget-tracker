"use client";

import { useEffect, useState } from "react";
import { useBudgetStore } from "@/stores/budget-store";
import { MainCard } from "@/components/home/main-card";
import { TransactionList } from "@/components/home/transaction-list";
import { AddExpenseSheet } from "@/components/sheets/add-expense-sheet";
import { AddPastExpenseSheet } from "@/components/sheets/add-past-expense-sheet";
import { ManageOverlay } from "@/components/manage/manage-overlay";
import { TopBar } from "@/components/shared/top-bar";
import { useToday } from "@/lib/hooks/use-today";
import { FONT_STYLES } from "@/lib/constants/typography";
import type {
  Profile,
  FixedExpense,
  SavingsTarget,
  Envelope,
  Transaction,
} from "@/stores/budget-store";
import { Plus, Settings } from "lucide-react";
import { WeeklySurplusCard } from "@/components/home/weekly-surplus-card";
import { SosSheet } from "@/components/sheets/sos-sheet";

interface InitialData {
  profile: Profile;
  fixedExpenses: FixedExpense[];
  savingsTarget: SavingsTarget | null;
  envelopes: Envelope[];
  transactions: Transaction[];
}

export function HomeClient({
  initialData,
  lastSavingsTransferDate,
  initialAdjustments,
}: {
  initialData: InitialData;
  lastSavingsTransferDate: string | null;
  initialAdjustments: Record<string, number>;
}) {
  const [tab, setTab] = useState<"today" | "week">("today");
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showAddPastExpense, setShowAddPastExpense] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [showSos, setShowSos] = useState(false);
  const {
    setProfile,
    setFixedExpenses,
    setSavingsTarget,
    setEnvelopes,
    setTransactions,
    setDailyAdjustments,
    dailyBudget,
    transactions,
    sosPending,
    setSosPending,
  } = useBudgetStore();

  // Auto-open SOS sheet after expense sheet closes when overspend detected
  useEffect(() => {
    if (sosPending && !showAddExpense) {
      const timer = setTimeout(() => {
        setShowSos(true);
        setSosPending(false);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [sosPending, showAddExpense, setSosPending]);

  useEffect(() => {
    setProfile(initialData.profile);
    setFixedExpenses(initialData.fixedExpenses);
    if (initialData.savingsTarget) {
      setSavingsTarget(initialData.savingsTarget);
    }
    setEnvelopes(initialData.envelopes);
    setTransactions(initialData.transactions);
    setDailyAdjustments(initialAdjustments);
  }, [
    initialData,
    initialAdjustments,
    setProfile,
    setFixedExpenses,
    setSavingsTarget,
    setEnvelopes,
    setTransactions,
    setDailyAdjustments,
  ]);

  const needsSetup = initialData.profile.grossIncome === 0;

  const { today } = useToday();

  // Savings accumulate from past completed days (after last transfer) that had real activity
  const cutoff = lastSavingsTransferDate
    ? lastSavingsTransferDate.split("T")[0]
    : null;
  const pastDayDates = new Set(
    transactions
      .filter(
        (t) =>
          t.transactionDate < today &&
          (!cutoff || t.transactionDate > cutoff)
      )
      .map((t) => t.transactionDate)
  );
  let surplus = 0;
  for (const date of pastDayDates) {
    const daySpent = transactions
      .filter((t) => t.transactionDate === date)
      .reduce((sum, t) => sum + t.amount, 0);
    surplus += Math.max(0, dailyBudget - daySpent);
  }
  const accumulatedSavings = Math.round(surplus * 100) / 100;

  return (
    <div className={`flex flex-col px-4 pt-6 pb-24 relative${needsSetup ? " flex-1" : ""}`}>
      <TopBar
        title={
          <div className="flex items-baseline gap-3">
            <button
              onClick={() => setTab("today")}
              className={`cursor-pointer text-4xl ${FONT_STYLES.displayTitle} transition-colors ${
                tab === "today" ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setTab("week")}
              className={`cursor-pointer text-4xl ${FONT_STYLES.displayTitle} transition-colors ${
                tab === "week" ? "text-foreground" : "text-muted-foreground"
              }`}
            >
              This Week
            </button>
          </div>
        }
        trailing={
          <button
            onClick={() => setShowManage(true)}
            className="flex h-10 w-10 cursor-pointer items-center justify-center text-muted-foreground transition-colors active:text-foreground"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24">
              <path fill="currentColor" d="M15.999 8.5h2c0-2.837-2.755-4.131-5-4.429V2h-2v2.071c-2.245.298-5 1.592-5 4.429c0 2.706 2.666 4.113 5 4.43v4.97c-1.448-.251-3-1.024-3-2.4h-2c0 2.589 2.425 4.119 5 4.436V22h2v-2.07c2.245-.298 5-1.593 5-4.43s-2.755-4.131-5-4.429V6.1c1.33.239 3 .941 3 2.4m-8 0c0-1.459 1.67-2.161 3-2.4v4.799c-1.371-.253-3-1.002-3-2.399m8 7c0 1.459-1.67 2.161-3 2.4v-4.8c1.33.239 3 .941 3 2.4" />
            </svg>
          </button>
        }
      />

      {needsSetup ? (
        /* Empty state — user skipped onboarding */
          <div className="flex flex-1 flex-col items-center justify-center text-center px-6">
            <div className="rounded-2xl bg-surface-card p-8 w-full">
              <h2 className={`mb-2 text-2xl ${FONT_STYLES.displayValue}`}>Welcome to Bajet</h2>
              <p className="text-muted-foreground mb-6">
                Set up your income and budget to start tracking your spending.
              </p>
            <button
              onClick={() => setShowManage(true)}
              className="flex h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-xl bg-foreground text-background font-semibold"
            >
              <Settings size={18} />
              Set Up Budget
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Main card */}
          <MainCard isWeekly={tab === "week"} onRequestSos={() => setShowSos(true)} weeklySurplus={accumulatedSavings} />

          {/* Transactions */}
          <div className="mt-6">
            <h2 className={`mb-3 text-lg ${FONT_STYLES.bodyStrong}`}>Transactions</h2>
            <TransactionList isWeekly={tab === "week"} />
          </div>
        </>
      )}

      {/* FAB — only show when budget is set up */}
      {!needsSetup && (
        <button
          onClick={() => tab === "week" ? setShowAddPastExpense(true) : setShowAddExpense(true)}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 flex h-[72px] w-[72px] cursor-pointer items-center justify-center rounded-full bg-white text-black shadow-lg"
        >
          <Plus size={34} strokeWidth={3} />
        </button>
      )}

      {/* Sheets & Overlays */}
      <AddExpenseSheet
        open={showAddExpense}
        onClose={() => setShowAddExpense(false)}
      />
      <AddPastExpenseSheet
        open={showAddPastExpense}
        onClose={() => setShowAddPastExpense(false)}
      />
      {showManage && (
        <ManageOverlay
          open={showManage}
          onClose={() => setShowManage(false)}
        />
      )}
      <SosSheet
        open={showSos}
        onClose={() => setShowSos(false)}
        isWeekly={tab === "week"}
      />
    </div>
  );
}
