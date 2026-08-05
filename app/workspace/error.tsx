"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/Enterprise";
import { WorkspaceState } from "@/components/workspace/WorkspaceModule";

export default function WorkspaceError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error("workspace-ui-error", error); }, [error]);
  return <main className="md-workspace-module"><WorkspaceState tone="danger" icon="shield" title="تعذر عرض هذه الوحدة" description="لم تتغير بياناتك. أعد المحاولة، وإن استمرت المشكلة ارجع إلى نظرة عامة ثم افتح الوحدة من جديد." action={<Button onClick={reset}>إعادة المحاولة</Button>} /></main>;
}
