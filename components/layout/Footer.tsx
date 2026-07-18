'use client';

import Link from 'next/link';

export default function Footer() {
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    المنتجات: [
      { label: 'أنظمة الذكاء الاصطناعي', href: '#' },
      { label: 'قوالب Notion', href: '#' },
      { label: 'أتمتة الأعمال', href: '#' },
      { label: 'أنظمة Google Sheets', href: '#' },
    ],
    الشركة: [
      { label: 'عن مَدار', href: '#' },
      { label: 'المدونة', href: '#' },
      { label: 'الوظائف', href: '#' },
      { label: 'اتصل بنا', href: '#' },
    ],
    القانوني: [
      { label: 'سياسة الخصوصية', href: '#' },
      { label: 'شروط الاستخدام', href: '#' },
      { label: 'سياسة الاسترجاع', href: '#' },
      { label: 'اتفاقية الخدمة', href: '#' },
    ],
    الموارد: [
      { label: 'مركز المساعدة', href: '#' },
      { label: 'الوثائق', href: '#' },
      { label: 'البرامج التعليمية', href: '#' },
      { label: 'المجتمع', href: '#' },
    ],
  };

  const socialLinks = [
    { name: 'Twitter', icon: '𝕏', href: '#' },
    { name: 'LinkedIn', icon: 'in', href: '#' },
    { name: 'Instagram', icon: '📷', href: '#' },
    { name: 'YouTube', icon: '▶️', href: '#' },
  ];

  return (
    <footer className="bg-[#0F172A] text-white">
      {/* Main Footer */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-20">
        {/* Footer Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-12 mb-12">
          {/* Brand Section */}
          <div className="lg:col-span-1">
            <div className="flex items-center gap-2 mb-6">
              <div className="w-8 h-8 bg-gradient-to-br from-[#6C3BFF] to-[#00C2A8] rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-sm">م</span>
              </div>
              <span className="font-bold text-lg">مَدار | ORBIT</span>
            </div>
            <p className="text-white/60 text-sm leading-relaxed mb-6">
              منصة رقمية متخصصة في المنتجات الرقمية وأنظمة الذكاء الاصطناعي والأتمتة
            </p>
            <div className="flex gap-4">
              {socialLinks.map((social) => (
                <Link
                  key={social.name}
                  href={social.href}
                  className="w-10 h-10 rounded-lg bg-white/10 hover:bg-white/20 transition-colors flex items-center justify-center text-sm font-semibold"
                  title={social.name}
                >
                  {social.icon}
                </Link>
              ))}
            </div>
          </div>

          {/* Links Sections */}
          {Object.entries(footerLinks).map(([category, links]) => (
            <div key={category}>
              <h3 className="font-semibold text-white mb-6">{category}</h3>
              <ul className="space-y-4">
                {links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-white/60 hover:text-white transition-colors text-sm"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="border-t border-white/10 my-12" />

        {/* Bottom Footer */}
        <div className="flex flex-col md:flex-row justify-between items-center gap-6">
          {/* Copyright */}
          <div className="text-white/60 text-sm">
            <p>© {currentYear} مَدار | ORBIT. جميع الحقوق محفوظة.</p>
          </div>

          {/* Additional Links */}
          <div className="flex gap-6 text-sm">
            <Link href="#" className="text-white/60 hover:text-white transition-colors">
              سياسة الخصوصية
            </Link>
            <Link href="#" className="text-white/60 hover:text-white transition-colors">
              شروط الاستخدام
            </Link>
            <Link href="#" className="text-white/60 hover:text-white transition-colors">
              اتصل بنا
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
