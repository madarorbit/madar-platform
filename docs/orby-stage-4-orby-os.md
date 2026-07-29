# ORBY Stage 4 — Expansion, Governance & ORBY OS

هذه المرحلة هي المرجع الفرعي الرابع والأخير داخل **ORBY Initial Architecture & Build Roadmap**، وتظل تابعة لـ **MADAR Integration Master Roadmap** وليست خارطة مستقلة.

## المخرج

`ORBY OS v1` يحول المراحل السابقة إلى نظام تشغيل وكلاء مؤسسي عبر:

- Workflow definitions مستقلة، إصدارات ثابتة، قوالب وتدفقات قابلة لإعادة الاستخدام.
- Plugin Registry مترجم داخل المستودع؛ لا كود ديناميكي من قاعدة البيانات.
- Domain Plugins: Business وStore وFinance وStudent.
- مركز إدارة موحد للمزودات والنماذج والأدوات والذاكرة والمعرفة والكواشف والتدفقات والإضافات.
- حوكمة حتمية Default-Deny لا يستطيع النموذج أو Plugin تجاوزها.
- Multi-model routing حسب القدرات والصحة والتكلفة ونوع المهمة مع Circuit Breaker.
- Trace/Span observability وتسجيل التكلفة والميزانيات.
- Evaluation وBenchmark Suite واختبارات أمن واعتمادية.
- Feature Flags وCanary وإصدارات وRollback.
- Backup metadata وData Governance وChannel-ready architecture.

## الحدود الآمنة عند الإطلاق

- لا مفاتيح مزودات في قاعدة البيانات أو GitHub.
- تنفيذ النماذج الخارجية يبقى مغلقًا حتى توفير المزود لاحقًا.
- OCR للصور وملفات PDF الممسوحة ضوئيًا يبقى مغلقًا.
- القناة الوحيدة النشطة افتراضيًا هي داخل مَدار؛ البريد وواتساب وPush والهاتف وWebhooks تبقى معطلة.
- الكتابة الخارجية والحذف لا يفتحان بهذه المرحلة.
- Plugins تحفظ Metadata وإصدارات وإعدادات فقط، أما الكود فمن Registry مترجم ومراجع.
- كل عمليات الإدارة محصورة في الإدارة العليا، وكل جداول التحكم محمية بـRLS.

## القبول

لا تُعتمد المرحلة إلا بعد نجاح الاختبارات، Smoke Suite، Lint، TypeScript، Next.js Build، تطبيق المهاجرة، فحص RLS والامتيازات، ثم Preview وProduction verification.
