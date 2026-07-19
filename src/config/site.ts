export const siteConfig = {
  name: 'مَدار | ORBIT', shortName: 'MADAR', companyName: 'MADAR Digital Systems',
  description: 'منصة عربية أولاً للمنتجات الرقمية وأنظمة التشغيل والأتمتة وحلول الذكاء الاصطناعي للأعمال.',
  baseUrl: 'https://madar.store', email: 'hello@madar.store', phone: '+966500000000', locale: 'ar_SA', themeColor: '#6A0DAD', copyright: 'جميع الحقوق محفوظة.',
  assets: { logo: '/brand/logo.svg', logoWhite: '/brand/logo.svg', favicon: '/brand/favicon.ico', appleTouchIcon: '/brand/symbol-180x180.png', ogImage: '/brand/logo.png' },
  links: { home: '/', products: '/products', services: '/services', about: '/about', contact: '/contact', faq: '/faq', privacy: '/privacy', terms: '/terms', checkout: '/checkout', admin: '/admin', search: '/search', start: '/checkout', learnMore: '/about', categories: '/products', refund: '/terms', serviceAgreement: '/terms', blog: '/about', careers: '/contact', helpCenter: '/faq', docs: '/faq', tutorials: '/services', community: '/contact' },
  social: { x: 'https://x.com/madar_store', linkedin: 'https://www.linkedin.com/company/madar-store', instagram: 'https://www.instagram.com/madar.store', youtube: 'https://www.youtube.com/@madarstore' },
  nav: [ { label: 'المنتجات', href: '/products' }, { label: 'الخدمات', href: '/services' }, { label: 'عن مَدار', href: '/about' }, { label: 'الأسئلة', href: '/faq' }, { label: 'التواصل', href: '/contact' } ],
  seo: { title: 'مَدار | ORBIT - منصة المنتجات الرقمية المتخصصة', titleTemplate: '%s | مَدار', keywords: ['منتجات رقمية','ذكاء اصطناعي','أتمتة الأعمال','Notion','Google Sheets'], twitterHandle: '@madar_store' },
  openGraph: { type: 'website', imageWidth: 1200, imageHeight: 630, imageAlt: 'مَدار | ORBIT' },
} as const;
