"use client";

interface ExpandToggleIconProps {
  open: boolean;
  size?: number;
  barScale?: number;
  className?: string;
}

export function ExpandToggleIcon({
  open,
  size = 32,
  barScale = 0.5,
  className = "",
}: ExpandToggleIconProps) {
  const bar = Math.round(size * barScale);
  const stroke = Math.max(2, Math.round(size * 0.06 * 10) / 10);

  return (
    <span
      className={`relative inline-flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <span
        className="absolute rounded-full bg-current"
        style={{ width: bar, height: stroke }}
      />
      <span
        className={`absolute rounded-full bg-current transition-transform duration-200 ${
          open ? "scale-y-0" : "scale-y-100"
        }`}
        style={{ width: stroke, height: bar }}
      />
    </span>
  );
}
