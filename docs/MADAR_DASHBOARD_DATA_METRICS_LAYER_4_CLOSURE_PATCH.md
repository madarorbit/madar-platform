# MADAR Dashboard Data & Metrics Layer — Phase 4.0 Closure Patch

هذا المستند يكمل وثيقة Phase 4.0 الأساسية ولا يغير حدود المرحلة أو يبدأ أي Dashboard متخصص.

## Self-describing comparison

`NormalizedMetricResult.comparison` أصبحت self-describing comparison كاملة. عند وجود مقارنة مدعومة تحمل النتيجة:

- `kind`: `previous | reference | benchmark`
- `period`: فترة المرجع المطَبَّعة
- `referenceValue`
- `absoluteDelta`
- `percentageDelta`
- `percentageDeltaReason`

بذلك لا تحتاج طبقة العرض إلى إعادة استنتاج نوع المقارنة أو فترتها من الطلب الأصلي. وعند فشل Metric مفردة، يبقى سياق المقارنة المطلوب محفوظًا إذا كان تعريف Metric يدعم المقارنة، بينما تظل القيم الحسابية Missing بدل اختراع أرقام.

## Cache comparison identity

هوية Metrics cache أصبحت تشمل comparison kind + period معًا. وجود نفس فترة المرجع لا يجعل `previous` و`benchmark` و`reference` طلبًا واحدًا.

تم رفع النسخة الداخلية لهوية المفتاح إلى `v: 2` لأن semantics المفتاح تغيرت.

## Typed filter encoding

canonical filter encoding تحفظ نوع كل scalar صراحةً:

- string
- number
- boolean

لذلك `1` لا تتصادم مع `"1"`، و`true` لا تتصادم مع `"true"`.

Arrays تبقى order-independent داخل قيمة الفلتر: يتم تحويل عناصرها إلى encoding نوعية أولًا ثم ترتيبها canonical ordering. لا يتم تحويل القيم إلى strings كوسيلة للتوحيد. القيم العددية غير المحدودة مثل `NaN` أو `Infinity` مرفوضة.

## Metric batch result order

ترتيب `MetricBatchResult.results` هو request order نفسه في `MetricQueryRequest.metricIds`.

لأن ترتيب النتائج جزء من العقد، فإن Cache identity تحفظ ترتيب Metric definitions المقابل للطلب ولا ترتبه أبجديًا. لذلك `[A, B]` و`[B, A]` لا تشتركان في المفتاح نفسه عندما تكون نتيجة الـbatch array مختلفة الترتيب.

## Scope

هذا Closure Patch لا يضيف KPIs ولا Service adapters فعلية ولا Queries جديدة، ولا يغير Retail أو Connected Business أو Native Business أو APIs أو Supabase أو Data sources. وهو يغلق Phase 4.0 فقط قبل بدء المراحل التخصصية لاحقًا.
