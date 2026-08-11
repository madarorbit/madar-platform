import Link from "next/link";
import {
  ArrowLeft,
  BarChart3,
  Boxes,
  Cloud,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { Brand } from "@/components/retail-v0/layout/brand";

const FEATURES = [
  {
    icon: Boxes,
    title: "المبيعات والمخزون معًا",
    text: "كل بيع أو شراء يُحدّث المخزون والصندوق والدين في عملية واحدة قابلة للتتبع.",
  },
  {
    icon: BarChart3,
    title: "أرقام مفهومة",
    text: "مبيعات وربح تقديري ومصروفات وصندوق وديون بلا مصطلحات محاسبية مربكة.",
  },
  {
    icon: Sparkles,
    title: "ORBY للتجارة",
    text: "يسأل بياناتك المصرح بها ويشرح المخاطر والفرص دون تعديل أي رقم أو فاتورة.",
  },
  {
    icon: ShieldCheck,
    title: "عزل محكم داخل مَدار",
    text: "تسجيل دخول وصلاحيات مَدار نفسها، مع قاعدة Retail مستقلة وسجل كامل لكل عملية.",
  },
];

const APPS = [
  { name: "Web", state: "متاح الآن", live: true, href: "/retail/onboarding" },
  { name: "Android", state: "قريبًا", live: false },
  { name: "iPhone", state: "قريبًا", live: false },
  { name: "Desktop", state: "قريبًا", live: false },
];

export default function LandingPage() {
  return (
    <main>
      <header className="container-shell flex min-h-20 items-center justify-between gap-4">
        <Brand />
        <nav className="flex items-center gap-2" aria-label="الحساب">
          <Link
            className="button-secondary"
            href="/login?next=/retail/onboarding"
          >
            تسجيل الدخول
          </Link>
          <Link
            className="button-primary hidden sm:inline-flex"
            href="/retail/onboarding"
          >
            فتح Retail
          </Link>
        </nav>
      </header>

      <section className="container-shell grid min-h-[75vh] items-center gap-10 py-16 lg:grid-cols-[1.15fr_.85fr]">
        <div>
          <p className="eyebrow">RETAIL SMALL BUSINESS OS</p>
          <h1 className="mt-5 max-w-3xl text-5xl leading-[1.12] font-black sm:text-6xl">
            نظام تشغيل ذكي وخفيف{" "}
            <span className="text-mint">للتجارة الصغيرة.</span>
          </h1>
          <p className="muted mt-6 max-w-2xl text-lg leading-8">
            اشترِ، خزّن، بِع، تابع الصندوق والديون، وافهم ما يحدث في تجارتك من
            الجوال أو الكمبيوتر — دون نظام ERP معقد.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link className="button-primary" href="/retail/onboarding">
              أنشئ تجارتك <ArrowLeft size={18} />
            </Link>
            <a className="button-secondary" href="#features">
              اكتشف المزايا
            </a>
          </div>
          <p className="muted mt-4 text-sm">
            سعر الخدمة يُدار مركزيًا من مَدار ويظهر قبل إرسال طلب التفعيل.
          </p>
        </div>

        <div className="surface relative overflow-hidden p-5 sm:p-7">
          <div className="absolute -top-24 -left-20 h-52 w-52 rounded-full bg-violet-500/15 blur-3xl" />
          <div className="relative flex items-center justify-between border-b border-slate-800 pb-5">
            <div>
              <p className="muted text-sm">نظرة اليوم</p>
              <p className="mt-1 text-xl font-black">متجرك أمامك بوضوح</p>
            </div>
            <Cloud className="text-mint" />
          </div>
          <div className="relative mt-5 grid grid-cols-2 gap-3">
            {[
              ["المبيعات", "184,500 YER"],
              ["الربح التقديري", "47,200 YER"],
              ["الصندوق", "91,000 YER"],
              ["منخفض المخزون", "4 منتجات"],
            ].map(([label, value]) => (
              <div className="surface-soft p-4" key={label}>
                <p className="muted text-xs">{label}</p>
                <p className="mt-2 font-black">{value}</p>
              </div>
            ))}
          </div>
          <div className="relative mt-3 rounded-xl border border-emerald-400/20 bg-emerald-400/5 p-4">
            <p className="text-mint text-sm font-bold">ORBY</p>
            <p className="mt-1 text-sm leading-6 text-slate-300">
              العطر رقم 12 يقترب من حد النفاد، ومبيعات هذا الأسبوع أعلى من
              السابق.
            </p>
          </div>
        </div>
      </section>

      <section id="features" className="container-shell py-20">
        <p className="eyebrow">المسار الشائع بسيط جدًا</p>
        <h2 className="mt-3 text-3xl font-black sm:text-4xl">
          كل ما يحتاجه متجر صغير. دون ضوضاء.
        </h2>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {FEATURES.map(({ icon: Icon, title, text }) => (
            <article className="surface p-6" key={title}>
              <Icon className="text-mint" />
              <h3 className="mt-5 text-xl font-black">{title}</h3>
              <p className="muted mt-2 leading-7">{text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container-shell py-20" id="apps">
        <div className="surface p-6 sm:p-9">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow">التطبيقات</p>
              <h2 className="mt-2 text-3xl font-black">
                ابدأ على الويب، وكمل من أي جهاز.
              </h2>
            </div>
            <p className="muted max-w-lg">
              بنية السحابة وواجهات المزامنة مجهزة للتطبيق القادم، بينما تبقى
              تطبيقات الهاتف وسطح المكتب خارج نطاق V0 الحالي.
            </p>
          </div>
          <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {APPS.map((app) =>
              app.live ? (
                <Link
                  href={app.href ?? "/retail/onboarding"}
                  key={app.name}
                  className="surface-soft p-5 transition hover:border-emerald-300"
                >
                  <strong>{app.name}</strong>
                  <span className="text-mint mt-2 block text-sm">
                    {app.state}
                  </span>
                </Link>
              ) : (
                <div
                  key={app.name}
                  className="surface-soft p-5 opacity-70"
                  aria-disabled="true"
                >
                  <strong>{app.name}</strong>
                  <span className="muted mt-2 block text-sm">{app.state}</span>
                </div>
              ),
            )}
          </div>
        </div>
      </section>

      <section className="container-shell py-20 text-center">
        <h2 className="text-3xl font-black">
          تجارتك لا تحتاج دورة محاسبة كي تبدأ.
        </h2>
        <p className="muted mx-auto mt-3 max-w-xl">
          أنشئ حسابك، أكمل خمس خطوات قصيرة، وأضف أول منتج.
        </p>
        <Link className="button-primary mt-7" href="/retail/onboarding">
          بدء إعداد Retail
        </Link>
      </section>

      <footer className="container-shell flex flex-wrap items-center justify-between gap-4 border-t border-slate-800 py-8 text-sm text-slate-500">
        <Brand compact />
        <p>© 2026 MADAR Orbit. مساحة Retail متكاملة داخل منصة مَدار.</p>
      </footer>
    </main>
  );
}
