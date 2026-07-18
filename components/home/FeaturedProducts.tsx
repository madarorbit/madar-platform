'use client';

import Link from 'next/link';
import { useState } from 'react';
import { siteConfig } from '@/src/config/site';

interface Product {
  id: number;
  category: string;
  title: string;
  description: string;
  price: string;
  icon: string;
}

const products: Product[] = [
  {
    id: 1,
    category: 'نظام ذكاء اصطناعي',
    title: 'مساعد AI متقدم',
    description: 'نظام ذكاء اصطناعي متطور للإجابة على الأسئلة وتحليل البيانات بدقة عالية',
    price: '299 ر.س',
    icon: '🤖',
  },
  {
    id: 2,
    category: 'قالب Notion',
    title: 'نظام إدارة المشاريع',
    description: 'قالب Notion احترافي لإدارة المشاريع والمهام بكفاءة عالية',
    price: '99 ر.س',
    icon: '📋',
  },
  {
    id: 3,
    category: 'أتمتة الأعمال',
    title: 'تطبيق الأتمتة الشامل',
    description: 'حل شامل لأتمتة عمليات عملك وتوفير الوقت والموارد',
    price: '199 ر.س',
    icon: '⚙️',
  },
  {
    id: 4,
    category: 'نظام Google Sheets',
    title: 'لوحة تحكم المبيعات',
    description: 'نظام Google Sheets متقدم لتتبع المبيعات والتحليلات الفورية',
    price: '149 ر.س',
    icon: '📊',
  },
  {
    id: 5,
    category: 'قالب احترافي',
    title: 'موقع المتجر الإلكتروني',
    description: 'قالب متجر إلكتروني احترافي جاهز للاستخدام الفوري',
    price: '399 ر.س',
    icon: '🛍️',
  },
  {
    id: 6,
    category: 'أداة رقمية',
    title: 'محرر الفيديو الذكي',
    description: 'أداة متقدمة لتحرير الفيديوهات بسهولة واحترافية عالية',
    price: '249 ر.س',
    icon: '🎬',
  },
];

export default function FeaturedProducts() {
  const [hoveredId, setHoveredId] = useState<number | null>(null);

  return (
    <section id="products" className="py-20 sm:py-32 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-[#F8FAFC] rounded-full border border-[#E2E8F0] mb-6">
            <span className="w-2 h-2 bg-[#6C3BFF] rounded-full" />
            <span className="text-sm text-[#475569] font-medium">المنتجات المختارة</span>
          </div>
          <h2 className="text-4xl sm:text-5xl font-bold text-[#0F172A] mb-6">
            أفضل المنتجات الرقمية
          </h2>
          <p className="text-lg text-[#475569] max-w-2xl mx-auto">
            اختر من مجموعة واسعة من المنتجات الرقمية المتخصصة والمصممة لتطوير عملك
          </p>
        </div>

        {/* Products Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product) => (
            <div
              key={product.id}
              onMouseEnter={() => setHoveredId(product.id)}
              onMouseLeave={() => setHoveredId(null)}
              className="group relative bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden transition-all duration-300 hover:shadow-2xl hover:border-[#6C3BFF]/20"
            >
              {/* Product Visual */}
              <div className="relative w-full h-48 bg-gradient-to-br from-[#F8FAFC] to-[#E2E8F0] flex items-center justify-center overflow-hidden">
                <div className="text-6xl group-hover:scale-110 transition-transform duration-300">
                  {product.icon}
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>

              {/* Product Content */}
              <div className="p-6">
                <div className="inline-block px-3 py-1 bg-[#F8FAFC] rounded-full mb-4">
                  <span className="text-xs font-semibold text-[#6C3BFF]">{product.category}</span>
                </div>

                <h3 className="text-xl font-bold text-[#0F172A] mb-3 line-clamp-2">
                  {product.title}
                </h3>

                <p className="text-[#475569] text-sm leading-relaxed mb-6 line-clamp-2">
                  {product.description}
                </p>

                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-2xl font-bold text-[#6C3BFF]">{product.price}</span>
                  </div>
                  <Link
                    href={siteConfig.links.products}
                    className={`rounded-lg px-4 py-2 font-semibold transition-all duration-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C3BFF] focus-visible:ring-offset-2 ${
                      hoveredId === product.id
                        ? 'bg-gradient-to-r from-[#6C3BFF] to-[#00C2A8] text-white shadow-lg'
                        : 'border border-[#E2E8F0] bg-[#F8FAFC] text-[#6C3BFF] hover:border-[#6C3BFF]/30 hover:bg-white'
                    }`}
                  >
                    عرض
                  </Link>
                </div>
              </div>

              {/* Hover Gradient Border */}
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none bg-gradient-to-r from-[#6C3BFF]/10 to-[#00C2A8]/10" />
            </div>
          ))}
        </div>

        {/* View All Button */}
        <div className="text-center mt-16">
          <Link href={siteConfig.links.products} className="rounded-xl border-2 border-[#E2E8F0] px-8 py-4 font-semibold text-[#0F172A] transition-colors hover:bg-[#F8FAFC] active:bg-[#E2E8F0] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#6C3BFF] focus-visible:ring-offset-2">
            عرض جميع المنتجات
          </Link>
        </div>
      </div>
    </section>
  );
}
