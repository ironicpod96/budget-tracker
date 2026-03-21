"use client";

import { CATEGORY_ICONS } from "@/lib/constants/categories";

export function getCategoryBarColor(remaining: number, budget: number) {
  const remainingRatio = budget > 0 ? Math.max(0, remaining / budget) : 0;
  const isOver = remaining < 0;

  if (isOver || remainingRatio <= 0.15) {
    return "var(--accent-red)";
  }

  if (remainingRatio <= 0.4) {
    return "color-mix(in oklab, var(--accent-yellow) 62%, var(--accent-red) 38%)";
  }

  return "color-mix(in oklab, var(--color-secondary) 88%, white 12%)";
}

const DEFAULT_BAR_COLOR = "color-mix(in oklab, var(--color-secondary) 88%, white 12%)";

interface CategoryBarProps {
  name: string;
  icon: string;
  spent: number;
  budget: number;
}

function CategoryBar({
  name,
  icon,
  spent,
  budget,
}: CategoryBarProps) {
  const remaining = Math.round((budget - spent) * 100) / 100;
  const remainingRatio = budget > 0 ? Math.max(0, remaining / budget) : 0;
  const isOver = remaining < 0;
  const fillColor = getCategoryBarColor(remaining, budget);
  const isWarning = fillColor !== DEFAULT_BAR_COLOR;

  return (
    <div className="flex items-center gap-3">
      <span className="w-6 text-center">{CATEGORY_ICONS[icon] || "📦"}</span>
      <span className="w-24 text-base font-semibold truncate">{name}</span>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-bg">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{
            width: isOver ? "4px" : `${remainingRatio * 100}%`,
            backgroundColor: fillColor,
          }}
        />
      </div>
      <div className="flex w-20 justify-end">
        <span
          className={`rounded-sm px-2 py-0.5 text-right text-base ${
            isWarning ? "font-semibold text-primary" : "font-medium text-muted-foreground"
          }`}
          style={isWarning ? { backgroundColor: fillColor, paddingTop: "1px", paddingBottom: "1px" } : undefined}
        >
          RM {Math.round(isOver ? Math.abs(remaining) : remaining)}
        </span>
      </div>
    </div>
  );
}

interface CategoryBarsProps {
  envelopes: Array<{
    id: string;
    name: string;
    icon: string;
    percentage: number;
  }>;
  transactionsByEnvelope: Record<string, number>;
  sliceBudget: number;
  budgetAdjustments?: Record<string, number>;
}

export function CategoryBars({
  envelopes,
  transactionsByEnvelope,
  sliceBudget,
  budgetAdjustments = {},
}: CategoryBarsProps) {
  return (
    <div className="space-y-3">
      {envelopes.map((env) => {
        const budget =
          Math.max(
            0,
            Math.round(
              (sliceBudget * (env.percentage / 100) + (budgetAdjustments[env.id] || 0)) * 100
            ) / 100
          );
        const spent = transactionsByEnvelope[env.id] || 0;

        return (
          <CategoryBar
            key={env.id}
            name={env.name}
            icon={env.icon}
            spent={spent}
            budget={budget}
          />
        );
      })}
    </div>
  );
}
