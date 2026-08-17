"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import type { ORBYCharacterRuntimeSnapshot } from "@/src/lib/guided-learning/character";

export type ORBYGuidePresentationProps = Readonly<{
  character: ORBYCharacterRuntimeSnapshot;
  currentIndex: number;
  total: number;
  title?: string;
  message: string;
  hint?: string;
  status?: string | null;
  warning?: string | null;
  actions: ReactNode;
}>;

/**
 * Phase 3B presentation. The authoritative ORBY asset is intentionally static
 * until a genuine layered/rigged production asset is authored. Semantic motion
 * attributes are exposed for the future driver without faking skeletal motion.
 */
export default function ORBYGuidePresentation({
  character,
  currentIndex,
  total,
  title,
  message,
  hint,
  status,
  warning,
  actions,
}: ORBYGuidePresentationProps) {
  const { frame, driverStatus } = character;
  return (
    <div
      className="md-orby-guide-presentation"
      data-orby-motion-intent={frame.intent}
      data-orby-motion-direction={frame.direction}
      data-orby-motion-mode={frame.mode}
      data-orby-driver-status={driverStatus}
    >
      <div className="md-orby-guide-character" aria-hidden="true">
        <Image
          src="/brand/orby-assistant.svg"
          alt=""
          width={112}
          height={112}
          sizes="(max-width: 639px) 72px, 112px"
          className="md-orby-guide-character-image"
          priority={false}
          unoptimized
        />
      </div>
      <div className="md-orby-guide-message">
        <div className="md-orby-guide-meta">
          <span>ORBY</span>
          <span>{currentIndex} / {total}</span>
        </div>
        {title ? <h2>{title}</h2> : null}
        <p>{message}</p>
        {hint ? <small>{hint}</small> : null}
        {status ? <div className="md-guide-status" role="status">{status}</div> : null}
        {warning ? <div className="md-guide-status is-warning" role="status">{warning}</div> : null}
        {actions}
      </div>
    </div>
  );
}
