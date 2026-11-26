"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * A boolean preference kept in localStorage. Starts at `defaultValue` on the server and the first
 * client render (so hydration matches), then picks up the stored value.
 */
export function useLocalPreference(key: string, defaultValue: boolean): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(defaultValue);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key);
      if (stored === "1" || stored === "0") {
        setValue(stored === "1");
      }
    } catch {
      // Private mode or storage disabled: keep the default.
    }
  }, [key]);

  const update = useCallback(
    (next: boolean) => {
      setValue(next);
      try {
        window.localStorage.setItem(key, next ? "1" : "0");
      } catch {
        // Ignore: the preference just won't persist.
      }
    },
    [key]
  );

  return [value, update];
}
