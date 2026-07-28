# ORBY Stage 3 — Memory, Knowledge & Proactive Intelligence

**المرجع:** ORBY Initial Architecture & Build Roadmap  
**الموقع المعماري:** مرجع فرعي تابع لـ MADAR Integration Master Roadmap، وليس خارطة مستقلة.  
**الاعتماد:** تُبنى هذه المرحلة فوق ORBY Kernel في المرحلة الأولى وAgent Execution Layer في المرحلة الثانية، وتعيد استخدام UDM وIntegration Gateway وNotification Center وWorkspace System.

## الهدف

تحويل ORBY من وكيل ينتظر الطلب إلى عقل تشغيلي يتذكر السياق المسموح، يفهم ملفات المؤسسة، يراقب بيانات مَدار بصورة دورية، يكتشف المخاطر والفرص، ويجهز خططًا ومسودات إجراءات لا تنفذ قبل الموافقة.

## ما تم بناؤه

### 1. Memory Engine

- نافذة محادثة محدودة الحجم، مع تلخيص تراكمي عند تجاوز الحد.
- ذاكرة قصيرة المدى، طويلة المدى، تفضيلات المستخدم وذاكرة مساحة العمل.
- سياسة مركزية للأنواع المسموحة، الحساسية، الموافقة، الكلمات والأنماط المحظورة.
- مدد احتفاظ وانتهاء تلقائي، واسترجاع مرتب بالصلة والأهمية والثقة والحداثة.
- عزل صريح بين المؤسسة، المستخدم، مساحة العمل والجلسة.
- الذاكرة طويلة المدى مغلقة افتراضيًا وتتطلب موافقة صريحة عند تفعيلها.

### 2. Knowledge Engine

- مصادر معرفة وإصدارات وحالة فهرسة وحداثة وثقة وبيانات مصدر.
- استخراج أصلي لـ TXT وMarkdown وCSV وJSON وHTML وXML.
- عقد OCR مستقل للـ PDF والصور، مع محول HTTP اختياري يقرأ من متغيرات الخادم فقط.
- تقسيم المستندات مع تداخل، Checksum، Metadata، Embeddings وتخزين متجهات.
- تضمينات من مزود ORBY عند توفرها، أو نموذج محلي حتمي كمسار احتياطي.
- بحث متجهي ودلالي مع عزل المؤسسة ومساحة العمل والمصدر.

### 3. RAG والاستشهادات

- Retrieval Pipeline وContext Builder وSource Ranking وحد أقصى للسياق.
- Citation Engine يفرض استخدام `[S1]` وما شابه للمعلومات المسترجعة.
- Hallucination Guard يرفض الإجابات التي تستخدم المعرفة دون استشهاد صحيح.
- عند غياب نموذج لغوي، يعيد ORBY ملخصًا استخراجيًا موثقًا بدل اختلاق إجابة.

### 4. Events, Scheduler & Queue

- Event Store وRouting وPriority وReplay وDeduplication.
- Scheduler للمهام المتكررة والمتأخرة.
- Queue دائمة مع Lease وHeartbeat منطقي عبر claim، Idempotency، Retry متدرج وDead-letter state.
- عامل محمي بسر ORBY ويعمل كل ساعة عبر Vercel Cron.

### 5. Detection & Analytics

كواشف مستقلة للمبيعات، الإيرادات، تسرب العملاء، المخزون، المدفوعات، الدعم، الزيارات وصحة الأنظمة. كل إشارة تحمل:

- Anomaly/Opportunity/Trend/Risk.
- Confidence Score مبنيًا على حجم العينة، حداثة البيانات وجودتها.
- Risk Score وOpportunity Score.
- أسبابًا محتملة وأدلة وتوصيات.
- Fingerprint وCooldown لمنع التكرار والإزعاج.

### 6. Insights, Notifications & Reports

- Insight موحد قابل للتحديث بدل إنشاء إنذار مكرر.
- مركز تفضيلات للإشعارات، شدة دنيا، Quiet Hours، قنوات وتسليم فوري أو Digest.
- ربط In-app مع جدول إشعارات مَدار الحالي.
- تقارير يومية وأسبوعية وشهرية وتنفيذية وتقارير مساحة العمل.

### 7. الربط بالمرحلة الثانية

كل إجراء استباقي يتحول إلى خطة صريحة تبدأ بعقدة Approval. الأدوات المقترحة في المرحلة الثالثة تنشئ فقط `madar.business.action.draft`. لا تعديل مباشر للطلبات أو العملاء أو المخزون، ولا حذف، ولا كتابة خارجية. التنفيذ اللاحق يظل مسؤولية Permission Engine وPolicy Engine وApproval Engine وAction Engine في المرحلة الثانية.

## التفعيل المحافظ

بعد تطبيق المهاجرات:

- تتفعل المحادثة والتلخيص والذاكرة القصيرة وذاكرة مساحة العمل والتفضيلات.
- تبقى الذاكرة طويلة المدى مغلقة.
- تتفعل الكواشف الدورية والتقارير اليومية والأسبوعية والتنظيف الدوري.
- تتفعل الإشعارات داخل المنصة للمالك، مع حد شدة متوسط وCooldown افتراضي.
- يتفعل فقط Tool إنشاء مسودة الأعمال.
- يبقى Model Planner مغلقًا، وكذلك الحذف والكتابة الخارجية.
- تُفعّل نواة ORBY فقط للمؤسسات التي لديها نموذج مفعل؛ وإلا يعمل RAG بالمسار الاستخراجي الموثق.

## واجهات الخادم

```text
/api/orby/intelligence/memory
/api/orby/intelligence/memory/policy
/api/orby/intelligence/preferences
/api/orby/intelligence/knowledge/sources
/api/orby/intelligence/knowledge/documents
/api/orby/intelligence/rag
/api/orby/intelligence/insights
/api/orby/intelligence/insights/:insightId/prepare
/api/orby/intelligence/reports
/api/orby/intelligence/schedules
/api/orby/intelligence/detectors/run
/api/orby/intelligence/worker
```

## حدود المرحلة

- لا تعلم ذاتي غير خاضع للمراجعة.
- لا تعديل تلقائي لسياسات الذاكرة أو التنفيذ.
- لا تنفيذ مباشر بناءً على Insight.
- لا مصادر خارجية غير موثقة دون Citation.
- OCR للمستندات المصورة يحتاج مزود OCR مضبوطًا عبر `ORBY_OCR_ENDPOINT`; استخراج الملفات النصية يعمل دون هذا الإعداد.
