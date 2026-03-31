"use client";

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "desc-suggestions";

function load(): Record<string, string[]> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function save(data: Record<string, string[]>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function useDescriptionSuggestions(envelopeId: string | undefined) {
  const [suggestions, setSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!envelopeId) return;
    setSuggestions(load()[envelopeId] ?? []);
  }, [envelopeId]);

  const addSuggestion = useCallback((text: string) => {
    if (!envelopeId || !text.trim()) return;
    setSuggestions((prev) => {
      if (prev.includes(text)) return prev;
      const next = [...prev, text];
      const all = load();
      all[envelopeId] = next;
      save(all);
      return next;
    });
  }, [envelopeId]);

  const removeSuggestion = useCallback((text: string) => {
    if (!envelopeId) return;
    setSuggestions((prev) => {
      const next = prev.filter((s) => s !== text);
      const all = load();
      all[envelopeId] = next;
      save(all);
      return next;
    });
  }, [envelopeId]);

  return { suggestions, addSuggestion, removeSuggestion };
}
