import {arabicMoney} from '@/src/lib/arabic-display';

export type Product = {
  id: number;
  slug: string;
  category: string;
  title: string;
  description: string;
  longDescription: string;
  price: number;
  currency: string;
  icon: string;
  status: 'published' | 'draft';
  delivery: string;
  features: string[];
  includes: string[];
  thumbnailUrl?: string | null;
};

export const products: Product[] = [
  { id: 1, slug: 'advanced-ai-assistant', category: 'أنظمة الذكاء الاصطناعي', title: 'مساعد ذكي متقدم للأعمال', description: 'مساعد ذكي عربي لإجابة العملاء وتلخيص البيانات وبناء قواعد معرفة داخلية.', longDescription: 'نظام جاهز للتخصيص يساعد فرق المبيعات والدعم على تحويل الأسئلة المتكررة إلى إجابات موحدة، مع مسارات تشغيل قابلة للتكامل لاحقًا مع البريد وواتساب وأنظمة إدارة العملاء.', price: 299, currency: 'ريال سعودي', icon: '🤖', status: 'published', delivery: 'رابط تنزيل وملف إعداد خلال أربع وعشرين ساعة', features: ['قاعدة معرفة قابلة للتوسع', 'سيناريوهات رد عربية', 'توثيق إعداد وتشغيل', 'بنية جاهزة للتكاملات'], includes: ['ملفات القالب', 'دليل التشغيل', 'جلسة تهيئة قصيرة'] },
  { id: 2, slug: 'project-management-notion-template', category: 'قوالب نوشن', title: 'نظام إدارة المشاريع', description: 'قالب نوشن احترافي لإدارة المشاريع والمهام والمؤشرات.', longDescription: 'مساحة عمل عربية منظمة للفرق الصغيرة ورواد الأعمال، تشمل المشاريع والمهام والاجتماعات والمؤشرات وقوالب التقارير.', price: 99, currency: 'ريال سعودي', icon: '📋', status: 'published', delivery: 'رابط قالب نوشن قابل للتكرار فور تأكيد الطلب', features: ['لوحات مشاريع ومهام', 'قوالب اجتماعات', 'مؤشرات تقدم', 'دليل استخدام عربي'], includes: ['رابط القالب', 'مقطع شرح مختصر', 'تحديثات طفيفة لمدة ثلاثين يومًا'] },
  { id: 3, slug: 'business-automation-suite', category: 'أتمتة الأعمال', title: 'حزمة أتمتة العمليات', description: 'خرائط أتمتة جاهزة لتنظيم الاستقبال والمتابعة والتقارير.', longDescription: 'حزمة عملية لتقليل العمل اليدوي في المتاجر والخدمات، مصممة كبنية قابلة للربط لاحقًا مع مزودي البريد والدفع والرسائل.', price: 199, currency: 'ريال سعودي', icon: '⚙️', status: 'published', delivery: 'ملفات العمل وخريطة التكامل بعد مراجعة بيانات الطلب', features: ['خرائط تدفق جاهزة', 'نماذج رسائل متابعة', 'قوائم تحقق تشغيلية', 'إرشادات أمن البيانات'], includes: ['ملفات الأتمتة', 'دليل الربط', 'قائمة اختبار قبل الإطلاق'] },
  { id: 4, slug: 'sales-dashboard-google-sheets', category: 'جداول جوجل', title: 'لوحة تحكم المبيعات', description: 'نظام جداول جوجل لمتابعة المبيعات والتحويلات والمؤشرات اليومية.', longDescription: 'لوحة قياس مرنة للشركات الصغيرة تجمع المبيعات والمصروفات ومؤشرات الأداء في جداول واضحة قابلة للتوسع.', price: 149, currency: 'ريال سعودي', icon: '📊', status: 'published', delivery: 'رابط نسخة من جداول جوجل وتعليمات التخصيص', features: ['مؤشرات مبيعات', 'تقارير شهرية', 'تنبيهات تحقق يدوية', 'صفحات إدخال منظمة'], includes: ['القالب', 'دليل الصيغ', 'أمثلة بيانات'] },
];

export const productCategories = Array.from(new Set(products.map((product) => product.category)));
export const publishedProducts = products.filter((product) => product.status === 'published');
export function getProduct(slug: string) { return products.find((product) => product.slug === slug); }
export function formatPrice(product: Product) { return arabicMoney(product.price,product.currency); }
