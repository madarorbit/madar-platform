import Navbar from '@/components/layout/Navbar';
import Hero from '@/components/home/Hero';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import Categories from '@/components/home/Categories';
import WhyMadar from '@/components/home/WhyMadar';
import CTA from '@/components/home/CTA';
import Footer from '@/components/layout/Footer';

export const metadata = {
  title: 'مَدار | ORBIT - منصة المنتجات الرقمية المتخصصة',
  description: 'منصة رقمية متخصصة في المنتجات الرقمية وأنظمة الذكاء الاصطناعي والأتمتة والقوالب الاحترافية',
  keywords: 'منتجات رقمية، ذكاء اصطناعي، أتمتة، قوالب، Notion، Google Sheets',
  openGraph: {
    title: 'مَدار | ORBIT - منصة المنتجات الرقمية المتخصصة',
    description: 'منصة رقمية متخصصة في المنتجات الرقمية وأنظمة الذكاء الاصطناعي والأتمتة والقوالب الاحترافية',
    type: 'website',
  },
};

export default function Home() {
  return (
    <main lang="ar" dir="rtl" className="bg-white">
      <Navbar />
      <Hero />
      <FeaturedProducts />
      <Categories />
      <WhyMadar />
      <CTA />
      <Footer />
    </main>
  );
}