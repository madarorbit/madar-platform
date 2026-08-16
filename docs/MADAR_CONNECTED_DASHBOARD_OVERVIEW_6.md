# MADAR Connected Business Dashboard & Overview — Phase 6.0

## الهدف

تحويل Connected Business Overview إلى **Decision Overview** تجيب عن أربعة أسئلة فقط:

1. هل المصادر المتصلة سليمة؟
2. هل البيانات الحالية قابلة للثقة؟
3. ما الذي يحتاج تدخلًا الآن؟
4. أين يذهب المستخدم للفحص أو الإصلاح؟

Connected ليست Retail ببيانات خارجية، ولذلك لا تعرض هذه المرحلة Revenue أو Profit أو Orders أو أي Business KPI غير قائم على مصدر Connected صريح وموثوق.

## Information hierarchy

`Header → Critical Exceptions → Data / Connection Readiness → Primary Trust Indicators → Sources Needing Attention → Connected Sources Summary → Drill-downs → Quick Actions`

لا يوجد Global Date Range لأن المقاييس المعتمدة Current State / latest-state بطبيعتها.

## Connected domain فوق Phase 4

الطبقة الجديدة:

- `src/lib/connected/dashboard/domain.ts`
- `src/lib/connected/dashboard/server.ts`
- `components/connected/ConnectedDecisionOverview.tsx`

تستخدم `normalizeMetricResult()` وMetric Registry الخاصة بـPhase 4، ولا تنشئ Metric contract موازيًا.

المقاييس المعتمدة كلها `aggregation: snapshot`:

- `connected.ready_sources`
- `connected.total_sources`
- `connected.open_issues`
- `connected.sources_needing_action`
- `connected.seconds_since_last_success`
- `connected.source_freshness_seconds`
- `connected.source_open_issues`

النتائج تحمل Phase 4 semantics: availability / coverage / freshness / provenance / dataAsOf / calculatedAt / definitionVersion. Missing لا يتحول إلى Zero.

الفترة الموجودة داخل `NormalizedMetricResult.period` هي envelope تقني Current-state في UTC لتلبية عقد Phase 4، وليست Global Date Filter ولا تغيّر المعنى التجاري للمؤشر.

## Readiness

حالات الجاهزية التجارية:

- `ready` → جاهز
- `attention` → يحتاج متابعة
- `repair` → يحتاج إصلاحًا
- `incomplete` → غير مكتمل
- `unknown` → غير معروف
- `setup` → إعداد أولي

ويوجد Source state إضافي `paused` = متوقف مؤقتًا.

القواعد الأساسية:

- `connection.status = error/disconnected` → Repair.
- أحدث Health = `unhealthy` → Repair حتى لو كان connection.status = active.
- incident مفتوح critical/error → Repair.
- Health = `degraded` أو warning مفتوح أو آخر Sync = failed → Attention.
- غياب Health → Incomplete/Unknown، وليس Healthy.
- `paused` وحدها ليست Critical ولا Attention.
- draft/verifying → Setup.
- active + latest Health healthy فقط يمكن أن تصبح Ready، مع مراعاة بقية حقائق الثقة.

لا يوجد Health Score رقمي عام، ولا تستنتج دلالة تجارية من quality_score أو freshness_seconds بلا policy موثقة.

## Latest Health وlimited-query ambiguity

التنفيذ القديم كان يجلب Health عامة بـ`limit=50` ثم يختار أول سجل لكل اتصال، وهو لا يضمن latest-per-connection إذا زاد عدد snapshots أو المصادر. كما كان يستخدم أطوال arrays محدودة كسياق شبه إجمالي.

لذلك أضيفت RPC جراحية واحدة read-only:

`public.connected_dashboard_facts(target_organization uuid)`

Migration:

`supabase/migrations/20260816224500_connected_dashboard_facts.sql`

خصائصها:

- `SECURITY INVOKER`؛ RLS الحالية تبقى Authorization boundary.
- أحدث Health لكل اتصال عبر correlated query مرتبة `captured_at DESC, id DESC LIMIT 1`.
- أحدث Sync لكل اتصال عبر `started_at DESC, id DESC LIMIT 1`.
- exact open incident counts عبر `count(*)` على status غير resolved.
- flags دقيقة لوجود critical/error/warning incident لكل مصدر.
- summary exact لإجمالي الاتصالات وآخر نجاح.

هذه الإضافة لا تعيد تصميم Integration schema ولا تغيّر الجداول أو عقود الكتابة.

## Records

لا تستخدم `integration_udm_records` المحدودة كإجمالي بيانات.

Server boundary تستخدم `LIMIT 1` فقط كـexistence/latest probe لمعرفة هل وصلت أي بيانات UDM؛ لا يوجد UI يعرض `records.length` كإجمالي.

إذا فشل records probe تصبح الصفحة Partial ولا تقول "لا توجد بيانات" على أنها حقيقة.

## Freshness

- `captured_at` هو `dataAsOf` لأحدث Health snapshot عند استخدام freshness المبلّغة.
- `freshness_seconds` يمكن عرضه كسياق رقمي محايد، لكن لا يصنف stale/good بلا policy موثقة.
- `last_success_at` يدعم "منذ آخر مزامنة ناجحة" دون اختراع threshold تحذير.
- وقت تنفيذ الصفحة هو `calculatedAt` فقط، وليس دليل Business freshness.

## UI

الصفحة تستخدم Dashboard Design System المشتركة:

- `DashboardCriticalException`
- `DashboardStatusBlock`
- `DashboardMetricCard`
- `DashboardAlertBlock`
- `DashboardDataState`
- `DataTrustIndicator`
- `DashboardDrillDownLink`

لا يوجد Chart في Connected Overview لأن المرحلة الحالية لا تملك سؤالًا زمنيًا موثوقًا يحتاج Visualization. لا يوجد direct Recharts import.

المصادر مرتبة بحيث تظهر Repair ثم Attention ثم Incomplete/Unknown قبل المصادر الجاهزة.

## Drill-downs

- `/workspace/connect` → التحقيق، الاختبار، المزامنة والإصلاح.
- `/workspace/data` → فحص البيانات الواصلة.

لم يتم وضع `/workspace/analytics` كـPrimary Connected drill-down لأن صفحة Analytics الحالية لم تُثبت بعد كمستهلك موثوق لـConnected UDM. هذا **Legacy gap موثق** وليس جزءًا من Phase 6.

## Scope

لم تتغير Retail Dashboard أو Native Dashboard أو Admin/Founder dashboards أو ORBY architecture أو Analytics architecture العامة.

Phase 7 لم تبدأ.
