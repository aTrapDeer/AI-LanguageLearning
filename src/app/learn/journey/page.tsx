import { Suspense } from "react";
import { JourneyRoute } from "./journey-route";

export const dynamic = "force-dynamic";

export default function JourneyPage() {
  return (
    <Suspense fallback={null}>
      <JourneyRoute />
    </Suspense>
  );
}
