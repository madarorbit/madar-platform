"use client";

import { useEffect } from "react";
import { Button, EmptyState } from "@/components/ui/Enterprise";

export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("retail-ui-error", error); }, [error]);
  return (
    <main className="md-workspace-module">
      <EmptyState
        icon="warning"
        title="تعذر تحميل قسم Retail"
        description="بيانات تجارتك لم تتغير، والتنقل إلى بقية مَدار ما زال متاحًا."
        action={<Button onClick={reset}>إعادة المحاولة</Button>}
      />
    </main>
  );
}
