import { useEffect, useState } from "react";
import { toLocalDateString } from "@/lib/utils";

function getWeekStartString() {
  const d = new Date();
  const day = d.getDay();
  const diff = day === 0 ? 6 : day - 1;
  d.setDate(d.getDate() - diff);
  return toLocalDateString(d);
}

function msUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

/**
 * Returns today's date string and week start string (local timezone),
 * automatically updating when the date changes at midnight.
 */
export function useToday() {
  const [today, setToday] = useState(() => toLocalDateString(new Date()));
  const [weekStart, setWeekStart] = useState(getWeekStartString);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;

    function scheduleCheck() {
      timer = setTimeout(() => {
        const next = toLocalDateString(new Date());
        if (next !== today) {
          setToday(next);
          setWeekStart(getWeekStartString());
        }
        scheduleCheck();
      }, msUntilMidnight() + 500);
    }

    scheduleCheck();
    return () => clearTimeout(timer);
  }, [today]);

  return { today, weekStart, now: new Date() };
}
