# MADAR Dashboard Design System — Phase 2.0

> **المهمة:** MADAR Dashboards & Overview System  
> **المرحلة:** 2.0 — Dashboard Design System  
> **المرجع المعماري الملزم:** `docs/MADAR_DASHBOARD_INFORMATION_ARCHITECTURE_1.md`  
> **الحالة:** Shared UI layer فوق MADAR Design System 2.0

---

## 1. الغرض

هذه المرحلة تحول قرارات هندسة المعلومات من Phase 1.0 إلى **لغة بصرية وتفاعلية ومكونات Dashboard مشتركة** قابلة للتركيب لاحقًا داخل Retail وConnected Business وNative Business ولوحات الإدارة المستقبلية.

النموذج التنفيذي المعتمد:

```text
MADAR Design System 2.0 primitives
          ↓
Shared Dashboard Layer
          ↓
Service-specific compositions (مؤجلة)
```

الطبقة الجديدة لا تستبدل `Enterprise.tsx` ولا تعيد إنشاء Buttons أو Inputs أو Cards أو Panels أو Skeletons أو Empty/Error primitives. هي تستخدمها لبناء عقود Dashboard ذات معنى.

---

## 2. الملفات الأساسية

- `components/dashboard/types.ts` — UI contracts عامة فقط.
- `components/dashboard/Dashboard.tsx` — المكونات الدلالية المشتركة.
- `components/dashboard/index.ts` — public module exports.
- `app/dashboard-design-system-2.css` — اللغة البصرية والاستجابة للطبقة المشتركة.
- `components/admin/DashboardDesignSystemShowcase.tsx` — fixtures عربية واضحة لأغراض فحص الـUI فقط.
- `app/admin/design-system/page.tsx` — يعرض الكتالوج المشترك داخل Route الإدارة المحمية الموجودة أصلًا.
- `tests/madar-dashboard-design-system-2.test.mjs` — عقود regression للمرحلة.

لا يوجد API جديد، ولا Migration، ولا Data contract للأعمال، ولا Dashboard خدمة جديدة.

---

## 3. المبادئ التنفيذية

### Hierarchy before decoration

الأولوية تُفهم أولًا من:

- Position.
- Scale.
- Spacing.
- Density.
- Grouping.
- Visual weight.
- Contrast.

اللون إشارة مساندة فقط.

الحالة الطبيعية هادئة، بينما الاستثناء الحقيقي يحصل على وزن بصري أعلى.

### Arabic-first

العربية وRTL هما الحالة المرجعية. الطبقة تعتمد:

- `text-align: start` والمنطق الاتجاهي الموجود في Design System.
- logical properties مثل `inset-inline-*` و`border-inline-start`.
- `bdi` و`dir="auto"` لقيم Metric، مع إمكانية `ltr` أو `rtl` عند الحاجة.
- `dir="ltr"` محلي داخل حقول التاريخ الرقمية فقط.
- النصوص الافتراضية والأمثلة والـARIA labels باللغة العربية.

الإنجليزية مدعومة كبيانات، وليست المرجع الذي صُممت حوله المكونات.

### Theme inheritance

لا توجد palette Dashboard مستقلة. كل المكونات تستهلك semantic tokens الحالية مثل:

- `--md-surface`
- `--md-surface-muted`
- `--md-text-primary`
- `--md-text-muted`
- `--md-border-*`
- `--md-info`
- `--md-warning`
- `--md-danger`
- `--md-success`
- `--md-accent`

لذلك Light/Dark يعملان من Theme System الحالي، ولا توجد قيم ألوان خام داخل Dashboard layer.

---

## 4. المكونات المشتركة

## DashboardSection / DashboardSectionHeader

**الوظيفة:** تنظيم Section دلالية وعنوانها ووصفها وإجراءاتها.

**استخدمها عندما:** تحتاج مجموعة معلومات لها سؤال أو وظيفة واحدة واضحة.

