"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  ReferenceLine,
} from "recharts";
import type { TooltipProps } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";

interface WeeklySpendingChartProps {
  data: Array<{
    day: string;
    spent: number | null;
    budget: number;
  }>;
}

const chartConfig = {
  spent: { label: "Spent", color: "var(--foreground)" },
} satisfies ChartConfig;

export function WeeklySpendingChart({ data }: WeeklySpendingChartProps) {
  const budget = data[0]?.budget ?? 0;

  return (
    <div className="w-full rounded-xl bg-black p-2" style={{ height: 140 }}>
      <ChartContainer config={chartConfig} className="h-full w-full">
        <LineChart
          data={data}
          margin={{ top: 8, right: 12, bottom: 0, left: 12 }}
        >
          <XAxis
            dataKey="day"
            axisLine={false}
            tickLine={false}
            tick={{ fontSize: 14, fontWeight: 500, fill: "var(--muted-foreground)" }}
            tickFormatter={(v: string) => v.charAt(0)}
            padding={{ left: 4, right: 4 }}
            interval={0}
            dy={4}
          />
          <YAxis hide domain={[0, (dataMax: number) => Math.max(dataMax, budget * 1.5)]} />
        <ReferenceLine
          y={budget}
          stroke="var(--muted-foreground)"
          strokeDasharray="4 4"
          strokeWidth={1}
          strokeOpacity={0.5}
          label={{ value: `RM${Math.round(budget)}`, position: "insideTopRight", fontSize: 18, fill: "var(--muted-foreground)", dy: -24, dx: 2 }}
        />
        <Line
          dataKey="spent"
          type="monotone"
          stroke="var(--foreground)"
          strokeWidth={2}
          dot={{ r: 2.5, fill: "var(--foreground)", strokeWidth: 0 }}
          activeDot={{ r: 4, fill: "var(--foreground)", strokeWidth: 0 }}
          connectNulls={false}
        />
        <ChartTooltip
          content={({ active, payload }: TooltipProps<number, string>) => {
            if (!active || !payload?.length) return null;
            const val = payload[0].value;
            return (
              <div className="rounded-md bg-surface-card px-2 py-1 text-xs font-medium shadow-sm">
                {val == null ? "No data" : `RM ${Math.round(val)}`}
              </div>
            );
          }}
        />
      </LineChart>
      </ChartContainer>
    </div>
  );
}
