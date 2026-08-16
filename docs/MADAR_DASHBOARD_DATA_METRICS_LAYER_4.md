# MADAR Dashboard Data & Metrics Layer — Phase 4.0

> **المهمة:** MADAR Dashboards & Overview System  
> **المرحلة:** 4.0 — Dashboard Data & Metrics Layer  
> **الحالة:** Shared infrastructure only  
> **المراجع الملزمة:** Phase 1 Information Architecture، Phase 2 Dashboard Design System، Phase 3 Data Visualization System  
> **الحد:** لا KPIs خاصة بـRetail/Connected/Native، ولا Dashboard خدمة، ولا Data Warehouse أو BI Engine.

---

## 1. المبدأ الحاكم

**مَدار يجب أن يعرف معنى الرقم قبل أن يرسم الرقم.**

المسار المعتمد:

```text
Authorized Workspace / Service Context
                ↓
        Metric Definition
                ↓
          Query Context
                ↓
       Service Data Adapter
                ↓
 Shared Validation / Calculation
                ↓
    Normalized Metric Result
                ↓
 Dashboard Design + Visualization
```

والفصل الملزم:

**Metric Definition ≠ Metric Calculation ≠ Metric Presentation**

Phase 4 لا تجعل React أو Recharts يحسبان Business KPIs، ولا ترسل raw business rows إلى المتصفح كي يستنتج منها KPI أساسية.

---

## 2. ما تم فحصه قبل التنفيذ

تمت مراجعة الواقع الحالي بدل افتراض Architecture نظرية، وخصوصًا:

- `src/lib/business.ts`
- `src/lib/analytics.ts`
- `app/workspace/analytics/page.tsx`
- `src/lib/services/experience.ts`
- `src/lib/retail/server/auth/context.ts`
- `src/lib/retail/server/analytics/queries.ts`
- `src/lib/retail/types.ts`
- `src/lib/v2/account.ts`
- `src/lib/platform-integrations/openfga.ts`
- `.github/workflows/ci.yml`
- Phase 1/2/3 dashboard layers الموجودة.

### الواقع الحالي المختصر

1. Business workspace الأساسي يحسم العضوية والاشتراك ثم يجري `authorizeOrganizationAction(... relation: can_view)` Server-side قبل إرجاع workspace صالح.
2. الـworkspace يحمل حاليًا `currency` و`operating_mode` و`source_of_truth`، وهي معلومات مناسبة لكي يرث منها Adapter المستقبل سياقًا موثوقًا.
3. Retail لديه Workspace context مستقل، لكنه مربوط بالـPlatform organization المصرح بها Server-side، ثم يتحقق من أن `retail_workspace.platform_organization_id` يطابق Principal الحالي قبل RPCs.
4. `src/lib/analytics.ts` هو Server-only ويستدعي RPC `business_analytics`، لكنه يعيد Contract قديمة فيها KPIs service/domain-specific و`generated_at`، ويستخدم date strings بنهاية شاملة.
5. `AnalyticsSnapshot` في Retail يحتوي `currency`, `timezone`, `as_of`, period وcomparison أفضل من بعض الـlegacy business analytics، لكنه يبقى Contract خاصة بـRetail ولا يتحول إلى Shared KPI catalog.
6. Connected Experience لديها مصادر Freshness حقيقية مثل `last_success_at`, `source_updated_at`, `updated_at`, `captured_at`, و`freshness_seconds`، لكن Phase 4 لا تضع thresholds أو KPIs خاصة بها.
7. partial failure pattern موجود أصلًا في `services/experience.ts` عبر `ServiceSection<T> { data, failed }`، لذلك Phase 4 تعمم القدرة نفسها على مستوى metric دون إعادة كتابة Connected.
8. الـCaching الحالي في المسارات المفحوصة يعتمد أساسًا على React `cache()` داخل server request lifecycle؛ لم يوجد Shared persistent metrics cache يستحق إنشاء Infrastructure جديدة له.

---

## 3. تعارضات Legacy التي لم تُكسر في Phase 4

### 3.1 Missing يتحول إلى Zero في formatting قديم

يوجد حاليًا:

- `analyticsMoney(value, currency)` باستخدام `Number(value || 0)`.
- `businessMoney(value, currency)` باستخدام `Number(value || 0)`.
- أماكن داخل Analytics القديمة تستخدم `data.foo || 0`.

**Risk:** القيمة الغائبة قد تظهر كصفر Business حقيقي.

