import Link from 'next/link';
import { siteConfig } from '@/src/config/site';

export default function CTA() {
  return (
    <section className="py-20 sm:py-32 bg-gradient-to-br from-[#6C3BFF] to-[#00C2A8] relative overflow-hidden">
      {/* Background Elements */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 right-0 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-96 h-96 bg-white/10 rounded-full blur-3xl" />
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        {/* Headline */}
        <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
          ابدأ رحلتك مع {siteConfig.shortName} اليوم
        </h2>

        {/* Subheadline */}
        <p className="text-lg sm:text-xl text-white/90 mb-10 max-w-2xl mx-auto leading-relaxed">
          انضم إلى آلاف المستخدمين الذين يطورون أعمالهم باستخدام منتجاتنا الرقمية المتقدمة
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link href={siteConfig.links.start} className="w-full rounded-xl bg-white px-8 py-4 font-semibold text-[#6C3BFF] transition-all hover:-translate-y-0.5 hover:shadow-2xl active:translate-y-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#6C3BFF] sm:w-auto">
            ابدأ الآن مجاناً
          </Link>
          <Link href={siteConfig.links.learnMore} className="w-full rounded-xl border-2 border-white px-8 py-4 font-semibold text-white transition-colors hover:bg-white/10 active:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#6C3BFF] sm:w-auto">
            اعرف المزيد
          </Link>
        </div>

        {/* Trust Section */}
        <div className="mt-16 pt-12 border-t border-white/20">
          <p className="text-white/80 text-sm mb-6 font-medium">موثوق من قبل</p>
          <div className="flex flex-wrap justify-center items-center gap-8">
            <div className="text-white/70 font-semibold">+500 منتج</div>
            <div className="w-1 h-6 bg-white/20" />
            <div className="text-white/70 font-semibold">+10K مستخدم</div>
            <div className="w-1 h-6 bg-white/20" />
            <div className="text-white/70 font-semibold">98% رضا</div>
          </div>
        </div>
      </div>
    </section>
  );
}
