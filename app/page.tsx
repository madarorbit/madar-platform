import Categories from '@/components/home/Categories';
import CTA from '@/components/home/CTA';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import Hero from '@/components/home/Hero';
import WhyMadar from '@/components/home/WhyMadar';
import Footer from '@/components/layout/Footer';
import Navbar from '@/components/layout/Navbar';
import {createPageMetadata} from '@/src/lib/seo';
import {getOptionalShellIdentity} from '@/src/lib/shell/server';

export const metadata=createPageMetadata({title:'مَدار | ORBIT — منصة ذكية لإدارة التجارة والأعمال',description:'مَدار | ORBIT منصة عربية ذكية لإدارة التجارة ودعم الأعمال الإلكترونية ورقمنة العمليات وإضافة طبقة ذكية قابلة للتوسع إلى الأعمال.',path:'/'});
export const dynamic='force-dynamic';
export default async function Home(){const authenticated=Boolean(await getOptionalShellIdentity());return <div className="md-public-page-frame"><a href="#main-content" className="md-skip-link">تجاوز إلى المحتوى</a><Navbar/><main id="main-content" className="md-shell md-public-shell md-public-home" tabIndex={-1}><Hero authenticated={authenticated}/><FeaturedProducts/><Categories/><WhyMadar/><CTA authenticated={authenticated}/></main><Footer/></div>}
