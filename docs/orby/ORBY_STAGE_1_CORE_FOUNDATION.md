# ORBY Stage 1 — Core Foundation

مرجع التنفيذ: **ORBY Initial Architecture & Build Roadmap**  
العلاقة: مرجع فرعي تابع لـ **MADAR Integration Master Roadmap**، وليس مشروعًا مستقلًا عن مَدار.

## حالة التنفيذ

تم بناء المرحلة الأولى بصورة إضافية فوق محرك الربط والمراحل الأربع المنفذة سابقًا. لم تُحذف أو تُستبدل أي طبقة من طبقات التكامل، ولم تُربط الواجهات الحالية مباشرة بأي مزود ذكاء اصطناعي.

النواة **غير مفعلة افتراضيًا**. لا يتغير سلوك الإنتاج حتى تُضبط إعدادات مساحة العمل، وتُسجل النماذج المسموح بها، وتُضاف مفاتيح المزودات في متغيرات البيئة على الخادم.

## ما تم بناؤه

### 1. ORBY Kernel

- دورة طلب موحدة: التحقق، الجلسة، السياق، تجميع التعليمات، التوجيه، التطبيع، الحفظ، الأحداث.
- تنفيذ نصي كامل وبث تدريجي.
- لا يعرف النواة أسماء OpenAI أو Gemini أو Anthropic أو أي نموذج بعينه.
- لا تتصل النواة بقاعدة البيانات مباشرة.

### 2. Provider Layer

تم بناء واجهة موحدة تشمل: `generate` و`stream` و`embeddings` و`moderation` و`models` و`health`.

وتم توفير المحولات التالية:

- OpenAI-compatible provider
- Anthropic provider
- Gemini provider
- Local OpenAI-compatible provider
- Mock provider للاختبارات

أي مزود جديد يُضاف عبر `OrbyProviderRegistry` دون تعديل النواة.

### 3. Model Registry وRouting Engine

- فصل معرّف مَدار الداخلي للنموذج عن اسم النموذج لدى المزود.
- ترتيب بالأولوية، قوائم سماح، قدرات مطلوبة، وحد تكلفة اختياري.
- Retry متدرج وFallback بين المزودات والنماذج.
- تسجيل كل محاولة وتبديل مزود عبر Event Bus.
- لا يوجد نموذج ثابت داخل النواة أو واجهة المستخدم.

### 4. Prompt Compiler وContext Engine

- نقطة واحدة فقط لبناء التعليمات النهائية.
- مصادر سياق قابلة للتسجيل، مرتبة بالأولوية، وتعمل عبر عقود مستقلة.
- عزل محتوى السياق داخل حدود واضحة واعتباره بيانات مرجعية لا تعليمات.
- تعطيل محاولات إغلاق حدود السياق بإفلات العلامات.
- حد مركزي لحجم السياق، مع عدم تمرير البيانات الحساسة إلى السجلات.

### 5. التوافق مع محرك ربط مَدار

- محول `MadarIntegrationContextSource` يستهلك لقطة موحدة من طبقة التكامل دون استدعاء الموصلات أو قاعدة البيانات من Kernel.
- يحتفظ بإصدار UDM، وقت التوليد، مؤشرات الجودة، وبيانات Lineage.
- لا يعيد بناء محرك الربط، ولا يكرر وظائف المزامنة أو إزالة التكرار أو مراقبة الجودة.

### 6. Session Engine

- عقود مستقلة للتخزين.
- تخزين ذاكرة مؤقتة للاختبارات والتطوير.
- محول Supabase للإنتاج.
- تحقق صريح من `organizationId` و`userId` عند استئناف أي جلسة.
- حالات جلسة: active، closed، expired.
- سجل رسائل منفصل مع RLS.

### 7. Configuration وCapabilities

