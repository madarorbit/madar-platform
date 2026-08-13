import Link from "next/link";
import { notFound } from "next/navigation";
import { AccountPage, AccountPageHeader } from "@/components/account/AccountPage";
import PaymentProofForm from "@/components/orders/PaymentProofForm";
import { Breadcrumbs, Notice, StatusBadge, type StatusTone } from "@/components/ui/Enterprise";
import { requireUser } from "@/src/lib/auth";
import { orderStatus, paymentStatus } from "@/src/lib/order-status";
import { formatStoreMoney } from "@/src/lib/store/currency";
import { supabaseFetch } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";

const paymentTone = (status: string): StatusTone => status === "approved" ? "approved" : status === "rejected" ? "rejected" : status === "unpaid" ? "draft" : "pending";

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
  return <AccountPage>
    <Breadcrumbs items={[{ label: "حساب مَدار", href: "/account" }, { label: "طلباتي", href: "/account/orders" }, { label: order.order_number }]} />
    <AccountPageHeader eyebrow="طلب متجر مَدار" title={order.order_number} description="حالة الطلب والدفع والمبلغ المثبت وقت الشراء، دون خلطه باشتراكات الخدمات." actions={<StatusBadge status={paymentTone(order.payment_status)}>{paymentStatus[order.payment_status] || order.payment_status}</StatusBadge>} />
    <div className="md-order-detail-layout">
      <div className="grid content-start gap-5">
        <section className="md-account-section"><div className="md-home-section-heading"><div><span className="md-eyebrow">الحالة</span><h2>{orderStatus[order.status] || order.status}</h2></div></div><dl className="md-order-facts"><div><dt>السعر الأصلي</dt><dd>{formatStoreMoney(originalAmount, originalCurrency, currencies)}</dd></div><div><dt>المبلغ المطلوب</dt><dd>{order.payment_currency ? formatStoreMoney(order.payment_amount, order.payment_currency, currencies) : formatStoreMoney(originalAmount, originalCurrency, currencies)}</dd></div>{order.exchange_rate ? <div><dt>سعر الصرف المثبت</dt><dd dir="ltr">{order.exchange_rate}</dd></div> : null}<div><dt>رقم العملية</dt><dd dir="ltr">{order.payment_reference || "—"}</dd></div></dl>{order.admin_note ? <Notice title="ملاحظة المراجعة" variant="warning">{order.admin_note}</Notice> : null}</section>
        {order.payment_status === "approved" ? <Notice title="تمت الموافقة" variant="success">المنتج متاح الآن في مكتبتك. <Link href="/account/purchases" className="font-bold underline">فتح المكتبة</Link></Notice> : null}
      </div>
      <aside>{order.payment_status === "under_review" ? <section className="md-account-section"><span className="md-eyebrow">المراجعة</span><h2>الدفع قيد المراجعة</h2>{method ? <div className="mt-4"><strong>{method.name}</strong><p className="md-type-body-sm md-muted mt-1">{method.account_name} · <span dir="ltr">{method.account_identifier}</span></p></div> : null}<p className="md-type-body-sm md-muted mt-4">تم تثبيت السعر وسعر الصرف داخل هذا الطلب.</p></section> : payable ? <PaymentProofForm orderId={order.id} /> : <Notice title="تمت معالجة الدفع" variant="success" />}</aside>
    </div>
  </AccountPage>;
}
