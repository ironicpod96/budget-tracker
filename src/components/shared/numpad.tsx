"use client";

import { useEffect } from "react";

interface NumpadProps {
  onInput: (key: string) => void;
  onDelete: () => void;
}

const KEYS = [
  ["1", "2", "3"],
  ["4", "5", "6"],
  ["7", "8", "9"],
  [".", "0", "⌫"],
];

export function Numpad({ onInput, onDelete }: NumpadProps) {
  function handleKey(key: string) {
    if (key === "⌫") {
      onDelete();
    } else {
      onInput(key);
    }
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key >= "0" && e.key <= "9") onInput(e.key);
      else if (e.key === ".") onInput(".");
      else if (e.key === "Backspace") onDelete();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onInput, onDelete]);

  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.flat().map((key) => (
        <button
          key={key}
          type="button"
          onClick={() => handleKey(key)}
          className="flex h-14 items-center justify-center rounded-xl bg-surface-card text-xl font-medium transition-colors active:bg-muted"
        >
          {key}
        </button>
      ))}
    </div>
  );
}

// Helper hook to manage numpad amount state
export function useNumpadAmount(initial: string = "0") {
  const MAX_DECIMALS = 2;

  function handleInput(current: string, key: string): string {
    if (key === "." && current.includes(".")) return current;
    if (key === "." && current === "0") return "0.";

    const parts = current.split(".");
    if (parts[1] && parts[1].length >= MAX_DECIMALS && key !== ".") return current;

    if (current === "0" && key !== ".") return key;
    return current + key;
  }

  function handleDelete(current: string): string {
    if (current.length <= 1) return "0";
    return current.slice(0, -1);
  }

  return { handleInput, handleDelete, initial };
}
