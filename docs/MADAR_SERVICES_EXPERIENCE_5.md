# MADAR Services Experience 5.0

دستور تنفيذي للواجهات الداخلية لخدمات مَدار. هذه المرحلة تنظّم التجربة فوق Global Shell وDesign System 2.0، ولا تغيّر منطق الدفع أو الاشتراكات أو ORBY Core أو مخططات Supabase.

## Service UX principles

1. Shell واحدة وهوية واحدة، مع محتوى مختلف حسب مصدر الحقيقة.
2. Dashboard تجيب: ماذا يحدث، ما الذي يحتاج انتباهًا، وما الإجراء الأقرب.
3. لا بيانات Demo ولا مؤشرات لوحدة غير مفعّلة.
4. الحالة والصلاحية تقودان الإجراء؛ المشاهد لا يرى نماذج كتابة.
5. فشل قسم لا يسقط Shell، والحالات الفارغة تقود إلى خطوة حقيقية فقط.
6. ORBY واحد للحساب، وسياقه يتبع Organization والخدمة الحالية آليًا.

## Audit inventory

| Surface | التصنيف | القرار |
|---|---|---|
| Retail domain/RPCs/ledgers | KEEP | المنطق التشغيلي حقيقي ومعزول؛ لا تغيير له |
| Retail Dashboard القديمة | REFACTOR | خفض 8 بطاقات متساوية إلى 4 مؤشرات أولية + ملخص ثانوي |
| Retail legacy CSS | REFACTOR | تحويل محددات الواجهة القديمة إلى Semantic Tokens دون Shell ثانية |
| Retail desktop tables | REFACTOR | Mobile list عبر `data-mobile=list` و`data-label` |
| Connected integration engine | KEEP | الاتصالات، الصحة، المزامنة، المعاينات وUDM هي مصدر الحقيقة |
| Connected + Native dashboard المشتركة | REPLACE | Dashboard منفصلة منطقيًا حسب `operating_mode` |
| صفحات Native اليدوية داخل Connected nav | MOVE | أُخرجت من IA؛ البيانات الخارجية في `/workspace/data` للقراءة فقط |
| Native module navigation | REFACTOR | لا يظهر إلا `organization_modules.status=active` |
| ORBY routes | KEEP | مدخل سياقي إلى ORBY نفسه، بلا مساعد جديد |

## Retail IA

| المجموعة | الوجهات |
|---|---|
| نظرة عامة | الرئيسية |
| البيع والمخزون | المبيعات، المنتجات، المخزون |
| التوريد والعلاقات | المشتريات، الموردون، العملاء |
| المال والذمم | المصروفات، الديون، الصندوق |
| الذكاء والتقارير | التقارير، ORBY |
| الإدارة | إعدادات Retail |

### Retail Dashboard hierarchy

- Primary: مبيعات اليوم، الربح التقديري، الصندوق، المصروفات.
- Secondary: ديون العملاء، مستحقات الموردين، قيمة المخزون، متوسط الفاتورة.
- Attention: المخزون الحرج.
- Performance: أفضل المنتجات.
- Activity: آخر العمليات.
- Quick actions: بيع جديد، إضافة منتج، تسجيل مصروف، تسوية مخزون.

تظهر Quick actions والنماذج لمن يملك صلاحية كتابة فقط. المستخدم `VIEWER` يرى السجلات دون أزرار ستفشل. Empty state الأولى تقول بوضوح: أضف منتجًا ثم ابدأ البيع.

## Connected IA

| المجموعة | الوجهات |
|---|---|
| نظرة عامة | مركز القيادة، الربط والمزامنة، ORBY |
| البيانات | البيانات الواصلة `/workspace/data` |
| المراقبة | التحليلات عند تفعيلها، سجل النشاط |
| الإدارة | الإعدادات والفريق حسب الوحدات المفعلة |

### Connected Dashboard hierarchy

1. حالة الاتصال.
2. آخر مزامنة ناجحة.
3. عدد السجلات وأنواع البيانات الواصلة.
4. التنبيهات المفتوحة.
5. الاتصالات وصحتها.
6. آخر عمليات المزامنة.

`/workspace/data` يقرأ `integration_udm_records` فقط، ويعرض freshness والجودة والحالة ومعرّف المصدر. لا يكتب في `business_*`. روابط Connected العميقة إلى منتجات/مبيعات/مخزون Native تُحوّل إلى البيانات الواصلة، كما تمنع Server Actions الكتابة اليدوية إذا كان `source_of_truth` خارجيًا.

### Connection and Sync UX

- الحالات: غير مكتمل، جارٍ الاختبار، متصل، متوقف، خطأ، جارٍ المزامنة، اكتملت، فشلت.
- لا يعتمد العرض على اللون وحده؛ كل StatusBadge يحمل نصًا.
- المعلومات التقنية التفصيلية لمعاينة mapping/counts داخل disclosure، لا تُعرض كـJSON أولي.
- انقطاع النظام الخارجي لا يسقط Workspace؛ تظهر الحالة والتنبيه ويبقى ORBY والتنقل متاحين.

