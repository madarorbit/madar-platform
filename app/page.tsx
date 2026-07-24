import Categories from '@/components/home/Categories';
import CTA from '@/components/home/CTA';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import Hero from '@/components/home/Hero';
import WhyMadar from '@/components/home/WhyMadar';
import Footer from '@/components/layout/Footer';
import Navbar from '@/components/layout/Navbar';
import {currentProfile} from '@/src/lib/supabase/server';

export const dynamic='force-dynamic';
export default async function Home(){
 const authenticated=Boolean(await currentProfile().catch(()=>null));
 return <><Navbar/><main className="md-shell"><Hero authenticated={authenticated}/><FeaturedProducts/><Categories/><WhyMadar/><CTA authenticated={authenticated}/></main><Footer/></>;
}
