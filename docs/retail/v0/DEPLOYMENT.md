# نشر MADAR Retail داخل منصة مَدار

## النموذج المعتمد

MADAR Retail سطح مدمج داخل مستودع ومشروع Vercel وقاعدة Supabase الخاصة بـMADAR Platform:

- GitHub: `madarorbit/madar-platform`
- Vercel: مشروع `madar-platform`
- المسار العام: `/retail`
- مساحة العمل المحمية: `/retail/workspace`
- إدارة Retail: `/admin/retail`
- Supabase: مشروع مَدار الرئيسي، مع جداول `retail_*`

النشر القديم على `https://madar-retail.vercel.app` لا يُحذف أثناء الانتقال. يُعامل كنسخة Legacy حتى اكتمال اختبار النسخة المدمجة، ثم يمكن تحويله إلى redirect في تغيير مستقل وقابل للتراجع.

## متغيرات Vercel

لا توجد متغيرات `RETAIL_SUPABASE_*`. يستخدم Retail القيم الحالية
`NEXT_PUBLIC_SUPABASE_URL` و`SUPABASE_SERVICE_ROLE_KEY` الخاصة بمَدار، وتبقى
قيمة service role على الخادم فقط.

## مسار الإصدار

1. تشغيل lint وtypecheck والاختبارات.
2. رفع فرع التكامل إلى GitHub وفتح Pull Request.
3. تطبيق migrations الموحدة على Supabase الرئيسي.
4. التحقق من Preview: الدخول الرئيسي، العمليات المالية، العزل، ORBY، وAdmin.
5. دمج Pull Request إلى `main` بعد نجاح Preview.
6. التحقق من Production على دومين مَدار.

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
