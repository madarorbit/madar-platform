import Image from "next/image";
import Link from "next/link";
import { AccountPage, AccountPageHeader } from "@/components/account/AccountPage";
import { ButtonLink, Card, EmptyState } from "@/components/ui/Enterprise";
import { requireUser } from "@/src/lib/auth";
import { catalogImageUrl } from "@/src/lib/catalog-media";
import { formatDate } from "@/src/lib/format";
import { formatStoreMoney, type CurrencyDefinition } from "@/src/lib/store/currency";
import { supabaseFetch } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "مكتبتي | حساب مَدار" };

type Purchase = { id: string; product_name: string; thumbnail_path: string | null; original_amount: number | string; original_currency: string; payment_amount: number | string | null; payment_currency: string | null; exchange_rate: number | string | null; purchased_at: string; product_files: { original_filename: string; mime_type: string } | Array<{ original_filename: string; mime_type: string }> | null };

export default async function PurchasesPage() {
  const user = await requireUser();
  const [currencies, items] = await Promise.all([
    supabaseFetch("/rest/v1/currencies?select=code,name,symbol,decimal_places,is_active"),
    supabaseFetch(`/rest/v1/product_entitlements?user_id=eq.${encodeURIComponent(user.id)}&select=id,product_name,thumbnail_path,original_amount,original_currency,payment_amount,payment_currency,exchange_rate,purchased_at,product_files(original_filename,mime_type)&order=purchased_at.desc`),
  ]);
  return (
    <AccountPage>
      <AccountPageHeader eyebrow="المتجر والمشتريات" title="مكتبتي" description="المنتجات الرقمية التي أصبحت مستحقة لحسابك بعد اعتماد الدفع، مع الملف الصحيح وقت الشراء." />
      {items?.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{(items as Purchase[]).map((item) => {
        const file = Array.isArray(item.product_files) ? item.product_files[0] : item.product_files;
        const image = catalogImageUrl(item.thumbnail_path);
        return <Card as="article" key={item.id} className="md-library-card">{image ? <div className="md-library-card-media"><Image src={image} alt={item.product_name} fill className="object-cover" /></div> : null}<div className="md-library-card-body"><h2>{item.product_name}</h2><p className="md-type-body-sm md-muted">تاريخ الشراء: {formatDate(item.purchased_at)}</p><dl><div><dt>السعر الأصلي</dt><dd>{formatStoreMoney(item.original_amount, item.original_currency, currencies as CurrencyDefinition[])}</dd></div>{item.payment_currency && item.payment_amount !== null ? <div><dt>تم الدفع</dt><dd>{formatStoreMoney(item.payment_amount, item.payment_currency, currencies as CurrencyDefinition[])}</dd></div> : null}</dl><p className="md-type-caption md-muted">الملف: {file?.original_filename || "ملف رقمي"}</p><Link href={`/account/purchases/${item.id}/download`} className="md-button md-button-primary w-full">تحميل الملف</Link></div></Card>;
      })}</div> : <EmptyState title="لا توجد مشتريات بعد" description="بعد اعتماد الدفع ينتقل المنتج من الطلب إلى مكتبتك تلقائيًا." icon="book" action={<ButtonLink href="/store">فتح المتجر</ButtonLink>} />}
    </AccountPage>
  );
}
