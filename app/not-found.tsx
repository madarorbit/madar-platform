import Link from 'next/link';
import PageShell from '@/components/ui/PageShell';
import {Section} from '@/components/ui/Section';
import {Icon} from '@/components/ui/Icons';

export default function NotFound(){return <PageShell><Section><div className="md-panel mx-auto max-w-3xl py-16 text-center"><span className="md-empty-icon" aria-hidden="true"><Icon name="search" className="h-7 w-7"/></span><span className="md-eyebrow mt-6">تعذر العثور على الصفحة</span><h1 className="md-type-h1 mt-3">الرابط غير موجود أو تم نقله</h1><p className="md-type-body md-muted mx-auto mt-4 max-w-xl">تحقق من عنوان الصفحة، أو عد إلى الرئيسية واستخدم التنقل أو البحث للوصول إلى ما تحتاجه.</p><div className="md-cluster mt-7 justify-center"><Link className="md-button md-button-primary" href="/">العودة إلى الرئيسية</Link><Link className="md-button md-button-secondary" href="/search">البحث في مَدار</Link></div></div></Section></PageShell>}