**Phase 4 treatment:** العقود الجديدة لا تستخدم هذه helpers ولا تسمح بتحويل missing إلى zero.

**Deferred:** تصحيح consumers القديمة يتم عندما تنتقل Dashboard/Analytics المعنية إلى الطبقة الجديدة؛ تغيير formatter عامة الآن قد يغير UI خارج النطاق.

### 3.2 Legacy period semantics

`business_analytics` يستخدم `report_start/report_end` كتاريخين calendar-inclusive، بينما Shared contract الجديدة تعتمد داخليًا:

**[fromInclusive, toExclusive)**

**Phase 4 treatment:** لا يتم كسر RPC القديمة. Adapter الخدمة المستقبلية مسؤولة عن ترجمة الحدود المشتركة إلى Contract الـRPC القديمة بصورة صريحة إذا استمر استخدامها.

### 3.3 `generated_at` ليس `dataAsOf`

الـBusiness Analytics القديم يوفر `generated_at`، لكنه لا يثبت أن أحدث Source data وصلت في تلك اللحظة.

**Phase 4 treatment:** `calculatedAt` و`dataAsOf` منفصلتان. إذا لم يوفر المصدر `dataAsOf` حقيقية، Freshness = `unknown`.

### 3.4 Comparison semantics القديمة

صفحة Analytics الحالية تستقبل change percentages محسوبة من RPC وتلونها بحسب sign.

**Phase 4 treatment:** لا تعاد كتابة الصفحة في هذه المرحلة. الطبقة الجديدة تحسب mathematical delta فقط ولا تنتج favorable/unfavorable من sign.

---

## 4. الملفات المشتركة الجديدة

```text
src/lib/dashboard/metrics/
├── contracts.ts
├── core.ts
├── server.ts
└── index.ts
```

### `contracts.ts`

Serializable/service-neutral contracts فقط.

### `core.ts`

Internal deterministic helpers للتحقق والحساب والتطبيع. لا fetch، لا Supabase، لا RPC، لا React، ولا service KPIs.

### `server.ts`

`server-only` entry لتنفيذ metrics وربطها بـAuthorized Metric Scope وService Adapter وعزل failures.

### `index.ts`

يعرض الـdata contracts فقط. Server APIs لا تمر عبر barrel عامة حتى يصعب سحب منطق التنفيذ إلى Client bundle بالخطأ.

---

## 5. Metric Definition Contract

التعريف المشترك يتضمن:

- `id`: identifier تقني ثابت ومحايد.
- `version`: definition version خفيفة.
- `valueKind`: `number | integer`.
- `unit`.
- `aggregation`.
- `comparison`: هل المقارنة مدعومة أم لا.
- `sourceCategory?`.
- `semanticIntent?` كسياق تقني اختياري، وليس UI label.

لا يوجد label إنجليزي مفروض، ولا UI copy داخل التعريف.

### Registry

`createMetricRegistry(definitions)`:

- يتحقق من identifiers.
- يتحقق من version.
- يرفض duplicate IDs.
- يتحقق من Currency definition.
- لا يقبل formulas أو SQL أو expression strings.

لا توجد Definitions افتراضية في Shared layer. Retail وConnected وNative تسجل Definitions الخاصة بها في مراحلها.

---

## 6. Unit & Money Contract

`MetricUnitDefinition` تدعم:

- number
- count
- percentage
- ratio
- duration
- money
- custom

Money definition تكون إما:

```text
currency: workspace
```

أو Currency صريحة في Definition.

النتيجة المطَبَّعة لا تحمل `workspace` كعملة؛ يجب أن تصبح Currency code فعلية.

### No implicit FX

`assertMetricCurrency` ترفض أي Source currency تختلف عن العملة resolved للـMetric.

Phase 4 لا:

- تجمع عملات مختلفة.
- تحول Currency.
- تبحث عن exchange rate.
- تخمن effective FX date.

أي FX مستقبلية تحتاج نظامًا صريحًا خارج هذا العقد.

---

## 7. Query Request مقابل Authorized Query Context

هذه نقطة أمنية أساسية.

`MetricQueryRequest` لا يحتوي أصلًا على:

- `organizationId`
- `workspaceId`

الطلب يحمل فقط:

- metric IDs
- period
- filters
- optional comparison
- optional source context

Server-side فقط يربط الطلب بـ`AuthorizedMetricScope`.

### AuthorizedMetricScope

يحمل:

- organizationId
- workspaceId
- service
- currency
- operatingMode
- sourceOfTruth

