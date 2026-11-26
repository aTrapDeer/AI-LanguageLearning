"use client";

import { useEffect, useRef } from "react";

function isTypingTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null;
  return Boolean(element && (element.tagName === "INPUT" || element.tagName === "TEXTAREA" || element.isContentEditable));
}

/** Number keys 1..count pick an option (ignored while typing in a field). */
export function useNumberKeys(count: number, onPick: (index: number) => void, enabled: boolean) {
  const handler = useRef(onPick);
  handler.current = onPick;

  useEffect(() => {
    if (!enabled || count <= 0) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || isTypingTarget(event.target)) return;
      const index = Number.parseInt(event.key, 10) - 1;
      if (Number.isInteger(index) && index >= 0 && index < count && index < 9) {
        event.preventDefault();
        handler.current(index);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [count, enabled]);
}

/** Enter anywhere (except a focused link) runs `onEnter`; replaces the native button activation. */
export function useEnterKey(onEnter: () => void, enabled: boolean) {
  const handler = useRef(onEnter);
  handler.current = onEnter;

  useEffect(() => {
    if (!enabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.repeat || event.isComposing || event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.tagName === "A" || target?.tagName === "TEXTAREA") return;
      event.preventDefault();
      handler.current();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}

/** Whether the page has had a user gesture, so speech can start without being blocked. */
export function hasUserActivation(): boolean {
  if (typeof navigator === "undefined") return false;
  const activation = (navigator as Navigator & { userActivation?: { hasBeenActive: boolean } }).userActivation;
  return activation ? activation.hasBeenActive : false;
}
