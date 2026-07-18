'use client';

import { useState } from 'react';

interface Feature {
  id: number;
  title: string;
  description: string;
  points: string[];
  icon: string;
  color: string;
}

const features: Feature[] = [
  {
    id: 1,
    title: 'أتمتة الأعمال',
    description: 'أتمتة عمليات عملك بسهولة وكفاءة عالية',
    points: [
      'أتمتة العمليات المتكررة',
      'توفير الوقت والموارد',
      'زيادة الإنتاجية والكفاءة',
      'تقليل الأخطاء البشرية',
    ],
    icon: '⚙️',
    color: 'from-[#6C3BFF]',
  },
  {
    id: 2,
    title: 'أنظمة الذكاء الاصطناعي',
    description: 'استخدم قوة الذكاء الاصطناعي في عملك',
    points: [
      'تحليل البيانات الذكي',
      'توقعات دقيقة وموثوقة',
      'حلول متقدمة وفعالة',
      'تطوير مستمر وتحديثات',
    ],
    icon: '🤖',
    color: 'from-[#00C2A8]',
  },
  {
    id: 3,
    title: 'القوالب الاحترافية',
    description: 'قوالب جاهزة وقابلة للتخصيص',
    points: [
      'تصاميم احترافية وحديثة',
      'سهلة التخصيص والتعديل',
      'جودة عالية وموثوقة',
      'دعم فني متخصص',
    ],
    icon: '🎨',
    color: 'from-[#6C3BFF]',
  },
  {
    id: 4,
    title: 'أنظمة إدارة الأعمال',
    description: 'إدارة عملك بكفاءة واحترافية',
    points: [
      'تنظيم شامل للعمليات',
      'تقارير مفصلة وتحليلات',
      'تتبع الأداء الفوري',
      'اتخاذ قرارات مستنيرة',
    ],
    icon: '📊',
    color: 'from-[#00C2A8]',
  },
];

export default function WhyMadar() {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <section id="about" className="py-20 sm:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#F8FAFC] rounded-full border border-[#E2E8F0] mb-6">
            <span className="w-2 h-2 bg-[#6C3BFF] rounded-full" />
            <span className="text-sm text-[#475569] font-medium">لماذا مَدار</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-[#0F172A] mb-6">
            لماذا تختار مَدار
          </h2>
          <p className="text-lg text-[#475569] max-w-2xl mx-auto">
            منصة متكاملة توفر لك كل ما تحتاجه لتطوير عملك الرقمي بنجاح
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {features.map((feature) => (
            <div
              key={feature.id}
              onClick={() => setExpandedId(expandedId === feature.id ? null : feature.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setExpandedId(expandedId === feature.id ? null : feature.id);
                }
              }}
              role="button"
              tabIndex={0}
              aria-expanded={expandedId === feature.id}
              className="group relative cursor-pointer rounded-2xl border border-[#E2E8F0] bg-gradient-to-br from-white to-[#F8FAFC] p-8 transition-all duration-300 hover:-translate-y-1 hover:border-[#6C3BFF]/20 hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C3BFF] focus-visible:ring-offset-2"
            >
              {/* Background Gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${feature.color} to-transparent opacity-0 group-hover:opacity-5 rounded-2xl transition-opacity`} />

              {/* Content */}
              <div className="relative z-10">
                {/* Icon */}
                <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.color} to-[#00C2A8] flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <span className="text-2xl">{feature.icon}</span>
                </div>

                {/* Title */}
                <h3 className="text-2xl font-bold text-[#0F172A] mb-3">
                  {feature.title}
                </h3>

                {/* Description */}
                <p className="text-[#475569] leading-relaxed mb-6">
                  {feature.description}
                </p>

                {/* Points */}
                <div className={`space-y-3 overflow-hidden transition-all duration-300 ${
                  expandedId === feature.id ? 'max-h-96' : 'max-h-0 md:max-h-96'
                }`}>
                  {feature.points.map((point, index) => (
                    <div key={index} className="flex items-start gap-3">
                      <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#6C3BFF] to-[#00C2A8] flex items-center justify-center flex-shrink-0 mt-0.5">
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <span className="text-[#475569] font-medium">{point}</span>
                    </div>
                  ))}
                </div>

                {/* Expand Button Mobile */}
                <div className="md:hidden mt-6 flex items-center gap-2 text-[#6C3BFF] font-semibold">
                  <span>{expandedId === feature.id ? 'إخفاء' : 'عرض'} التفاصيل</span>
                  <svg
                    className={`w-5 h-5 transition-transform ${expandedId === feature.id ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                  </svg>
                </div>
              </div>

              {/* Border Gradient on Hover */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-gradient-to-r from-[#6C3BFF]/10 to-[#00C2A8]/10" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