**لا تستخدمها عندما:** تريد تغليف كل Card منفردة بقسم إضافي أو صناعة Grid ثابتة للخدمة.

تدعم:

- eyebrow اختياري.
- description اختياري.
- actions اختيارية.
- أولوية دلالية: `critical | primary | normal | supporting`.
- density: `comfortable | compact`.
- heading level `h2 | h3`.

الأولوية هنا Metadata للتركيب ولا تفرض Layout خدمة بعينه.

---

## DashboardMetricGrid

**الوظيفة:** Grid مرنة لمجموعة Metrics.

لا تفرض عدد بطاقات ولا أربعة أعمدة ثابتة. تستخدم `auto-fit/minmax` وتتحول إلى عمود واحد على الهاتف لتجنب horizontal scroll للمعلومة الأساسية.

---

## DashboardMetricCard

**الوظيفة:** تمثيل KPI/Metric دون فرض شكل تحليلي أو مقارنة.

### الحقول

- `label` — مطلوب.
- `value` — مطلوب.
- `unit` — اختياري.
- `supportingContext` — اختياري.
- `comparison` — اختياري.
- `trust` — اختياري.
- `status` — اختياري.
- `action` — اختياري.
- `valueDirection` — `auto` افتراضيًا، ويمكن عزله LTR/RTL.
- `compactOnMobile` — يخفي **السياق الثانوي فقط** على الهاتف عند اختيار composition لذلك؛ لا يخفي القيمة أو الحالة أو الثقة أو الإجراء.

### قواعد الاستخدام

- لا تضع سهمًا أو Delta إذا لم توجد مقارنة ذات معنى.
- لا تستخدم لون القيمة لتقرير good/bad.
- لا تجعل كل Card تملك CTA.
- True zero يعرض كقيمة Metric عادية.
- No meaningful data يستخدم `DashboardEmptyState` بدل Metric مزيفة بصفر.

---

## MetricContext

**الوظيفة:** Slot محايد لسياق رقمي أو مرجعي داخل Metric.

يدعم أنواع UI فقط:

- `absolute`
- `delta`
- `reference`
- `target`

هذه الأنواع **لا تحمل حكمًا إيجابيًا أو سلبيًا** في Phase 2.0. الدائرة الصغيرة والبنية النصية حيادية، ولا يوجد green-up/red-down mapping.

---

## DashboardSummaryBlock

**الوظيفة:** تجميع سياق تشغيلي أو ملخص ثانوي أقل وزنًا من Primary Metrics.

لا يستخدم بدل Section كاملة، ولا يجب أن يتحول إلى مستودع لكل التفاصيل.

---

## 5. Status / Insight / Alert / Critical Exception

هذه ليست variants لمكوّن `Notice` واحد.

## DashboardStatusBlock

**المعنى:** وصف الحالة الحالية.

- يحمل label ظاهر: `الحالة الحالية`.
- يستخدم `role="status"`.
- قد يكون neutral/info/success/warning/danger بحسب معنى الحالة نفسها.
- لا يعني تلقائيًا أن Action مطلوب.

## DashboardInsightBlock

**المعنى:** ملاحظة أو اكتشاف ذو معنى.

- يحمل label ظاهر: `ملاحظة`.
- له بناء مستقل ووزن أهدأ من Alert.
- لا يستخدم `role="alert"`.
- يمكن أن يقود إلى فهم أعمق عند وجود Drill-down مناسب.

## DashboardAlertBlock

**المعنى:** شيء يحتاج انتباهًا أو إجراءً.

Severity UI:

- `attention`
- `warning`
- `critical`

يملك بنية مستقلة، border hierarchy ونصًا واضحًا؛ لا يعتمد على اللون وحده.

## DashboardCriticalException

**المعنى:** استثناء يغير سلامة القرار أو الثقة أو يمنع عملية أساسية.

خصائصه:

