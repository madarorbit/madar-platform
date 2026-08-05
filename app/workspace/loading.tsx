import { Skeleton } from "@/components/ui/Enterprise";

export default function WorkspaceLoading() {
  return <main className="md-workspace-module" aria-busy="true" aria-label="جارٍ تحميل مساحة العمل">
    <header className="md-module-header"><div className="md-module-heading-row"><div className="flex items-center gap-3"><Skeleton className="h-10 w-10 rounded-xl" /><div className="grid gap-2"><Skeleton className="h-5 w-44" /><Skeleton className="h-3 w-72 max-w-full" /></div></div></div></header>
    <div className="md-list-toolbar"><Skeleton className="h-9 w-80 max-w-full rounded-xl" /><Skeleton className="h-9 w-28 rounded-xl" /></div>
    <div className="mt-4 grid gap-2">{Array.from({ length: 8 }, (_, index) => <Skeleton key={index} className="h-14 w-full rounded-xl" />)}</div>
  </main>;
}
