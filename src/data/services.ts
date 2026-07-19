export type Service = { slug: string; title: string; description: string; outcomes: string[]; duration: string; startingFrom: string };
export const services: Service[] = [
  { slug: 'automation-consulting', title: 'استشارات وأتمتة العمليات', description: 'تحليل سير العمل وبناء خطة أتمتة عملية قابلة للتنفيذ دون تغيير جذري في أدواتك الحالية.', outcomes: ['خريطة عمليات', 'أولويات تنفيذ', 'متطلبات تكامل'], duration: '5-10 أيام عمل', startingFrom: 'تبدأ من 750 ر.س' },
  { slug: 'digital-product-build', title: 'بناء منتجات رقمية', description: 'تصميم قوالب وأنظمة تشغيل داخلية ولوحات بيانات لفريقك أو لبيعها كمنتج رقمي.', outcomes: ['مواصفات منتج', 'نسخة قابلة للإطلاق', 'توثيق استخدام'], duration: '2-4 أسابيع', startingFrom: 'تبدأ من 2,500 ر.س' },
  { slug: 'ai-workflows', title: 'تجهيز تدفقات AI', description: 'تحويل المهام المتكررة إلى تدفقات مدعومة بالذكاء الاصطناعي مع ضوابط جودة ومراجعة.', outcomes: ['تصميم prompts', 'قواعد مراجعة', 'خطة قياس'], duration: '1-3 أسابيع', startingFrom: 'تبدأ من 1,500 ر.س' },
];
