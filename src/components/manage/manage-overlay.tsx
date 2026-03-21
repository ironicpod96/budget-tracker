"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useBudgetStore } from "@/stores/budget-store";
import { TopBar } from "@/components/shared/top-bar";
import { ExpandToggleIcon } from "@/components/shared/expand-toggle-icon";
import { CurrencyInput } from "@/components/shared/currency-input";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRM } from "@/components/shared/amount-display";
import { FONT_STYLES } from "@/lib/constants/typography";
import { parseCurrencyInput } from "@/lib/currency";
import { calcAllDeductions } from "@/lib/calculations/deductions";
import { calcTakeHome, calcVariablePool } from "@/lib/calculations/budget";
import {
  CATEGORY_ICONS,
  DEFAULT_CATEGORIES,
  FIXED_EXPENSE_SUGGESTIONS,
  getSuggestedPercentages,
} from "@/lib/constants/categories";
import { X, RotateCcw, LogOut, Plus, Minus, TriangleAlert } from "lucide-react";

interface ManageOverlayProps {
  open: boolean;
  onClose: () => void;
}

interface ExpenseDraft {
  id?: string;
  name: string;
  amount: string;
  icon: string;
}

interface EnvelopeDraft {
  id?: string;
  name: string;
  icon: string;
  percentage: number;
}

interface ExpandableRowProps {
  label: string;
  value: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

function ExpandableRow({
  label,
  value,
  open,
  onToggle,
  children,
}: ExpandableRowProps) {
  return (
    <div className="border-t border-border py-3">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "group flex w-full items-center justify-between gap-3 text-left",
          open ? "text-white" : "text-muted-foreground hover:text-white"
        )}
      >
        <span
          className={`flex items-center gap-0.5 text-base ${FONT_STYLES.bodyStrong}`}
        >
          <ExpandToggleIcon open={open} size={32} className="-ml-2" />
          <span>{label}</span>
        </span>
        <span
          className={cn(
            "text-base font-medium",
            open ? "text-white" : "text-muted-foreground group-hover:text-white"
          )}
        >
          {value}
        </span>
      </button>

      {open && <div className="pb-4 pt-4">{children}</div>}
    </div>
  );
}

