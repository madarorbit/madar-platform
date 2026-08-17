"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import GuidedLearningHost from "@/components/guided-learning/GuidedLearningHost";
import { GuideRegistry, GuidedLearningRuntime, MemoryLearningProgressStore } from "@/src/lib/guided-learning";
import { GuidedLearningController } from "@/src/lib/guided-learning/browser";

const GuidedLearningControllerContext = createContext<GuidedLearningController | null>(null);

export function useGuidedLearningController(): GuidedLearningController {
  const controller = useContext(GuidedLearningControllerContext);
  if (!controller) throw new Error("Guided Learning controller is only available inside the authenticated MADAR learning boundary.");
  return controller;
}

export default function GuidedLearningBoundary({ accountId, children }: { accountId: string; children: ReactNode }) {
  const [controller] = useState(() => {
    const registry = new GuideRegistry();
    const runtime = new GuidedLearningRuntime({ registry, progressStore: new MemoryLearningProgressStore() });
    return new GuidedLearningController(runtime, registry, { accountId });
  });

  return (
    <GuidedLearningControllerContext.Provider value={controller}>
      <div data-madar-guide-app-root className="md-guide-app-root">{children}</div>
      <GuidedLearningHost controller={controller} />
    </GuidedLearningControllerContext.Provider>
  );
}
