import PageShell from '@/components/ui/PageShell';
import { PageHero, Section } from '@/components/ui/Section';
import { publishedProducts, formatPrice } from '@/src/data/products';
import { bankTransfer } from '@/src/lib/commerce';

export const metadata = { title: 'إتمام الشراء' };

export default function Page() {
  return <PageShell><PageHero eyebrow="الدفع الآمن" title="أكمل طلبك بالتحويل البنكي" description="لن يُسلّم أي منتج مدفوع قبل مراجعة إثبات التحويل واعتماد الدفع من فريق مَدار." />
    <Section><div className="grid gap-8 lg:grid-cols-[1fr_380px]">
      <form className="space-y-4 rounded-3xl border border-white/10 bg-white/[.04] p-6">
        <h2 className="text-xl font-bold">بيانات الطلب</h2>
        <input required name="name" className="w-full rounded-xl p-3 text-slate-900" placeholder="الاسم الكامل" />
        <input required type="email" name="email" className="w-full rounded-xl p-3 text-slate-900" placeholder="البريد الإلكتروني للتسليم" />
        <input required name="phone" inputMode="tel" className="w-full rounded-xl p-3 text-slate-900" placeholder="رقم الهاتف / واتساب" />
        <input name="transaction" className="w-full rounded-xl p-3 text-slate-900" placeholder="رقم العملية (اختياري)" />
        <p className="text-sm text-slate-300">سيظهر رفع إثبات التحويل بعد إنشاء طلب محفوظ. لا ترسل إثباتاً عبر نموذج غير مؤمن أو رابط عام.</p>
        <button type="button" disabled className="cursor-not-allowed rounded-xl bg-slate-600 px-6 py-3 font-bold text-slate-200">إنشاء طلب التحويل (يتطلب ربط قاعدة البيانات)</button>
        <a className="block text-sm font-bold text-[#70E4D4] underline" href="https://wa.me/message/C65GHDBXUOIYP1">أكمل الطلب أو استفسر بأمان عبر واتساب مَدار</a>
      </form>
      <aside className="rounded-3xl border border-white/10 bg-white/[.04] p-6"><h2 className="text-2xl font-bold">تعليمات التحويل</h2>
        <dl className="mt-5 space-y-3 text-slate-200"><div><dt className="text-sm text-slate-400">البنك</dt><dd>{bankTransfer.bankName}</dd></div><div><dt className="text-sm text-slate-400">رقم الحساب</dt><dd dir="ltr" className="text-xl font-bold tracking-wider">{bankTransfer.accountNumber}</dd></div></dl>
        <p className="mt-5 rounded-2xl border border-emerald-300/20 bg-emerald-300/10 p-4 text-sm leading-6 text-emerald-100">{bankTransfer.temporaryAccountNotice}</p>
        <h3 className="mt-6 font-bold">ملخص مبدئي</h3>{publishedProducts.slice(0, 2).map((p) => <p className="mt-3 flex justify-between" key={p.slug}><span>{p.title}</span><span>{formatPrice(p)}</span></p>)}
      </aside>
    </div></Section></PageShell>;
}