- إعدادات عامة وإعدادات خاصة بكل مؤسسة.
- تعطيل افتراضي للنواة.
- سجل قدرات مركزي.
- قدرات المرحلة الثانية والثالثة (`tools` و`long-term-memory`) مسجلة ولكن معطلة، لمنع تسرب منطق المراحل اللاحقة إلى النواة.

### 8. Security وObservability

- مفاتيح المزودات من متغيرات البيئة فقط.
- لا توجد أعمدة لتخزين مفاتيح المزودات في جداول ORBY.
- Redacting Logger يخفي المفاتيح والرموز وكلمات المرور والترويسات الحساسة.
- Event Bus للأحداث التشغيلية.
- Health Monitor موحد.
- أخطاء داخلية موحدة وأكواد مستقرة لا تعتمد على صياغة المزود.

## ملفات التنفيذ

```text
src/lib/orby/
├── core/contracts.ts
├── core/errors.ts
├── core/runtime.ts
├── providers/
├── adapters/integration.ts
├── adapters/supabase.ts
├── kernel.ts
├── index.ts
└── server.ts

scripts/run-orby-foundation-smoke.ts
tests/orby-core-foundation.test.mjs
supabase/migrations/20260728001000_orby_core_foundation.sql
```

## التركيب على الخادم

```ts
import {createServerOrbyFoundation} from '@/src/lib/orby/server';

const orby = await createServerOrbyFoundation();
const response = await orby.kernel.execute({
  identity: {organizationId, userId, workspaceId},
  message: userMessage,
});
```

لن يعمل الطلب إلا عند تحقق الشروط الثلاثة:

1. إعداد مساحة العمل يحتوي على `enabled: true`.
2. يوجد نموذج مفعل في `orby_model_registry` ومربوط بمزود مهيأ.
3. مفتاح المزود موجود في بيئة الخادم.

## متغيرات البيئة المدعومة

```text
ORBY_OPENAI_API_KEY=
ORBY_OPENAI_BASE_URL=
ORBY_OPENAI_PROVIDER_ID=
ORBY_ANTHROPIC_API_KEY=
ORBY_ANTHROPIC_BASE_URL=
ORBY_GEMINI_API_KEY=
ORBY_GEMINI_BASE_URL=
ORBY_LOCAL_LLM_BASE_URL=
ORBY_LOCAL_LLM_API_KEY=
ORBY_LOCAL_LLM_PROVIDER_ID=
```

لا تُستخدم المتغيرات العامة `NEXT_PUBLIC_*` لمفاتيح ORBY.

## قاعدة البيانات

المهاجرة تضيف بصورة مستقلة:

- `orby_runtime_config`
- `orby_sessions`
- `orby_session_messages`
- `orby_model_registry`
- `orby_provider_health`

وتفعّل RLS مع القواعد التالية:

- جلسات ورسائل المستخدم خاصة به وحده.
- إعدادات المؤسسة قابلة للقراءة لأعضائها والإدارة للمالك أو المدير.
- سجل النماذج وصحة المزودات للمديرين فقط.
- لا يتم تخزين أسرار المزودات داخل هذه الجداول.

## اختبارات القبول

ينفذ الأمر:

```bash
npm run orby:smoke
```

الاختبارات تغطي استقلال النواة عن المزود، Retry وFallback، عزل الجلسات، حماية السياق، البث، عزل الإعدادات، موانع المراحل، صحة المزودات، إخفاء الأسرار، تكوين الخادم، ووجود RLS.

## الموانع المطبقة

- لا استدعاء لمزود من صفحات الواجهة.
- لا Prompt مبني داخل الواجهة.
- لا نموذج ثابت داخل النواة.
- لا اتصال مباشر بين Kernel وSupabase.
- لا مفاتيح داخل الكود أو قاعدة البيانات.
- لا أدوات تنفيذ أو ذاكرة طويلة المدى داخل المرحلة الأولى.
- لا تفعيل تلقائي على حسابات العملاء.
