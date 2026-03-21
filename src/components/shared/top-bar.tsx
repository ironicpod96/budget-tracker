"use client";

import type { ReactNode } from "react";
import { FONT_STYLES } from "@/lib/constants/typography";
import { cn } from "@/lib/utils";

interface TopBarProps {
  title?: ReactNode;
  leading?: ReactNode;
  trailing?: ReactNode;
  className?: string;
}

export function TopBar({
  title,
  leading,
  trailing,
  className,
}: TopBarProps) {
  return (
    <div
      className={cn("mb-5 flex items-center justify-between gap-4", className)}
    >
      <div className={cn("flex min-w-0 flex-1 items-center gap-3", FONT_STYLES.bodyRegular)}>
        {leading}
        {title}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </div>
  );
}
