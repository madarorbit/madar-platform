import Link from "next/link";
import { AccountPage, AccountPageHeader } from "@/components/account/AccountPage";
import { ButtonLink, EmptyState, ErrorState, StatusBadge, type StatusTone } from "@/components/ui/Enterprise";
import { Icon } from "@/components/ui/Icons";
import { getAccountPayments } from "@/src/lib/account/server";
import { formatCurrency, formatDateTime } from "@/src/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "المدفوعات | حساب مَدار" };

const labels: Record<string, string> = {
  unpaid: "بانتظار الدفع",
  under_review: "قيد المراجعة",
  approved: "معتمدة",
  rejected: "مرفوضة",
  cancelled: "ملغاة",
};

const tone = (status: string): StatusTone => status === "approved" ? "approved" : status === "rejected" ? "rejected" : status === "cancelled" ? "draft" : "pending";

export default async function PaymentsPage() {
  const payments = await getAccountPayments();
  return <AccountPage>
    <AccountPageHeader eyebrow="الحساب والملكية" title="المدفوعات" description="طلبات الدفع الفعلية من المتجر والخدمات والتجديد وORBY في سجل واحد، مع إبقاء كل مبلغ بعملته الأصلية." actions={<Link href="/account/orders" className="md-button md-button-secondary"><Icon name="document" />طلبات المتجر</Link>} />
    {payments.failed ? <ErrorState title="بعض مصادر المدفوعات لم تستجب" description="المعروض هو ما أمكن تحميله الآن. لم تُجمع العملات أو تُفترض مبالغ بديلة." action={<ButtonLink href="/account/payments" variant="secondary">إعادة المحاولة</ButtonLink>} /> : null}
    {payments.data.length ? <div className="md-payments-list">
      {payments.data.map((payment) => <article className="md-payment-row" key={`${payment.source}-${payment.id}`}>
        <div className="md-payment-main"><span className="md-home-summary-icon"><Icon name={payment.source === "orby" ? "sparkles" : payment.source === "store" ? "store" : "layers"} /></span><div><h2>{payment.label}</h2><p>{formatDateTime(payment.createdAt)}</p></div></div>
        <dl><div><dt>المبلغ</dt><dd>{formatCurrency(payment.amount, payment.currency)}</dd></div><div><dt>المرجع</dt><dd dir="ltr">{payment.reference || "—"}</dd></div></dl>
        <StatusBadge status={tone(payment.status)}>{labels[payment.status] || payment.status}</StatusBadge>
        <Link href={payment.href} className="md-button md-button-ghost md-button-sm">عرض التفاصيل<Icon name="arrow" className="md-icon-directional" /></Link>
        {payment.note ? <p className="md-payment-note">{payment.note}</p> : null}
      </article>)}
    </div> : !payments.failed ? <EmptyState title="لا توجد مدفوعات بعد" description="ستظهر هنا دفعات الخدمات والاشتراكات ومشتريات المتجر عندما تنشئ أول طلب." icon="document" action={<ButtonLink href="/account/services">استعراض خدماتي</ButtonLink>} /> : null}
  </AccountPage>;
}
