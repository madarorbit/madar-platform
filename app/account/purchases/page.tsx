import Image from "next/image";
import Link from "next/link";
import { AccountPage, AccountPageHeader } from "@/components/account/AccountPage";
import { requireUser } from "@/src/lib/auth";
import { catalogImageUrl } from "@/src/lib/catalog-media";
import { formatStoreMoney } from "@/src/lib/store/currency";
import { supabaseFetch } from "@/src/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "مكتبتي | حساب مَدار" };

export default async function PurchasesPage() {
  const user = await requireUser();
  const [currencies, items] = await Promise.all([
    supabaseFetch("/rest/v1/currencies?select=code,name,symbol,decimal_places,is_active"),
    supabaseFetch(`/rest/v1/product_entitlements?user_id=eq.${encodeURIComponent(user.id)}&select=id,product_name,thumbnail_path,original_amount,original_currency,payment_amount,payment_currency,exchange_rate,purchased_at,product_files(original_filename,mime_type)&order=purchased_at.desc`),
  ]);
  return (
    <AccountPage>
      <AccountPageHeader eyebrow="المتجر والمشتريات" title="مكتبتي" description="المنتجات الرقمية التي أصبحت مستحقة لحسابك بعد اعتماد الدفع، مع الملف الصحيح وقت الشراء." />
      {items?.length ? <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{items.map((item: any) => {
        const file = Array.isArray(item.product_files) ? item.product_files[0] : item.product_files;
        const image = catalogImageUrl(item.thumbnail_path);
        return <article key={item.id} className="md-card overflow-hidden p-0">{image ? <div className="relative aspect-[16/9]"><Image src={image} alt={item.product_name} fill className="object-cover" /></div> : null}<div className="p-5"><h2 className="text-xl font-black">{item.product_name}</h2><p className="mt-2 text-sm text-slate-400">تاريخ الشراء: {new Date(item.purchased_at).toLocaleDateString("ar-YE")}</p><p className="mt-3">السعر الأصلي: <strong>{formatStoreMoney(item.original_amount, item.original_currency, currencies)}</strong></p>{item.payment_currency && item.payment_amount !== null ? <p className="mt-1 text-sm text-slate-300">تم الدفع: {formatStoreMoney(item.payment_amount, item.payment_currency, currencies)}</p> : null}<p className="mt-2 text-xs text-slate-500">الملف: {file?.original_filename || "ملف رقمي"}</p><Link href={`/account/purchases/${item.id}/download`} className="md-button md-button-primary mt-5 w-full">تحميل الملف</Link></div></article>;
      })}</div> : <div className="md-empty"><div><h2 className="text-xl font-black">لا توجد مشتريات بعد</h2><p className="mt-2 text-slate-400">بعد اعتماد الدفع ينتقل المنتج من الطلب إلى مكتبتك تلقائيًا.</p><Link href="/store" className="md-button md-button-primary mt-5">فتح المتجر</Link></div></div>}
    </AccountPage>
  );
}
