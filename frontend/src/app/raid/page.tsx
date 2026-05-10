"use client";

import { Suspense } from "react";
import RaidContent from "./RaidContent";

export default function RaidPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-foreground/30">
          Loading...
        </div>
      }
    >
      <RaidContent />
    </Suspense>
  );
}
