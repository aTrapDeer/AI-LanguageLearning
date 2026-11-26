"use client";

import Link from "next/link";
import { BookOpen, MessageSquarePlus, Mic, MoreVertical } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface ToggleItem {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}

interface ChatMenuProps {
  language: string;
  onNewConversation: (() => void) | null;
  toggles: ToggleItem[];
}

/** Overflow menu for the chat top bar: new conversation, display/audio preferences, other modes. */
export function ChatMenu({ language, onNewConversation, toggles }: ChatMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setOpen(false);
    window.addEventListener("pointerdown", onPointer);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemClass =
    "flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 focus-visible:bg-slate-100 focus-visible:outline-none";

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Chat options"
        className="inline-flex h-10 w-10 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <MoreVertical aria-hidden className="h-5 w-5" />
      </button>

      {open && (
        <div role="menu" className="absolute right-0 top-12 z-50 w-64 rounded-2xl bg-white p-1.5 shadow-2xl ring-1 ring-slate-200">
          {onNewConversation && (
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              onClick={() => {
                setOpen(false);
                onNewConversation();
              }}
            >
              <MessageSquarePlus aria-hidden className="h-4 w-4 text-indigo-600" />
              New conversation
            </button>
          )}

          {toggles.map((toggle) => (
            <label key={toggle.id} className={`${itemClass} cursor-pointer justify-between`}>
              <span>{toggle.label}</span>
              <input
                type="checkbox"
                role="menuitemcheckbox"
                aria-checked={toggle.checked}
                checked={toggle.checked}
                onChange={(event) => toggle.onChange(event.target.checked)}
                className="h-4 w-4 accent-indigo-600"
              />
            </label>
          ))}

          <div className="my-1 h-px bg-slate-100" />
          <Link role="menuitem" href={`/learn/conversation?lang=${language}`} className={itemClass}>
            <Mic aria-hidden className="h-4 w-4 text-emerald-600" />
            Voice conversation
          </Link>
          <Link role="menuitem" href={`/learn/journey?lang=${language}`} className={itemClass}>
            <BookOpen aria-hidden className="h-4 w-4 text-amber-600" />
            Lesson path
          </Link>
        </div>
      )}
    </div>
  );
}
