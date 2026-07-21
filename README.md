# مَدار | ORBIT

منصة عربية (RTL) للمنتجات الرقمية والخدمات، مع فصل صريح بين **لوحة العميل** (`/dashboard`) ومساحة إدارة منصة مَدار (`/admin`). امتلاك العميل لمساحة عمل لا يمنحه وصولاً إلى الإدارة.

## التشغيل المحلي

1. انسخ `.env.example` إلى `.env.local` وأدخل القيم من مشروع Supabase المقصود؛ لا تضع الأسرار في Git.
2. شغّل `npm install` ثم `npm run dev`.
3. في **Authentication → URL Configuration** أضف `${NEXT_PUBLIC_SITE_URL}/auth/callback` و`${NEXT_PUBLIC_SITE_URL}/reset-password` (ومكافئات الإنتاج). روابط البريد تستخدم callback للتحقق ثم تحفظ جلسة httpOnly.

## قاعدة البيانات

لا تعدّل migration المرحلة الأولى بعد تطبيقها. افحصها أولاً بالاستعلام read-only في `supabase/verification/phase_one_read_only.sql`. لا تستخدم `db reset` على قاعدة بعيدة. ترتيب migrations الكامل:

- `supabase/migrations/20260719000000_phase_one.sql`
- `supabase/migrations/20260720000000_phase_two_workspaces.sql`
- `supabase/migrations/20260720010000_member_management.sql`
- `supabase/migrations/20260721000000_phase_one_two_hardening.sql`
- `supabase/migrations/20260721010000_seed_initial_catalog.sql`
- `supabase/migrations/20260721020000_rpc_and_policy_cleanup.sql`

تضيف المرحلة الثانية `organizations` و`organization_members` وعزل RLS وRPC ذرية تنشئ المساحة وعضوية OWNER معاً. تنقل migrations التقوية دوال الامتياز إلى schema خاصة، وتضبط منح Data API وحدود Storage صراحةً.

طُبقت migrations المرحلة الثانية والتقوية وبيانات الكتالوج على مشروع Supabase الإنتاجي في 2026-07-21. سجل المرحلة الأولى كان قد طُبق يدوياً قبل إنشاء سجل migrations؛ ملف التحقق read-only هو مرجع baseline. لا تعِد تطبيق ملف المرحلة الأولى على المشروع الحالي.

## مالك المنصة

سجّل البريد المطابق تماماً لـ`SUPER_ADMIN_EMAIL` وأكّده، ثم شغّل `npm run promote:super-admin` في بيئة خادمية فيها `SUPABASE_SERVICE_ROLE_KEY`. السكربت idempotent ولا يطبع الأسرار.

## الفحوصات

`npm run lint`، `npx tsc --noEmit`، `npm run build`، و`npm test`.