- presentation أكبر من Alert العادية.
- `role="alert"` و`aria-live="assertive"`.
- label نصي `استثناء حرج`.
- يدعم شرح Impact وTrust وإجراء مباشر.
- لا يُخفى في Mobile أو disclosure أو overflow menu.
- Mobile يعيد تركيب العنصر، لكنه يبقي العنوان والشرح والتأثير والإجراء ظاهرًا.

لا تستخدمه لرفع أهمية Alert عادية.

---

## 6. Data Trust & UI States

## DataTrustIndicator

**الوظيفة:** إظهار Context الثقة عندما يكون مهمًا للقرار، وليس Badge إجبارية على كل KPI.

الحالات:

- `fresh`
- `syncing`
- `stale`
- `partial`
- `unknown`
- `error`

يدعم:

- label مخصص.
- آخر تحديث.
- detail إضافي.
- mode مضغوط.

الحالة تُفهم من icon + text + visual treatment، وليس اللون وحده.

## DashboardDataState

Section/module-level presentation لحالة الثقة عندما تؤثر على مجموعة بيانات لا رقم منفرد.

مناسب لـ:

- Partial.
- Stale.
- Syncing.
- Unknown.
- Error.

لا يستخدم بدل Business Alert؛ هو يشرح **حالة البيانات**.

## DashboardEmptyState

يمثل `No meaningful data yet` أو سياقًا فارغًا حقيقيًا.

يدعم:

- explanation.
- context.
- next action.
- onboarding/setup guidance من Composition المستقبلية.

وجود `data-empty-kind="no-meaningful-data"` يثبت الفصل الدلالي عن true zero.

## DashboardLoadingState

Skeleton structure مشتركة لا تغير Shell ولا تعرض Spinner وحيدًا لمحتوى Dashboard كامل.

عدد placeholders محدود UI فقط ولا يمثل KPIs حقيقية.

## DashboardErrorState

يبني على `ErrorState` الحالية ويحتفظ بإجراء recovery اختياري.

---

## 7. Filters

## DashboardFilterBar

يدعم Scope صريح:

- `global`
- `local`

كل Scope يملك label عربيًا ظاهرًا:

- `مرشحات النظرة العامة`
- `مرشحات هذا القسم`

الـGlobal أعلى وزنًا بصريًا، والـLocal أكثر هدوءًا ودون إيحاء بأنه يغيّر بقية Dashboard.

يدعم:

- label/description.
- controls.
- active filters.
- clear/reset href عندما يكون منطقيًا.

لا يهدف لتحويل Overview إلى Analytics filtering workspace.

## ActiveFilterChip

يعرض اسم الفلتر وقيمته وإزالة اختيارية. إزالة الفلتر لها Accessible label، وعلى Mobile تحصل على touch target مناسب.

## DateRangeControl

Pattern مشتركة تدعم:

- presets اختيارية.
- active preset.
- custom from/to.
- GET form بسيط يمكن ربطه بالـURL state الموجود لاحقًا.

لا تحدد هذه المرحلة أي Default Range لخدمة بعينها، ولا Contextual Comparison business logic.

حقول التاريخ معزولة LTR رقميًا داخل الصفحة العربية فقط؛ بنية التحكم وتسمياته تبقى RTL/Arabic-first.

---

## 8. Drill-down

## DashboardDrillDownLink

Pattern موحدة للمسار:

```text
Overview → Understand → Investigate
```

تدعم labels مثل:

- عرض التفاصيل.
- فتح التقرير.
- التحقق من المصدر.
- أي Action ذات صلة.

السهم Directional ويعكس اتجاهه عبر `md-icon-directional` في RTL.

لا يجب إضافة Drill-down لكل Card تلقائيًا.

---

## 9. Visualization shell

## DashboardVisualizationShell

هذه **حاوية فقط** وليست Chart system.

تتعامل مع:

- title.
- description.
- actions.
- trust.
- ready/loading/empty/error shell states.
- container sizing.

