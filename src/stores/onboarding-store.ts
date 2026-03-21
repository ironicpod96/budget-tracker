import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface OnboardingFixedExpenseDraft {
  name: string;
  amount: string;
  icon: string;
}

export interface OnboardingCategoryDraft {
  name: string;
  icon: string;
  percentage: number;
}

interface OnboardingDraftState {
  incomeAmountStr: string;
  incomeShowBreakdown: boolean;
  fixedExpenses: OnboardingFixedExpenseDraft[];
  savingsMode: "percentage" | "amount";
  savingsValue: number;
  savingsComputedAmountOverride: number | null;
  variableCategories: OnboardingCategoryDraft[];
  variableDirty: boolean;
  setIncomeAmountStr: (value: string) => void;
  setIncomeShowBreakdown: (value: boolean) => void;
  setFixedExpenses: (expenses: OnboardingFixedExpenseDraft[]) => void;
  setSavingsDraft: (mode: "percentage" | "amount", value: number) => void;
  setSavingsComputedAmountOverride: (value: number | null) => void;
  setVariableCategories: (categories: OnboardingCategoryDraft[]) => void;
  setVariableDirty: (value: boolean) => void;
  resetOnboardingDrafts: () => void;
}

const initialState = {
  incomeAmountStr: "0",
  incomeShowBreakdown: false,
  fixedExpenses: [] as OnboardingFixedExpenseDraft[],
  savingsMode: "percentage" as const,
  savingsValue: 20,
  savingsComputedAmountOverride: null,
  variableCategories: [] as OnboardingCategoryDraft[],
  variableDirty: false,
};

export const useOnboardingStore = create<OnboardingDraftState>()(
  persist(
    (set) => ({
      ...initialState,
      setIncomeAmountStr: (incomeAmountStr) => set({ incomeAmountStr }),
      setIncomeShowBreakdown: (incomeShowBreakdown) =>
        set({ incomeShowBreakdown }),
      setFixedExpenses: (fixedExpenses) => set({ fixedExpenses }),
      setSavingsDraft: (savingsMode, savingsValue) =>
        set({ savingsMode, savingsValue, savingsComputedAmountOverride: null }),
      setSavingsComputedAmountOverride: (savingsComputedAmountOverride) =>
        set({ savingsComputedAmountOverride }),
      setVariableCategories: (variableCategories) => set({ variableCategories }),
      setVariableDirty: (variableDirty) => set({ variableDirty }),
      resetOnboardingDrafts: () => set(initialState),
    }),
    {
      name: "bajet-onboarding-drafts",
      storage: createJSONStorage(() => localStorage),
    }
  )
);
