import { Skeleton, SkeletonGroup } from "@/components/ui/Enterprise";

export default function AccountLoading() {
  return (
    <main className="md-account-page" aria-busy="true">
      <SkeletonGroup label="جارٍ تحميل حساب مَدار">
        <div className="grid gap-3">
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          {Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-36 w-full rounded-2xl" />)}
        </div>
      </SkeletonGroup>
    </main>
  );
}