لا تتعامل مع:

- Line/Bar/Pie/Donut selection.
- axes.
- legends.
- chart palette semantics.
- trend direction semantics.
- tooltip visualization rules.

كل ذلك مؤجل إلى Phase 3.0.

---

## 10. Supporting information

## DashboardSupportingInfo

حاوية أقل وزنًا للمعلومات التشغيلية أو التفسيرية المساندة.

يجب ألا تنافس Primary decision signal بصريًا، ولا تستخدم لإدخال deep diagnostics إلى Overview.

---

## 11. Responsive contract

### Desktop / Laptop

- Section header يمكنه وضع actions بجانب العنوان.
- MetricGrid تتكيف بعدد العناصر والمساحة بدل عدد أعمدة ثابت.
- Critical exception يمكن أن تستخدم ثلاثة أعمدة: icon / content / action.
- Date range custom fields يمكن أن تظهر في صف واحد عندما تتوفر المساحة.

### Tablet

- Section actions تنتقل تحت heading عند الحاجة.
- Critical action تنتقل إلى صف مستقل بدل ضغط الشرح.
- Date range تتحول إلى Grid أبسط.

### Mobile

Mobile **ليس Desktop stacked فقط**:

- Primary Metric تصبح عمودًا واحدًا دون horizontal scroll.
- العناوين تقل كثافتها مع بقاء hierarchy.
- `compactOnMobile` اختياري لإخفاء context الثانوي فقط.
- Status/Insight/Alert يعاد تركيبها إلى icon + content ثم action.
- Critical Exception تبقى ظاهرة بالكامل ولا تدخل disclosure.
- Filter controls تتحول إلى Grid بعرض كامل.
- Active filters تظهر كصفوف واضحة بدل chips مضغوطة.
- Presets وDrill-down وإزالة filters تحافظ على touch targets.
- Custom date range يصبح عمودًا واحدًا.

لا توجد معلومات حرجة مخفية بالـhover.

---

## 12. Light / Dark

الطبقة لا تملك Theme logic مستقلًا. كل styles مبنية على semantic tokens الحالية، لذلك:

- surfaces.
- borders.
- primary/secondary text.
- status/alert tones.
- trust states.
- skeletons.
- filter surfaces.

تتحول تلقائيًا مع `data-theme="light|dark"`.

لم تتم إضافة hardcoded colors إلى `app/dashboard-design-system-2.css`.

---

## 13. Accessibility baseline

- لا يوجد status أو alert يعتمد على اللون وحده.
- Status/Insight/Alert/Critical لها labels وبنى مختلفة.
- Critical Exception تستخدم alert semantics واضحة.
- Error data state تستخدم `role="alert"`.
- قيم Metric معزولة bidirectionally.
- Date inputs مع labels فعلية.
- Global/Local filter bars لها accessible region labels.
- remove filter control له accessible label.
- directional drill-down icon يحترم RTL.
- التفاعل لا يحتاج hover لفهم المعنى.
- responsive controls تحافظ على touch targets المهمة.
- النظام العالمي ما زال يطبق `:focus-visible` و`prefers-reduced-motion` من Design System الأساسي.

---

## 14. Showcase

تمت إعادة استخدام `/admin/design-system` لأنها:

- محمية أصلًا ببوابة الإدارة.
- مخصصة أصلًا لعرض Design System.
- تمنع إنشاء Production dashboard تجريبية.

`DashboardDesignSystemShowcase` يستخدم نصوصًا وقيمًا عامة، مع تنبيه ظاهر بأنها **UI fixtures فقط**.

لا يستورد بيانات أعمال، ولا ينفذ queries، ولا يضيف fake production metrics.

---

## 15. Shared vs service-specific

### Shared في Phase 2.0

- hierarchy containers.
- Metric visual contract.
- comparison slot المحايد.
- Status / Insight / Alert / Critical Exception.
- trust/freshness presentation.
- Empty/Loading/Error/Data states.
- filters scope pattern.
- date range pattern.
- drill-down pattern.
- visualization shell.
- responsive rules.

