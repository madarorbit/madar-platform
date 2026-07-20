# مَدار | ORBIT

منصة عربية (RTL) للمنتجات الرقمية والخدمات، مع فصل صريح بين **لوحة العميل** (`/dashboard`) ومساحة إدارة منصة مَدار (`/admin`). امتلاك العميل لمساحة عمل لا يمنحه وصولاً إلى الإدارة.

## التشغيل المحلي

1. انسخ `.env.example` إلى `.env.local` وأدخل القيم من مشروع Supabase المقصود؛ لا تضع الأسرار في Git.
2. شغّل `npm install` ثم `npm run dev`.
3. في **Authentication → URL Configuration** أضف `${NEXT_PUBLIC_SITE_URL}/auth/callback` و`${NEXT_PUBLIC_SITE_URL}/reset-password` (ومكافئات الإنتاج). روابط البريد تستخدم callback للتحقق ثم تحفظ جلسة httpOnly.

## قاعدة البيانات

لا تعدّل migration المرحلة الأولى بعد تطبيقها. افحصها أولاً بالاستعلام read-only في `supabase/verification/phase_one_read_only.sql`. بعد ربط المشروع بالـSupabase CLI وتحقق آثار المرحلة الأولى، استخدم `supabase migration list` ثم أصلح السجل رسمياً فقط إن كانت كل الآثار موجودة، وبعدها طبّق migration المرحلة الثانية:

- `supabase/migrations/20260719000000_phase_one.sql`
- `supabase/migrations/20260720000000_phase_two_workspaces.sql`

Migration المرحلة الثانية تضيف `organizations` و`organization_members` وRLS وRPC ذرية تنشئ المساحة وعضوية OWNER معاً. لا تشغّل `db reset` على قاعدة بعيدة.

## مالك المنصة

سجّل البريد المطابق تماماً لـ`SUPER_ADMIN_EMAIL` وأكّده، ثم شغّل `npm run promote:super-admin` في بيئة خادمية فيها `SUPABASE_SERVICE_ROLE_KEY`. السكربت idempotent ولا يطبع الأسرار.

## الفحوصات

`npm run lint`، `npx tsc --noEmit`، `npm run build`، و`npm test`.
