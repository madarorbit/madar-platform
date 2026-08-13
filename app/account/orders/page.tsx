import Link from "next/link";
import { AccountPage, AccountPageHeader } from "@/components/account/AccountPage";
import { ButtonLink, EmptyState } from "@/components/ui/Enterprise";
import { requireUser } from "@/src/lib/auth";
import { formatCurrency, formatDate } from "@/src/lib/format";
import { orderStatus, paymentStatus } from "@/src/lib/order-status";
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
      {!orders?.length ? <EmptyState title="لا توجد طلبات بعد" description="ابدأ من المتجر، ثم ستظهر هنا حالة الدفع والتنفيذ." icon="document" action={<ButtonLink href="/store">استعراض المتجر</ButtonLink>} /> : (
        <div className="grid gap-3">
          {orders.map((order) => <Link href={`/account/orders/${order.id}`} key={order.id} className="md-order-row"><div><span>رقم الطلب</span><strong dir="ltr">{order.order_number}</strong></div><div><span>الحالة</span><strong>{orderStatus[order.status] || order.status}</strong></div><div><span>الدفع</span><strong>{paymentStatus[order.payment_status] || order.payment_status}</strong></div><div><span>التاريخ</span><strong>{formatDate(order.created_at)}</strong></div><b>{formatCurrency(order.total, order.currency)}</b></Link>)}
        </div>
      )}
    </AccountPage>
  );
}
