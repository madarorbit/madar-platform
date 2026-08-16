export const siteConfig = {
  name: 'مَدار | ORBIT', shortName: 'مَدار | ORBIT', companyName: 'مَدار | ORBIT',
  description: 'مَدار | ORBIT منصة عربية ذكية لإدارة التجارة ودعم الأعمال الإلكترونية ورقمنة العمليات وإضافة طبقة ذكية قابلة للتوسع إلى الأعمال.',
  baseUrl: 'https://www.orbitmadar.com',
  email: 'orbit.ops.digital@gmail.com', phone: '+967 735509366', locale: 'ar_YE', themeColor: '#070A12', copyright: 'جميع الحقوق محفوظة لمَدار | ORBIT.',
  assets: { logo: '/brand/logo.svg', logoWhite: '/brand/logo.svg', favicon: '/brand/favicon.ico', appleTouchIcon: '/brand/symbol-180x180.png', ogImage: '/brand/madar-identity.jpg', identityImage:'/brand/madar-identity.jpg', identityVideo:'/brand/madar-identity-motion.mp4', orbyCompact:'/brand/orby-assistant.svg', orbyMaster:'/assets/orby/orby-master.png', orby:'/brand/orby-assistant.svg' },
  links: { home: '/', store:'/store', products: '/products', services: '/services', about: '/about', orby:'/about#orby', contact: '/contact', faq: '/faq', privacy: '/privacy', terms: '/terms', refund:'/refund-policy', serviceAgreement:'/service-agreement', blog:'/blog', careers:'/careers', helpCenter:'/help', docs:'/docs', tutorials:'/docs', community:'/community', checkout: '/checkout', admin: '/admin', search: '/search', start: '/register', login:'/login', account:'/account', learnMore: '/about', categories: '/store' },
  social: { x: 'https://x.com/ORBITewrt', instagram: 'https://www.instagram.com/orbit.ops.digital/', whatsapp: 'https://wa.me/message/C65GHDBXUOIYP1', github:'https://github.com/madarorbit/madar-platform' },
  nav: [ { label: 'الرئيسية', href: '/' }, { label: 'المنصة', href: '/about' }, { label: 'المتجر', href: '/store' }, { label: 'المدونة', href: '/blog' }, { label: 'التوظيف', href: '/careers' }, { label: 'المساعدة', href: '/help' } ],
  seo: { title: 'مَدار | ORBIT — منصة ذكية لإدارة التجارة والأعمال', titleTemplate: '%s | مَدار | ORBIT', keywords: ['إدارة التجارة','رقمنة الأعمال','ذكاء اصطناعي','أتمتة الأعمال','منتجات رقمية','منصة عربية'], twitterHandle: '@ORBITewrt' },
  openGraph: { type: 'website', imageWidth: 1536, imageHeight: 1536, imageAlt: 'مَدار | ORBIT — منصة عربية ذكية للأعمال' },
} as const;