export function ManageOverlay({ open, onClose }: ManageOverlayProps) {
  const {
    profile,
    deductions,
    takeHome,
    fixedExpensesTotal,
    fixedExpenses,
    savingsTarget,
    variablePool,
    envelopes,
    setProfile,
    setFixedExpenses,
    setSavingsTarget,
    setEnvelopes,
  } = useBudgetStore();
  const router = useRouter();
  const supabase = createClient();

  const [manageTab, setManageTab] = useState<"manage" | "more">("manage");
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [nameDraft, setNameDraft] = useState(() => profile?.name || "");
  const [incomeDraft, setIncomeDraft] = useState(() =>
    String(profile?.grossIncome || 0)
  );
  const [epfDraft, setEpfDraft] = useState(() => String(profile?.epfRate || 11));
  const [fixedExpenseDrafts, setFixedExpenseDrafts] = useState<ExpenseDraft[]>(
    () =>
      fixedExpenses.map((expense) => ({
        id: expense.id,
        name: expense.name,
        amount: String(expense.amount),
        icon: expense.icon || "📝",
      }))
  );
  const [savingsMode, setSavingsMode] = useState<"percentage" | "amount">(() =>
    savingsTarget?.mode || "percentage"
  );
  const [savingsValue, setSavingsValue] = useState(() => savingsTarget?.value || 0);
  const [variableDrafts, setVariableDrafts] = useState<EnvelopeDraft[]>(() =>
    (envelopes.length > 0 ? envelopes : DEFAULT_CATEGORIES).map((item, index) => ({
      id: "id" in item ? item.id : undefined,
      name: item.name,
      icon: item.icon,
      percentage:
        "percentage" in item
          ? item.percentage
          : DEFAULT_CATEGORIES[index]?.defaultPercentage || 0,
    }))
  );
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [editingSection, setEditingSection] = useState<string | null>(null);
  const [resolution, setResolution] = useState<null | "put_back" | "use_savings">(
    null
  );

  const grossIncome = parseFloat(incomeDraft) || 0;
  const epfRate = parseFloat(epfDraft) || 0;
  const draftDeductions = calcAllDeductions(grossIncome, epfRate);
  const draftTakeHome = calcTakeHome(grossIncome, draftDeductions.total);
  const fixedDraftTotal = fixedExpenseDrafts.reduce(
    (sum, expense) => sum + (parseFloat(expense.amount) || 0),
    0
  );
  const draftSavingsAmount =
    savingsMode === "percentage"
      ? Math.round(draftTakeHome * (savingsValue / 100) * 100) / 100
      : savingsValue;
  const draftVariablePool = calcVariablePool(
    draftTakeHome,
    fixedDraftTotal,
    draftSavingsAmount
  );
  const totalVariablePct = variableDrafts.reduce(
    (sum, envelope) => sum + envelope.percentage,
    0
  );
  const isUnderAllocated = totalVariablePct < 100;
  const differencePct = Math.abs(100 - totalVariablePct);
  const differenceAmount = Math.round(
    Math.abs(draftVariablePool) * (differencePct / 100)
  );
  const needsRemainderChoice = totalVariablePct !== 100;
  const variablePoolDelta = Math.round((draftVariablePool - variablePool) * 100) / 100;
  const variablePoolWarning = variablePoolDelta < 0;
  const protectedIndexes = new Set(
    variableDrafts
      .map((envelope, index) =>
        envelope.percentage > (envelopes[index]?.percentage ?? 0) ? index : -1
      )
      .filter((index) => index >= 0)
  );
  const trimmableVariablePct = variableDrafts.reduce(
    (sum, envelope, index) =>
      protectedIndexes.has(index) ? sum : sum + envelope.percentage,
    0
  );
  const trimmableVariableAmount = Math.round(
    Math.abs(draftVariablePool) * (trimmableVariablePct / 100)
  );
  const remainingAfterTrimAmount = Math.max(
    0,
    differenceAmount - trimmableVariableAmount
  );
  const canTrimOthers =
    totalVariablePct > 100 &&
    trimmableVariablePct > 0 &&
    remainingAfterTrimAmount === 0;
  const canUseSavings =
    totalVariablePct > 100 &&
    remainingAfterTrimAmount <= Math.round(draftSavingsAmount);

  function formatManageRM(amount: number) {
    return formatRM(Math.round(amount));
  }

  function getMonthlyAllocation(
    percentage: number,
    pool: number,
    fallback = 0
  ) {
    const computed = Math.round(pool * (percentage / 100) * 100) / 100;
    return Math.abs(computed) > 0.01 ? computed : fallback;
  }

  if (!open || !profile) return null;
  const currentProfile = profile;

  function resetProfileDraft() {
    setNameDraft(currentProfile.name || "");
    setIncomeDraft(String(currentProfile.grossIncome || 0));
    setEpfDraft(String(currentProfile.epfRate || 11));
  }

  function resetFixedDraft() {
    setFixedExpenseDrafts(
      fixedExpenses.map((expense) => ({
        id: expense.id,
        name: expense.name,
        amount: String(expense.amount),
        icon: expense.icon || "📝",
      }))
    );
  }

  function resetSavingsDraft() {
    setSavingsMode(savingsTarget?.mode || "percentage");
    setSavingsValue(savingsTarget?.value || 0);
  }

  function resetVariableDraft() {
    setVariableDrafts(
      (envelopes.length > 0 ? envelopes : DEFAULT_CATEGORIES).map((item, index) => ({
        id: "id" in item ? item.id : undefined,
        name: item.name,
        icon: item.icon,
        percentage:
          "percentage" in item
            ? item.percentage
            : DEFAULT_CATEGORIES[index]?.defaultPercentage || 0,
      }))
    );
    setResolution(null);
  }

  function resetSectionDraft(section: string) {
    if (section === "profile") resetProfileDraft();
    if (section === "fixed") resetFixedDraft();
    if (section === "savings") resetSavingsDraft();
    if (section === "variable") resetVariableDraft();
  }

  function toggleEditing(section: string) {
    setEditingSection((current) => {
      if (current === section) {
        resetSectionDraft(section);
        return null;
      }

      resetSectionDraft(section);
      return section;
    });
  }

  function toggleSection(section: string) {
    setExpandedSection((current) => current === section ? null : section);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.refresh();
  }

  async function handleReset() {
    await supabase
      .from("profiles")
      .update({ onboarding_complete: false })
      .eq("id", currentProfile.id);
    router.push("/onboarding/income");
    onClose();
  }

  async function saveProfileSection() {
    setLoadingKey("profile");

    const nextName = nameDraft.trim() || currentProfile.name;

    await supabase
      .from("profiles")
      .update({
        name: nextName,
        gross_income: grossIncome,
        epf_rate: epfRate,
      })
      .eq("id", currentProfile.id);

    await supabase.from("monthly_deductions").upsert(
      {
        profile_id: currentProfile.id,
        epf_amount: draftDeductions.epf,
        socso_amount: draftDeductions.socso,
        eis_amount: draftDeductions.eis,
        pcb_amount: draftDeductions.pcb,
      },
      { onConflict: "profile_id" }
    );

    if (savingsTarget?.mode === "percentage") {
      const recomputedSavingsAmount =
        Math.round(draftTakeHome * (savingsTarget.value / 100) * 100) / 100;

      await supabase.from("savings_target").upsert(
        {
          profile_id: currentProfile.id,
          mode: savingsTarget.mode,
          value: savingsTarget.value,
          computed_amount: recomputedSavingsAmount,
        },
        { onConflict: "profile_id" }
      );

      setSavingsTarget({
        ...savingsTarget,
        computedAmount: recomputedSavingsAmount,
      });
    }

    setProfile({
      ...currentProfile,
      name: nextName,
      grossIncome,
      epfRate,
    });
    setLoadingKey(null);
    setEditingSection(null);
  }

  async function saveFixedExpenses() {
    setLoadingKey("fixed");

    const validExpenses = fixedExpenseDrafts.filter(
      (expense) => expense.name.trim() && parseFloat(expense.amount) > 0
    );

    await supabase.from("fixed_expenses").delete().eq("profile_id", currentProfile.id);

    if (validExpenses.length > 0) {
      await supabase.from("fixed_expenses").insert(
        validExpenses.map((expense) => ({
          profile_id: currentProfile.id,
          name: expense.name.trim(),
          amount: parseFloat(expense.amount),
          icon: expense.icon,
        }))
      );
    }

    setFixedExpenses(
      validExpenses.map((expense, index) => ({
        id: expense.id || `draft-fixed-${index}`,
        name: expense.name.trim(),
        amount: parseFloat(expense.amount),
        icon: expense.icon,
      }))
    );
    setLoadingKey(null);
    setEditingSection(null);
    setExpandedSection(null);
  }

  async function saveVariableExpenses() {
    setLoadingKey("variable");

    const nextEnvelopes = variableDrafts.map((envelope, index) => ({
      id: envelope.id || `draft-envelope-${index}`,
      name: envelope.name,
      icon: envelope.icon,
      percentage: envelope.percentage,
      monthlyBudget: getMonthlyAllocation(
        envelope.percentage,
        draftVariablePool,
        envelopes[index]?.monthlyBudget ?? 0
      ),
      sortOrder: index,
    }));

    if (totalVariablePct < 100 && resolution === "put_back") {
      const remainderAmount =
        Math.round(draftVariablePool * ((100 - totalVariablePct) / 100) * 100) / 100;
      const newComputed = (savingsTarget?.computedAmount || 0) + remainderAmount;

      await supabase.from("savings_target").upsert(
        {
          profile_id: currentProfile.id,
          mode: "amount",
          value: newComputed,
          computed_amount: newComputed,
        },
        { onConflict: "profile_id" }
      );

      setSavingsTarget({
        id: savingsTarget?.id || "draft-savings",
        mode: "amount",
        value: newComputed,
        computedAmount: newComputed,
      });
    }

    if (totalVariablePct > 100 && resolution === "use_savings") {
      const shortageAmount =
        Math.round(draftVariablePool * ((totalVariablePct - 100) / 100) * 100) / 100;
      const newComputed = Math.max(
        0,
        (savingsTarget?.computedAmount || 0) - shortageAmount
      );

      await supabase.from("savings_target").upsert(
        {
          profile_id: currentProfile.id,
          mode: "amount",
          value: newComputed,
          computed_amount: newComputed,
        },
        { onConflict: "profile_id" }
      );

      setSavingsTarget({
        id: savingsTarget?.id || "draft-savings",
        mode: "amount",
        value: newComputed,
        computedAmount: newComputed,
      });
    }

    await supabase.from("envelopes").delete().eq("profile_id", currentProfile.id);
    await supabase.from("envelopes").insert(
      nextEnvelopes.map((envelope) => ({
        profile_id: currentProfile.id,
        name: envelope.name,
        icon: envelope.icon,
        percentage: envelope.percentage,
        monthly_budget: envelope.monthlyBudget,
        sort_order: envelope.sortOrder,
      }))
    );

    setEnvelopes(nextEnvelopes);
    setLoadingKey(null);
    setEditingSection(null);
    setExpandedSection(null);
    setResolution(null);
  }

  function addFixedExpense(name = "", icon = "📝") {
    setFixedExpenseDrafts((current) => [...current, { name, amount: "", icon }]);
  }

  function updateFixedExpense(
    index: number,
    field: "name" | "amount" | "icon",
    value: string
  ) {
    setFixedExpenseDrafts((current) => {
      const next = [...current];
      next[index] = { ...next[index], [field]: value };
      return next;
    });
  }

  function removeFixedExpense(index: number) {
    setFixedExpenseDrafts((current) => current.filter((_, i) => i !== index));
  }

  function updateVariablePercentage(index: number, percentage: number) {
    setVariableDrafts((current) => {
      const next = [...current];
      next[index] = {
        ...next[index],
        percentage: Math.max(0, Math.min(100, percentage)),
      };
      return next;
    });
    setResolution(null);
  }

  function autofillVariableCategories() {
    const suggested = getSuggestedPercentages(grossIncome);
    setVariableDrafts(
      DEFAULT_CATEGORIES.map((category) => ({
        name: category.name,
        icon: category.icon,
        percentage: suggested[category.name] || category.defaultPercentage,
      }))
    );
    setResolution(null);
  }

  async function applySavingsDraft(
    nextMode: "percentage" | "amount",
    nextValue: number
  ) {
    const normalizedValue = Math.max(0, nextValue);
    const computedAmount =
      nextMode === "percentage"
        ? Math.round(draftTakeHome * (normalizedValue / 100) * 100) / 100
        : normalizedValue;

    setSavingsMode(nextMode);
    setSavingsValue(normalizedValue);

    const nextTarget = {
      id: savingsTarget?.id || "draft-savings",
      mode: nextMode,
      value: normalizedValue,
      computedAmount,
    } as const;

    setSavingsTarget(nextTarget);

    await supabase.from("savings_target").upsert(
      {
        profile_id: currentProfile.id,
        mode: nextMode,
        value: normalizedValue,
        computed_amount: computedAmount,
      },
      { onConflict: "profile_id" }
    );
  }

  function adjustCategoriesEvenly(targetTotal: number) {
    const adjusted = variableDrafts.map((category) => ({ ...category }));
    let currentTotal = adjusted.reduce(
      (sum, category) => sum + category.percentage,
      0
    );

    while (currentTotal !== targetTotal) {
      const activeIndexes = adjusted
        .map((category, index) => ({ category, index }))
        .filter(({ category }) =>
          currentTotal < targetTotal ? true : category.percentage > 0
        )
        .map(({ index }) => index);

      if (activeIndexes.length === 0) break;

      for (const index of activeIndexes) {
        if (currentTotal === targetTotal) break;

        if (currentTotal < targetTotal) {
          adjusted[index].percentage += 1;
          currentTotal += 1;
        } else if (adjusted[index].percentage > 0) {
          adjusted[index].percentage -= 1;
          currentTotal -= 1;
        }
      }
    }

    setVariableDrafts(adjusted);
    setResolution(null);
  }

  function trimOthers() {
    const adjusted = variableDrafts.map((envelope) => ({ ...envelope }));
    let currentTotal = adjusted.reduce(
      (sum, envelope) => sum + envelope.percentage,
      0
    );

    while (currentTotal > 100) {
      const activeIndexes = adjusted
        .map((envelope, index) => ({ envelope, index }))
        .filter(
          ({ envelope, index }) =>
            !protectedIndexes.has(index) && envelope.percentage > 0
        )
        .map(({ index }) => index);

      if (activeIndexes.length === 0) break;

      for (const index of activeIndexes) {
        if (currentTotal <= 100) break;
        if (adjusted[index].percentage > 0) {
          adjusted[index].percentage -= 1;
          currentTotal -= 1;
        }
      }
    }

    setVariableDrafts(adjusted);
    setResolution(null);
  }

  const unusedSuggestions = FIXED_EXPENSE_SUGGESTIONS.filter(
    (suggestion) =>
      !fixedExpenseDrafts.some((expense) => expense.name === suggestion.name)
  );

  return (
    <div className="fixed inset-0 z-50 bg-surface-bg">
      <div className="absolute inset-y-0 left-1/2 w-full -translate-x-1/2 overflow-y-auto">
        <div className="mx-auto w-full max-w-[430px] px-4 pb-8 pt-6">
          <TopBar
            title={
              <div className="flex items-baseline gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setManageTab("manage");
                  }}
                  className={`cursor-pointer text-4xl ${FONT_STYLES.displayTitle} transition-colors ${
                    manageTab === "manage" ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  Manage
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setManageTab("more");
                    setExpandedSection(null);
                    setEditingSection(null);
                  }}
                  className={`cursor-pointer text-4xl ${FONT_STYLES.displayTitle} transition-colors ${
                    manageTab === "more" ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  More
                </button>
              </div>
            }
            trailing={
              <button
                onClick={onClose}
                className="rounded-full p-2 text-muted-foreground hover:text-white"
              >
                <X size={24} />
              </button>
            }
          />

          {manageTab === "manage" ? (
            <>
              <div className="mb-4 rounded-2xl bg-surface-card p-5">
                <div className="mb-4 flex items-center justify-between gap-3">
                  {editingSection === "profile" ? (
                    <Input
                      value={nameDraft}
                      onChange={(e) => setNameDraft(e.target.value)}
                      className="h-10 flex-1 bg-background text-xl"
                      placeholder="Name"
                    />
                  ) : (
                    <h2 className={`text-xl ${FONT_STYLES.bodyStrong}`}>
                      {currentProfile.name}
                    </h2>
                  )}
                  <button
                    type="button"
                    onClick={() => toggleEditing("profile")}
                    className="text-sm text-muted-foreground hover:text-white"
                  >
                    {editingSection === "profile" ? "Cancel" : "Edit"}
                  </button>
                </div>

                <div className="border-t border-border py-3">
                  {editingSection === "profile" ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="mb-2 text-xs text-muted-foreground">
                          Monthly Income
                        </p>
                        <CurrencyInput
                          value={incomeDraft}
                          onChange={setIncomeDraft}
                        />
                      </div>
                      <div>
                        <p className="mb-2 text-xs text-muted-foreground">
                          EPF Contribution
                        </p>
                        <div className="relative">
                          <Input
                            inputMode="decimal"
                            value={epfDraft}
                            onChange={(e) =>
                              setEpfDraft(parseCurrencyInput(e.target.value))
                            }
                            className="h-11 bg-background pr-8"
                          />
                          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                            %
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Monthly Income</p>
                        <p className={`text-xl ${FONT_STYLES.displayValue}`}>
                          {formatManageRM(currentProfile.grossIncome)}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">EPF Contribution</p>
                        <p className={`text-xl ${FONT_STYLES.displayValue}`}>
                          {currentProfile.epfRate}%
                        </p>
                      </div>
                    </div>
                  )}
                </div>

                {editingSection === "profile" && (
                  <Button
                    onClick={saveProfileSection}
                    disabled={loadingKey === "profile"}
                    className="h-11 w-full"
                  >
                    {loadingKey === "profile" ? "Saving..." : "Save Changes"}
                  </Button>
                )}

                <ExpandableRow
                  label="Monthly Deductions"
                  value={formatManageRM(deductions?.total ?? draftDeductions.total)}
                  open={expandedSection === "deductions"}
                  onToggle={() => toggleSection("deductions")}
                >
                  <div className="space-y-2 rounded-xl bg-background p-4 text-sm">
                    <div className="flex justify-between">
                      <span>EPF</span>
                      <span>{formatManageRM(draftDeductions.epf)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>SOCSO</span>
                      <span>{formatManageRM(draftDeductions.socso)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>EIS</span>
                      <span>{formatManageRM(draftDeductions.eis)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>PCB</span>
                      <span>{formatManageRM(draftDeductions.pcb)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-2 font-medium">
                      <span>Total</span>
                      <span>{formatManageRM(draftDeductions.total)}</span>
                    </div>
                  </div>
                </ExpandableRow>
              </div>

              <div className="mb-4 rounded-2xl bg-surface-card p-5">
                <div className="mb-4 flex items-center justify-between">
                  <h2 className={`text-xl ${FONT_STYLES.bodyStrong}`}>Take-Home</h2>
                  <span className={`text-xl ${FONT_STYLES.displayValue}`}>
                    {formatManageRM(takeHome)}
                  </span>
                </div>

                <ExpandableRow
                  label="Fixed Expenses"
                  value={formatManageRM(fixedExpensesTotal)}
                  open={expandedSection === "fixed"}
                  onToggle={() => toggleSection("fixed")}
                >
                  <div className="space-y-4">
                    {editingSection === "fixed" ? (
                      <>
                        <div className="space-y-3">
                          {fixedExpenseDrafts.map((expense, index) => (
                            <div
                              key={`${expense.name}-${index}`}
                              className="flex items-center gap-2"
                            >
                              <Input
                                value={expense.icon}
                                onChange={(e) =>
                                  updateFixedExpense(index, "icon", e.target.value)
                                }
                                maxLength={2}
                                className="h-10 w-12 bg-background px-0 text-center text-xl"
                                aria-label="Expense emoji"
                              />
                              <Input
                                value={expense.name}
                                onChange={(e) =>
                                  updateFixedExpense(index, "name", e.target.value)
                                }
                                placeholder="Name"
                                className="h-10 flex-1 bg-background"
                              />
                              <CurrencyInput
                                value={expense.amount}
                                onChange={(value) =>
                                  updateFixedExpense(index, "amount", value)
                                }
                                className="w-32"
                              />
                              <button
                                type="button"
                                onClick={() => removeFixedExpense(index)}
                                className="text-sm text-muted-foreground hover:text-white"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>

                        <div className="flex flex-wrap gap-2">
                          {unusedSuggestions.map((suggestion) => (
                            <button
                              key={suggestion.name}
                              type="button"
                              onClick={() =>
                                addFixedExpense(suggestion.name, suggestion.icon)
                              }
                              className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted"
                            >
                              <span>{suggestion.icon}</span> {suggestion.name}
                            </button>
                          ))}
                          <button
                            type="button"
                            onClick={() => addFixedExpense()}
                            className="flex items-center gap-1 rounded-full border border-border px-3 py-1.5 text-sm hover:bg-muted"
                          >
                            <Plus size={14} /> Add
                          </button>
                        </div>

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleEditing("fixed")}
                            className="text-sm text-muted-foreground hover:text-white"
                          >
                            Cancel
                          </button>
                          <Button
                            onClick={saveFixedExpenses}
                            disabled={loadingKey === "fixed"}
                            className="h-11 flex-1"
                          >
                            {loadingKey === "fixed" ? "Saving..." : "Save Fixed Expenses"}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2 rounded-xl bg-background p-4 text-sm">
                          {fixedExpenses.length > 0 ? (
                            fixedExpenses.map((expense) => (
                              <div
                                key={expense.id}
                                className="flex items-center justify-between"
                              >
                                <span>
                                  {expense.icon || "📝"} {expense.name}
                                </span>
                                <span>{formatManageRM(expense.amount)}</span>
                              </div>
                            ))
                          ) : (
                            <p className="text-muted-foreground">No fixed expenses yet</p>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleEditing("fixed")}
                          className="text-sm text-muted-foreground hover:text-white"
                        >
                          Edit
                        </button>
                      </>
                    )}
                  </div>
                </ExpandableRow>

                <ExpandableRow
                  label={`Savings Target${savingsTarget?.mode === "percentage" ? ` · ${savingsTarget.value}%` : ""}`}
                  value={formatManageRM(savingsTarget?.computedAmount ?? 0)}
                  open={expandedSection === "savings"}
                  onToggle={() => toggleSection("savings")}
                >
                  <div className="space-y-4">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-4">
                        <button
                          type="button"
                          onClick={() =>
                            applySavingsDraft(
                              savingsMode,
                              savingsValue - (savingsMode === "percentage" ? 1 : 50)
                            )
                          }
                          className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-white active:text-white"
                        >
                          <Minus size={28} strokeWidth={2.5} />
                        </button>
                        <div className="min-w-[120px]">
                          <span className="text-5xl font-semibold">
                            {savingsMode === "percentage"
                              ? `${Math.round(savingsValue)}%`
                              : formatManageRM(savingsValue)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            applySavingsDraft(
                              savingsMode,
                              savingsValue + (savingsMode === "percentage" ? 1 : 50)
                            )
                          }
                          className="flex h-12 w-12 items-center justify-center rounded-full bg-secondary text-muted-foreground hover:text-white active:text-white"
                        >
                          <Plus size={28} strokeWidth={2.5} />
                        </button>
                      </div>
                      <p className="mt-3 text-sm text-muted-foreground">
                        {savingsMode === "percentage"
                          ? `${formatManageRM(draftSavingsAmount)} / month`
                          : `${Math.round((draftSavingsAmount / Math.max(draftTakeHome, 1)) * 100)}%`}
                      </p>
                      <div className="mt-6 grid grid-cols-2 rounded-lg bg-background p-1">
                        <button
                          type="button"
                          onClick={() =>
                            applySavingsDraft(
                              "percentage",
                              draftTakeHome > 0
                                ? Math.round((savingsValue / draftTakeHome) * 100)
                                : 0
                            )
                          }
                          className={`rounded-md py-2 text-sm font-medium shadow-sm ${
                            savingsMode === "percentage"
                              ? "bg-foreground text-background"
                              : "text-muted-foreground hover:text-white"
                          }`}
                        >
                          Percentage
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            applySavingsDraft("amount", Math.round(draftSavingsAmount))
                          }
                          className={`rounded-md py-2 text-sm font-medium shadow-sm ${
                            savingsMode === "amount"
                              ? "bg-foreground text-background"
                              : "text-muted-foreground hover:text-white"
                          }`}
                        >
                          Amount
                        </button>
                      </div>
                    </div>
                  </div>
                </ExpandableRow>

                <ExpandableRow
                  label="Variable Expenses"
                  value={
                    <span
                      className={cn(
                        "inline-flex items-center gap-2",
                        variablePoolWarning &&
                          expandedSection !== "variable" &&
                          "text-accent-yellow"
                      )}
                    >
                      {variablePoolWarning && expandedSection !== "variable" && (
                        <TriangleAlert size={16} className="shrink-0" />
                      )}
                      <span>{formatManageRM(draftVariablePool)}</span>
                    </span>
                  }
                  open={expandedSection === "variable"}
                  onToggle={() => toggleSection("variable")}
                >
                  <div className="space-y-4">
                    {editingSection === "variable" ? (
                      <>
                        <div className="overflow-hidden rounded-xl bg-background">
                          <div className="grid grid-cols-[1.3fr_1fr_80px] gap-3 border-b border-border px-4 py-3 text-xs uppercase tracking-wide text-muted-foreground">
                            <span>Category</span>
                            <span>RM</span>
                            <span>%</span>
                          </div>
                          {variableDrafts.map((envelope, index) => (
                            <div
                              key={`${envelope.name}-${index}`}
                              className="border-b border-border last:border-b-0"
                            >
                              <div className="grid grid-cols-[1.3fr_1fr_80px] items-center gap-3 px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span>{CATEGORY_ICONS[envelope.icon] || "📦"}</span>
                                  <span className="text-sm font-medium">
                                    {envelope.name}
                                  </span>
                                </div>
                                <span className="text-sm">
                                  {formatManageRM(
                                    getMonthlyAllocation(
                                      envelope.percentage,
                                      draftVariablePool,
                                      envelopes[index]?.monthlyBudget ?? 0
                                    )
                                  )}
                                </span>
                                <div className="relative">
                                  <Input
                                    inputMode="numeric"
                                    value={String(envelope.percentage)}
                                    onChange={(e) =>
                                      updateVariablePercentage(
                                        index,
                                        parseInt(e.target.value || "0", 10)
                                      )
                                    }
                                    className="h-10 bg-surface-card pr-8 text-right"
                                  />
                                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                    %
                                  </span>
                                </div>
                              </div>
                              <div className="px-4 pb-3">
                                <input
                                  type="range"
                                  min="0"
                                  max="100"
                                  value={envelope.percentage}
                                  onChange={(e) =>
                                    updateVariablePercentage(
                                      index,
                                      parseInt(e.target.value, 10)
                                    )
                                  }
                                  className="budget-slider w-full"
                                  style={{
                                    ["--slider-progress" as string]: `${envelope.percentage}%`,
                                  }}
                                />
                              </div>
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between">
                          <Button
                            variant="ghost"
                            onClick={autofillVariableCategories}
                            className="h-10 px-0 text-sm font-medium text-muted-foreground"
                          >
                            Autofill
                          </Button>

                          <div
                            className={`text-sm font-medium ${
                              totalVariablePct === 100
                                ? "text-muted-foreground"
                                : "text-accent-red"
                            }`}
                          >
                            Total: {totalVariablePct}%
                          </div>
                        </div>

                        {needsRemainderChoice && (
                          <div className="rounded-2xl bg-background p-4">
                            <p className="text-sm text-muted-foreground">
                              {isUnderAllocated
                                ? `You have ${formatManageRM(differenceAmount)} extra.`
                                : `You need ${formatManageRM(differenceAmount)} more.`}
                            </p>
                            <div className="mt-3 flex gap-3">
                              {isUnderAllocated ? (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => adjustCategoriesEvenly(100)}
                                    className="h-11 flex-1"
                                  >
                                    Spread
                                  </Button>
                                  <Button
                                    type="button"
                                    variant={
                                      resolution === "put_back" ? "default" : "outline"
                                    }
                                    onClick={() => setResolution("put_back")}
                                    className="h-11 flex-1"
                                  >
                                    Put back in Savings
                                  </Button>
                                </>
                              ) : (
                                <>
                                  <Button
                                    type="button"
                                    variant="outline"
                                    onClick={trimOthers}
                                    disabled={!canTrimOthers}
                                    className="h-11 flex-1"
                                  >
                                    Trim others
                                  </Button>
                                  <Button
                                    type="button"
                                    variant={
                                      resolution === "use_savings" ? "default" : "outline"
                                    }
                                    onClick={() => setResolution("use_savings")}
                                    disabled={!canUseSavings}
                                    className="h-11 flex-1"
                                  >
                                    Use savings
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={() => toggleEditing("variable")}
                            className="text-sm text-muted-foreground hover:text-white"
                          >
                            Cancel
                          </button>
                          <Button
                            onClick={saveVariableExpenses}
                            disabled={
                              loadingKey === "variable" ||
                              (totalVariablePct !== 100 && resolution === null) ||
                              (totalVariablePct > 100 &&
                                !canTrimOthers &&
                                !canUseSavings)
                            }
                            className="h-11 flex-1"
                          >
                            {loadingKey === "variable" ? "Saving..." : "Save Changes"}
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="space-y-2 rounded-xl bg-background p-4 text-sm">
                          <p className="text-sm text-muted-foreground">Monthly Allocations</p>
                          {envelopes.map((envelope) => (
                            <div
                              key={envelope.id}
                              className="flex items-center justify-between"
                            >
                              <span>
                                {CATEGORY_ICONS[envelope.icon] || "📦"} {envelope.name}
                              </span>
                              <span>
                                {formatManageRM(
                                  getMonthlyAllocation(
                                    envelope.percentage,
                                    variablePool,
                                    envelope.monthlyBudget
                                  )
                                )}{" "}
                                budgeted · {Math.round(envelope.percentage)}%
                              </span>
                            </div>
                          ))}
                        </div>

                        <button
                          type="button"
                          onClick={() => toggleEditing("variable")}
                          className="text-sm text-muted-foreground hover:text-white"
                        >
                          Edit
                        </button>
                      </>
                    )}
                  </div>
                </ExpandableRow>
              </div>
            </>
          ) : (
            <div className="space-y-3">
              <button
                onClick={handleReset}
                className="flex w-full items-center gap-3 rounded-2xl bg-surface-card px-5 py-4"
              >
                <RotateCcw size={18} />
                <span className="text-sm font-medium">Reset Budget Setup</span>
              </button>

              <button
                onClick={handleLogout}
                className="flex w-full items-center gap-3 rounded-2xl bg-surface-card px-5 py-4 text-accent-red"
              >
                <LogOut size={18} />
                <span className="text-sm font-medium">Log Out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
