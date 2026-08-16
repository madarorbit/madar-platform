# MADAR Dashboard & Information Architecture Specification — Phase 1.0

> **المهمة:** MADAR Dashboards & Overview System  
> **المرحلة:** 1.0 — Dashboard & Information Architecture  
> **الحالة:** Architecture Contract / Product Information Specification  
> **النطاق:** النظام المشترك فقط؛ لا يتضمن تصميم Dashboard نهائية أو KPIs خاصة بخدمة أو Data Visualization System.

---

## 0. الغرض وحدود الوثيقة

هذه الوثيقة هي المرجع المعماري المشترك لكل Overview/Dashboard مستقبلية داخل مَدار. وظيفتها تثبيت **منطق المعلومات والأولوية والمعنى** قبل بناء المكوّنات البصرية أو لوحات Retail وConnected Business وNative Business أو لوحات Admin/Founder.

هذه الوثيقة **لا تستبدل مصادر الحقيقة التشغيلية** في المشروع، ولا تنشئ Data Contracts جديدة، ولا تضيف KPIs، ولا تغيّر Backend، ولا تفرض Layout أو Chart محددًا.

عند التعارض بين تنفيذ قديم وبين هذه الوثيقة في موضوع يخص **المعنى المشترك للـOverview**، تعتبر هذه الوثيقة المرجع للمراحل القادمة، ويجب معالجة التعارض في المرحلة المختصة بدل تعديله خلسة في Phase 1.0.

---

## 1. المبدأ الأساسي: Arabic-first Architecture

مَدار منتج عربي أولًا من الأساس:

> **MADAR is Arabic-first by design, not Arabic-translated.**

لذلك تكون العربية هي المرجع الأول لأي قرار خاص بهندسة المعلومات، بما يشمل:

- RTL وتسلسل القراءة من اليمين إلى اليسار.
- أولوية المعلومات وترتيبها الدلالي داخل السياق العربي.
- طول التسميات العربية قبل اعتماد كثافة أي مكوّن.
- عرض الأرقام والعملات والتواريخ بصورة صحيحة داخل النص العربي.
- دعم اتجاه LTR محليًا عندما يحتاج الرقم أو الكود أو الرابط أو المعرّف ذلك، دون قلب الصفحة إلى منطق إنجليزي.
- Tooltips وLegends وPopover وLabels تعمل ضمن RTL دون الاعتماد على نسخة إنجليزية أصلية.
- Responsive composition تُختبر عربيًا أولًا.
- الإنجليزية لغة مدعومة مستقبلًا، لكنها ليست النموذج المرجعي الذي تُترجم عنه العربية.

**قاعدة تنفيذية للمراحل اللاحقة:** أي مكوّن Dashboard مشترك يجب أن يثبت صحته في العربية وRTL قبل اعتباره صالحًا للنظام المشترك.

---

## 2. وظيفة الـOverview

تعتمد مَدار نموذج **Decision Overview**.

وظيفة الـOverview هي تمكين المستخدم من الإجابة بسرعة عن الأسئلة التالية:

1. ماذا يحدث الآن؟
2. هل النشاط أو النظام في حالة جيدة؟
3. ما الذي تغير بصورة تستحق الانتباه؟
4. هل يوجد شيء مهم يحتاج تدخلي؟
5. ما الخطوة المنطقية التالية: إجراء، فهم سريع، أو تحقيق أعمق؟

الـOverview ليست تقريرًا طويلًا، وليست مستودعًا لكل البيانات، وليست مساحة استكشاف تحليلي كاملة.

> **Overview = Monitor & Decide**  
> **Analytics = Explore & Explain**

### اختبار القبول الوظيفي

إذا كانت المعلومة لا تساعد المستخدم على المراقبة أو اتخاذ قرار أو معرفة ما يستحق المتابعة، فالأصل ألا تكون عنصرًا دائمًا في الـOverview.

---

## 3. الحد بين Overview وAnalytics

### Overview — Monitor & Decide

تجيب عن:

- ماذا يحدث؟
- ما الحالة الحالية؟
- ما التغير المهم؟
- ما الذي يحتاج انتباهًا؟
- أين أذهب بعد ذلك؟

### Analytics — Explore & Explain

تجيب عن:

- لماذا حدث ذلك؟
- أين حدث؟
- عبر أي بُعد أو فئة؟
- ما النمط عبر الزمن؟
- كيف تتغير النتيجة عند تبديل الفلاتر أو المقارنات أو الشرائح؟

