import Link from 'next/link';
import { siteConfig } from '@/src/config/site';

export default function Hero() {
  return (
    <section className="relative overflow-hidden bg-white py-20 sm:py-28 lg:py-32">
      {/* Background Gradient */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-[#6C3BFF]/10 to-transparent rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-[#00C2A8]/10 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left Content */}
          <div className="animate-fade-in">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#F8FAFC] rounded-full border border-[#E2E8F0] mb-8">
              <span className="w-2 h-2 bg-[#00C2A8] rounded-full" />
              <span className="text-sm text-[#475569] font-medium">منصة احترافية للمنتجات الرقمية</span>
            </div>

            <h1 className="text-4xl font-bold leading-[1.12] text-[#0F172A] sm:text-5xl lg:text-6xl xl:text-7xl mb-6">
              اكتشف أفضل المنتجات الرقمية
            </h1>

            <p className="max-w-xl text-base leading-8 text-[#475569] sm:text-lg mb-8">
              منصة {siteConfig.shortName} توفر لك أنظمة ذكاء اصطناعي متقدمة وقوالب احترافية وأتمتة الأعمال. كل ما تحتاجه لتطوير عملك الرقمي في مكان واحد.
            </p>

            <div className="flex flex-col sm:flex-row gap-4">
              <Link href={siteConfig.links.products} className="rounded-xl bg-gradient-to-r from-[#6C3BFF] to-[#00C2A8] px-8 py-4 text-center font-semibold text-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-2xl active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C3BFF] focus-visible:ring-offset-2">
                استكشف المنتجات
              </Link>
              <Link href={siteConfig.links.learnMore} className="rounded-xl border-2 border-[#E2E8F0] px-8 py-4 text-center font-semibold text-[#0F172A] transition-colors hover:bg-[#F8FAFC] active:bg-[#E2E8F0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C3BFF] focus-visible:ring-offset-2">
                اعرف المزيد
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-4 sm:gap-8 mt-12 pt-8 border-t border-[#E2E8F0]">
              <div>
                <div className="text-3xl font-bold text-[#6C3BFF]">500+</div>
                <p className="text-sm text-[#475569] mt-1">منتج احترافي</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-[#00C2A8]">10K+</div>
                <p className="text-sm text-[#475569] mt-1">مستخدم نشط</p>
              </div>
              <div>
                <div className="text-3xl font-bold text-[#6C3BFF]">98%</div>
                <p className="text-sm text-[#475569] mt-1">رضا العملاء</p>
              </div>
            </div>
          </div>

          {/* Right Illustration */}
          <div className="relative animate-fade-in">
            <div className="relative">
              {/* Main Illustration */}
              <div className="relative w-full aspect-square bg-gradient-to-br from-[#6C3BFF]/5 to-[#00C2A8]/5 rounded-3xl border border-[#E2E8F0] flex items-center justify-center">
                <div className="text-center">
                  <div className="w-24 h-24 bg-gradient-to-br from-[#6C3BFF] to-[#00C2A8] rounded-2xl mx-auto mb-4 flex items-center justify-center">
                    <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                  </div>
                  <p className="text-[#475569] font-medium">منصة احترافية</p>
                </div>
              </div>

              {/* Floating Card 1 */}
              <div className="absolute -top-4 right-2 sm:-top-8 sm:-right-8 bg-white rounded-2xl p-6 shadow-xl border border-[#E2E8F0] w-56 sm:w-64 transform hover:scale-105 transition-transform">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#6C3BFF] to-[#00C2A8] rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                  </div>
                  <span className="font-semibold text-[#0F172A]">أتمتة ذكية</span>
                </div>
                <p className="text-sm text-[#475569]">أتمتة عمليات عملك بسهولة وكفاءة عالية</p>
              </div>

              {/* Floating Card 2 */}
              <div className="absolute -bottom-4 left-2 sm:-bottom-8 sm:-left-8 bg-white rounded-2xl p-6 shadow-xl border border-[#E2E8F0] w-56 sm:w-64 transform hover:scale-105 transition-transform">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-[#00C2A8] to-[#6C3BFF] rounded-lg flex items-center justify-center">
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <span className="font-semibold text-[#0F172A]">دعم 24/7</span>
                </div>
                <p className="text-sm text-[#475569]">فريق دعم متخصص جاهز لمساعدتك دائماً</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
