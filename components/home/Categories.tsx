import Link from 'next/link';
import { siteConfig } from '@/src/config/site';

interface Category {
  id: number;
  title: string;
  description: string;
  icon: string;
  color: string;
}

const categories: Category[] = [
  {
    id: 1,
    title: 'أنظمة الذكاء الاصطناعي',
    description: 'حلول ذكاء اصطناعي متقدمة لتطوير عملك وزيادة الإنتاجية',
    icon: '🤖',
    color: 'from-[#6C3BFF]',
  },
  {
    id: 2,
    title: 'قوالب Notion',
    description: 'قوالب احترافية لتنظيم العمل والمشاريع والبيانات',
    icon: '📝',
    color: 'from-[#00C2A8]',
  },
  {
    id: 3,
    title: 'أتمتة الأعمال',
    description: 'أدوات لأتمتة العمليات وتوفير الوقت والموارد',
    icon: '⚙️',
    color: 'from-[#6C3BFF]',
  },
  {
    id: 4,
    title: 'أنظمة Google Sheets',
    description: 'أنظمة متقدمة لإدارة البيانات والتحليلات الفورية',
    icon: '📊',
    color: 'from-[#00C2A8]',
  },
  {
    id: 5,
    title: 'القوالب الاحترافية',
    description: 'قوالب جاهزة للاستخدام الفوري في مختلف المجالات',
    icon: '🎨',
    color: 'from-[#6C3BFF]',
  },
  {
    id: 6,
    title: 'الأدوات الرقمية',
    description: 'أدوات متخصصة لتسهيل عمليات العمل اليومية',
    icon: '🛠️',
    color: 'from-[#00C2A8]',
  },
];

export default function Categories() {
  return (
    <section id="categories" className="py-20 sm:py-32 bg-[#F8FAFC]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full border border-[#E2E8F0] mb-6">
            <span className="w-2 h-2 bg-[#00C2A8] rounded-full" />
            <span className="text-sm text-[#475569] font-medium">الفئات الرئيسية</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-[#0F172A] mb-6">
            استكشف جميع الفئات
          </h2>
          <p className="text-lg text-[#475569] max-w-2xl mx-auto">
            تصفح أنواع مختلفة من المنتجات الرقمية المتخصصة
          </p>
        </div>

        {/* Categories Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {categories.map((category) => (
            <Link
              key={category.id}
              href={siteConfig.links.products}
              className="group relative rounded-2xl border border-[#E2E8F0] bg-white p-8 transition-all duration-300 hover:-translate-y-1 hover:border-[#6C3BFF]/20 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C3BFF] focus-visible:ring-offset-2"
            >
              {/* Background Gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${category.color} to-transparent opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity`} />

              {/* Content */}
              <div className="relative z-10">
                {/* Icon */}
                <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${category.color} to-[#00C2A8] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <span className="text-3xl">{category.icon}</span>
                </div>

                {/* Title */}
                <h3 className="text-xl font-bold text-[#0F172A] mb-3">
                  {category.title}
                </h3>

                {/* Description */}
                <p className="text-[#475569] leading-relaxed mb-6">
                  {category.description}
                </p>

                {/* Arrow */}
                <div className="flex items-center gap-2 text-[#6C3BFF] font-semibold group-hover:gap-4 transition-all">
                  <span>اكتشف المزيد</span>
                  <svg className="w-5 h-5 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
                  </svg>
                </div>
              </div>

              {/* Border Gradient on Hover */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-gradient-to-r from-[#6C3BFF]/10 to-[#00C2A8]/10" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