### Boundary Rules

لا تُحمّل الـOverview بـ:

- فلاتر استكشافية كثيرة.
- جداول تحليلية كبيرة.
- تشخيص متعدد الأبعاد.
- مقارنات مركبة تحتاج شرحًا طويلًا.
- Charts ضخمة لمجرد توفر البيانات.
- أدوات Export/Print/تحقيق عميق باعتبارها الوظيفة الأساسية للصفحة.

المسار الصحيح هو:

> **Overview → Understand → Investigate**

---

## 4. هرم المعلومات المشترك

الترتيب الدلالي المرجعي هو:

1. **Context & Period**
2. **Business State / Critical Exceptions**
3. **Primary KPIs**
4. **Performance & Trends**
5. **Insights / Attention Required**
6. **Supporting Operational Information**
7. **Drill-down Paths**

هذا **هرم معنى** وليس Grid أو Layout ثابتًا. لا يلزم أن تظهر كل طبقة دائمًا، ولا يُنشأ قسم فارغ فقط للحفاظ على الشكل.

### Critical Exception Override

إذا ظهر استثناء حرج يغير قدرة المستخدم على الوثوق بالصفحة أو يتطلب إجراءً فوريًا، يمكنه تجاوز الترتيب الطبيعي والظهور قبل المحتوى الذي كان سيأتي قبله عادةً.

أمثلة دلالية عامة، دون ربطها بخدمة محددة:

- مصدر البيانات غير متاح.
- بيانات جوهرية أصبحت قديمة أو ناقصة.
- حالة تشغيلية حرجة تمنع الاعتماد على المؤشرات المعروضة.

الاستثناء الحرج لا يرفع لأنه “أحمر”، بل لأنه يغيّر القرار أو سلامة تفسير بقية الصفحة.

---

## 5. مستويات الـKPIs

### 5.1 Primary KPIs

مؤشرات تصف مباشرة الصحة أو الأداء الرئيسي للنشاط/الخدمة، وتستحق مكانًا بارزًا لأنها تساعد المستخدم على قراءة الحالة بسرعة.

### 5.2 Supporting KPIs

مؤشرات تفسر Primary KPI أو تضيف سياقًا لازمًا لفهمه، لكنها ليست دائمًا أهم من المؤشر الأساسي نفسه.

### 5.3 Diagnostic Metrics

مؤشرات تستخدم لفهم السبب أو التحقيق. مكانها الطبيعي غالبًا:

- Drill-down.
- Analytics.
- صفحة تشغيلية/متخصصة.

### القاعدة الذهبية

> **لا KPI بلا وظيفة.**

يجب أن يؤدي كل KPI ظاهر في الـOverview وظيفة واحدة على الأقل من الآتي:

- وصف صحة النشاط أو النظام.
- كشف تغير مهم.
- دعم قرار فعلي.
- كشف حالة تحتاج انتباهًا.

**Phase 1.0 لا تعرّف أي KPI خاصة بـRetail أو Connected أو Native.** كل KPI موجود حاليًا في المشروع يبقى تنفيذًا حاليًا يجب إعادة التحقق من أهليته في المرحلة المتخصصة الخاصة به.

---

## 6. بوابة قبول العناصر داخل الـOverview

قبل إدخال أي عنصر، يقيّم عبر المعايير التالية:

| المعيار | السؤال |
|---|---|
| Decision Value | هل يغير أو يدعم قرارًا فعليًا؟ |
| Business Health | هل يوضح صحة النشاط أو النظام؟ |
| Attention Value | هل يكشف مشكلة أو Risk أو Opportunity أو Anomaly؟ |
| Change Value | هل التغير في هذا العنصر يحمل معنى؟ |
| Actionability | هل يعرف المستخدم ماذا يفعل أو أين يحقق بعد رؤيته؟ |
| Frequency | هل يحتاج رؤية هذه المعلومة بتكرار يناسب Overview؟ |
| Trustworthiness | هل البيانات حديثة وموثوقة بما يكفي؟ |

ليس مطلوبًا تحقيق كل المعايير. المطلوب **مبرر واضح للوجود**.

### Simplicity Test

إذا احتاج الفريق إلى شرح طويل لإقناع نفسه بسبب وجود عنصر في الـOverview، فالأرجح أن مكانه ليس الـOverview.

---

