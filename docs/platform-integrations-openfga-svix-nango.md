# تكامل مَدار مع OpenFGA وSvix وNango

## القرار المعماري

تم دمج المشاريع الثلاثة كطبقات مساندة اختيارية حول أنظمة مَدار، لا كبدائل لها:

- عضوية المؤسسة وRLS وقواعد مَدار تظل المصدر الأول للصلاحيات.
- MADAR Connect يظل المسؤول عن نموذج البيانات والمزامنة والتحويل والكتابة.
- قاعدة مَدار تحتفظ بمراجع اتصالات Nango فقط، ولا تخزن رموز OAuth المدارة بواسطة Nango.
- Svix مسؤول عن تسليم Webhooks الصادرة وإعادة المحاولة، ولا يصبح مصدر حالة الأعمال.
- كل التكاملات مغلقة افتراضيًا ويمكن تعطيلها فورًا بمتغيرات البيئة.

## التراخيص

- OpenFGA: Apache License 2.0. يمكن تشغيله كخدمة مستقلة وربطه عبر HTTP.
- Svix: MIT. يمكن استخدام Svix Cloud أو تشغيل خادمه ذاتيًا عند توفر PostgreSQL وRedis/Valkey المناسبين.
- Nango: Elastic License 2.0. لا يتم نسخ مستودعه أو إعادة تقديم وظائفه الجوهرية كخدمة مُدارة تحمل اسم مَدار. التكامل الحالي عميل API اختياري لخدمة Nango أو لنشر مرخص مستقل.

## 1. OpenFGA — صلاحيات دقيقة

### نموذج مَدار

يوجد النموذج المرجعي في:

```text
infra/openfga/model.fga
```

الأنواع والعلاقات الحالية:

```text
user
organization
  owner
  admin
  member
  can_view
  can_manage_members
  can_manage_integrations
  can_use_orby
  can_manage_billing
```

### قاعدة عدم توسيع الصلاحية

OpenFGA لا يستطيع منح عملية رفضتها مَدار. الترتيب دائمًا:

```text
MADAR membership / RLS / subscription
              ↓
       internalAllowed?
        ├─ no  → deny
        └─ yes → OpenFGA check
```

### أوضاع التشغيل

`shadow` هو الوضع الافتراضي:

- قرار مَدار هو المستخدم فعليًا.
- نتيجة OpenFGA تُقارن بالقرار الداخلي.
- الاختلاف يُسجل دون منع المستخدم.

`enforce`:

- يجب أن تسمح مَدار أولًا.
- يجب أن تسمح OpenFGA أيضًا.
- فشل OpenFGA أو غياب Tuple يؤدي إلى الرفض، لا إلى فتح الصلاحية.

### التفعيل

```env
MADAR_OPENFGA_ENABLED=true
MADAR_OPENFGA_MODE=shadow
OPENFGA_API_URL=https://openfga.example.com
OPENFGA_STORE_ID=
OPENFGA_AUTHORIZATION_MODEL_ID=
OPENFGA_API_TOKEN=
```

### الانتقال الآمن إلى enforce

1. نشر النموذج وإنشاء Store وAuthorization Model.
2. استيراد جميع أعضاء `organization_members` كـTuples.
3. إبقاء `shadow` ومراجعة الاختلافات.
4. اختبار OWNER وADMIN وMEMBER والمؤسسات المتعددة.
5. تشغيل `enforce` في Preview ثم على مؤسسة تجريبية.
6. عدم تعميمه قبل وصول الاختلافات غير المفسرة إلى صفر.

تغييرات العضوية الجديدة تُزامن تلقائيًا مع OpenFGA بعد نجاح RPC الداخلي. فشل المزامنة لا يلغي نجاح عملية مَدار، ويظهر في السجلات لمعالجته لاحقًا.

## 2. Svix — Webhooks صادرة موثوقة

### عزل المستأجرين

يُنشئ مَدار Application مستقلة في Svix لكل مؤسسة باستخدام UID ثابت:

```text
madar-org-<organization-id>
```

وبذلك لا تختلط Endpoints أو Messages بين المؤسسات.

### الأحداث الحالية

- `organization.member.added`
- `organization.member.removed`
- `orby.agent.run.submitted`
- `integration.batch.received`
- `integration.connection.authorized`
- `integration.connection.failed`

لا تشمل الأحداث:

- سؤال العميل أو رد أوربي.
- سجلات المبيعات أو المنتجات الخام.
- أسرار الاتصال.
- رموز OAuth.
- البريد الإلكتروني للعضو.

الحد الداخلي للـPayload هو 40KB، وتستخدم الرسائل Event ID وIdempotency Key ثابتين حيث يلزم منع التكرار.

### التفعيل

```env
MADAR_SVIX_ENABLED=true
SVIX_API_URL=https://api.svix.com
SVIX_AUTH_TOKEN=
```

