# نشر MADAR Retail داخل منصة مَدار

## النموذج المعتمد

MADAR Retail أصبح سطحًا مدمجًا داخل مستودع ومشروع Vercel الخاصين بـMADAR Platform، بينما تبقى بياناته في مشروع Supabase مستقل:

- GitHub: `madarorbit/madar-platform`
- Vercel: مشروع `madar-platform`
- المسار العام: `/retail`
- مساحة العمل المحمية: `/retail/workspace`
- إدارة Retail: `/admin/retail`
- Supabase Retail: `madar-retail`، ref `gjfeseljmillalmeygej`

النشر القديم على `https://madar-retail.vercel.app` لا يُحذف أثناء الانتقال. يُعامل كنسخة Legacy حتى اكتمال اختبار النسخة المدمجة، ثم يمكن تحويله إلى redirect في تغيير مستقل وقابل للتراجع.

## متغيرات Vercel

تُضاف إلى مشروع `madar-platform` في Preview وProduction:

```text
RETAIL_SUPABASE_URL=https://gjfeseljmillalmeygej.supabase.co
RETAIL_SUPABASE_SERVICE_ROLE_KEY=<Retail service-role secret>
```

قواعد إلزامية:

- المفتاح Server-only ولا يبدأ بـ`NEXT_PUBLIC_`.
- يؤخذ من مشروع Retail فقط، ولا يُستخدم مفتاح Supabase الخاص بمنصة مَدار.
- لا يُكتب في Git أو logs أو browser bundle.
- وصول المتصفح يكون عبر جلسة مَدار وواجهات BFF فقط.

لا يحتاج مشروع Supabase Retail إلى Google OAuth أو جلسات مستخدمين جديدة؛ تسجيل الدخول وGoogle callback والجلسة تأتي من MADAR Platform.

## مسار الإصدار

1. تشغيل lint وtypecheck والاختبارات.
2. رفع فرع التكامل إلى GitHub وفتح Pull Request.
3. ضبط متغيري Retail على Preview.
4. التحقق من Preview: الدخول الرئيسي، onboarding، العمليات المالية، العزل، ORBY، وAdmin.
5. دمج Pull Request إلى `main` بعد نجاح Preview.
6. التحقق من Production على دومين مَدار، مع إبقاء النسخة القديمة متاحة مؤقتًا للرجوع.

## تحقق ما بعد النشر

- `/retail` يعمل دون جلسة ويعرض المنتج.
- `/retail/workspace` يحوّل غير المسجل إلى تسجيل دخول مَدار.
- Google Sign-In يعود إلى مسار Retail المطلوب.
- أول دخول يربط مؤسسة مَدار بمساحة Retail واحدة.
- كل عملية مالية تمر عبر `retail_platform_execute` وتنجح بالكامل أو تُلغى بالكامل.
- مستخدم من مؤسسة أخرى لا يقرأ أو يعدّل مساحة Retail.
- ORBY يعرض أدلة Retail محددة ولا ينفذ mutations.
- `/admin/retail` يتطلب صلاحية Platform Admin.

## النطاق

المسار الأساسي هو نفس دومين مَدار، مثل `https://orbitmadar.com/retail`. لا يحتاج ذلك إلى تعديل DNS. لا يُنقل `orbitmadar.com` ولا يُغيّر مشروع Vercel الأساسي خارج عملية النشر المعتادة للمستودع.
