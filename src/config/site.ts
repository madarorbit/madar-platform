export const siteConfig = {
  name: 'مَدار | MADAR ORBIT', shortName: 'مَدار', companyName: 'MADAR | ORBIT',
  description: 'مَدار: منتجات رقمية وأنظمة تشغيل وأتمتة وحلول عملية للتجارة والأعمال العربية.',
  baseUrl: process.env.NEXT_PUBLIC_SITE_URL ?? 'https://orbit-ops-digital.netlify.app', email: 'orbit.ops.digital@gmail.com', phone: '+967 735509366', locale: 'ar_YE', themeColor: '#0B0B0C', copyright: 'جميع الحقوق محفوظة لمَدار.',
  assets: { logo: '/brand/logo.svg', logoWhite: '/brand/logo.svg', favicon: '/brand/favicon.ico', appleTouchIcon: '/brand/symbol-180x180.png', ogImage: '/brand/logo.png' },
  links: { home: '/', products: '/products', services: '/services', about: '/about', contact: '/contact', faq: '/faq', privacy: '/privacy', terms: '/terms', checkout: '/checkout', admin: '/admin', search: '/search', start: '/checkout', learnMore: '/about', categories: '/products', refund: '/terms', serviceAgreement: '/terms', blog: '/about', careers: '/contact', helpCenter: '/faq', docs: '/faq', tutorials: '/services', community: '/contact' },
  social: { x: 'https://x.com/ORBITewrt', instagram: 'https://www.instagram.com/orbit.ops.digital/?hl=ar', whatsapp: 'https://wa.me/message/C65GHDBXUOIYP1' },
  nav: [ { label: 'المنتجات', href: '/products' }, { label: 'الخدمات', href: '/services' }, { label: 'عن مَدار', href: '/about' }, { label: 'الأسئلة', href: '/faq' }, { label: 'التواصل', href: '/contact' } ],
  seo: { title: 'مَدار | MADAR ORBIT - حلول التجارة الرقمية', titleTemplate: '%s | مَدار', keywords: ['منتجات رقمية','ذكاء اصطناعي','أتمتة الأعمال','Notion','Google Sheets'], twitterHandle: '@ORBITewrt' },
  openGraph: { type: 'website', imageWidth: 1200, imageHeight: 630, imageAlt: 'مَدار | ORBIT' },
} as const;
