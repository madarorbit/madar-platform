# MADAR Data Visualization System — Phase 3.0

> **المهمة:** MADAR Dashboards & Overview System  
> **المرحلة:** 3.0 — Data Visualization System  
> **المراجع الملزمة:** `docs/MADAR_DASHBOARD_INFORMATION_ARCHITECTURE_1.md` و`docs/MADAR_DASHBOARD_DESIGN_SYSTEM_2.md`  
> **المحرك الداخلي:** Recharts 3.10.1  
> **الحد:** Presentation فقط؛ Phase 4.0 مسؤولة عن تعريف البيانات والحسابات والمصادر.

---

## 1. الفلسفة

المبدأ الحاكم:

**Question → Data → Visualization**

لا يوجد Chart quota، ولا يُختار الرسم لإكمال شكل الصفحة. إذا أجابت KPI أو Status أو نص قصير عن السؤال بصورة أوضح فلا يوجد سبب لاستخدام Chart.

الـOverview ما زالت **Monitor & Decide**. الرسوم المشتركة لا تحولها إلى Analytics workspace.

---

## 2. البنية التقنية

```text
Recharts 3.10.1
       ↓
components/dashboard/visualization
       ↓
DashboardVisualizationShell (Phase 2)
       ↓
Service compositions لاحقًا
```

Recharts implementation detail. الاستيراد المباشر من `recharts` مسموح فقط داخل `components/dashboard/visualization`، وليس في Retail أو Connected أو Native أو أي composition مستقبلية.

أضيف `react-is@19.2.4` لأنه peer مطلوب من Recharts ويطابق React `19.2.4` المستخدمة في مَدار.

---

## 3. Public Visualization API

الـAPI العامة الحالية:

- `TrendChart`
- `CategoryBarChart`
- `StackedBarChart`
- `CompositionDonut`
- `TargetProgress`
- `Sparkline`
- `VisualizationTooltip`
- `VisualizationLegend`
- `VisualizationCategoryLegend`
- formatting utilities
- visualization-only types/contracts

لا يوجد `Chart` عام ولا Config DSL تحاول تمثيل كل مكتبة Recharts.

---

## 4. دليل الاختيار

| السؤال | التمثيل المرجح |
| --- | --- |
| كيف تغير الشيء عبر الزمن؟ | Trend / Line |
| كيف نقارن بين فئات؟ | Bar |
| كيف نقارن فئات ذات أسماء عربية طويلة؟ | Horizontal Bar |
| كيف يتكون إجمالي عبر فئات/فترات؟ | Stacked Bar |
| كيف يتكون إجمالي بسيط من أجزاء قليلة؟ | Donut |
| أين نحن بالنسبة إلى هدف معروف؟ | Progress / Target |
| ما شكل الحركة سريعًا داخل KPI؟ | Sparkline |

هذا Guide وليس قانونًا أعمى. السؤال وسياق البيانات يملكان القرار النهائي.

---

## 5. TrendChart

**السؤال:** كيف تغير الشيء بمرور الوقت؟

Default هو Line. يدعم:

- سلسلة واحدة.
- عدة سلاسل عندما تكون المقارنة ذات معنى.
- `role="reference"` لسلسلة مرجعية أهدأ ومتقطعة.
- Target/Benchmark كـ`ReferenceLine` مستقلة.
- Missing points كـ`null` مع `connectNulls={false}`.
- Partial range كتظليل معلن، لا كنقاط مخترعة.
- Tooltip عربية.
- Legend عند تعدد السلاسل.
- محور Y لا يبدأ من صفر قسرًا في الـtime-series؛ يمكن طلب `includeZero` فقط عندما يخدم السؤال.

يدعم `variant="area"` صراحةً فقط عندما يكون الحجم/الامتلاء جزءًا من المعنى. `line` هي القيمة الافتراضية.

---

## 6. CategoryBarChart

**السؤال:** كيف نقارن بين فئات؟

يدعم:

