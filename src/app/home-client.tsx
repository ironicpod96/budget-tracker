"use client";

import { useEffect, useState } from "react";
import { useBudgetStore } from "@/stores/budget-store";
import { MainCard } from "@/components/home/main-card";
import { TransactionList } from "@/components/home/transaction-list";
import { AddExpenseSheet } from "@/components/sheets/add-expense-sheet";
import { ManageOverlay } from "@/components/manage/manage-overlay";
import { TopBar } from "@/components/shared/top-bar";
import { FONT_STYLES } from "@/lib/constants/typography";
import type {
  Profile,
  FixedExpense,
  SavingsTarget,
  Envelope,
  Transaction,
} from "@/stores/budget-store";
import { DollarSign, Plus, Settings } from "lucide-react";

interface InitialData {
  profile: Profile;
  fixedExpenses: FixedExpense[];
  savingsTarget: SavingsTarget | null;
  envelopes: Envelope[];
  transactions: Transaction[];
}

export function HomeClient({ initialData }: { initialData: InitialData }) {
  const [tab, setTab] = useState<"today" | "week">("today");
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const {
    setProfile,
    setFixedExpenses,
    setSavingsTarget,
    setEnvelopes,
    setTransactions,
  } = useBudgetStore();

  useEffect(() => {
    setProfile(initialData.profile);
    setFixedExpenses(initialData.fixedExpenses);
    if (initialData.savingsTarget) {
      setSavingsTarget(initialData.savingsTarget);
    }
    setEnvelopes(initialData.envelopes);
    setTransactions(initialData.transactions);
  }, [
    initialData,
    setProfile,
    setFixedExpenses,
    setSavingsTarget,
    setEnvelopes,
    setTransactions,
  ]);

  const needsSetup = initialData.profile.grossIncome === 0;

  return (
    <div className="flex flex-1 flex-col px-4 pt-6 pb-24 relative">
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
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-border bg-muted/40 transition-colors active:bg-muted/70"
          >
            <DollarSign size={18} />
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
          <MainCard isWeekly={tab === "week"} />

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
          onClick={() => setShowAddExpense(true)}
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
      {showManage && (
        <ManageOverlay
          open={showManage}
          onClose={() => setShowManage(false)}
        />
      )}
    </div>
  );
}
