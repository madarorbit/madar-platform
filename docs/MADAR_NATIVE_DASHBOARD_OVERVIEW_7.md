# MADAR Native Business Dashboard & Overview — Phase 7.0

## الهدف

تحويل Native `/workspace` من Legacy summary presentation-ready إلى **Sector-aware + Module-aware Decision Overview** واحدة هندسيًا، مع Definitions وAttention semantics مستقلة لـCommerce وFood Service وHospitality.

الصفحة تجيب عن:

1. كيف يسير النشاط الآن؟
2. ما أهم مؤشرات القطاع والوحدات المفعلة؟
3. ما الذي يحتاج تدخلًا؟
4. أين يذهب المستخدم للتشغيل أو التحقيق؟

`Overview = Monitor & Decide`؛ التشغيل والتحقيق يبقيان في الوحدات المتخصصة، و`/workspace/activity` يبقى سجلًا للتحقيق فقط ولا تُعرض Recent Activity feed داخل Overview.

## Architecture

```text
Authorized Native Workspace
→ Vertical + enabledModules
→ Native metric registry / domain profile
→ read-only Native facts adapter
→ Phase 4 normalizeMetricResult()
→ Phase 2 dashboard UI
```

الطبقة الجديدة:

- `src/lib/native/dashboard/domain.ts`
- `src/lib/native/dashboard/server.ts`
- `components/native/NativeDecisionOverview.tsx`
- `supabase/migrations/20260816235000_native_dashboard_facts.sql`

`sectorMetrics()` بقيت Legacy للـconsumers الآخرين فقط ولا تغذي Native Overview الجديدة. لا تمر business metrics كسلاسل presentation-ready، ولا تستخدم `businessMoney()` المتسامحة مع Missing.

## Setup + enabledModules admission

`enabledModules` هي Admission Gate فعلية. المؤشر أو Alert أو Quick Action التابعة لوحدة غير مفعلة لا تدخل الـOverview.

Core operating module:

- Commerce → `sales`
- Food Service → `restaurant`
- Hospitality → `hotel`

إذا `setup_status !== ready` أو غابت Core module، تعرض الصفحة Setup state وCTA لاستكمال الإعداد بدل Dashboard ناقصة.

`module=unavailable` يبقى behavior قائمًا، لكن برسالة من Dashboard shared states.

## Time semantics

لا يوجد Global Date Range ولا previous-period comparison ولا Trend في Phase 7.

السياقات الظاهرة صراحة:

- `تراكمي`: من إنشاء المنظمة إلى وقت الحساب، بــUTC technical envelope.
- `حاليًا`: snapshot تقني وقت القراءة، وليس period KPI.
- `اليوم`: مستخدمة فقط لإيراد الغرف عندما يوجد timezone واحد صالح يمكن توحيده بأمان.

لا يُستخدم وقت تنفيذ الصفحة كدليل Business freshness. في غياب freshness policy تبقى Phase 4 freshness `unknown` بدل ادعاء Fresh/Stale.

## Commerce profile

### Primary

- قيمة المبيعات المكتملة تراكميًا، فقط إذا كانت العملة قابلة للعرض بأمان.
- عدد عمليات البيع المكتملة تراكميًا.

### Current state

- قيمة المخزون الحالية عند تفعيل Inventory، من `stock_quantity * cost`.

### Supporting

- COGS لعمليات البيع المكتملة.
- المرتجعات المرحلة POSTED.
- المصروفات.

كل مجموعة مالية تقرأ حسب عملتها الأصلية. إذا ظهرت أكثر من عملة، لا تجمع القيم ولا تنفذ FX؛ تعرض الصفحة Trust/Context notice مع drill-down بدل رقم مالي مزيف.

لا يوجد Net Profit KPI في Phase 7 لأن Legacy aggregate لا تقدم تعريفًا آمنًا متعدد العملات يمكن اعتماده تلقائيًا.

### Attention

عند تفعيل Inventory:

- `stock_quantity = 0` → Critical operational exception.
- `stock_quantity > 0 && stock_quantity <= low_stock_threshold` → Attention.

العتبة هي Domain threshold المخزنة للصنف، وليست threshold عامة جديدة.

## Food Service profile

لا تستخدم Overview `restaurant_profit_report`.

### Financial/business facts

تُحسب من `restaurant_orders` فقط، وتُقبل الحالات النهائية:

- `SERVED`
- `COMPLETED`

`IN_KITCHEN` و`READY` و`CONFIRMED` لا تدخل completed orders ولا الإيراد أو الربح.

Primary:

