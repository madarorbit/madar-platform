import Link from "next/link";
import { markNotificationsRead } from "@/app/actions/orders";
import { AccountPage, AccountPageHeader } from "@/components/account/AccountPage";
import { Button, EmptyState } from "@/components/ui/Enterprise";
import { requireUser } from "@/src/lib/auth";
import { formatDateTime } from "@/src/lib/format";
import { supabaseFetch } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "الإشعارات | حساب مَدار" };

type Notification = { id: string; title: string; body: string; link: string | null; read_at: string | null; created_at: string };

export default async function NotificationsPage() {
  await requireUser();
  const rows = (await supabaseFetch("/rest/v1/notifications?select=*&order=created_at.desc&limit=100")) as Notification[];
  return (
    <AccountPage>
      <AccountPageHeader title="الإشعارات" description="تاريخ الأحداث المهمة في الخدمات والطلبات والدفع. الرسائل اللحظية لا تُخزّن هنا." actions={<form action={markNotificationsRead}><Button variant="secondary">تحديد الكل كمقروء</Button></form>} />
      <div className="grid gap-3">
        {rows?.length ? rows.map((item) => (
          <article key={item.id} className={`md-notification-card ${item.read_at ? "" : "is-unread"}`}>
            <span className={item.read_at ? "" : "is-unread"} aria-label={item.read_at ? "مقروء" : "غير مقروء"} />
            <div><h2>{item.title}</h2><p>{item.body}</p></div>
            <div><time dateTime={item.created_at}>{formatDateTime(item.created_at)}</time>{item.link ? <Link href={item.link} className="md-button md-button-ghost md-button-sm">فتح</Link> : null}</div>
          </article>
        )) : <EmptyState title="لا توجد إشعارات" description="ستظهر هنا تحديثات الخدمات والطلبات التي تحتاج الرجوع إليها." icon="bell" compact />}
      </div>
    </AccountPage>
  );
}