## Native IA

Native تعكس `MADAR_NATIVE` والـvertical الحقيقي فقط:

- Overview وORBY وإعدادات النشاط متاحة دائمًا.
- التشغيل يظهر فقط للوحدات المسجلة Active في `organization_modules`.
- التقارير والمهام والربط والصلاحيات لا تظهر دون module فعلي.
- رابط عميق لوحدة غير مفعلة يعيد إلى Overview مع تفسير، بدل صفحة وهمية.

### Native Dashboard hierarchy

- مؤشرات الوحدة المفعلة فقط، بحد أقصى أربعة.
- حالة الإعداد إذا لم تكن `ready`.
- المهام الحقيقية فقط عند تفعيل tasks.
- آخر أحداث التشغيل الفعلية.
- Quick actions خاصة بالقطاع والوحدات المفعلة؛ لا تُنسخ Retail IA على الفندق أو المطعم.

## Workspace Shell and switching

- `MadarGlobalShell` يبقى Shell الأعلى.
- `EnterpriseWorkspaceShell` و`RetailWorkspaceShell` يضيفان هوية الخدمة والسياق فقط.
- Service switcher خادمي ويعرض المساحات المملوكة/المصرح بها.
- الانتقال بين خدمات لا يحتفظ بمسار داخلي غير صالح؛ الوجهة هي Overview الخاصة بالخدمة.
- Deep link وrefresh يعيدان حل session، entitlement، العضوية و`can_view` قبل عرض المحتوى.

## ORBY context behavior

| المدخل | السياق |
|---|---|
| Retail | `organization=<platformOrganizationId>&service=MADAR_RETAIL` |
| Connected | Organization الحالية + `CONNECT_EXISTING` |
| Native | Organization الحالية + `BUILD_ON_MADAR` |

السياق يأتي من بوابة Workspace المحمية، لا من اختيار Mode يدوي ولا من مساعد منفصل.

## Empty, loading and error states

- Empty states تصف المجال: أول منتج/أول بيع/أول اتصال/أول مزامنة، لا «لا توجد بيانات» العامة.
- Route loading يبقي Shell ويستخدم Skeletons الموجودة.
- Section fetch في Connected معزول؛ يعرض Warning ويترك بقية Dashboard.
- Page error لا يسرّب Stack trace ولا يزيل التنقل العالمي.
- Suspended/expired تبقي البيانات وتحوّل الإجراء إلى الاشتراك بدل فتح عملية ستفشل.

## Responsive and accessibility

- 1440/1024: Workspace navigation ثابتة أو قابلة للطي، ومحتوى بعمودين عند الحاجة.
- 768: لا Sidebar مزدحمة؛ Bottom navigation وSheet من Global Shell.
- 390/360: 4 وجهات أولية، Quick actions عمودية، والجدول يتحول إلى list ذات labels.
- Focus واضح، headings دلالية، status بنص، touch target من DS2، وRTL هو الأصل.
- الحركة تستخدم Motion Tokens وتحترم `prefers-reduced-motion`.

## Mobile App Translation Notes

### MADAR Retail App

- Primary navigation candidates: الرئيسية، المبيعات، المنتجات، المخزون، المزيد.
- Primary action: بيع جديد؛ يبقى thumb-friendly ومن Home والمبيعات.
- Core screens: Overview، Sale composer، Products، Inventory، Expenses، Customers، Reports.
- ORBY يبقى floating/global وضمن More، لا Tab خامس يزاحم التشغيل اليومي.

### MADAR Business App

- يضم Connected وNative تحت حساب واحد مع Service/Workspace switcher.
- Connected primary: الحالة، الربط/المزامنة، البيانات، ORBY، المزيد.
- Native primary يتغير حسب vertical: تشغيل الفندق/المطعم/المبيعات بدل قائمة ثابتة.
- Dashboard contract قابلة للترجمة إلى native cards/lists؛ لا WebView ولا 12 عمودًا مضغوطًا.

## Production truth and known gaps

- Retail يملك domain كاملًا واشتراكًا فعالًا، لكن مساحة Production الحالية فارغة تشغيليًا؛ Empty states هي الحقيقة المقصودة.
- Native يملك اشتراكًا فعالًا ووحدة فندق فعلية، لكن البيانات التشغيلية محدودة وإحدى المساحات ما زالت `in_progress`.
- Connected engine موجود، لكن لا يوجد حاليًا اشتراك/Workspace/Connection نشط في Production؛ لا نضيف بيانات لاختبار شكلي.
- بعض الصفحات الداخلية القديمة في Native ما زالت تحتاج Migration بصرية تدريجية كاملة إلى DS2؛ IA والحماية ومصدر الحقيقة مثبتة في هذه المرحلة.

## Deferred to ORBY Experience 6.0

- إعادة بناء Chat، composer، sources/tool cards، memory controls، voice UI والسلوك الكامل للمحادثة.
- لا تغيير في ORBY Core أو أدواته أو صلاحيات البيانات في هذه المرحلة.
