import { Skeleton, SkeletonGroup } from "@/components/ui/Enterprise";

export default function WorkspaceLoading() {
  return (
    <main className="md-workspace-module" aria-busy="true">
      <SkeletonGroup label="جارٍ تحميل بيانات التجارة">
        <div className="grid gap-2"><Skeleton className="h-7 w-48" /><Skeleton className="h-4 w-80 max-w-full" /></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-32 w-full rounded-2xl" />)}
        </div>
        <Skeleton className="mt-5 h-72 w-full rounded-2xl" />
      </SkeletonGroup>
    </main>
  );
}
