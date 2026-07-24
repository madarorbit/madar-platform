import Link from 'next/link';
import PageShell from '@/components/ui/PageShell';
import {Section} from '@/components/ui/Section';
import {Card} from '@/components/ui/Enterprise';
import {Icon} from '@/components/ui/Icons';

export default function NotFound(){return <PageShell><Section><Card className="relative mx-auto max-w-3xl overflow-hidden px-6 py-16 text-center sm:px-12"><div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(124,77,255,.18),transparent_45%)]"/><div className="relative"><span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-white/10 bg-violet-300/10 text-violet-200"><Icon name="search" className="h-8 w-8"/></span><p className="mt-6 text-sm font-black text-emerald-300">تعذر العثور على الصفحة</p><h1 className="mt-3 text-4xl font-black sm:text-5xl">الرابط غير موجود أو تم نقله</h1><p className="mx-auto mt-5 max-w-xl leading-8 text-slate-400">تحقق من عنوان الصفحة، أو عد إلى الرئيسية للوصول إلى أقسام مَدار | ORBIT من التنقل الواضح.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><Link className="md-button md-button-primary" href="/">العودة إلى الرئيسية</Link><Link className="md-button md-button-secondary" href="/search">البحث في مَدار | ORBIT</Link></div></div></Card></Section></PageShell>}
