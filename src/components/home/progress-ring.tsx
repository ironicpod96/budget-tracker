"use client";

import { useLayoutEffect, useRef, useState } from "react";

interface ProgressRingProps {
  percentage: number; // 0 to 1
  remaining: number;
  size?: number;
}

export function ProgressRing({
  percentage,
  remaining,
  size = 200,
}: ProgressRingProps) {
  const measureRef = useRef<HTMLSpanElement>(null);
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - Math.max(0, Math.min(1, percentage)));
  const textInset = 24;
  const innerDiameter = size - strokeWidth * 2;

  let ringColor = "var(--foreground)"; // white in dark mode
  if (percentage <= 0.25) ringColor = "var(--accent-red)";
  else if (percentage <= 0.5) ringColor = "var(--accent-yellow)";

  const isNegative = remaining < 0;
  const displayAmount = Math.abs(Math.round(remaining)).toLocaleString("en-MY");
  const displayText = `RM ${displayAmount}`;
  const textBoxWidth = Math.max(0, innerDiameter - textInset);
  const maxFontSize = 82;
  const minFontSize = 24;
  const [displayFontSize, setDisplayFontSize] = useState(maxFontSize);

  useLayoutEffect(() => {
    const measure = measureRef.current;
    if (!measure) return;

    const fitText = () => {
      const measuredWidth = measure.getBoundingClientRect().width;
      if (!measuredWidth) {
        setDisplayFontSize(maxFontSize);
        return;
      }

      const nextFontSize = Math.max(
        minFontSize,
        Math.min(maxFontSize, ((textBoxWidth - 6) / measuredWidth) * maxFontSize)
      );
      setDisplayFontSize(nextFontSize);
    };

    fitText();

    const resizeObserver = new ResizeObserver(fitText);
    resizeObserver.observe(measure);
    return () => resizeObserver.disconnect();
  }, [displayText, textBoxWidth]);

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-bg)"
          strokeWidth={strokeWidth}
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={ringColor}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center px-2">
        <span
          ref={measureRef}
          className="pointer-events-none absolute opacity-0 font-semibold tracking-tight whitespace-nowrap"
          style={{ fontSize: `${maxFontSize}px` }}
          aria-hidden="true"
        >
          {displayText}
        </span>
        <span
          className="block overflow-hidden text-center font-semibold tracking-tight whitespace-nowrap"
          style={{
            width: `${textBoxWidth}px`,
            fontSize: `${displayFontSize}px`,
            lineHeight: 1,
            color: isNegative ? "var(--accent-red)" : undefined,
          }}
        >
          {displayText}
        </span>
        <span
          className="text-base font-medium text-muted-foreground"
        >
          {isNegative ? "overbudget" : "remaining"}
        </span>
      </div>
    </div>
  );
}
