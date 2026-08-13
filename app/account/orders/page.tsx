import Link from "next/link";
import { AccountPage, AccountPageHeader } from "@/components/account/AccountPage";
import { requireUser } from "@/src/lib/auth";
import { money, orderStatus, paymentStatus } from "@/src/lib/order-status";
import { supabaseFetch } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "طلباتي | حساب مَدار" };

type Order = { id: string; order_number: string; status: string; payment_status: string; total: number; currency: string; created_at: string };

export default async function OrdersPage() {
  await requireUser();
  const orders = (await supabaseFetch("/rest/v1/orders?select=id,order_number,status,payment_status,total,currency,created_at&order=created_at.desc")) as Order[];
  return (
    <AccountPage>
      <AccountPageHeader title="طلباتي" description="من إنشاء الطلب إلى إثبات الدفع والمراجعة والتسليم في مسار واحد." />
      {!orders?.length ? <div className="md-empty"><div><h2 className="text-xl font-black">لا توجد طلبات بعد</h2><p className="mt-2 text-slate-400">ابدأ من المتجر، ثم ستظهر هنا حالة الدفع والتنفيذ.</p><Link href="/store" className="md-button md-button-primary mt-5">استعراض المتجر</Link></div></div> : (
        <div className="grid gap-3">
          {orders.map((order) => <Link href={`/account/orders/${order.id}`} key={order.id} className="md-order-row"><div><span>رقم الطلب</span><strong dir="ltr">{order.order_number}</strong></div><div><span>الحالة</span><strong>{orderStatus[order.status] || order.status}</strong></div><div><span>الدفع</span><strong>{paymentStatus[order.payment_status] || order.payment_status}</strong></div><div><span>التاريخ</span><strong>{new Date(order.created_at).toLocaleDateString("ar-YE")}</strong></div><b>{money(order.total, order.currency)}</b></Link>)}
        </div>
      )}
    </AccountPage>
  );
}
