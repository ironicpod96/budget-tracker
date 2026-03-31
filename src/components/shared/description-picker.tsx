"use client";

import { useEffect, useRef, useState } from "react";
import { Check, X } from "lucide-react";
import { useDescriptionSuggestions } from "@/lib/hooks/use-description-suggestions";

interface DescriptionPickerProps {
  envelopeId: string | undefined;
  value: string;
  onChange: (val: string) => void;
}

export function DescriptionPicker({ envelopeId, value, onChange }: DescriptionPickerProps) {
  const { suggestions, addSuggestion, removeSuggestion } = useDescriptionSuggestions(envelopeId);
  const [showInput, setShowInput] = useState(false);
  const [draft, setDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (showInput) inputRef.current?.focus();
  }, [showInput]);

  useEffect(() => {
    if (value && suggestions.length > 0 && !suggestions.includes(value)) {
      onChange("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [envelopeId]);

  // Dismiss delete mode when tapping outside
  useEffect(() => {
    if (!pendingDelete) return;
    function dismiss() { setPendingDelete(null); }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [pendingDelete]);

  function confirm() {
    const text = draft.trim();
    if (!text) { cancel(); return; }
    addSuggestion(text);
    onChange(text);
    setDraft("");
    setShowInput(false);
  }

  function cancel() {
    setDraft("");
    setShowInput(false);
  }

  function startLongPress(s: string) {
    longPressTimer.current = setTimeout(() => {
      setPendingDelete(s);
    }, 450);
  }

  function cancelLongPress() {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }

  function handlePillPointerDown(e: React.PointerEvent, s: string) {
    e.stopPropagation();
    startLongPress(s);
  }

  function handlePillClick(s: string) {
    if (pendingDelete === s) return; // suppress tap after long press
    onChange(value === s ? "" : s);
  }

  function handleRemove(e: React.PointerEvent | React.MouseEvent, s: string) {
    e.stopPropagation();
    if (value === s) onChange("");
    removeSuggestion(s);
    setPendingDelete(null);
  }

  return (
    <div className="flex flex-wrap gap-2">
      {suggestions.map((s) => {
        const isDeleting = pendingDelete === s;
        const isSelected = value === s;
        return (
          <div key={s} className="relative">
            <button
              type="button"
              onPointerDown={(e) => handlePillPointerDown(e, s)}
              onPointerUp={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onPointerCancel={cancelLongPress}
              onClick={() => handlePillClick(s)}
              className={`h-9 rounded-full border px-4 text-sm font-semibold transition-colors select-none ${
                isDeleting
                  ? "border-accent-red/60 bg-accent-red/10 text-accent-red"
                  : isSelected
                    ? "border-foreground bg-foreground text-background"
                    : "border-muted-foreground/30 bg-transparent text-foreground"
              }`}
            >
              {s}
            </button>
            {isDeleting && (
              <button
                type="button"
                onPointerDown={(e) => e.stopPropagation()}
                onClick={(e) => handleRemove(e, s)}
                className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-accent-red text-white shadow"
              >
                <X size={10} strokeWidth={3} />
              </button>
            )}
          </div>
        );
      })}

      {/* Input mode */}
      {showInput ? (
        <div className="flex items-center gap-1.5">
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") confirm(); if (e.key === "Escape") cancel(); }}
            placeholder="Description…"
            className="h-9 w-36 rounded-full border border-muted-foreground/30 bg-transparent px-4 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button type="button" onClick={confirm} className="flex h-9 w-9 items-center justify-center rounded-full bg-foreground text-background">
            <Check size={14} strokeWidth={3} />
          </button>
          <button type="button" onClick={cancel} className="flex h-9 w-9 items-center justify-center rounded-full bg-surface-card text-muted-foreground">
            <X size={14} strokeWidth={2.5} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowInput(true)}
          className="h-9 rounded-full border border-dashed border-muted-foreground/30 px-4 text-sm text-muted-foreground transition-colors hover:border-muted-foreground/60"
        >
          {suggestions.length === 0 ? "Add description (optional)" : "+"}
        </button>
      )}
    </div>
  );
}
