import { Skeleton, SkeletonGroup } from "@/components/ui/Enterprise";

export default function OrbyLoading() {
  return (
    <main className="md-orby-shell" aria-busy="true">
      <header className="md-orby-header"><Skeleton className="h-10 w-40 rounded-xl" /><Skeleton className="h-10 w-32 rounded-xl" /></header>
      <SkeletonGroup label="جارٍ فتح ORBY" className="mx-auto grid w-full max-w-3xl gap-4 p-6">
        <Skeleton className="h-20 w-4/5 rounded-2xl" />
        <Skeleton className="ms-auto h-16 w-2/3 rounded-2xl" />
        <Skeleton className="h-24 w-5/6 rounded-2xl" />
      </SkeletonGroup>
    </main>
  );
}
