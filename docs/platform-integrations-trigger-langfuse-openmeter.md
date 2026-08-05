# تكامل مَدار مع Trigger.dev وLangfuse وOpenMeter

## القرار المعماري

هذه الخدمات **طبقات مساندة اختيارية** وليست مصادر حقيقة بديلة لأنظمة مَدار:

- قاعدة بيانات مَدار و`IntegrationQueue` وORBY Agent Repository تظل المصدر الملزم لحالة المهام.
- `consume_orby_quota` وجداول الاشتراكات والحقوق تظل المرجع الملزم للسماح والمنع.
- تعطل Trigger.dev أو Langfuse أو OpenMeter لا يفشل طلب المستخدم ولا يفتح صلاحية ولا يفقد مهمة.
- جميع التكاملات مغلقة افتراضيًا وتُفعل بمتغيرات بيئة صريحة.

## 1. Trigger.dev — منفذ تنفيذ دائم

### ما تم دمجه

يوجد Runtime مستقل في:

```text
infra/trigger-runtime
```

ويحتوي مهمتين:

- `madar-integration-worker`: تستدعي عامل MADAR Connect وتكرر السحب حتى فراغ الدفعة أو بلوغ حد آمن.
- `madar-orby-worker`: تستدعي عامل ORBY Agent بالطريقة نفسها.

تطبيق Next.js لا يستورد SDK الخاص بـTrigger.dev ولا يغير `package-lock.json`. يتواصل معه عبر Management API فقط، بينما Runtime مستقل بحزمه و`tsconfig` الخاص به.

### الحماية من التعارض

- Trigger.dev لا ينشئ حالة أعمال موازية ولا يحتفظ ببيانات العميل الأساسية.
- Payload يحتوي نوع العامل ومعرف ارتباط فقط، ولا يحتوي أسرار الربط أو سجلات المبيعات.
- العامل الفعلي داخل مَدار محمي بـBearer secret ويستخدم آليات claim/lease/idempotency القائمة.
- الاستدعاء يتم داخل `after()` بعد إرسال استجابة Next.js.
- عند فشل Trigger.dev تستمر Cron routes والعمال الحاليون دون تغيير.

### التفعيل

في Vercel:

```env
MADAR_TRIGGER_ENABLED=true
TRIGGER_SECRET_KEY=tr_prod_...
TRIGGER_API_URL=https://api.trigger.dev
MADAR_TRIGGER_INTEGRATION_TASK_ID=madar-integration-worker
MADAR_TRIGGER_ORBY_TASK_ID=madar-orby-worker
```

في مشروع Trigger.dev المعزول:

```env
TRIGGER_PROJECT_REF=proj_...
MADAR_BASE_URL=https://www.orbitmadar.com
MADAR_INTEGRATION_WORKER_SECRET=...
MADAR_ORBY_WORKER_SECRET=...
```

النشر:

```bash
cd infra/trigger-runtime
npm install
npm run deploy
```

## 2. Langfuse — رصد أوربي

### ما يتم إرساله

- زمن تنفيذ الطلب.
- المزود والنموذج المستخدمان.
- وضع أوربي ومصدر الرد: AI أو fallback.
- معرف المؤسسة والمستخدم والمحادثة.
- تصنيف النية والقطاع والاستراتيجية.
- نجاح الطلب أو رمز الخطأ عند إضافته لاحقًا.

### الخصوصية

النص المدخل والناتج **لا يُرسل افتراضيًا**. تفعيله يحتاج قرارًا صريحًا:

```env
MADAR_OBSERVABILITY_CAPTURE_CONTENT=true
```

يجب إبقاء هذا الخيار `false` في الإنتاج حتى اعتماد سياسة احتفاظ وإخفاء معلومات حساسة وموافقة المستخدم عند الحاجة.

### التفعيل

```env
MADAR_LANGFUSE_ENABLED=true
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=https://cloud.langfuse.com
MADAR_OBSERVABILITY_CAPTURE_CONTENT=false
```

يرسل مَدار OTLP/HTTP JSON إلى `/api/public/otel/v1/traces` مع `x-langfuse-ingestion-version: 4`. لا توجد حزمة Langfuse داخل تطبيق Next.js، لذلك لا يوجد تعارض مع React أو Next أو OpenTelemetry أخرى قد تُضاف لاحقًا.

## 3. OpenMeter — نسخة قياس الاستخدام

### الأحداث الحالية

- `orby.request`
  - `requests`
  - `input_characters`
  - `latency_ms`
  - المزود والنموذج والوضع
- `orby.agent.run.submitted`
  - `runs`
- `integration.records.received`
  - `records`
  - `batches`
  - نوع القناة وstream key

الأحداث بصيغة CloudEvents 1.0 ومعرفات ثابتة حيث يلزم منع التكرار.

### حدود الصلاحية

OpenMeter في هذه المرحلة مرآة للقياس والتحليل فقط. لا يجوز استخدام نتيجة OpenMeter مباشرة لفتح مساحة أو منع عميل قبل بناء reconciliation واختبارات تطابق مع سجل مَدار الداخلي.

### التفعيل

```env
MADAR_OPENMETER_ENABLED=true
OPENMETER_BASE_URL=https://your-openmeter-instance.example
OPENMETER_API_KEY=...
OPENMETER_EVENTS_PATH=/api/v1/events
```

يجب إنشاء Meters في OpenMeter وفق الأحداث السابقة، مثل جمع `$.requests` لأحداث `orby.request` وجمع `$.records` لأحداث `integration.records.received`.

## مسارات الدمج الحالية

```text
ORBY chat response
  └─ after(response)
      ├─ Langfuse OTLP observation
      └─ OpenMeter usage event

ORBY agent run submitted
  └─ after(response)
      ├─ Trigger.dev durable worker
      └─ OpenMeter usage event

MADAR Connect inbound batch queued
  └─ after(response)
      ├─ Trigger.dev durable worker
      └─ OpenMeter usage event
```

## خطة الإطلاق الآمن

1. نشر الكود مع جميع الأعلام `false` والتأكد من عدم تغير السلوك.
2. تشغيل Langfuse وحده في Preview دون التقاط المحتوى ومراجعة traces.
3. تشغيل OpenMeter في Preview ومقارنة العدادات يوميًا مع Supabase.
4. نشر Trigger Runtime في بيئة Development ثم Staging.
5. تفعيل Trigger.dev لمؤسسة تجريبية وتشغيل ضغط وفشل متعمد.
6. تفعيل الإنتاج تدريجيًا مع إبقاء Cron الحالي كمسار احتياطي.
7. عدم جعل OpenMeter مصدر enforcement قبل اجتياز reconciliation كامل.

## الرجوع الفوري

لا يحتاج الرجوع حذف كود أو migration. يكفي:

```env
MADAR_TRIGGER_ENABLED=false
MADAR_LANGFUSE_ENABLED=false
MADAR_OPENMETER_ENABLED=false
```

وتعود المنصة فورًا إلى العمال والسجلات الداخلية وحدها.
