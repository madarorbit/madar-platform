import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountPage } from "@/components/account/AccountPage";
import PaymentProofForm from "@/components/orders/PaymentProofForm";
import { Breadcrumbs } from "@/components/ui/Breadcrumbs";
import { requireUser } from "@/src/lib/auth";
import { orderStatus, paymentStatus } from "@/src/lib/order-status";
import { formatStoreMoney } from "@/src/lib/store/currency";
import { supabaseFetch } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function OrderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireUser();
  const { id } = await params;
  const [rows, currencies] = await Promise.all([
    supabaseFetch(`/rest/v1/orders?id=eq.${encodeURIComponent(id)}&select=*,order_items(*),payment_methods(name,account_name,account_identifier,instructions)&limit=1`),
    supabaseFetch("/rest/v1/currencies?select=code,name,symbol,decimal_places,is_active"),
  ]);
  const order = rows?.[0];
  if (!order) notFound();
  const payable = ["unpaid", "rejected"].includes(order.payment_status);
  const originalCurrency = order.original_currency || order.currency;
  const originalAmount = order.original_amount ?? order.total;
  const method = Array.isArray(order.payment_methods) ? order.payment_methods[0] : order.payment_methods;
  return (
    <AccountPage>
      <Breadcrumbs items={[{ label: "حساب مَدار", href: "/account" }, { label: "طلباتي", href: "/account/orders" }, { label: order.order_number }]} />
      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <article className="rounded-3xl border border-white/10 bg-white/[.04] p-6">
            <div className="flex flex-wrap items-center justify-between gap-4"><h1 dir="ltr" className="text-3xl font-black">{order.order_number}</h1><div><p>{orderStatus[order.status]}</p><p className="text-[#70E4D4]">{paymentStatus[order.payment_status]}</p></div></div>
            <div className="mt-6 grid gap-3 sm:grid-cols-2"><div><p className="text-sm text-slate-400">السعر الأصلي</p><strong>{formatStoreMoney(originalAmount, originalCurrency, currencies)}</strong></div><div><p className="text-sm text-slate-400">المبلغ المطلوب</p><strong>{order.payment_currency ? formatStoreMoney(order.payment_amount, order.payment_currency, currencies) : formatStoreMoney(originalAmount, originalCurrency, currencies)}</strong></div>{order.exchange_rate ? <div><p className="text-sm text-slate-400">سعر الصرف المثبت</p><strong dir="ltr">{order.exchange_rate}</strong></div> : null}<div><p className="text-sm text-slate-400">رقم العملية</p><strong dir="ltr">{order.payment_reference || "—"}</strong></div></div>
            {order.admin_note ? <p className="mt-5 rounded-xl bg-amber-300/10 p-4">{order.admin_note}</p> : null}
          </article>
          {order.payment_status === "approved" ? <div className="rounded-3xl border border-emerald-300/20 bg-emerald-300/10 p-6"><h2 className="text-xl font-black">تمت الموافقة</h2><p className="mt-2">المنتج متاح الآن في مكتبتك.</p><Link href="/account/purchases" className="md-button md-button-primary mt-4">فتح المكتبة</Link></div> : null}
        </div>
        <aside>{order.payment_status === "under_review" ? <div className="md-panel"><h2 className="text-xl font-black">الدفع قيد المراجعة</h2>{method ? <><p className="mt-4 font-bold">{method.name}</p><p className="text-sm text-slate-300">{method.account_name} · <span dir="ltr">{method.account_identifier}</span></p></> : null}<p className="mt-4 text-sm text-slate-400">تم تثبيت السعر وسعر الصرف داخل هذا الطلب.</p></div> : payable ? <PaymentProofForm orderId={order.id} /> : <div className="md-panel">تمت معالجة الدفع.</div>}</aside>
      </div>
    </AccountPage>
  );
}