## 7. قواعد الاستبعاد

الأصل استبعاد العناصر التالية من الـOverview الرئيسية ما لم يوجد سبب منتجي استثنائي موثق:

- Vanity Metrics.
- Deep Diagnostic Metrics.
- جداول كبيرة.
- تكرار نفس المعلومة بصيغ متعددة.
- Charts بلا سؤال واضح.
- KPIs بلا وظيفة.
- فلاتر تحليلية معقدة.
- معلومات نادرة الاستخدام.
- تفاصيل تشغيلية مفرطة.
- معلومات مكانها الطبيعي Analytics أو صفحة متخصصة.
- بيانات قديمة أو ناقصة أو غير موثوقة معروضة وكأنها حقيقة كاملة.

> **المزيد من المعلومات لا يعني Dashboard أفضل.**

---

## 8. نموذج الأولوية

بعد اجتياز بوابة القبول، ترتب العناصر دلاليًا كالتالي:

1. **Critical** — يغير سلامة القرار أو يتطلب تدخلاً فوريًا.
2. **Actionable** — يحتاج إجراءً قريبًا وواضحًا.
3. **Primary Health** — يصف صحة النشاط/الخدمة الأساسية.
4. **Significant Change** — تغير ذو معنى يستحق الانتباه.
5. **Supporting Context** — يفسر أو يكمل الصورة.
6. **Informational** — مفيد لكنه لا يغير القرار مباشرة.

الأولوية لا تعتمد على نوع Widget. قد يكون Alert نصي أهم من KPI، وقد تكون حالة موثوقية البيانات أهم من كل الأرقام.

---

## 9. Context & Period Architecture

### 9.1 Global Overview Context

يجب أن تمتلك الـOverview سياقًا زمنيًا واضحًا ومعلنًا. الفترة المختارة تعمل افتراضيًا كـ **Global Overview Context** وتؤثر على كل العناصر التي تعتمد على فترة زمنية، ما لم توجد حالة دلالية مبررة ومعلنة للمستخدم.

### 9.2 أنواع الفترات المدعومة مفاهيميًا

- Preset ranges.
- Custom range.
- Contextual comparison.

أمثلة Presets مثل “اليوم” أو “آخر 7 أيام” أو “هذا الشهر” ليست Contract نهائيًا في هذه المرحلة.

### 9.3 Mixed Time Semantics

يجوز لعنصر أن يمثل **Current State** لا يخضع للفترة، مثل حالة اتصال أو رصيد لحظي، لكن يجب ألا يبدو للمستخدم وكأنه محسوب من نفس الفترة إذا لم يكن كذلك.

لا يجوز لكل Widget أن تختار فترة خفية مختلفة لمجرد سهولة التنفيذ.

---

## 10. هندسة الفلاتر

### Global Filters

فلاتر تؤثر على معظم/كل محتوى الـOverview الذي ينطبق عليه الفلتر.

### Local Filters

فلاتر تخص وحدة أو سؤالًا محددًا فقط، ولا تغير سياق بقية الصفحة.

### قواعد مشتركة

- يجب أن يكون Scope الفلتر واضحًا للمستخدم.
- لا يجوز أن يغير Local Filter معنى KPI خارج الوحدة بصمت.
- لا تُضاف فلاتر خاصة بخدمة إلى النظام المشترك في Phase 1.0.
- تفاصيل مثل Store/Channel/Integration/Source تُقرر فقط في مراحل الخدمات بعد فحص البيانات الحقيقية.

---

## 11. نموذج المقارنات

يجب أن يستطيع النظام التعبير عن:

- Absolute Value.
- Delta / Change.
- Reference-period Comparison.
- Target Comparison.

لكن لا يُفرض أي نوع مقارنة على كل KPI.

### Comparison Meaning Rules

- لا تعرض سهمًا أو نسبة تغير لمجرد توفر قيمتين.
- يجب أن تكون الفترة المرجعية مفهومة وصحيحة للسؤال.
- “الفترة السابقة” ليست دائمًا المرجع الأنسب.
- Target لا يعامل كفترة زمنية.
- لا تفترض أن الارتفاع إيجابي أو أن الانخفاض سلبي.
- Semantics الخاصة بـgood/bad/neutral تُعرّف لاحقًا في Data Visualization System وبحسب Domain metric meaning.

---

## 12. نموذج Drill-down

### Quick Context