- Vertical Bar للفئات القليلة ذات labels قصيرة.
- Horizontal Bar كخيار First-class.
- `orientation="auto"`، ويتحول إلى Horizontal على الهاتف أو عندما تكون labels العربية طويلة.
- Arabic category tick wrapping دون تدوير النص.
- zero baseline ضمن domain المقارنة حتى لا تصبح أطوال الأعمدة مضللة.

لا يستخدم Bar عندما يكون السؤال الحقيقي تغيرًا مستمرًا عبر الزمن.

---

## 7. StackedBarChart

**السؤال:** كيف يتكون الإجمالي من أجزاء عبر فئات أو فترات؟

العقد المشترك يركز على أجزاء غير سالبة ذات معنى داخل إجمالي. إذا وصلت قيم سالبة، يعرض النظام Guidance بدل فرض stack قد يكون مضللًا.

لا يستخدم لعشرات القطع الصغيرة أو للمقارنة الدقيقة بين كل segment.

---

## 8. CompositionDonut

**السؤال:** كيف يتكون إجمالي بسيط من أجزاء قليلة؟

الشروط:

- Part-to-whole حقيقي.
- قيم غير سالبة.
- إجمالي أكبر من صفر.
- الحد المشترك الافتراضي `MAX_DONUT_SLICES = 5`.

إذا تجاوزت البيانات الحد، لا يجمع النظام الشرائح ولا يخفيها ولا ينشئ `Other` من تلقاء نفسه؛ يعرض Guidance لاستخدام Bar أو تصميم أنسب.

المركز اختياري ويُملأ فقط عندما يزوّده الـcomposition بسياق مفيد.

---

## 9. TargetProgress

**السؤال:** أين نحن بالنسبة إلى هدف أو حد معروف؟

- يحتاج Target موجبًا وصالحًا.
- يعرض current وtarget بوضوح.
- يستخدم `role="progressbar"` وARIA values.
- لا يستخدم Gauge أو Speedometer.
- `outcome` اختياري وصريح؛ المكوّن لا يستنتجه من ارتفاع الرقم أو إشارته.

النسبة المحسوبة داخل المكوّن هي نسبة presentation للـprogress فقط، وليست Business metric definition.

---

## 10. Sparkline

إشارة خفيفة داخل سياق صغير مثل KPI.

- بلا axes مزدحمة.
- بلا Tooltip تحليلية.
- Missing تبقى gap.
- لا تستنتج good/bad من اتجاه الخط.
- إذا احتاج المستخدم التاريخ والقيم الدقيقة ينتقل السؤال إلى TrendChart.

---

## 11. Series Identity ≠ Business Outcome

### Series Identity

`series-1 ... series-5` تميز السلاسل والفئات فقط.

الألوان تأتي من:

- `--md-viz-series-1`
- `--md-viz-series-2`
- `--md-viz-series-3`
- `--md-viz-series-4`
- `--md-viz-series-5`

ولا تعني نجاحًا أو فشلًا أو صعودًا أو هبوطًا.

### Business Outcome

العقد يسمح فقط بقيمة صريحة:

- `favorable`
- `unfavorable`
- `neutral`
- `unknown`

هذه القيمة يجب أن تأتي مستقبلًا من Domain/Composition. Visualization لا تحسبها من الرقم.

### Numeric direction

**Numeric direction ≠ Business meaning.**

لا يوجد داخل الطبقة الجديدة `positive number = green` أو `negative number = red`.

---

## 12. Legacy chart-positive / chart-negative

`app/design-tokens.css` ما زال يحتوي:

- `--md-chart-positive`
- `--md-chart-negative`

بسبب compatibility مع Legacy UI.

الحالة الرسمية في Phase 3.0:

**Legacy / deprecated for generic metric direction.**

لا تستخدم `components/dashboard/visualization` هذين الرمزين، ولا تُحذف حاليًا حتى لا نكسر consumers قديمة.

---

## 13. Comparison semantics

