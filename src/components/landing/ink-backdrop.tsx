import { cn } from "@/lib/utils";

/**
 * The brand "night" surface shared by the landing page and the dashboard's hero card: layered indigo and
 * violet light, an optional corner glow, and film grain for depth. Static, so it costs nothing on phones.
 * The glow is fuchsia rather than ember on purpose: orange blurred into violet turns muddy.
 */
export function InkBackdrop({ glow = false, className }: { glow?: boolean; className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div className="absolute inset-0 bg-[radial-gradient(110%_70%_at_0%_0%,#3d23a3_0%,transparent_60%),radial-gradient(90%_80%_at_100%_100%,#6b1d9c_0%,transparent_62%),linear-gradient(165deg,#120d3a_0%,#1a1250_55%,#26105a_100%)]" />
      {glow && <div className="absolute -right-28 -top-32 h-80 w-80 rounded-full bg-fuchsia-500/30 blur-3xl" />}
      <div className="absolute inset-0 bg-grain opacity-[0.16] mix-blend-overlay" />
    </div>
  );
}