تفسير صغير أو سياق فوري يمكن تقديمه بوسيلة خفيفة مثل:

- Inline explanation.
- Tooltip.
- Popover.
- Expansion/Disclosure.

اختيار الوسيلة البصرية نفسها مؤجل لمرحلة المكونات.

### Investigation

التحقيق الحقيقي ينتقل إلى:

- Analytics.
- صفحة متخصصة.
- View أعمق.

لا تستخدم Inline Expansion لبناء Analytics مصغرة داخل الـOverview.

---

## 13. Status / Insight / Alert

### Status

وصف للحالة الحالية لشيء ما. قد يكون طبيعيًا، متوقفًا، قيد الإعداد، قديم البيانات، أو غير ذلك.

### Insight

ملاحظة مشتقة ذات معنى: نمط، تغير، علاقة، أو حدث يستحق أن يعرفه المستخدم. لا يعني وجود Insight أن هناك خطرًا.

### Alert

حالة تتطلب انتباهًا أو إجراءً بسبب Risk أو خطأ أو انحراف أو عائق فعلي.

### Exception-driven Overview

- الحالة الطبيعية هادئة.
- لا تتحول كل ملاحظة إلى Alert.
- لا تستخدم Alert كحاوية عامة لـ“أي رسالة مفيدة”.
- “لا توجد مشكلة” هي **Status/confirmation** وليست Alert نجاح.
- الهدف هو تقليل Alert Fatigue والحفاظ على قيمة الاستثناء الحقيقي.

---

## 14. Meaningful Empty States

يجب التفريق بين:

### True Zero

الصفر قيمة تجارية صحيحة ضمن بيانات موجودة وكافية، مثل نتيجة فعلية تساوي صفرًا.

### No Meaningful Data Yet

لا توجد بيانات كافية لتكوين المؤشر أو المستخدم لم يبدأ النشاط المطلوب بعد.

عند No Meaningful Data Yet لا ينبغي افتراضيًا عرض صف من “0 / 0 / 0 / 0%”. بدلًا من ذلك تدعم الـArchitecture:

- تفسير سبب غياب البيانات.
- Context واضح.
- Next Action حقيقي ومصرح به.
- Onboarding/Progress guidance عند الحاجة.

لا تُنشأ بيانات Demo لإزالة الفراغ.

---

## 15. Data Freshness & Trust

كل عنصر بيانات يجب أن يكون قادرًا مفاهيميًا على حمل Metadata للثقة عندما تكون ذات صلة، مثل:

- Last updated.
- Sync state.
- Partial data.
- Stale data.
- Failed source/section.
- Quality/coverage indicator عندما يكون المجال يدعمه فعلًا.

### Trust Rules

- البيانات القديمة لا تعرض كأنها لحظية.
- البيانات الجزئية لا تعرض كأنها كاملة.
- فشل مصدر واحد لا يجب بالضرورة أن يسقط كامل الـOverview، لكن يجب أن يغير تفسير الوحدات المتأثرة.
- إذا أثرت مشكلة freshness/trust على صحة القرار، يمكنها الصعود إلى Critical Exception.
- `fetchedAt` أو وقت استجابة الواجهة ليس بديلًا تلقائيًا عن وقت تحديث مصدر البيانات نفسه.

هذه النقطة مهمة خصوصًا للمصادر الخارجية، لكنها قاعدة مشتركة وليست مرتبطة بخدمة واحدة.

---

## 16. Responsive Information Architecture

> **نحافظ على معنى المعلومات وأولويتها، لا على نفس الـLayout.**

### قواعد الأولوية

- ترتيب الأولوية الدلالي يبقى ثابتًا بين Desktop وMobile.
- Composition يمكن أن يتغير جذريًا.
- المعلومات الثانوية يمكن أن تنتقل إلى Disclosure على Mobile.
- Critical Exception لا يجوز أن يختفي خلف interaction ثانوي.
- Primary decision signal يجب أن يبقى قابلًا للفهم دون Horizontal scrolling أو الاعتماد على Hover.
- RTL وارتفاع النص العربي وكثافة الأرقام تُعتبر من البداية.

تفاصيل Grid وBreakpoints ومكوّنات الهاتف مؤجلة إلى Phase 2.0.

---

## 17. Personalization Boundaries

الاتجاه المستقبلي:

> **Stable Core + Limited Personalization**

يمكن لاحقًا السماح بأشياء محدودة مثل إخفاء/ترتيب وحدات غير حرجة، لكن:

