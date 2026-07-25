import PageShell from '@/components/ui/PageShell';
import {PageHero,Section} from '@/components/ui/Section';
import ContactForm from '@/components/contact/ContactForm';
import {siteConfig} from '@/src/config/site';

export const metadata={title:'اتصل بنا',description:'تواصل مع فريق مَدار | ORBIT للاستفسار عن المنصة والمنتجات والخدمات وطلبات التنفيذ.'};

export default function Page(){return <PageShell><PageHero eyebrow="التواصل" title="ابدأ طلبك أو اسأل عن منتج" description="نراجع الرسائل وطلبات الشراء يدوياً لضمان صحة البيانات قبل الدفع والتسليم."/><Section><div className="grid gap-8 lg:grid-cols-2"><ContactForm/><div className="rounded-3xl border border-white/10 bg-white/[.04] p-6"><h2 className="text-2xl font-bold">بيانات التواصل</h2><p className="mt-4"><a href={`mailto:${siteConfig.email}`}>{siteConfig.email}</a></p><p className="mt-2"><a href={`tel:${siteConfig.phone}`}>{siteConfig.phone}</a></p><p className="mt-5 leading-8 text-slate-400">يفتح نموذج التواصل محادثة واتساب جاهزة ببيانات رسالتك، ولا تُرسل المعلومات قبل تأكيدك داخل واتساب.</p></div></div></Section></PageShell>}
