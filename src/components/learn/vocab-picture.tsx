"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

/** Waits between tries while a picture is still being generated (the server answers 202 meanwhile). */
const RETRY_DELAYS_MS = [1500, 3000, 6000, 10000];

export interface VocabPictureProps {
  url: string | null | undefined;
  /** Size of the reserved square, e.g. "h-28 w-28". */
  className?: string;
}

/**
 * A word's picture in a fixed square, so nothing moves when it arrives. Fades in once loaded, retries
 * with back-off while the picture is still being generated, and renders nothing if it never comes.
 * Decorative: the word and its meaning are always shown as text next to it.
 */
export function VocabPicture({ url, className }: VocabPictureProps) {
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setObjectUrl(null);
    setLoaded(false);
    setFailed(false);
    if (!url) return;

    // fetch (unlike <img>) sees the status, so a 202 is retried and a 404 ends it straight away.
    let cancelled = false;
    const controller = new AbortController();
    let created: string | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;

    const retryOrGiveUp = () => {
      if (cancelled) return;
      if (attempt < RETRY_DELAYS_MS.length) {
        timer = setTimeout(load, RETRY_DELAYS_MS[attempt]);
        attempt += 1;
      } else {
        setFailed(true);
      }
    };

    async function load() {
      try {
        const response = await fetch(url as string, { signal: controller.signal });
        if (cancelled) return;
        if (response.status === 202) return retryOrGiveUp();
        if (!response.ok) return setFailed(true);
        const blob = await response.blob();
        if (cancelled) return;
        created = URL.createObjectURL(blob);
        setObjectUrl(created);
      } catch {
        retryOrGiveUp();
      }
    }

    void load();
    return () => {
      cancelled = true;
      controller.abort();
      if (timer) clearTimeout(timer);
      if (created) URL.revokeObjectURL(created);
    };
  }, [url]);

  if (!url || failed) return null;

  return (
    <div
      aria-hidden
      className={cn("relative shrink-0 overflow-hidden rounded-2xl bg-slate-100", !loaded && "motion-safe:animate-pulse", className)}
    >
      {objectUrl && (
        // A small stored WebP shown from memory: there is nothing for next/image to optimise.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={objectUrl}
          alt=""
          draggable={false}
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            "h-full w-full object-cover transition-opacity duration-500 motion-reduce:transition-none",
            loaded ? "opacity-100" : "opacity-0"
          )}
        />
      )}
    </div>
  );
}
