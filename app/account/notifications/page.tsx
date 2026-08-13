import Link from "next/link";
import { markNotificationsRead } from "@/app/actions/orders";
import { AccountPage, AccountPageHeader } from "@/components/account/AccountPage";
import { requireUser } from "@/src/lib/auth";
import { supabaseFetch } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "الإشعارات | حساب مَدار" };

type Notification = { id: string; title: string; body: string; link: string | null; read_at: string | null; created_at: string };

export default async function NotificationsPage() {
  await requireUser();
  const rows = (await supabaseFetch("/rest/v1/notifications?select=*&order=created_at.desc&limit=100")) as Notification[];
  return (
    <AccountPage>
      <AccountPageHeader title="الإشعارات" description="تاريخ الأحداث المهمة في الخدمات والطلبات والدفع. الرسائل اللحظية لا تُخزّن هنا." actions={<form action={markNotificationsRead}><button className="md-button md-button-secondary">تحديد الكل كمقروء</button></form>} />
      <div className="grid gap-3">
        {rows?.length ? rows.map((item) => (
          <article key={item.id} className={`md-notification-card ${item.read_at ? "" : "is-unread"}`}>
            <span className={item.read_at ? "" : "is-unread"} aria-label={item.read_at ? "مقروء" : "غير مقروء"} />
            <div><h2>{item.title}</h2><p>{item.body}</p></div>
            <div><time>{new Date(item.created_at).toLocaleString("ar-YE")}</time>{item.link ? <Link href={item.link} className="md-button md-button-ghost md-button-sm">فتح</Link> : null}</div>
          </article>
        )) : <div className="md-empty"><div><h2 className="text-xl font-black">لا توجد إشعارات</h2><p className="mt-2 text-slate-400">ستظهر هنا تحديثات الخدمات والطلبات التي تحتاج الرجوع إليها.</p></div></div>}
      </div>
    </AccountPage>
  );
}