### يبقى Service-specific

- أي KPI تستحق الظهور.
- ترتيب KPIs الفعلي.
- Default period.
- Presets النهائية.
- filters الفعلية.
- wording المرتبطة بالمجال.
- actions الفعلية.
- empty-state onboarding steps الخاصة بالخدمة.
- freshness thresholds.
- ما الذي يعد Critical Exception في domain معين.
- composition النهائية للـOverview.

لا توجد أسماء Retail أو Connected أو Native داخل shared component contracts.

---

## 16. ما لم يُغيّر عمدًا

Phase 2.0 لا تعدل:

- Dashboards الخدمات الحالية.
- Analytics logic.
- Mobile Dashboard API.
- Database schema.
- Supabase migrations.
- aggregation/calculation semantics.
- ORBY.
- Navigation.
- Branding.
- هوية مَدار.

تعارضات Phase 1.0 القديمة تبقى في أماكنها إلى أن تصل المرحلة المختصة، إلا إذا كانت تخص Shared UI contract نفسه.

---

## 17. مؤجل إلى Phase 3.0 — Data Visualization System

مؤجل عمدًا:

- Chart selection rules.
- Line / Bar / Area / Pie / Donut semantics.
- Axis rules.
- Grid rules.
- Legend rules.
- Tooltip visualization behavior.
- chart color ordering.
- positive/negative trend semantics.
- good/bad direction mapping.
- comparison visualization semantics.
- target visualization.
- sparklines.

### تعارض موجود يجب حمله إلى Phase 3.0

`app/design-tokens.css` يحتوي مسبقًا على compatibility chart tokens:

- `--md-chart-positive`
- `--md-chart-negative`

والـlegacy chart foundation في `app/design-system.css` يمررها إلى `--chart-positive/negative`.

Phase 2.0 **لم تستخدم هذه الرموز في أي Dashboard component ولم توسعها**، لأن تقرير ما إذا كان اتجاه metric إيجابيًا أو سلبيًا ليس قرارًا بصريًا عامًا. يجب مراجعة هذا الإرث صراحة في Phase 3.0 بدل حذفه بصمت هنا.

---

## 18. مؤجل إلى Phase 4.0 — Dashboard Data & Metrics Layer

- data contracts المشتركة.
- metric definitions.
- aggregation.
- query contracts.
- caching/freshness calculations.
- normalization.
- data coverage calculations.

UI types الموجودة في `components/dashboard/types.ts` تصف **presentation state فقط** ولا تمثل مصدر حقيقة للأعمال.

---

## 19. قاعدة التبني للمراحل القادمة

عند بناء Dashboard خدمة لاحقًا:

1. ابدأ من Phase 1.0 لتحديد ما يستحق الظهور.
2. استخدم Shared Dashboard components من هذه المرحلة.
3. لا تنسخ Component لتغيير label أو KPI.
4. أضف Composition في نطاق الخدمة فقط.
5. اترك chart semantics لـPhase 3.0.
6. اترك business/data contract لـPhase 4.0.
7. إذا احتاجت الخدمة نمطًا بصريًا جديدًا، قيّم أولًا هل هو حاجة عامة أم domain-specific قبل إضافته إلى shared layer.

---

## 20. Definition of done لهذه الوثيقة

Phase 2.0 تعتبر صحيحة عندما يبقى النظام:

- فوق Design System الحالي لا بجانبه.
- service-neutral.
- Arabic/RTL-first.
- theme-aware.
- responsive بحسب الأولوية لا بحسب stacking فقط.
- metric comparison optional.
- Status/Insight/Alert منفصلة.
- Critical Exception first-class.
- no-data منفصلة عن true-zero.
- trust/partial/stale first-class.
- filters scope ظاهرًا.
- chart-type neutral.
- بلا backend expansion.
