import Link from "next/link";
import ActionFeedback from "@/components/business/ActionFeedback";
import { EntityForm } from "@/components/admin/EntityForm";
import { setServiceSubscriptionState } from "@/app/actions/services";
import { Badge, Card, EmptyState } from "@/components/ui/Enterprise";
import { Icon } from "@/components/ui/Icons";
import { requireSuperAdmin } from "@/src/lib/auth";
import { serviceDefinition, type ServiceCode } from "@/src/lib/services/catalog";
import { supabaseFetch } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "المستخدمون والخدمات | إدارة مَدار" };

type Profile = { id: string; email: string; full_name: string | null; role: string; status: string; created_at: string };
type Subscription = { id: string; user_id: string; service_code: ServiceCode; status: string; activation_state: string; starts_at: string; ends_at: string; suspension_reason: string | null };

const stateLabel: Record<string, string> = {
  ACTIVE: "فعّالة",
  PROVISIONING: "قيد التجهيز",
  SUSPENDED: "موقوفة",
  EXPIRED: "منتهية",
};

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  await requireSuperAdmin();
  const [feedback, profilesValue, subscriptionsValue] = await Promise.all([
    searchParams,
    supabaseFetch("/rest/v1/profiles?select=id,email,full_name,role,status,created_at&order=created_at.desc"),
    supabaseFetch("/rest/v1/workspace_subscriptions?select=id,user_id,service_code,status,activation_state,starts_at,ends_at,suspension_reason&order=created_at.desc"),
  ]);
  const profiles = (profilesValue || []) as Profile[];
  const subscriptions = (subscriptionsValue || []) as Subscription[];
  const byUser = new Map<string, Subscription[]>();
  for (const item of subscriptions) byUser.set(item.user_id, [...(byUser.get(item.user_id) || []), item]);
  // This is a dynamic Server Component; capture one request-stable instant for all expiry checks.
  // eslint-disable-next-line react-hooks/purity
  const renderedAt = Date.now();

  return <main className="mx-auto max-w-7xl p-4 py-8 sm:p-6">
    <header className="flex flex-wrap items-end justify-between gap-4">
      <div><p className="font-bold text-emerald-300">الحسابات والصلاحيات</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">المستخدمون وخدماتهم</h1><p className="mt-3 max-w-3xl leading-8 text-slate-400">الحساب مستقل عن الخدمات. يمكن للمستخدم امتلاك أكثر من خدمة، ولكل خدمة اشتراك وحالة وتاريخ صلاحية مستقل.</p></div>
      <Link href="/admin/workspace-requests" className="md-button md-button-primary"><Icon name="document" />طلبات الخدمات</Link>
    </header>
    <div className="mt-6"><ActionFeedback {...feedback} /></div>
    <section className="mt-7 grid gap-3 sm:grid-cols-3">
      <Card><p className="text-sm text-slate-400">الحسابات</p><strong className="mt-2 block text-3xl">{profiles.length}</strong></Card>
      <Card><p className="text-sm text-slate-400">اشتراكات الخدمات</p><strong className="mt-2 block text-3xl">{subscriptions.length}</strong></Card>
      <Card><p className="text-sm text-slate-400">خدمات فعالة</p><strong className="mt-2 block text-3xl text-emerald-200">{subscriptions.filter((item) => item.activation_state === "ACTIVE" && new Date(item.ends_at).getTime() > renderedAt).length}</strong></Card>
    </section>
    <section className="mt-8 grid gap-5">
      {profiles.map((profile) => {
        const userServices = byUser.get(profile.id) || [];
        return <article className="md-panel" key={profile.id}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3"><span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-violet-300/10 text-violet-100"><Icon name="user" /></span><div className="min-w-0"><h2 className="truncate text-lg font-black">{profile.full_name || "مستخدم مَدار"}</h2><p className="truncate text-sm text-slate-400" dir="ltr">{profile.email}</p></div></div>
            <div className="flex gap-2"><Badge variant={profile.status === "active" ? "success" : "danger"}>{profile.status === "active" ? "نشط" : "معطل"}</Badge><Badge variant={profile.role === "SUPER_ADMIN" ? "brand" : "default"}>{profile.role}</Badge></div>
          </div>
          <div className="mt-5 grid gap-3 xl:grid-cols-3">
            {userServices.map((subscription) => {
              const definition = serviceDefinition(subscription.service_code);
              const active = subscription.activation_state === "ACTIVE" && new Date(subscription.ends_at).getTime() > renderedAt;
              return <div className="rounded-2xl border border-white/10 bg-white/[.025] p-4" key={subscription.id}>
                <div className="flex items-start justify-between gap-3"><div><strong>{definition.shortName}</strong><p className="mt-1 text-xs text-slate-500">حتى {new Date(subscription.ends_at).toLocaleDateString("ar-YE")}</p></div><Badge variant={active ? "success" : subscription.activation_state === "SUSPENDED" ? "danger" : "default"}>{stateLabel[subscription.activation_state] || subscription.activation_state}</Badge></div>
                <form action={setServiceSubscriptionState} className="mt-4 grid gap-2">
                  <input type="hidden" name="subscription_id" value={subscription.id} />
                  <input className="field rounded-xl px-3 py-2 text-sm" name="reason" maxLength={500} placeholder="سبب القرار عند الإيقاف" />
                  <div className="flex gap-2">{active ? <button className="md-button md-button-secondary md-button-sm" name="requested_state" value="SUSPENDED">إيقاف الخدمة</button> : <button className="md-button md-button-primary md-button-sm" name="requested_state" value="ACTIVE">إعادة التفعيل</button>}<button className="md-button md-button-secondary md-button-sm" name="requested_state" value="EXPIRED">تحديد منتهية</button></div>
                </form>
              </div>;
            })}
            {!userServices.length ? <EmptyState title="لا توجد خدمات" description="هذا حساب مَدار فقط، ولم تُفعّل له خدمة بعد." /> : null}
          </div>
          <details className="mt-5"><summary className="cursor-pointer text-sm font-bold text-violet-200">إدارة دور الحساب وحالته</summary><div className="mt-4"><EntityForm kind="user" initial={profile as unknown as Record<string, unknown>} /></div></details>
        </article>;
      })}
      {!profiles.length ? <EmptyState title="لا توجد حسابات" description="ستظهر حسابات مَدار هنا بعد التسجيل." /> : null}
    </section>
  </main>;
}
