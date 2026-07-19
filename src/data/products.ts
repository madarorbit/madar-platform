export type Product = {
  id: number;
  slug: string;
  category: string;
  title: string;
  description: string;
  price: string;
  icon: string;
};

export const products: Product[] = [
  {
    id: 1,
    slug: 'advanced-ai-assistant',
    category: 'نظام ذكاء اصطناعي',
    title: 'مساعد AI متقدم',
    description: 'نظام ذكاء اصطناعي متطور للإجابة على الأسئلة وتحليل البيانات بدقة عالية',
    price: '299 ر.س',
    icon: '🤖',
  },
  {
    id: 2,
    slug: 'project-management-notion-template',
    category: 'قالب Notion',
    title: 'نظام إدارة المشاريع',
    description: 'قالب Notion احترافي لإدارة المشاريع والمهام بكفاءة عالية',
    price: '99 ر.س',
    icon: '📋',
  },
  {
    id: 3,
    slug: 'business-automation-suite',
    category: 'أتمتة الأعمال',
    title: 'تطبيق الأتمتة الشامل',
    description: 'حل شامل لأتمتة عمليات عملك وتوفير الوقت والموارد',
    price: '199 ر.س',
    icon: '⚙️',
  },
  {
    id: 4,
    slug: 'sales-dashboard-google-sheets',
    category: 'نظام Google Sheets',
    title: 'لوحة تحكم المبيعات',
    description: 'نظام Google Sheets متقدم لتتبع المبيعات والتحليلات الفورية',
    price: '149 ر.س',
    icon: '📊',
  },
  {
    id: 5,
    slug: 'ecommerce-store-template',
    category: 'قالب احترافي',
    title: 'موقع المتجر الإلكتروني',
    description: 'قالب متجر إلكتروني احترافي جاهز للاستخدام الفوري',
    price: '399 ر.س',
    icon: '🛍️',
  },
  {
    id: 6,
    slug: 'smart-video-editor',
    category: 'أداة رقمية',
    title: 'محرر الفيديو الذكي',
    description: 'أداة متقدمة لتحرير الفيديوهات بسهولة واحترافية عالية',
    price: '249 ر.س',
    icon: '🎬',
  },
];

export const productCategories = Array.from(new Set(products.map((product) => product.category)));