- لا تُبنى Personalization في Phase 1.0.
- لا يتحول النظام إلى Dashboard Builder.
- المعلومات الحرجة لا تكون قابلة للإخفاء.
- لا يجوز للتخصيص كسر Global Context أو معنى الأولوية.

---

## 18. Service-independent Contract

Retail وConnected Business وNative Business وAdmin/Founder يمكنها مشاركة:

- فلسفة Decision Overview.
- Arabic-first/RTL.
- هرم المعلومات.
- KPI levels.
- قواعد القبول والاستبعاد.
- Priority model.
- Global/Local filter semantics.
- Period/comparison semantics.
- Drill-down model.
- Status/Insight/Alert semantics.
- Empty-state semantics.
- Freshness/trust model.
- Responsive information priority.

لكنها **لا يجب** أن تشترك تلقائيًا في:

- نفس KPIs.
- نفس عدد الوحدات.
- نفس الفلاتر.
- نفس الفترات الافتراضية.
- نفس Charts.
- نفس العمليات أو Actions.
- نفس Thresholds أو Alert rules.

كل خدمة تقرر محتواها بعد فحص Domain وبياناتها الحقيقية في مرحلتها المتخصصة.

---

## 19. Visualization Neutrality

Phase 1.0 لا تفرض Line/Bar/Pie أو أي تركيبة ثابتة.

> **Question → Data → Representation**

يمكن أن تكون أفضل Representation:

- KPI.
- Status.
- Text insight.
- Sparkline/Trend.
- Progress.
- Table صغيرة عند الحاجة.
- Chart.
- أي تمثيل مناسب للسؤال والبيانات.

قواعد اختيار Charts والترميز البصري للاتجاهات والمقارنات تُعرّف في **Phase 3.0 — Data Visualization System**.

---

## 20. تدقيق واقع المشروع الحالي

تمت مراجعة آخر `main` عند بداية Phase 1.0، وكان HEAD:

`f4bd0800a8238f272f8903323defb7c1647e72e3`

### Surfaces / Files التي تم فحصها مباشرة

| المسار | ما كشفه الفحص | علاقته بالمرحلة |
|---|---|---|
| `app/dashboard/page.tsx` | `/dashboard` أصبح Redirect إلى `/account`، ولا توجد Dashboard عامة مستقلة هنا | يمنع اعتبار هذا المسار المرجع المشترك |
| `src/lib/v2/navigation.ts` | يفصل “نظرة عامة” عن “التقارير والتحليلات”، مع Navigation عربية وMobile variant | متوافق مع فصل Overview/Analytics ومع Arabic-first |
| `app/workspace/page.tsx` | ينفذ حاليًا Connected وNative Overview مختلفة حسب `operating_mode` | يؤكد استقلال الخدمات، لكنه يحتوي Hierarchies/KPIs خاصة يجب إعادة تقييمها لاحقًا |
| `app/workspace/analytics/page.tsx` | Analytics حقيقية بفترة وتصدير وتقارير وجداول ومقارنات | يؤكد وجود Surface منفصلة للتحليل، لكنه يحتوي سلوك مقارنة/اتجاه يحتاج مواءمة لاحقة |
| `src/lib/analytics.ts` | Data contract حالي لتحليلات Business وفيه `generated_at` ومقارنة بالفترة السابقة | مصدر حقيقي قائم؛ لا يتم تغييره أو تعميمه كعقد Dashboard مشترك في 1.0 |
| `src/lib/services/experience.ts` | Connected يملك `freshness_seconds`, `quality_score`, `success_rate`, `open_issues`, `last_success_at` وفشل Sections معزول | أساس واقعي قوي لمتطلب Freshness/Trust دون اختراع حقول جديدة |
| `app/retail/workspace/page.tsx` | Retail Overview قائمة حاليًا على “اليوم” ومؤشرات/Attention/Activity خاصة بالخدمة | تبقى تنفيذًا قائمًا، لا تصبح قاعدة مشتركة |
| `app/retail/workspace/reports/page.tsx` | Reports منفصلة بفترة واتجاه ومقارنة | يدعم فصل Overview عن Analytics/Reports |
| `src/lib/retail/server/analytics/queries.ts` | Retail Analytics تأتي من RPC حقيقي وتتحقق من Workspace access | يثبت وجود مصدر بيانات حقيقي؛ لا نحتاج Fake Contract |
| `app/api/mobile/v1/dashboard/route.ts` | Endpoint Mobile قديم/قائم يجمع Summary/Alerts/7-day series/30-day values | يكشف تعارضات في scope الزمني وفي semantics للـAlerts؛ لا يُعاد تصميمه في 1.0 |
| `app/admin/founder/page.tsx` | Founder surface لديها metrics وتنبيهات وأولوية تشغيلية خاصة | مثال على لوحة داخلية مستقبلية يجب أن تتبع القواعد المشتركة دون نسخ محتوى خدمات العملاء |
| `docs/MADAR_UX_ARCHITECTURE.md` | يثبت أن العربية وRTL الحالة الأساسية وأن Connected وNative لهما IA مختلفة | متوافق مع هذه الوثيقة |
| `docs/MADAR_SERVICES_EXPERIENCE_5.md` | يحتوي Hierarchies خدمة محددة من مرحلة UX سابقة | يُعامل كتاريخ تنفيذ/قرار خدمة سابق، وليس Dashboard common contract جديد |

