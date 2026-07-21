import type { IconName } from '@/components/ui/Icons';

export const platformPillars:{title:string;description:string;icon:IconName}[]=[
  {title:'إدارة التجارة',description:'مساحات عمل تنظّم المنتجات والطلبات والعمليات في سياق واحد.',icon:'chart'},
  {title:'الرقمنة العملية',description:'تحويل الإجراءات المتكررة إلى تدفقات واضحة وقابلة للقياس.',icon:'automation'},
  {title:'طبقة ذكية للأعمال',description:'تهيئة البيانات والعمليات للاستفادة الآمنة من الذكاء الاصطناعي.',icon:'sparkles'},
  {title:'منتجات وخدمات متخصصة',description:'متجر مستقل للأدوات الرقمية وخدمات تنفيذ تناسب مرحلة العمل.',icon:'layers'},
];

export const blogPosts=[
  {slug:'digital-foundation',category:'التحول الرقمي',date:'22 يوليو 2026',title:'لماذا تبدأ رقمنة التجارة من العمليات لا من الأدوات؟',excerpt:'إطار عملي لتحديد ما يستحق الرقمنة أولاً، وكيف تتجنب تراكم الأدوات دون أثر تشغيلي.'},
  {slug:'smart-business-layer',category:'الذكاء الاصطناعي',date:'22 يوليو 2026',title:'ما المقصود بإضافة طبقة ذكية إلى العمل؟',excerpt:'شرح مؤسسي للفرق بين استخدام أداة ذكاء اصطناعي وبناء عمل مهيأ للاستفادة المستدامة منها.'},
  {slug:'commerce-operations',category:'إدارة التجارة',date:'22 يوليو 2026',title:'خمس إشارات تدل أن عمليات متجرك تحتاج إلى إعادة تنظيم',excerpt:'مؤشرات مبكرة تكشف تشتت الطلبات والبيانات، وخطوات بسيطة لاستعادة السيطرة التشغيلية.'},
];

export const jobs=[
  {slug:'growth-marketing',title:'مسؤول/ة تسويق ونمو',department:'التسويق',type:'تعاون مرن · عن بُعد',icon:'megaphone' as IconName,summary:'تخطيط وتنفيذ محتوى وحملات ترفع حضور مَدار وتحوّل الاهتمام إلى فرص حقيقية.',requirements:['قدرة قوية على الكتابة العربية','فهم أساسيات التسويق الرقمي وقياس الأداء','الالتزام بالتجربة والتحسين المستمر']},
  {slug:'platform-developer',title:'مطوّر/ة منصات وتكاملات',department:'التطوير',type:'تعاون مرن · عن بُعد',icon:'code' as IconName,summary:'تطوير واجهات وتكاملات آمنة تساعد التجار والأعمال على إدارة عملياتهم بكفاءة.',requirements:['خبرة عملية في TypeScript وواجهات الويب','فهم قواعد البيانات وواجهات API','اهتمام بالأمان وجودة تجربة المستخدم']},
];