ويملك Runtime/TypeScript brand داخل `server.ts`.

`metricScopeFromAuthorizedWorkspace()` **ليست authorization check**. عقدها يلزم أن يدخل إليها context سبق حسمه من resolver موثوق مثل Business/Retail authorization الحالي. Raw client ID ليست إثبات وصول.

هذا يمنع تصميم API تكون فيه `organizationId` القادمة من Browser هي authorization بحد ذاتها.

---

## 8. Tenant isolation

الطبقة الجديدة تثبت القواعد التالية:

1. Query context لا تنشأ دون AuthorizedMetricScope.
2. Adapter تستقبل scope الموثوقة Server-side.
3. Adapter service يجب أن تطابق `scope.service`، وإلا يفشل batch قبل الحساب.
4. Cache identity تحتوي organization + workspace + service.
5. لا Shared data fetch خارج adapter.
6. Authorization الحقيقية تبقى في MADAR resolvers / RLS / RPC guards الحالية؛ Metrics layer لا تنشئ بابًا جانبيًا لها.

Retail مثلًا يجب أن يستمر في استخدام `assertRetailWorkspaceAccess` أو context مكافئة قبل minting للـscope في مرحلته المتخصصة.

Connected/Native يجب أن يستمرا في الاعتماد على `requireBusinessWorkspace`/authorization الحالية قبل ذلك.

---

## 9. Time model

### User selection

يمكن أن تكون calendar dates مثل:

```text
2026-08-01 → 2026-08-31
```

### Internal period

تتحول إلى:

```text
fromInclusive: instant

toExclusive: instant

timezone: IANA timezone
```

`metricPeriodFromDateSelection` يحول end date الشاملة للمستخدم إلى midnight التالية في نفس timezone.

### لماذا ليست `+ 24h`؟

لأن الأيام في Timezones التي تستخدم DST قد تكون 23 أو 25 ساعة. helper يحل midnight المحلية إلى UTC عبر `Intl` بدل الاعتماد على server locale أو browser timezone.

`Asia/Aden` مدعومة صراحةً كأي IANA timezone دون hard-coding داخل كل calculation.

### Legacy RPC translation

لا تعني `[from,to)` أن كل RPC قديمة تغيرت. Adapter هو boundary الذي يترجمها عند الحاجة.

---

## 10. Comparison model

`calculateMetricComparison(current, reference)` ينتج:

- `referenceValue`
- `absoluteDelta`
- `percentageDelta`
- `percentageDeltaReason`

المقارنة لا تظهر إذا Definition تقول `comparison: none`.

### reference = 0

إذا كانت current موجودة والمرجع صفرًا:

```text
absoluteDelta = current - 0
percentageDelta = null
percentageDeltaReason = zero_reference
```

لا Infinity ولا invented +100%.

### Missing current/reference

تنتج `null` في delta المناسب مع reason صريحة.

### Mathematical direction

الطبقة لا تنتج:

- favorable
- unfavorable
- success
- danger

من sign. هذه Business semantics تأتي من الخدمة المتخصصة فقط.

---

## 11. Aggregation semantics

الـDefinition vocabulary يدعم:

- `sum`
- `count`
- `distinct_count`
- `average`
- `ratio`
- `snapshot`
- `weighted_average`

لكن لا يوجد Generic `calculate(formula)` engine.

### Helpers المقصودة

- `sumMetricValues`
- `averageMetricValues`
- `distinctMetricCount`
- `calculateMetricRatio`
- `weightedMetricAverage`
- `latestMetricSnapshot`

### قواعد السلامة

1. Missing input لا يتحول إلى zero؛ result يمكن أن يكون partial.
2. Ratio يعاد حسابه من numerator/denominator ولا يجمع ratios.
3. denominator = 0 يعطي `value=null` + reason.
4. Weighted average تتطلب weights فعلية ولا يوجد helper لـaverage-of-averages العمياء.
5. Snapshot تختار أحدث نقطة موثقة timestamp؛ لا يوجد sum للـsnapshots.
6. Negative weights مرفوضة.

هذه helpers plumbing صغيرة، وليست Formula DSL.

---

## 12. Zero ≠ Missing

في العقد الجديد:

- `0` finite value ⇒ يمكن أن تكون `available` حقيقية.
- `null | undefined` ⇒ Missing قابل للتمثيل صراحةً.
- available + missing value ⇒ invalid contract.
- missing/unavailable/error + رقم ⇒ invalid contract.

