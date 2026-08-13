"use client";

import { useEffect } from "react";
import { Button, EmptyState } from "@/components/ui/Enterprise";

export default function AccountError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("account-ui-error", error); }, [error]);
  return (
    <main className="md-account-page">
      <EmptyState
        icon="warning"
        title="تعذر عرض هذا القسم"
        description="ظل تنقل مَدار متاحًا ولم تتغير بياناتك. أعد المحاولة أو انتقل إلى قسم آخر."
        action={<Button onClick={reset}>إعادة المحاولة</Button>}
      />
    </main>
  );
}
