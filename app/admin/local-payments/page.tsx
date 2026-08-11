import Link from "next/link";
import { savePaymentMethod } from "@/app/actions/local-payments";
import { saveServicePlan } from "@/app/actions/services";
import ActionFeedback from "@/components/business/ActionFeedback";
import { Badge, Card, EmptyState } from "@/components/ui/Enterprise";
import { Icon } from "@/components/ui/Icons";
import { requireAdmin } from "@/src/lib/auth";
import { businessMoney } from "@/src/lib/business";
import { serviceDefinition, type ServiceCode } from "@/src/lib/services/catalog";
import { supabaseFetch } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "الخدمات والدفع | إدارة مَدار" };

type Plan = { id: string; service_code: ServiceCode; name: string; description: string | null; price: number; currency: string; billing_months: number; grace_days: number; is_active: boolean; is_available: boolean };
type Method = { id: string; code: string; name: string; method_type: string; account_name: string | null; account_identifier: string | null; instructions: string | null; currency: string; is_active: boolean; sort_order: number };
type Subscription = { id: string; service_code: ServiceCode; status: string; activation_state: string; ends_at: string };

export default async function ServicePaymentsAdmin({ searchParams }: { searchParams: Promise<{ success?: string; error?: string }> }) {
  await requireAdmin();
  const [feedback, planRows, methodRows, requestRows, subscriptionRows] = await Promise.all([
    searchParams,
    supabaseFetch("/rest/v1/subscription_plans?select=id,service_code,name,description,price,currency,billing_months,grace_days,is_active,is_available&order=created_at"),
    supabaseFetch("/rest/v1/payment_methods?select=*&order=sort_order.asc"),
    supabaseFetch("/rest/v1/workspace_requests?status=eq.pending_review&select=id"),
    supabaseFetch("/rest/v1/workspace_subscriptions?select=id,service_code,status,activation_state,ends_at"),
  ]);
  const plans = (planRows || []) as Plan[];
  const methods = (methodRows || []) as Method[];
  const subscriptions = (subscriptionRows || []) as Subscription[];
  // This is a dynamic Server Component; capture one request-stable instant for all expiry checks.
  // eslint-disable-next-line react-hooks/purity
  const renderedAt = Date.now();
  const active = subscriptions.filter((item) => item.status === "active" && item.activation_state === "ACTIVE" && new Date(item.ends_at).getTime() > renderedAt).length;
  return (
    <main className="mx-auto max-w-7xl p-4 py-8 sm:p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div><p className="font-bold text-emerald-300">إدارة مركزية</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">الخدمات والأسعار وطرق الدفع</h1><p className="mt-3 max-w-3xl leading-8 text-slate-400">باقة واحدة وسعر واحد لكل خدمة. أي تعديل هنا ينعكس مباشرة على العميل، وطرق الدفع لا تظهر إلا إذا كانت مفعّلة ومطابقة للعملة.</p></div>
        <Link href="/admin/workspace-requests" className="md-button md-button-primary"><Icon name="document" />طلبات الموافقة ({requestRows?.length || 0})</Link>
      </header>
      <div className="mt-6"><ActionFeedback {...feedback} /></div>
      <section className="mt-7 grid gap-4 sm:grid-cols-3">
        <Card className="p-5"><p className="text-sm text-slate-400">الخدمات المتاحة</p><strong className="mt-2 block text-3xl">{plans.filter((plan) => plan.is_available).length}</strong></Card>
        <Card className="p-5"><p className="text-sm text-slate-400">اشتراكات فعالة</p><strong className="mt-2 block text-3xl text-emerald-200">{active}</strong></Card>
        <Card className="p-5"><p className="text-sm text-slate-400">طرق دفع مفعلة</p><strong className="mt-2 block text-3xl">{methods.filter((method) => method.is_active).length}</strong></Card>
      </section>

      <section className="mt-10">
        <h2 className="text-2xl font-black">أسعار خدمات مَدار</h2>
        <p className="mt-2 text-sm text-slate-400">لا توجد أسعار داخل الواجهة؛ القيمة المعروضة للعميل تقرأ من هذه السجلات.</p>
        <div className="mt-5 grid gap-5 xl:grid-cols-3">
          {plans.map((plan) => {
            const definition = serviceDefinition(plan.service_code);
            return (
              <form action={saveServicePlan} key={plan.id} className="md-panel grid gap-4">
                <input type="hidden" name="service_code" value={plan.service_code} />
                <div className="flex items-start justify-between gap-3"><span className="grid h-11 w-11 place-items-center rounded-xl bg-violet-300/10 text-violet-100"><Icon name={definition.icon} /></span><Badge variant={plan.is_available ? "success" : "danger"}>{plan.is_available ? "متاحة" : "معطلة"}</Badge></div>
                <div><h3 className="text-xl font-black">{definition.name}</h3><p className="mt-2 text-sm leading-7 text-slate-400">{plan.description}</p><strong className="mt-3 block text-2xl text-emerald-200">{businessMoney(plan.price, plan.currency)}</strong></div>
                <div className="grid grid-cols-2 gap-3">
                  <label className="grid gap-2 text-sm font-bold">السعر<input className="field rounded-xl p-3" name="price" type="number" min="0" step="0.01" defaultValue={plan.price} required /></label>
                  <label className="grid gap-2 text-sm font-bold">العملة<select className="field rounded-xl p-3" name="currency" defaultValue={plan.currency}><option value="YER">YER</option><option value="SAR">SAR</option><option value="USD">USD</option></select></label>
                  <label className="grid gap-2 text-sm font-bold">مدة الاشتراك<input className="field rounded-xl p-3" name="billing_months" type="number" min="1" max="36" defaultValue={plan.billing_months} /></label>
                  <label className="grid gap-2 text-sm font-bold">أيام السماح<input className="field rounded-xl p-3" name="grace_days" type="number" min="0" max="60" defaultValue={plan.grace_days} /></label>
                </div>
                <label className="grid gap-2 text-sm font-bold">إتاحة الخدمة<select className="field rounded-xl p-3" name="is_available" defaultValue={String(plan.is_available)}><option value="true">متاحة للعملاء</option><option value="false">معطلة مؤقتًا</option></select></label>
                <button className="md-button md-button-primary">حفظ السعر والحالة</button>
              </form>
            );
          })}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-2xl font-black">طرق الدفع المحلية</h2>
        <p className="mt-2 text-sm text-slate-400">يمكن إضافة طريقة جديدة أو تعديل البيانات وتعطيلها دون تغيير الواجهة.</p>
        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          {[...methods, null].map((method, index) => (
            <form action={savePaymentMethod} key={method?.id || `new-${index}`} className={`md-panel grid gap-4 ${!method ? "border-emerald-300/20" : ""}`}>
              {method ? <input type="hidden" name="id" value={method.id} /> : null}
              <div className="flex items-center justify-between gap-3"><h3 className="text-xl font-black">{method?.name || "إضافة طريقة دفع"}</h3><Badge variant={method?.is_active ? "success" : "default"}>{method?.is_active ? "مفعلة" : method ? "معطلة" : "جديدة"}</Badge></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="grid gap-2 text-sm font-bold">الرمز<input name="code" defaultValue={method?.code || ""} required pattern="[A-Z0-9_-]{3,40}" dir="ltr" className="field rounded-xl p-3" /></label>
                <label className="grid gap-2 text-sm font-bold">الاسم<input name="name" defaultValue={method?.name || ""} required minLength={2} maxLength={120} className="field rounded-xl p-3" /></label>
                <label className="grid gap-2 text-sm font-bold">النوع<select name="method_type" defaultValue={method?.method_type || "wallet"} className="field rounded-xl p-3"><option value="wallet">محفظة محلية</option><option value="bank">تحويل بنكي</option></select></label>
                <label className="grid gap-2 text-sm font-bold">العملة<select name="currency" defaultValue={method?.currency || "YER"} className="field rounded-xl p-3"><option value="YER">YER</option><option value="SAR">SAR</option><option value="USD">USD</option></select></label>
                <label className="grid gap-2 text-sm font-bold">اسم الحساب<input name="account_name" defaultValue={method?.account_name || ""} maxLength={120} className="field rounded-xl p-3" /></label>
                <label className="grid gap-2 text-sm font-bold">رقم الحساب<input name="account_identifier" defaultValue={method?.account_identifier || ""} maxLength={160} dir="ltr" className="field rounded-xl p-3" /></label>
              </div>
              <label className="grid gap-2 text-sm font-bold">تعليمات التحويل<textarea name="instructions" defaultValue={method?.instructions || ""} maxLength={1000} rows={3} className="field rounded-xl p-3" /></label>
              <div className="grid grid-cols-2 gap-3"><label className="grid gap-2 text-sm font-bold">ترتيب العرض<input name="sort_order" type="number" min="0" max="10000" defaultValue={method?.sort_order || 100} className="field rounded-xl p-3" /></label><label className="grid gap-2 text-sm font-bold">الحالة<select name="is_active" defaultValue={String(method?.is_active || false)} className="field rounded-xl p-3"><option value="true">مفعلة</option><option value="false">معطلة</option></select></label></div>
              <button className="md-button md-button-primary">{method ? "حفظ الطريقة" : "إضافة طريقة الدفع"}</button>
            </form>
          ))}
          {!methods.length ? <EmptyState title="لا توجد طرق دفع" description="أضف أول طريقة دفع محلية من النموذج." /> : null}
        </div>
      </section>
    </main>
  );
}