`normalizeMetricResult` يفرض هذه القواعد بدل ترك UI تستنتجها.

---

## 13. Normalized Metric Result

النتيجة المشتركة تحتوي:

```text
metricId

definitionVersion

value

unit

period

comparison

dataAsOf

calculatedAt

provenance

coverage

freshness

availability
```

UI لا تحتاج استنتاج Currency أو period أو source trust من الرقم نفسه.

---

## 14. Trust model

ثلاثة أبعاد منفصلة:

### Availability

- available
- missing
- unavailable
- error

### Coverage

- complete
- partial
- optional ratio 0..1

### Freshness

- fresh
- stale
- unknown

بالتالي الحالات المركبة ممكنة، مثل:

**available + partial + stale**

ولا تختزل إلى status واحدة.

---

## 15. `dataAsOf` مقابل `calculatedAt`

`calculatedAt` ينتج من server batch execution.

`dataAsOf` تأتي من Adapter/source فقط.

Freshness helper لا يستخدم `calculatedAt` كدليل أن المصدر Fresh.

إذا:

- لا توجد `dataAsOf` ⇒ unknown / `missing_data_as_of`.
- توجد `dataAsOf` لكن لا توجد stale policy ⇒ unknown / `missing_policy`.
- الاثنتان موجودتان ⇒ fresh/stale وفق age الفعلية.

لا يتم تحويل legacy `generated_at` تلقائيًا إلى `dataAsOf`.

---

## 16. Provenance

العقد العام يسمح بفئات تقنية عامة:

- madar_native
- external_connected
- derived
- rpc
- aggregated
- imported
- unknown

ويقبل `source` key داخلية اختيارية و`derivedFrom` IDs.

لا تُحفظ credentials أو raw URLs السرية أو payloads داخل Provenance.

Phase 4 لا تسجل Source catalog افتراضية؛ Adapter المستقبل يصرح بالمصدر الحقيقي.

---

## 17. Partial failure

`executeMetricBatch` يعالج كل Metric بصورة مستقلة افتراضيًا.

إذا فشلت واحدة:

- لا يسقط باقي الـresults.
- metric الفاشلة تعود `availability=error`.
- `value=null`.
- `coverage=partial` مع ratio=0.
- freshness=unknown.
- `partialFailure=true` للBatch.

إذا كان لخدمة لاحقًا Critical shared dependency يجعل كل النتائج غير موثوقة، فيجب أن تفشل **قبل** batch execution أو عبر Adapter policy متخصصة. Phase 4 لا تخترع Criticality لخدمات لم تُصمم بعد.

---

## 18. Service adapters

العقد:

```text
MetricServiceDataAdapter
  service
  resolveMetric({ definition, context })
```

Shared layer لا تعرف:

- Retail sales tables.
- Connected provider rules.
- Native vertical entities.

كل خدمة ستنفذ Adapter مستقلة لاحقًا، مع نفس result/trust/time/comparison contracts.

---

## 19. Caching

لم تُبنَ Cache Infrastructure جديدة.

تمت إضافة **canonical cache identity** فقط لتحديد ما يجب أن يدخل في أي cache مستقبلية:

- organizationId
- workspaceId
- service
- metric id + definition version
- period boundaries
- timezone
- normalized filters
- comparison period
- source context

هذا يمنع تصميم cache key لا تعرف Tenant أو Definition version.

`buildMetricCacheIdentity` لا يخزن شيئًا ولا يضيف Redis/Data Cache.

---

## 20. Definition versioning

`metricId` ليست وحدها هوية تاريخية للحساب.

كل Definition تحتاج `version` غير فارغة، وتدخل version ضمن cache identity والNormalized result.

لا توجد Version migration platform أو warehouse schema في Phase 4.

---

## 21. Existing Analytics compatibility

### Business Analytics

الحالة الحالية:

- Server RPC موجود ويظل كما هو.
- Currency موجودة في response/workspace.
- period calendar-inclusive.
- comparison تأتي جاهزة من RPC.
- `generated_at` موجود.
- domain KPI contract موجودة.

Phase 4 لا تعيد كتابة RPC ولا الصفحة. في مرحلة الخدمة يمكن بناء Adapter يترجم هذا output تدريجيًا إلى Shared metric results، مع تعريف `dataAsOf` فقط إذا كان المصدر يملك timestamp حقيقية.

### Retail Analytics

الحالة الحالية أفضل في بعض الجوانب:

