export const blogCategories=[
 {slug:'general',title:'مقالات عامة',description:'أفكار ورؤى عملية حول التقنية والأعمال والتحول الرقمي.',iconUrl:'https://api.iconify.design/ph:newspaper-clipping-duotone.svg?color=%2370E4D4'},
 {slug:'business-management',title:'إدارة الأعمال',description:'مقالات مؤسسية عن الإدارة والتشغيل والنمو واتخاذ القرار.',iconUrl:'https://api.iconify.design/ph:briefcase-duotone.svg?color=%23A78BFA'},
 {slug:'artificial-intelligence',title:'الذكاء الاصطناعي',description:'تطبيقات واقعية للذكاء الاصطناعي في الأعمال والمنتجات.',iconUrl:'https://api.iconify.design/ph:brain-duotone.svg?color=%2370E4D4'},
 {slug:'merchant-guides',title:'أدلة للتجار',description:'أدلة تنفيذية تساعد التجار على تنظيم المبيعات والعمليات والبيانات.',iconUrl:'https://api.iconify.design/ph:storefront-duotone.svg?color=%23A78BFA'},
 {slug:'educational',title:'دروس ومنشورات تعليمية',description:'شروحات ودروس قصيرة لبناء مهارات رقمية وعملية قابلة للتطبيق.',iconUrl:'https://api.iconify.design/ph:graduation-cap-duotone.svg?color=%2370E4D4'},
] as const;

export type BlogCategorySlug=(typeof blogCategories)[number]['slug'];
export const blogCategoryBySlug=(slug:string)=>blogCategories.find(category=>category.slug===slug);
export const isBlogCategory=(value:string):value is BlogCategorySlug=>blogCategories.some(category=>category.slug===value);
