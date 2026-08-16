# MADAR Retail Dashboard & Overview — Phase 5.0

## الهدف

تحويل `/retail/workspace` من لوحة تشغيلية Legacy إلى **Decision Overview** تجيب سريعًا عن:

1. كيف أداء التجارة؟
2. ماذا تغيّر؟
3. ما الذي يحتاج انتباهًا الآن؟
4. أين ينتقل المستخدم للتصرف أو التحقيق؟

المرحلة ترث Information Architecture وDashboard Design System وData Visualization System وDashboard Data & Metrics Layer، ولا تنشئ نظامًا موازيًا.

## الفترة

الفترة الافتراضية هي **آخر 7 أيام**، مع اليوم وآخر 30 يومًا وفترة مخصصة.

الحدود الداخلية تستفيد من عقد Phase 4 الواعي بالـtimezone. أما RPC Retail الحالية فتستقبل تاريخي `date_from/date_to` شاملين وتحوّلهما داخل PostgreSQL إلى `[start_at, end_at)` وفق timezone مساحة Retail؛ لم يتم كسر عقد RPC.

## المقاييس

### Primary

- صافي المبيعات — `retail.net_sales`
- الربح الإجمالي التقديري — `retail.estimated_gross_profit`
- النتيجة التشغيلية التقديرية — `retail.estimated_operating_result`
- عدد الفواتير — `retail.invoice_count`

المقارنة مفعلة فقط لصافي المبيعات لأن RPC الحالية توفر previous-period reference موثقة له. `reference = 0` يبقى percentage delta غير قابل للحساب؛ لا يتحول إلى 0% أو 100% مفترضة.

### Supporting

- المصروفات
- متوسط الفاتورة

### Current state

- الصندوق
- ديون العملاء
- مستحقات الموردين
- قيمة المخزون

هذه الأربع معرفة كـ`aggregation: snapshot` وموسومة في الواجهة بـ **حاليًا**. فحص RPC الفعلي أكد أن CTE `balances` يقرأها كأرصدة حالية مستقلة عن الفترة المختارة.

في **Phase 5 Closure Patch** أصبحت الأربع تمر أيضًا عبر عقد Phase 4 الرسمي `normalizeMetricResult()` بدل إخراج `{ value, currency }` موازٍ. لذلك تحتفظ كل Current-state metric بعقد `NormalizedMetricResult` كامل، بما في ذلك `availability`, `coverage`, `freshness`, `provenance`, `definitionVersion`, `calculatedAt`, `unit` و`period`.

الـ`period` لهذه Snapshot metrics هو سياق بنيوي ليوم تنفيذ القراءة وفق timezone مساحة Retail، وليس فترة أداء يختارها المستخدم. تغيير فلتر الأداء إلى 30 يومًا أو Custom لا يغيّر المعنى التجاري للصندوق أو الديون أو قيمة المخزون. كما أن `as_of` يبقى `calculatedAt` ولا يتحول إلى Business `dataAsOf`؛ لذلك freshness تظل `unknown` ما لم يتوفر مصدر حداثة حقيقي.

## Data boundary وإصلاح Contract drift

العقد الفعلي لـ`retail_analytics_snapshot` يعيد:

- `metrics.retail_expenses`
- `metrics.retail_receivables`
- `metrics.retail_payables`

بينما عقد TypeScript المستقر يستخدم:

- `metrics.expenses`
- `metrics.receivables`
- `metrics.payables`

تم وضع المعرفة بهذا الفرق في Boundary واحدة:

`src/lib/retail/analytics/adapter.ts`

`getAnalyticsSnapshot()` لم يعد يعمل blind cast إلى `AnalyticsSnapshot`. أصبح يجلب `unknown` ثم يمرر النتيجة إلى `normalizeRetailAnalyticsSnapshot()` التي تتحقق من القيم المطلوبة وتطبع أسماء المفاتيح.

الـauthoritative RPC key له الأولوية عندما يكون **موجودًا** في payload، حتى إذا كانت قيمته `null` أو invalid؛ عندها يفشل العقد بوضوح. fallback إلى الاسم stable/legacy مسموح فقط عندما يكون المفتاح authoritative غائبًا أصلًا، ولا يمكن استخدام legacy value لإخفاء `null` أو قيمة تالفة من المصدر authoritative.

**Missing ≠ Zero:** أي قيمة مطلوبة مفقودة أو غير finite تؤدي إلى Contract error؛ لا تستبدل بصفر. بقي `formatMoney()` القديم دون Big Rewrite لحماية Consumers خارج Phase 5، والـOverview لا تمرر إليه Missing على أنها قيمة مالية حقيقية.

لم تحدث أي DB migration ولم تتغير RPC؛ الحل الآمن كان عند server adapter boundary.

## Attention

المخزون هو مصدر Attention الوحيد الذي استُخدم في Phase 5:

- `stock_on_hand === 0` → `DashboardCriticalException`
- `stock_on_hand > 0 && stock_on_hand <= minimum_stock` → `DashboardAlertBlock` بدرجة attention

لا يوجد Retail Health Score أو cash/payables risk threshold أو slow-moving alert جديد.

## Visualization

الـOverview يستخدم `TrendChart` من MADAR shared visualization layer لصافي المبيعات اليومية فقط. لا يوجد direct Recharts import داخل Retail page ولا رسوم إضافية للزينة.

Top Products بقيت قائمة مرتبة لأنها أوضح وأقل ازدحامًا ضمن Overview، بينما التحقيق الأعمق ينتقل إلى Reports.

## First-use والثقة

إذا كانت قائمة المنتجات فارغة وعدد الفواتير صفرًا، تعرض الصفحة Meaningful First-use state بدل شبكة أصفار كثيفة، مع احترام صلاحية VIEWER.

`as_of` في RPC هو وقت تنفيذ القراءة، ولذلك لا يُستخدم كدليل Business Freshness. تعرض الـOverview حداثة المصدر كـ`unknown` حيث يلزم بدل الادعاء بأن البيانات Fresh.

## Drill-downs

- Sales / Profit / Orders → Reports
- Inventory exceptions → Inventory
- Cash → Cash
- Receivables / Payables → Debts
- Expenses → Expenses
- Top Products → Reports

## ما أُزيل من Overview

`recent_activity` لا يُعرض في الصفحة الرئيسية. Activity feed ليست Decision Information، مع بقاء العقد القديم متاحًا للـConsumers الحالية دون تعديل RPC.

## حدود المرحلة

لم تبدأ Phase 6، ولم يتم تعديل Connected Business أو Native Business أو Admin/Founder dashboards أو ORBY أو قواعد بيانات Retail أو محرك الرسوم.