---

## 21. التعارضات المكتشفة في التنفيذ الحالي

### C1 — Automatic comparison semantics في Business Analytics

`app/workspace/analytics/page.tsx` يعلن مقارنة تلقائية بالفترة السابقة ويعرض بعض التغيرات بصيغة مرتبطة مباشرة بإشارة الرقم. كما أن لون التغير في الصفحة يربط السالب بالأحمر والموجب بالأخضر.

**التعارض:** Phase 1.0 تقرر أن المقارنة يجب أن تكون ذات معنى، وأن الارتفاع/الانخفاض لا يحملان حكمًا إيجابيًا/سلبيًا بصورة عامة.

**القرار:** لا تعديل في 1.0. يُعالج في Phase 3.0 و/أو مرحلة Analytics المناسبة بعد تعريف metric semantics.

### C2 — Mixed time scopes في Mobile Dashboard endpoint

`app/api/mobile/v1/dashboard/route.ts` يجمع في Response واحدة قيم 30 يومًا، `todayRevenue`، و`dailySeries` لسبعة أيام دون Global Overview Context واحدة صريحة.

**التعارض:** النظام المشترك الجديد يرفض اختلاف الفترات بصمت داخل Overview واحدة.

**القرار:** لا تغيير في endpoint الآن. يعاد تقييمه عند تنفيذ Dashboard/Mobile contract لاحقًا.

### C3 — “Healthy state” داخل Alerts

نفس Mobile endpoint يضيف عنصرًا باسم “لا توجد أمور حرجة الآن” داخل `alerts` عند غياب التنبيهات.

**التعارض:** هذا Status/confirmation وليس Alert.

**القرار:** يوثق التعارض ويؤجل إصلاح العقد إلى المرحلة التي تمس هذا API أو التطبيق المستهلك له.

### C4 — Current service dashboards تحتوي KPI hierarchies ثابتة مسبقًا

Retail وNative وConnected لديها بالفعل مجموعات مؤشرات وترتيب تم تصميمها في مراحل UX سابقة.

**التعارض:** Phase 1.0 لا تعتمد أي KPI خدمة كجزء من النظام المشترك، ولا تفترض أن الاختيارات السابقة نهائية.

**القرار:** لا حذف ولا إعادة كتابة الآن. كل مجموعة مؤشرات تُعاد مراجعتها أمام بوابة القبول في المرحلة المتخصصة للخدمة.

### C5 — Freshness/Trust موجودة في Domain أكثر مما يظهر في Overview الحالية

Connected domain يملك حقول freshness/quality/health وفشل sections، بينما الـOverview الحالية لا تعرض كل سياق الثقة مع كل رقم متأثر.

**التعارض:** عند كون freshness مؤثرة في القرار، يجب ألا يظهر الرقم كحقيقة كاملة بلا سياق.

**القرار:** يؤجل تطبيق العرض والسلوك إلى مرحلة Connected المتخصصة، مع الحفاظ على حقول المصدر الحقيقية الموجودة.

### C6 — Historical service documentation vs new common architecture

`docs/MADAR_SERVICES_EXPERIENCE_5.md` يذكر Hierarchies وPrimary metrics لخدمات بعينها.

**القرار:** لا يتم تعديل المستند التاريخي. هذه الوثيقة الجديدة تسود فقط على **القواعد المشتركة**، بينما محتوى كل خدمة يبقى خاضعًا لإعادة التحقق في مرحلتها.

