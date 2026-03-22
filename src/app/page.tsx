import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { HomeClient } from "./home-client";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/auth/login");

  // Fetch all data for the store
  const [
    { data: profile },
    { data: deductionsRow },
    { data: fixedExpenses },
    { data: savingsTarget },
    { data: envelopes },
    { data: transactions },
    { data: weeklySavingsRow },
    { data: adjustmentRows },
  ] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase
      .from("monthly_deductions")
      .select("*")
      .eq("profile_id", user.id)
      .single(),
    supabase
      .from("fixed_expenses")
      .select("*")
      .eq("profile_id", user.id)
      .order("created_at"),
    supabase
      .from("savings_target")
      .select("*")
      .eq("profile_id", user.id)
      .single(),
    supabase
      .from("envelopes")
      .select("*")
      .eq("profile_id", user.id)
      .order("sort_order"),
    supabase
      .from("transactions")
      .select("*")
      .eq("profile_id", user.id)
      .order("transaction_date", { ascending: false })
      .order("transaction_time", { ascending: false })
      .limit(100),
    supabase
      .from("weekly_savings")
      .select("transferred_at")
      .eq("profile_id", user.id)
      .eq("transferred_to_savings", true)
      .order("transferred_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("envelope_adjustments")
      .select("envelope_id, adjustment_date, amount")
      .eq("profile_id", user.id),
  ]);

  if (!profile?.onboarding_complete) redirect("/onboarding/income");

  // Map envelope IDs for transaction display
  const envelopeMap = new Map(
    (envelopes || []).map((e) => [e.id, { name: e.name, icon: e.icon }])
  );

  const initialData = {
    profile: {
      id: profile.id,
      name: profile.name,
      grossIncome: profile.gross_income,
      epfRate: profile.epf_rate,
      maritalStatus: profile.marital_status || "single",
      numChildren: profile.num_children || 0,
      onboardingComplete: profile.onboarding_complete,
    },
    fixedExpenses: (fixedExpenses || []).map((e) => ({
      id: e.id,
      name: e.name,
      amount: e.amount,
      icon: e.icon,
    })),
    savingsTarget: savingsTarget
      ? {
          id: savingsTarget.id,
          mode: savingsTarget.mode as "percentage" | "amount",
          value: savingsTarget.value,
          computedAmount: savingsTarget.computed_amount,
        }
      : null,
    envelopes: (envelopes || []).map((e) => ({
      id: e.id,
      name: e.name,
      icon: e.icon,
      monthlyBudget: e.monthly_budget,
      percentage: e.percentage,
      sortOrder: e.sort_order,
      color: e.color,
    })),
    transactions: (transactions || []).map((t) => ({
      id: t.id,
      envelopeId: t.envelope_id,
      envelopeName: envelopeMap.get(t.envelope_id)?.name || "Unknown",
      envelopeIcon: envelopeMap.get(t.envelope_id)?.icon || "utensils",
      amount: t.amount,
      description: t.description,
      transactionDate: t.transaction_date,
      transactionTime: t.transaction_time,
    })),
  };

  // Build dailyAdjustments map: { [envelopeId]: amount } for today's date
  const todayStr = new Date().toISOString().slice(0, 10);
  const initialAdjustments: Record<string, number> = {};
  for (const row of adjustmentRows || []) {
    if (row.adjustment_date === todayStr) {
      initialAdjustments[row.envelope_id] = Number(row.amount);
    }
  }

  return (
    <HomeClient
      initialData={initialData}
      lastSavingsTransferDate={weeklySavingsRow?.transferred_at ?? null}
      initialAdjustments={initialAdjustments}
    />
  );
}