بعد التفعيل تُنشأ Applications عند أول حدث. يجب إنشاء Endpoints الخاصة بكل عميل من لوحة موثوقة لاحقًا، مع السماح للعميل بالوصول إلى مؤسسته فقط.

### مسار الفشل

Svix غير حاجب؛ الإرسال يجري بعد استجابة العملية الأساسية. تعطل Svix لا يفشل إضافة عضو أو تشغيل أوربي أو استقبال دفعة ربط.

## 3. Nango — OAuth واتصالات APIs

### حدود الاستخدام

Nango يستخدم في مَدار من أجل:

- Connect Session قصيرة العمر.
- OAuth وAPI Key lifecycle.
- Token refresh داخل Nango.
- Proxy محدود للموصلات المعتمدة.
- استقبال Auth Webhooks موقعة.

ولا يستخدم كبديل عن:

- Connector Registry.
- UDM.
- Data Pipeline.
- Sync checkpoints.
- Write governance.
- سجلات مَدار وتدقيقها.

### قائمة السماح

لا يستطيع المستخدم طلب أي Integration عشوائية. يجب إدراج المفاتيح صراحة:

```env
MADAR_NANGO_ALLOWED_INTEGRATIONS=odoo,google-sheets,woocommerce
```

يُرفض أي مفتاح غير موجود في القائمة، حتى لو كان مدعومًا لدى Nango.

### إنشاء جلسة اتصال

المسار:

```text
POST /api/integrations/nango/connect-session
```

يتحقق من:

1. تسجيل الدخول.
2. عضوية المؤسسة.
3. أن الدور OWNER أو ADMIN.
4. OpenFGA في حال تفعيل enforce.
5. حالة الاشتراك.
6. قائمة الموصلات المسموحة.

ثم يعيد Token وConnect Link قصيري العمر.

### Webhook المصادقة

المسار:

```text
POST /api/integrations/nango/webhook
```

يتحقق من `X-Nango-Hmac-Sha256` باستخدام `NANGO_WEBHOOK_SIGNING_KEY`. يتم تجاهل الأنواع غير المعروفة بأمان. أحداث إنشاء الاتصال أو إعادة تفويضه تُطابق مع المؤسسة والمستخدم عبر Tags موقعة.

### تخزين المراجع

Migration:

```text
supabase/migrations/20260805235500_platform_external_bindings.sql
```

الجدول يخزن:

- المؤسسة.
- المزود `nango`.
- Integration ID.
- Connection ID.
- الحالة وMetadata غير السرية.

لا توجد أعمدة Access Token أو Refresh Token أو Client Secret. القراءة متاحة لأعضاء المؤسسة عبر RLS، والكتابة محصورة في Service Role القادم من Webhook الموقّع.

### Proxy محدود

`nangoProxyRequest` دالة Server-only للموصلات المعتمدة، وتمنع:

- Integration خارج Allowlist.
- URL كامل أو تغيير Base URL.
- `//` و`..` وBackslash وCRLF داخل Endpoint.
- Body أكبر من 256KB.
- Response أكبر من 5MB.
- تعديل ترويسات Nango الخاصة بالهوية والمصادقة.

لا يوجد Proxy API عام للمستخدم أو لأوربي. يجب أن يستدعيه Connector معتمد بعد تحميل Binding تخص المؤسسة من قاعدة مَدار.

### التفعيل

```env
MADAR_NANGO_ENABLED=true
NANGO_API_URL=https://api.nango.dev
NANGO_API_KEY=
NANGO_WEBHOOK_SIGNING_KEY=
MADAR_NANGO_ALLOWED_INTEGRATIONS=
```

## ترتيب الإطلاق

1. نشر الكود وكل الأعلام `false`.
2. تطبيق Migration الخاصة بالمراجع الخارجية.
3. تفعيل OpenFGA في `shadow` فقط وإجراء Backfill.
4. تفعيل Svix في Preview وإرسال أحداث اختبار لمؤسسة داخلية.
5. تفعيل Nango في Development مع Integration واحدة فقط.
6. اختبار إنشاء الاتصال وإعادة التفويض وتكرار Webhook وتوقيع خاطئ.
7. بناء أول Connector معتمد يستهلك `nangoProxyRequest`.
8. توسيع Allowlist Integration واحدة في كل مرة.
9. عدم تحويل OpenFGA إلى `enforce` قبل اكتمال Tuples واختبارات الانقطاع.

## الرجوع الفوري

```env
MADAR_OPENFGA_ENABLED=false
MADAR_SVIX_ENABLED=false
MADAR_NANGO_ENABLED=false
```

عند التعطيل:

- تعود صلاحيات مَدار الداخلية وحدها.
- تتوقف Webhooks الصادرة دون التأثير على العمليات.
- يتوقف إنشاء اتصالات Nango الجديدة.
- تبقى Binding references محفوظة ولا تؤثر على MADAR Connect.
