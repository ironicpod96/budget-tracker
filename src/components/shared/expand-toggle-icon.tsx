"use client";

import { ChevronDown } from "lucide-react";

interface ExpandToggleIconProps {
  open: boolean;
  size?: number;
  className?: string;
}

export function ExpandToggleIcon({
  open,
  size = 32,
  className = "",
}: ExpandToggleIconProps) {
  return (
    <span
      className={`inline-flex items-center justify-center transition-transform duration-200 ${
        open ? "rotate-180" : "rotate-0"
      } ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <ChevronDown
        size={Math.round(size * 0.65)}
        strokeWidth={2.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </span>
  );
}
