# Retail Sync Architecture

## عقد الهوية

Android القادم يسجل الدخول إلى **MADAR Platform Auth** نفسه (Google PKCE أو email/password) ويرسل access token الرئيسي إلى دومين مَدار. لا يتصل مباشرة بمشروع Supabase Retail.

```http
Authorization: Bearer <madar_platform_access_token>
Content-Type: application/json
```

الخادم يتحقق من JWT لدى مشروع مَدار، profile، organization membership، وربط workspace في قاعدة Retail، ثم ينفذ عبر الجسر service-only.

## Endpoints

- `POST /api/retail/v1/sync/register`
- `POST /api/retail/v1/sync/pull`
- `POST /api/retail/v1/sync/push`

الأجسام تبقى كما في `src/lib/retail/sync/contracts.ts`. الاستجابة تحمل `X-MADAR-Sync-Version: 1`.

## السلوك

1. التطبيق ينشئ device UUID ثابتًا وOutbox operation UUID لا يتغير عند retry.
2. push dispatch إلى allowlist من RPCs الذرية؛ تكرار UUID يعيد receipt السابقة، واستخدامه لنوع آخر = `409`.
3. pull يستخدم cursor خادميًا؛ الوقت المحلي metadata وليس ترتيبًا ماليًا.
4. ledgers append-only ولا تُدمج على الجهاز. Master data تعتمد version/tombstone وتحتاج conflict UI في مهمة Android.
5. payload الأقصى 256KiB؛ page pull حتى 500.

لا توجد SQLite أو Outbox محلية أو محرك conflict في هذا المستودع.
