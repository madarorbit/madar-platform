import Categories from '@/components/home/Categories';
import CTA from '@/components/home/CTA';
import FeaturedProducts from '@/components/home/FeaturedProducts';
import Hero from '@/components/home/Hero';
import WhyMadar from '@/components/home/WhyMadar';
import Footer from '@/components/layout/Footer';
import Navbar from '@/components/layout/Navbar';

export default function Home() {
  return (
    <>
      <Navbar />
      <main className="bg-white">
        <Hero />
        <FeaturedProducts />
        <Categories />
        <WhyMadar />
        <CTA />
      </main>
      <Footer />
    </>
  );
}