- الطلبات المخدومة/المكتملة.
- إيرادها.
- Gross Profit = total - ingredient_cost لنفس الطلبات.

Supporting:

- ingredient cost.
- average kitchen ticket duration عندما توجد `ready_at` صحيحة.

### Kitchen

Kitchen facts تُحسب مستقلًا من `restaurant_kitchen_tickets`، لذلك لا يوجد JOIN يكرر إيراد/عدد الطلبات.

- `NEW/PREPARING/READY` → Current kitchen workload فقط.
- HIGH/URGENT ضمن العمل النشط → Attention.
- الحالات التشغيلية العادية ليست Alerts.

عند تفعيل Inventory، المنتجات المستخدمة فعلًا في active recipes فقط تدخل ingredient stock attention:

- stock-out → Critical.
- low-stock حسب threshold الخاصة بالمنتج → Attention.

## Hospitality profile

لا تستخدم Overview `hotel_daily_report[0]` ولا تفترض Property واحدة.

### Primary

- إجمالي الغرف عبر جميع Properties النشطة.
- الغرف المشغولة عبر جميع Properties النشطة.
- الإشغال = `sum(occupied_rooms) / sum(total_rooms)`؛ لا متوسط لنسب Properties.
- إيراد الغرف اليوم فقط عندما يكون السياق الزمني والعملة قابلين للتوحيد بأمان.

### Currency + timezone safety

Room charges تُجمع داخل DB حسب عملة Folio، ولا توجد implicit FX.

- أكثر من Currency → لا aggregate مالية واحدة؛ تعرض notice.
- Currency واحدة → تعرض بنفس عملتها الفعلية، حتى لو اختلفت عن workspace currency.
- أكثر من Property timezone → لا تفرض الصفحة Global Today واحدًا؛ تعرض notice بدل رقم اليوم.
- timezone غير صالح → revenue today غير متاحة حتى التصحيح.

### Current operating state

- IN_HOUSE stays.
- housekeeping workload غير المكتمل.
- open maintenance workload.

### Attention

- EMERGENCY maintenance → Critical.
- HIGH maintenance → Attention.
- BLOCKED housekeeping → Attention.
- PENDING/ASSIGNED/IN_PROGRESS/INSPECTION والتنقلات العادية ليست Alerts.

## Shared Tasks

إذا كانت `tasks` مفعلة:

- task مفتوحة تجاوزت `due_at` → Attention.
- high/urgent overdue ترفع أولوية النص والترتيب لكنها لا تصبح Critical تلقائيًا.

القائمة الطويلة لا تُعرض؛ RPC تعيد exact counts وعينة صغيرة فقط.

## Data boundary / DB change

أضيفت RPCs read-only جراحية:

- `public.native_dashboard_facts(uuid, text)`
- `public.native_dashboard_task_facts(uuid)`

السبب: تصحيح Restaurant semantics دون join duplication، Hotel organization-level aggregation مع currency/timezone safety، exact operational attention counts، وفصل Shared Tasks لتمكين partial failure isolation.

كلاهما:

- `STABLE`
- `SECURITY INVOKER`
- يعمل تحت RLS الحالية.
- `anon` و`PUBLIC` بلا EXECUTE.
- `authenticated` و`service_role` فقط لديهما EXECUTE.

لا توجد جداول جديدة ولا write behavior ولا Warehouse أو materialized metrics platform.

## Partial / Missing / Zero

Server adapter يقرأ RPC output كـ`unknown` ويطبّق validation قبل إنشاء typed facts.

- فشل vertical facts → Partial، بدون synthesized zeros.
- فشل task facts عند تفعيل Tasks → Partial مستقل، ولا يسقط باقي القطاع.
- Metric missing تبقى `value=null`/availability مناسبة عبر Phase 4.
- true exact aggregate zero يبقى Zero حقيقيًا.
- Occupancy مع zero denominator تبقى Missing وليست `0%`.

## UI

تستخدم Shared Dashboard layer فقط، ومنها:

- `DashboardMetricCard`
- `DashboardCriticalException`
- `DashboardAlertBlock`
- `DashboardStatusBlock`
- `DashboardDataState`
- `DashboardEmptyState`
- `DataTrustIndicator`
- `DashboardDrillDownLink`

لا يوجد direct Recharts import، ولا Chart لأن Phase 7 لا تملك سؤالًا زمنيًا موثوقًا يحتاج رسمًا.

## Scope

لم تُفتح Retail أو Connected من جديد، ولم يبدأ Admin Dashboard أو Founder Command Center أو QA عام. Phase 7 تغلق Native Dashboard فقط.