- access check قبل RPC.
- workspace currency/timezone.
- snapshot `as_of`.
- comparison percentage nullable.

لكنها Retail-specific وتبقى كذلك حتى مرحلة Retail Dashboard.

### Connected data

توجد timestamps وpartial section failures مفيدة، لكن freshness thresholds وMetric definitions الخاصة بالاتصال ليست مسؤولية Phase 4.

---

## 22. Server boundary

`server.ts` يبدأ بـ`import "server-only"`.

Business metric execution، adapter access، tenant context، batch normalization، cache identity التي تحمل tenant IDs تبقى Server-side.

`index.ts` لا يعيد تصدير server executor أو calculation core؛ يعرض Types data contracts فقط.

---

## 23. Arabic-first boundary

Phase 4 Data layer لا تعرف presentation labels.

- IDs تقنية مستقرة.
- Error codes تقنية مستقرة.
- لا يوجد English UI copy مفروض.
- Arabic labels تبقى مسؤولية service composition وPhase 2/3 UI.
- لا تم تحويل أي copy عربية موجودة إلى الإنجليزية.

---

## 24. ما لم يُبنَ عمدًا

لا يوجد:

- Global KPI catalog.
- Revenue/Orders/Customers كـshared required KPIs.
- BI Engine.
- Formula Builder.
- expression DSL.
- user-defined metrics.
- metrics SQL language.
- global metrics table.
- metric snapshot warehouse.
- OLAP.
- materialized metrics platform.
- FX subsystem.
- persistent cache infrastructure.
- service Dashboard.
- service-specific freshness rules.
- service-specific business outcome rules.

---

## 25. Adoption contract للمراحل المتخصصة

كل Service phase القادمة يجب أن تقوم بهذا التسلسل:

1. Resolve existing authorized workspace context Server-side.
2. Convert trusted identity إلى `AuthorizedMetricScope`.
3. Register service-owned Metric Definitions.
4. Build `MetricQueryRequest` من Overview context.
5. Create server `MetricQueryContext`.
6. Adapter تجلب/calculate من Domain source الحقيقي.
7. Shared layer تطبع comparison/trust/unit/result.
8. Phase 2/3 components تعرض الـNormalized result.

ولا تبدأ أي خدمة من خطوة 3 قبل حسم الخطوة 1.

---

## 26. Phase boundaries بعد الإغلاق

Phase 4 هي آخر Shared phase.

### مؤجل إلى Retail

- ما KPIs التي تستحق Overview.
- أي Retail RPCs تصبح adapters.
- تعريف Retail periods/freshness domain policies.
- اختيار Retail outcomes.

### مؤجل إلى Connected Business

- connection/sync/quality KPIs.
- provider/source policies.
- freshness thresholds.
- critical dependency rules.

### مؤجل إلى Native Business

- vertical-specific KPIs.
- module-specific sources.
- aggregation definitions لكل Domain.

### مؤجل خارج Phase 4

- Admin/Founder dashboard metrics.
- Legacy Analytics page redesign/migration.
- FX conversion system.
- persistent metric caching إذا أثبتت الحاجة.

---

## 27. قواعد لا يجوز كسرها لاحقًا

1. Client organizationId ليست Authorization.
2. Metric Definition لا تحتوي query أو formula runtime.
3. Missing لا يتحول إلى Zero.
4. Money لا تفقد Currency.
5. لا implicit FX.
6. reference=0 لا تنتج Infinity أو invented percentage.
7. Mathematical direction لا تعني Business outcome.
8. `dataAsOf` لا تساوي `calculatedAt` تلقائيًا.
9. Freshness unknown أفضل من Fresh مختلقة.
10. Ratios لا تجمع.
11. Snapshots لا تجمع عبر الزمن.
12. Average-of-averages لا يتم بلا weighting صحيح.
13. Cache key بلا Tenant غير صالح للMetrics.
14. Metric failure لا تسقط باقي Batch بلا Critical dependency حقيقي.
15. الخدمة تملك Definitions ومصادرها؛ Shared layer تملك العقود والسلامة.

---

## 28. Phase 4 STOP condition

بعد إغلاق هذه المرحلة:

- لا يبدأ Retail تلقائيًا.
- لا يبدأ Connected تلقائيًا.
- لا يبدأ Native تلقائيًا.
- لا تختار Shared layer KPIs بدل الخدمات.
- لا تنشأ Phase عامة إضافية من تلقاء نفسها.

**Strong, explicit, trustworthy metric contracts — not a BI engine.**
