"use client";

import { Mic } from "lucide-react";
import { useCallback, useEffect, useState } from "react";

export interface AudioInput {
  deviceId: string;
  label: string;
}

/** Audio inputs, refreshed when devices change. Labels appear once mic permission is granted. */
export function useAudioInputs() {
  const [inputs, setInputs] = useState<AudioInput[]>([]);

  const refresh = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return;
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      setInputs(
        devices
          .filter((device) => device.kind === "audioinput" && device.deviceId)
          .map((device, index) => ({ deviceId: device.deviceId, label: device.label || `Microphone ${index + 1}` }))
      );
    } catch {
      setInputs([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
    navigator.mediaDevices?.addEventListener?.("devicechange", refresh);
    return () => navigator.mediaDevices?.removeEventListener?.("devicechange", refresh);
  }, [refresh]);

  return { inputs, refresh };
}

interface DevicePickerProps {
  inputs: AudioInput[];
  value: string;
  onChange: (deviceId: string) => void;
}

export function DevicePicker({ inputs, value, onChange }: DevicePickerProps) {
  if (inputs.length === 0) return null;

  return (
    <label className="flex items-center gap-2 rounded-2xl bg-white/10 px-3 py-2 text-sm text-indigo-50 ring-1 ring-white/15">
      <Mic aria-hidden className="h-4 w-4 shrink-0" />
      <span className="sr-only">Microphone</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="min-w-0 flex-1 truncate bg-transparent text-sm font-medium text-white focus:outline-none [&>option]:text-slate-900"
      >
        {inputs.map((input) => (
          <option key={input.deviceId} value={input.deviceId}>
            {input.label}
          </option>
        ))}
      </select>
    </label>
  );
}
