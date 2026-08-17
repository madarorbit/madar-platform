"use client";

import { useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const MAX_AUTOMATIC_ATTEMPTS = 2;
const RETRY_DELAYS_MS = [900, 2_200] as const;

type RecoveryResult = "authenticated" | "unauthenticated" | "recovering";

export default function SessionRecoveryState({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const inFlightRef = useRef<Promise<RecoveryResult> | null>(null);

  const recover = useCallback(async (): Promise<RecoveryResult> => {
    if (inFlightRef.current) return inFlightRef.current;
    const request = (async () => {
      try {
        const response = await fetch("/auth/refresh", {
          method: "POST",
          credentials: "same-origin",
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const payload = await response.json().catch(() => null) as { status?: RecoveryResult } | null;
        if (response.ok && payload?.status === "authenticated") return "authenticated";
        if (response.status === 401 || payload?.status === "unauthenticated") return "unauthenticated";
        return "recovering";
      } catch {
        return "recovering";
      }
    })();
    inFlightRef.current = request;
    try {
      return await request;
    } finally {
      if (inFlightRef.current === request) inFlightRef.current = null;
    }
  }, []);

  const finish = useCallback((result: RecoveryResult) => {
    if (result === "authenticated") {
      router.replace(nextPath);
      return true;
    }
    if (result === "unauthenticated") {
      router.replace(`/login?next=${encodeURIComponent(nextPath)}`);
      return true;
    }
    return false;
  }, [nextPath, router]);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const run = async (attempt: number) => {
      const result = await recover();
      if (cancelled || finish(result)) return;
      if (attempt + 1 >= MAX_AUTOMATIC_ATTEMPTS) return;
      timer = setTimeout(() => void run(attempt + 1), RETRY_DELAYS_MS[attempt] ?? 2_200);
    };

    void run(0);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [finish, recover]);

  const retryManually = async () => {
    finish(await recover());
  };

  return (
    <main className="md-shell min-h-[70vh] grid place-items-center px-4" id="main-content">
      <section className="md-panel mx-auto max-w-lg text-center" role="status" aria-live="polite">
        <span className="md-eyebrow">اتصال الحساب</span>
        <h1 className="md-type-h2 mt-4">جارٍ استعادة جلستك…</h1>
        <p className="md-type-body md-muted mt-3">
          نعيد الاتصال بحسابك بأمان. لن نسجّل خروجك بسبب انقطاع مؤقت في خدمة التحقق.
        </p>
        <div className="mt-6 flex justify-center">
          <button type="button" className="md-button md-button-secondary" onClick={retryManually}>
            المحاولة مجددًا
          </button>
        </div>
      </section>
    </main>
  );
}
