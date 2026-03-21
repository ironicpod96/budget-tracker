import { useMemo } from "react";
import { useBudgetStore } from "@/stores/budget-store";
import { getCategoryBarColor } from "@/components/home/category-bars";
import { CATEGORY_ICONS } from "@/lib/constants/categories";

export interface CategoryState {
  id: string;
  name: string;
  icon: string;
  baseBudget: number;
  adjustedBudget: number;
  spent: number;
  remainingAmount: number;
  displayAmount: number;
  color: string;
}

export interface DonorTake extends CategoryState {
  take: number;
  after: number;
}

export function useSosComputation(isWeekly: boolean) {
  const {
    dailyBudget,
    weeklyBudget,
    envelopes,
    transactions,
    dailyAdjustments,
  } = useBudgetStore();

  const budget = isWeekly ? weeklyBudget : dailyBudget;

  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const weekStart = useMemo(() => {
    const d = new Date();
    const day = d.getDay();
    const diff = day === 0 ? 6 : day - 1;
    d.setDate(d.getDate() - diff);
    return d.toISOString().split("T")[0];
  }, []);

  const relevantTxns = useMemo(
    () =>
      transactions.filter((t) =>
        isWeekly ? t.transactionDate >= weekStart : t.transactionDate === today
      ),
    [transactions, isWeekly, weekStart, today]
  );

  const byEnvelope = useMemo(() => {
    const next: Record<string, number> = {};
    relevantTxns.forEach((t) => {
      next[t.envelopeId] = (next[t.envelopeId] || 0) + t.amount;
    });
    return next;
  }, [relevantTxns]);

  const categoryStates: CategoryState[] = useMemo(
    () =>
      envelopes
        .map((env) => {
          const baseBudget = Math.round(budget * (env.percentage / 100) * 100) / 100;
          const adjustedBudget = Math.max(
            0,
            Math.round((baseBudget + (dailyAdjustments[env.id] || 0)) * 100) / 100
          );
          const spent = byEnvelope[env.id] || 0;
          const remainingAmount = Math.round((adjustedBudget - spent) * 100) / 100;
          const color = getCategoryBarColor(remainingAmount, adjustedBudget);

          return {
            id: env.id,
            name: env.name,
            icon: CATEGORY_ICONS[env.icon] || "📦",
            baseBudget,
            adjustedBudget,
            spent,
            remainingAmount,
            displayAmount: Math.round(Math.abs(remainingAmount)),
            color,
          };
        })
        .sort((a, b) => a.remainingAmount - b.remainingAmount),
    [budget, byEnvelope, dailyAdjustments, envelopes]
  );

  const remaining = categoryStates.reduce(
    (sum, item) => sum + item.remainingAmount,
    0
  );
  const pct = budget > 0 ? Math.max(0, Math.min(1, remaining / budget)) : 1;

  const alertEnvelopes = useMemo(
    () =>
      categoryStates.filter(
        (item) =>
          item.color === "var(--accent-yellow)" ||
          item.color === "var(--accent-red)"
      ),
    [categoryStates]
  );

  const overspentCategories = categoryStates.filter((item) => item.remainingAmount < 0);
  const totalDebt = overspentCategories.reduce(
    (sum, item) => sum + Math.abs(item.remainingAmount),
    0
  );
  const totalDebtCents = Math.round(totalDebt * 100);

  const sosDonors = categoryStates.filter((item) => item.remainingAmount > 0);
  const donorCapacity = sosDonors.reduce(
    (sum, item) => sum + item.remainingAmount,
    0
  );

  const donorTakes: DonorTake[] = useMemo(() => {
    if (sosDonors.length === 0 || totalDebtCents <= 0) return [];

    const takes: Record<string, number> = {};
    let remainingCents = totalDebtCents;
    const capacities = sosDonors.map((d) => ({
      id: d.id,
      capacityCents: Math.round(d.remainingAmount * 100),
    }));

    while (remainingCents > 0) {
      const active = capacities.filter((d) => d.capacityCents > 0 && remainingCents > 0);
      if (active.length === 0) break;

      const share = Math.max(1, Math.floor(remainingCents / active.length));
      for (const d of active) {
        if (remainingCents <= 0) break;
        const take = Math.min(d.capacityCents, share, remainingCents);
        d.capacityCents -= take;
        remainingCents -= take;
        takes[d.id] = (takes[d.id] || 0) + take;
      }
    }

    return sosDonors.map((donor) => {
      const takeCents = takes[donor.id] || 0;
      const take = takeCents / 100;
      return {
        ...donor,
        take: Math.round(take * 100) / 100,
        after: Math.round((donor.remainingAmount - take) * 100) / 100,
      };
    });
  }, [sosDonors, totalDebtCents]);

  const totalFromDonors = donorTakes.reduce((sum, d) => sum + d.take, 0);
  const shortfall = Math.round(Math.max(0, totalDebt - totalFromDonors) * 100) / 100;
  const sosNeedsFuture = overspentCategories.length > 0 && donorCapacity <= 0;

  return {
    budget,
    categoryStates,
    remaining,
    pct,
    alertEnvelopes,
    byEnvelope,
    overspentCategories,
    totalDebt,
    sosDonors,
    donorCapacity,
    donorTakes,
    totalFromDonors,
    shortfall,
    sosNeedsFuture,
  };
}