### Current

Actual series أساسية.

### Previous / Reference

`role="reference"` يجعلها أهدأ ومتقطعة، ولا يجعلها Business outcome.

### Target

Reference line/marker، وليس سلسلة زمنية مزيفة.

### Benchmark

Reference خارجي معلن بوضوح.

لا Comparison لمجرد توفر قيمتين.

---

## 14. Tooltip

`VisualizationTooltip` عربية وRTL-first:

- label للفترة/الفئة.
- series label واضح، لا developer key.
- formatted value.
- unit/currency عبر format contract.
- `bdi dir="ltr"` للقيمة الرقمية.
- context اختياري للنقطة مثل partial/missing explanation.
- outcome label يظهر فقط إذا أُعطي صراحة.

الـTooltip تستخدم `role="status"` و`aria-live="polite"`، بينما البديل النصي يمنع اعتماد الفهم على hover وحده.

---

## 15. Legend

Legend ليست إجبارية للسلسلة الواحدة.

عند تعدد السلاسل:

- RTL.
- label نصية.
- ترتيب مطابق للـseries.
- reference series لها dash مختلف ونص `مرجع`.
- لا يعتمد التفريق على اللون وحده في Trends.

Donut/stacked تستخدم labels نصية ثابتة مع markers، إضافة إلى البديل النصي.

---

## 16. Axes

- Gridlines هادئة من semantic token.
- axis lines/tick lines غير ضرورية افتراضيًا.
- tick density تتكيف عبر `minTickGap` و`preserveStartEnd`.
- Bar تحافظ على zero baseline.
- Trend لا تُجبر على zero إذا شوّه ذلك شكل التغير.
- لا توجد dual Y axes في Core vocabulary.
- لا توجد axis truncation متعمدة لإنتاج انطباع مضلل.

---

## 17. Formatting

`formatVisualizationValue` و`formatVisualizationDate` utilities عرض فقط.

القيم تدعم:

- number.
- compact.
- percent.
- currency عندما يعطي الـcomposition رمز العملة صراحةً.
- unit.
- precision.

الافتراضي عربي مع `numberingSystem="latn"` لتبقى الأرقام معزولة وواضحة داخل RTL دون تغيير سياسة أرقام المنصة كلها. يمكن للـcontract طلب `arab` صراحةً إذا احتاج سياق لاحق ذلك.

لا توجد Revenue/Profit/Growth calculations هنا.

---

## 18. Missing Data

**Missing ≠ Zero.**

- `null` تبقى missing.
- Trend وSparkline تستخدم `connectNulls={false}`.
- لا توجد `?? 0` لتحويل نقاط series المفقودة.
- إذا لم توجد أي قيمة ذات معنى، تستخدم مكونات Phase 2 `DashboardEmptyState` بدل axes فارغة.

---

## 19. Partial / Stale

Partial يمكن تمثيلها عبر:

- `DashboardVisualizationShell` + `DataTrustIndicator state="partial"`.
- `partialRange` داخل Trend عندما يحتاج جزء من الفترة توضيحًا بصريًا.
- tooltipContext للنقطة عند الحاجة.

Stale لا تعيد Charts بناء Trust system؛ تستخدم Phase 2 `DataTrustIndicator state="stale"` وLast updated داخل Shell.

لا تخترع الطبقة missing points ولا تجعل partial/stale تبدو complete/fresh.

---

## 20. Accessibility

كل visualization أساسية تستفيد من Recharts `accessibilityLayer`، وفوقها مَدار تضيف:

- `ariaLabel` مطلوب للرسوم الأساسية.
- summary نصية مطلوبة.
- `figcaption` غير مرئية بصريًا لقارئات الشاشة.
- `<details>` منخفض الضوضاء للوصول إلى ملخص نصي مرئي عند الحاجة.
- Tooltip polite عند التفاعل.
- Legends نصية.
- `bdi` للقيم الرقمية.
- color-independent dash للـTrend/reference.
- Progress ARIA semantics.
- لا اعتماد على hover وحده.

