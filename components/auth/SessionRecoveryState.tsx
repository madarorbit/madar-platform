"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const MAX_AUTOMATIC_RETRIES = 2;
const RECOVERY_WINDOW_MS = 30_000;

export default function SessionRecoveryState({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const storageKey = `madar:auth-recovery:${nextPath}`;

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const now = Date.now();
      const saved = JSON.parse(sessionStorage.getItem(storageKey) || "null") as
        | { startedAt?: number; attempts?: number }
        | null;
      const withinWindow = Boolean(saved?.startedAt && now - saved.startedAt < RECOVERY_WINDOW_MS);
      const attempts = withinWindow ? Number(saved?.attempts || 0) : 0;
      const startedAt = withinWindow ? Number(saved?.startedAt) : now;
      if (attempts >= MAX_AUTOMATIC_RETRIES) return;
      sessionStorage.setItem(
        storageKey,
        JSON.stringify({ startedAt, attempts: attempts + 1 }),
      );
      timer = setTimeout(() => router.refresh(), attempts === 0 ? 900 : 2_200);
    } catch {
      timer = setTimeout(() => router.refresh(), 1_200);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [router, storageKey]);

  return (
    <main className="md-shell min-h-[70vh] grid place-items-center px-4" id="main-content">
      <section className="md-panel mx-auto max-w-lg text-center" role="status" aria-live="polite">
        <span className="md-eyebrow">اتصال الحساب</span>
        <h1 className="md-type-h2 mt-4">جارٍ استعادة جلستك…</h1>
        <p className="md-type-body md-muted mt-3">
          نعيد الاتصال بحسابك بأمان. لن نسجّل خروجك بسبب انقطاع مؤقت في خدمة التحقق.
        </p>
        <div className="mt-6 flex justify-center">
          <button type="button" className="md-button md-button-secondary" onClick={() => router.refresh()}>
            المحاولة مجددًا
          </button>
        </div>
      </section>
    </main>
  );
}