---

## 22. القرارات المؤجلة عمدًا

### Phase 2.0 — Dashboard Design System

- المكوّنات البصرية المشتركة.
- Card/Panel/KPI/Alert/Status/Empty-state component contracts.
- Density/spacing/composition.
- Responsive component behavior وBreakpoints التفصيلية.
- Interaction patterns النهائية لـTooltip/Popover/Disclosure.

### Phase 3.0 — Data Visualization System

- اختيار نوع Chart حسب السؤال والبيانات.
- اتجاهات good/bad/neutral.
- ألوان المقارنات والدلالات البصرية.
- Axes/legends/tooltips في RTL.
- Sparklines/trends/benchmarks/targets.
- Missing/partial data داخل الرسوم.

### Phase 4.0

- أي نظام مشترك لاحق تحدده خارطة المهمة للـOverview بعد المرحلتين 2 و3.
- لا تُسبق قراراتها هنا ولا تُفترض تفاصيلها.

### Retail specialized phase

- اختيار Primary/Supporting/Diagnostic KPIs الحقيقية.
- الفترة الافتراضية المناسبة للتشغيل اليومي.
- الفلاتر الخاصة بـRetail.
- مراجعة الأرقام الحالية وفق Decision Value وMeaningful Empty State.
- Drill-down بين Overview وReports/Inventory/Sales وغيرها.

### Connected Business specialized phase

- Business State الخاصة بالربط.
- Freshness/quality/partial data thresholds والمعنى المنتجـي لها.
- ما الذي يُرفع كCritical Exception.
- فلاتر Integration/Source إن أثبتت البيانات الحاجة.
- العلاقة بين Overview والبيانات الواصلة والتحليلات.

### Native Business specialized phase

- KPIs حسب vertical والوحدات المفعّلة، دون نسخ Retail.
- الفلاتر والفترات المناسبة لكل قطاع.
- التعامل مع setup/in-progress/no-data بحسب الحالة الحقيقية.
- Drill-down إلى Modules التشغيلية الفعلية.

### Admin / Founder future dashboards

- Platform health / operations / revenue / subscription semantics.
- تعريف ما هو Status وما هو Alert وما هو Decision-critical داخل سياق الإدارة.
- عدم إعادة استخدام KPIs خدمات العملاء كقالب للوحة الإدارة.

---

## 23. Acceptance Checklist — Phase 1.0

- [x] Overview معرّفة كـDecision Overview.
- [x] Arabic-first وRTL هما المرجع الأساسي.
- [x] Overview وAnalytics منفصلتان بوضوح.
- [x] Information hierarchy دلالية وليست Layout ثابتًا.
- [x] KPI levels: Primary / Supporting / Diagnostic.
- [x] لا توجد KPI خدمة جديدة مخترعة.
- [x] قواعد قبول واستبعاد العناصر موثقة.
- [x] Priority model موثق.
- [x] Global/Local filters معرفة مفاهيميًا.
- [x] Global period context وCustom/Presets/Contextual comparison معرفة.
- [x] المقارنة غير مفروضة ولا تحمل حكم good/bad تلقائيًا.
- [x] Drill-down hybrid موثق.
- [x] Status / Insight / Alert مفصولة دلاليًا.
- [x] Critical Exception يمكنها تجاوز الترتيب الطبيعي.
- [x] Meaningful Empty State تفرق بين true zero وno meaningful data.
- [x] Data freshness/trust موثقة كمتطلب معماري.
- [x] Responsive يحافظ على أولوية المعنى لا Layout.
- [x] Personalization محدودة ومؤجلة.
- [x] القواعد مشتركة دون إجبار Retail/Connected/Native على نفس المحتوى.
- [x] لا Chart type مفروض.
- [x] تعارضات التنفيذ الحالي موثقة بدل تعديلها خارج النطاق.
- [x] لا Backend/Data/Schema/UI implementation أو redesign أُدخل في Phase 1.0.

---

## 24. Closure Decision

**Phase 1.0 مكتملة معماريًا عند اعتماد هذه الوثيقة كمرجع للمراحل التالية.**

التغيير المقصود في هذه المرحلة Documentation-only. لا توجد Migration أو API جديدة أو Component جديدة أو Dashboard خدمة جديدة، ولا يبدأ Phase 2.0 تلقائيًا.