Sparkline تعتمد على سياق KPI ولديها `role="img"` و`aria-label` بدل جدول مستقل.

---

## 21. RTL / Arabic-first

- wrappers `dir="rtl"`.
- Tooltip وLegend RTL.
- الأرقام معزولة LTR محليًا.
- Horizontal Bar تستخدم Y axis على الجانب المنطقي الملائم وتلف labels العربية بدل تدويرها.
- Showcase كلها عربية أولًا.
- المصطلح الإنجليزي يظهر فقط عند فائدته التقنية.

---

## 22. Responsive / Mobile

Mobile ليست Desktop chart مصغرة:

- Trend تقلل tick density والارتفاع.
- Category Bar `auto` تنتقل إلى Horizontal على الهاتف.
- labels الطويلة تلف إلى عدة أسطر دون ellipsis متعمد.
- Legend تتحول إلى قائمة عمودية.
- Tooltip تضبط عرضها ضمن viewport.
- Progress يعيد header إلى Grid.
- لا يوجد horizontal scrolling لفهم Core visualization.
- لا يتم حذف series أساسية تلقائيًا أو sampling البيانات بصمت.

إذا كانت البيانات كثيفة لدرجة لا تُفهم على الهاتف، فالمطلوب من composition/Phase 4 اختيار سياق أبسط، لا تحويل الهاتف إلى BI canvas.

---

## 23. Density / Large datasets

Phase 3 تتحكم في presentation density فقط:

- `minTickGap`.
- `preserveStartEnd`.
- no point markers افتراضيًا في Trend.
- Sparkline بلا ticks.
- لا label لكل نقطة.

لا تنفذ aggregation أو business downsampling أو تختصر dataset بصمت. ذلك جزء من Phase 4/data contract أو Analytics-specific decisions لاحقًا.

---

## 24. Motion

Recharts animation تعطل عند `prefers-reduced-motion: reduce` عبر hook مشترك.

CSS progress transition تتوقف كذلك في reduced-motion.

الحركة subtle وليست ضرورية لفهم البيانات.

---

## 25. Light / Dark

الرسوم لا تحمل raw palette داخل components أو visualization CSS.

- grid/labels/surfaces من semantic tokens الحالية.
- series palette معرفة في `dashboard-visualization-tokens-3.css` لكل theme.
- tooltip تستخدم surface overlay وsemantic borders/text.
- target/reference/partial لها tokens مستقلة عن good/bad metric direction.

---

## 26. Patterns الممنوعة افتراضيًا

- 3D/perspective.
- Gauge / Speedometer.
- Radar / Funnel / Treemap / Sankey / Heatmap / Maps في Core Phase 3.
- Dual Y axes.
- dozens of series.
- donut بشرائح كثيرة.
- rotated Arabic labels كحل افتراضي.
- hidden missing data.
- arbitrary raw colors في service composition.
- positive=green / negative=red inference.

---

## 27. Service boundaries

Shared visualization components لا تحتوي:

- Retail metrics.
- Connected sync schema.
- Native orders schema.
- organization IDs.
- Supabase responses.
- fetching.
- RPCs.

كلها Data-in / UI-out.

الخدمات لاحقًا تختار السؤال والبيانات والتمثيل من هذه اللغة، ولا تستورد Recharts مباشرة.

---

## 28. Phase 4.0 boundary

مؤجل عمدًا إلى **Phase 4.0 — Dashboard Data & Metrics Layer**:

- تعريف كل KPI.
- source of truth.
- queries.
- aggregation.
- normalization.
- currencies/business conversion.
- period definitions.
- comparison calculations.
- favorable/unfavorable business rules.
- freshness calculations/thresholds.
- caching.
- data contracts.
- server/client query behavior.

Phase 3 تعرض البيانات التي تصلها؛ Phase 4 تعرفها وتحسبها وتوصلها.
