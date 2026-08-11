# ORBY Retail

ORBY Retail يستخدم الآن `createServerOrbyFoundation` من منصة مَدار: Provider Registry وModel Registry وrouting/fallback والذاكرة المقيدة بالمنظمة نفسها. لا يحمل مفتاح OpenRouter مستقلًا.

المسار:

1. `/api/retail/orby` يتحقق من جلسة مَدار أو Bearer الرئيسي ويطابق المنظمة بالـworkspace.
2. صلاحية `can_use_orby` وquota وanalytics وcustomer/supplier summaries تُتحقق عبر منصة مَدار ثم bridge وactor الحقيقي.
3. Analytics Engine الحتمي يبني `evidence[]` مع القيمة والمصدر والفترة.
4. سياق Retail يدخل ORBY كبيانات حساسة غير موثوقة من حيث التعليمات، مع system policies للقراءة فقط.
5. لا توجد tools مالية. mutation intent يعيد رفضًا حتميًا دون استدعاء المزود.
6. أي رقم في جواب المزود غير موجود في السؤال/evidence يرفض الجواب ويستخدم fallback الحتمي.
7. تحفظ المحادثة والأدلة في قاعدة Retail، بينما مزودات وتشغيل النواة تأتي من مَدار.

فشل المزود لا يوقف التحليل؛ المستخدم يحصل على جواب حتمي من نفس البيانات. عدم وجود بيانات ينتج تصريحًا واضحًا، لا تخمينًا.
