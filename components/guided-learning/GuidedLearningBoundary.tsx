"use client";

import { createContext, useContext, useRef, type ReactNode } from "react";
import GuidedLearningHost from "@/components/guided-learning/GuidedLearningHost";
import {
  GuideRegistry,
  GuidedLearningRuntime,
  MemoryLearningProgressStore,
} from "@/src/lib/guided-learning";
import { GuidedLearningController } from "@/src/lib/guided-learning/browser";

const GuidedLearningControllerContext = createContext<GuidedLearningController | null>(null);

export function useGuidedLearningController(): GuidedLearningController {
  const controller = useContext(GuidedLearningControllerContext);
  if (!controller) throw new Error("Guided Learning controller is only available inside the authenticated MADAR learning boundary.");
  return controller;
}

/**
 * Authenticated-shell composition point. No production guides are registered in
 * Phase 2, and the host creates no DOM observers/listeners while the runtime is idle.
 */
export default function GuidedLearningBoundary({
  accountId,
  children,
}: {
  accountId: string;
  children: ReactNode;
}) {
  const controllerRef = useRef<GuidedLearningController | null>(null);
  if (!controllerRef.current) {
    const registry = new GuideRegistry();
    const runtime = new GuidedLearningRuntime({
      registry,
      progressStore: new MemoryLearningProgressStore(),
    });
    controllerRef.current = new GuidedLearningController(runtime, registry, { accountId });
  }
  const controller = controllerRef.current;
  return (
    <GuidedLearningControllerContext.Provider value={controller}>
      {children}
      <GuidedLearningHost controller={controller} />
    </GuidedLearningControllerContext.Provider>
  );
}
