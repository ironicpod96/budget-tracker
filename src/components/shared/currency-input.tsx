"use client";

import { Input } from "@/components/ui/input";
import { formatCurrencyInput, parseCurrencyInput } from "@/lib/currency";
import { cn } from "@/lib/utils";

interface CurrencyInputProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}

export function CurrencyInput({
  value,
  onChange,
  className,
  placeholder = "0",
}: CurrencyInputProps) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
        RM
      </span>
      <Input
        inputMode="decimal"
        value={formatCurrencyInput(value)}
        onChange={(e) => onChange(parseCurrencyInput(e.target.value))}
        placeholder={placeholder}
        className={cn("h-11 bg-background pl-10", className)}
      />
    </div>
  );
}
