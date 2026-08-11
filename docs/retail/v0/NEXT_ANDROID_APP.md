# Next MADAR Retail Android App

## عقد Cloud الحالي

- Auth: مشروع Supabase الرئيسي لمَدار، بنفس Google PKCE/email flow. لا تستخدم Auth مشروع Retail.
- Base URL: دومين مَدار؛ كل sync تحت `/api/retail/v1/sync/*`.
- Authorization: Platform access token في Bearer، والتحقق النهائي من organization membership على الخادم.
- Workspace: يحصل التطبيق عليه من API/bootstrap القادم؛ لا يقبل UUID يدويًا.
- Money: Decimal/minor units، لا `Double`. Quantity حتى ثلاث منازل.
- Device: UUID v4 ثابت لكل تثبيت ثم register.
- Outbox: operation UUID immutable وretry بنفس payload.
- Pull: changes + cursor في SQLite transaction واحدة.
- Financial conflicts: لا merge؛ اعرض domain rejection ثم refresh.

الـCloud backend يملك ledgers ذرية وidempotency وdevice registration وcursor pull، وقد نجح سيناريو مالي كامل عبر الجسر. قبل بدء Android يلزم فقط تثبيت endpoint bootstrap/session refresh contract وسياسة retention/tombstone النهائية؛ بناء SQLite/Outbox/UX التعارض هو المهمة القادمة.

زر Android موجود في `app/retail/page.tsx` بحالة «قريبًا». الإصدار القادم يجعله config-driven عبر release manifest (`version`, `minVersion`, `sha256`, `url`) دون تغيير تصميم الصفحة.
