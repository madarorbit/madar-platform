# MADAR Design System 2.0

الحالة: **مرجع تنفيذي معتمد للمرحلة الثانية**  
النطاق: الويب، مع قابلية نقل المبادئ والرموز لاحقًا إلى MADAR Retail وMADAR Business.  
المرجع البنيوي السابق: [`MADAR_UX_ARCHITECTURE.md`](./MADAR_UX_ARCHITECTURE.md).

## 1. مبادئ المنتج

1. **Simple first, powerful underneath:** الإجراء الأساسي ظاهر، والتفاصيل المتقدمة لا تزاحمه.
2. **الوضوح قبل الزينة:** التسلسل والمحتوى والحالة أهم من المؤثر.
3. **دلالي قبل الخام:** المكوّن يطلب `surface` أو `danger` ولا يختار أبيض أو أحمر مباشرة.
4. **مَدار منتج واحد:** Account وWorkspace وORBY والمتجر يشتركون في الرموز والسلوك.
5. **العربية وRTL هما الحالة الأساسية:** مع عزل واعٍ للأرقام والأكواد والروابط الإنجليزية.
6. **الوصول سلوك افتراضي:** لوحة المفاتيح وfocus والـlabels والتباين ليست تحسينات لاحقة.
7. **الحركة تشرح الحالة:** لا animation استعراضية، ويُحترم `prefers-reduced-motion`.
8. **الترحيل تدريجي وآمن:** لا يُستبدل Legacy مشترك قبل معرفة كل المستهلكين.

## 2. نتيجة تدقيق الواجهة

تم مسح الصفحات والمكوّنات وملفات CSS الفعلية. ظهرت الأنماط البنيوية التالية:

- 572 موضعًا يعتمد على ألوان أو شفافية مباشرة.
- 418 موضعًا يستخدم radius أو shadow أو spacing غير منضبط.
- 389 استخدامًا مباشرًا لـbutton/input/select/dialog/table بدل API مشتركة.
- Theme قديم dark-first مع إصلاحات Light واسعة تعتمد على مطابقة أسماء Tailwind.
- تكرار EmptyState وBreadcrumbs وبعض الـdrawers والـmenus.
- خلط custom SVG مع `lucide-react` وemoji في بعض الأسطح القديمة.
- Cards كثيرة بظلال وgradients لا تعكس elevation حقيقيًا.
- جداول Desktop بلا استراتيجية متسقة على الهاتف.

### Inventory

| التصنيف | الموجود | القرار |
|---|---|---|
| KEEP | `ThemeProvider`، `Icons`، `PageShell`، منطق Cart وORBY وRetail | إبقاء المنطق، وتغيير العرض عبر الرموز المشتركة |
| REFACTOR | `Enterprise.tsx`، Shells، Service cards، Auth، ORBY shell | تحولت إلى API دلالية وتبقى نقطة الترحيل الأساسية |
| REPLACE | EmptyState/Breadcrumbs المكررة، raw menus/drawers، `window.confirm` | استخدام المكوّنات المشتركة الجديدة |
| LEGACY | markup الخام وملفات bridge في المسارات غير المرجعية | لا تُحذف الآن؛ تُرحّل route-by-route ثم يُزال bridge |

## 3. ملفات النظام

- `app/design-tokens.css`: القيم الخام والـsemantic tokens فقط.
- `app/design-system.css`: primitives والمكوّنات العامة.
- `app/design-system-2-surfaces.css`: الأسطح المرجعية وقواعد responsive وسياق Shell.
- `app/theme-system.css`: Theme controls وbridge مؤقت للمسارات القديمة.
- `components/ui/Enterprise.tsx`: API المكوّنات server-safe.
- `components/ui/EnterpriseClient.tsx`: Menu وSheet وDialog وToast والسلوك التفاعلي.
- `components/ui/Icons.tsx`: مجموعة الأيقونات الرسمية الحالية.
- `src/lib/format.ts`: تنسيق العملة والتاريخ العام.

ترتيب الاستيراد مهم: tokens ثم components ثم compatibility ثم theme ثم ملفات Legacy ثم `design-system-2-surfaces.css` في النهاية.

## 4. Design tokens

### Color roles

| المجموعة | Tokens الأساسية | الاستخدام |
|---|---|---|
| الخلفية | `--md-background`, `--md-background-subtle` | Canvas وطبقة Shell |
| الأسطح | `--md-surface`, `--md-surface-raised`, `--md-surface-muted`, `--md-surface-sunken`, `--md-surface-overlay` | Cards، panels، code، overlays |
| النص | `--md-text-primary`, `--md-text-secondary`, `--md-text-muted`, `--md-text-disabled`, `--md-text-inverse` | التسلسل القرائي |
| الحدود | `--md-border-subtle`, `--md-border-default`, `--md-border-strong` | الفصل والتفاعل |
| الهوية | `--md-accent`, `--md-accent-hover`, `--md-accent-subtle`, `--md-mint`, `--md-mint-subtle` | CTA والهوية دون إغراق السطح |
| الحالات | `--md-success`, `--md-warning`, `--md-danger`, `--md-info` مع `-subtle` و`-text` | Status وfeedback |
| الوصول | `--md-focus-ring` | focus مرئي ومتباين |
| الرسوم | `--md-chart-grid`, `--md-chart-label`, `--md-chart-1..3`, `--md-chart-positive/negative` | charts في Light/Dark |

قاعدة: لا يُستخدم `white`, `black`, `gray-900` أو hex في Component جديد. الاستثناء الوحيد هو أصل brand لا يمكن تمثيله دلاليًا، ويُوثّق.

### Typography

| Role | Token/Class | الغرض |
|---|---|---|
| Display | `--md-type-display` / `.md-type-display` | Hero واحد فقط |
| H1 | `--md-type-h1` / `.md-type-h1` | عنوان route |
| H2 | `--md-type-h2` / `.md-type-h2` | Section كبير |
| H3/H4 | `--md-type-h3/4` | أقسام داخلية |
| Body Large | `--md-type-body-lg` | وصف تمهيدي |
| Body | `--md-type-body` | النص القياسي |
| Body Small | `--md-type-body-sm` | بيانات مساندة |
| Label | `--md-type-label` | controls وform labels |
| Caption | `--md-type-caption` | metadata فقط |
| Numeric/Stat | `--md-type-stat` / `.md-type-stat` | أرقام ذات `tabular-nums` |

الخط الحالي لم يُغيّر قسرًا؛ stack عربي مناسب مع Segoe UI/Noto Sans Arabic fallback. تستخدم العناوين line-height أقصر والنصوص العربية `--md-leading-body: 1.75`. استخدم `.md-ltr-data` للأكواد والمعرفات والأرقام التقنية، لا تعكسها مع RTL.

### Spacing, radius, sizing, elevation

- المسافات: `0, 4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 80px` عبر `--md-space-*`.
- Radius: `sm=8`, `md=12`, `lg=16`, `xl=24`, `pill`.
- Touch target: `--md-size-touch = 44px`.
- Controls: 36 / 44 / 52px.
- Shadows: `shadow-1` فصل خفيف، `shadow-2` menu/sheet، `shadow-3` modal فقط.
- Card عادية بلا shadow. لا elevation بلا سبب مكاني.

### Motion

- `fast=120ms`: press/hover/focus.
- `normal=200ms`: menu، tab، sheet.
- `slow=320ms`: theme surface transition فقط.
- easing: `--md-ease-standard` و`--md-ease-exit`.
- reduced motion يلغي النقل والـshimmer الزائد ويحافظ على feedback الفوري.

### Z-index

`base 0 → sticky 30 → header 50 → popover 70 → modal 90 → toast 100`.

## 5. Theme architecture

الخيارات: `light | dark | system`. يحفظ `ThemeProvider` الاختيار في local preference، ويحسب System عند الحاجة. سكربت pre-paint في root layout يطبّق `data-theme` قبل hydration ويحدث `theme-color` لتقليل flash.

- الـComponents لا تحتوي `dark:` مكررًا؛ نفس token يتغير حسب `:root[data-theme]`.
- ThemePreferences هو المكان الكامل للاختيار، وThemeToggle quick action مختصر.
- Charts لها palette دلالية مستقلة.
- `theme-system.css` يحتوي bridge محدودًا للمسارات غير المهاجرة. وجوده مؤقت وليس API.

## 6. Component APIs

### Layout

`Container`, `PageContainer`, `Page`, `PageHeader`, `Section`, `ContentArea`, `Stack`, `Grid`, `Surface`, `Panel`, `Card`.

- استخدم `Panel` لوحدة محتوى كبيرة ذات حد واضح.
- استخدم `Card` لكيان مستقل قابل للتكرار.
- استخدم Surface بلا Card عندما يكفي الفصل بالمسافة أو border.

### Actions

`Button`, `ButtonLink`, `IconButton`, `IconLink`.

Variants: primary, secondary, outline, ghost, danger, link.  
Sizes: sm, md, lg.  
`loading` يمنع الضغط ويعرض spinner مع `aria-busy`.  
كل IconButton يتطلب `label` ويعرض tooltip native حاليًا.

### Forms

`Field`, `Input`, `SearchInput`, `Select`, `Textarea`.

الحالات: default, hover, focus, invalid, disabled, readonly. رسالة Field تبقى قرب الحقل؛ لا Toast لخطأ validation. Combobox المتقدم لم يُضف لأن النظام الحالي لا يبرر dependency جديدة؛ يُبنى فوق primitive accessible عند أول استخدام فعلي.

### Data and status

`Badge`, `StatusBadge`, `Stat`, `Table`, `TableWrap`, `Tabs`, `Pagination`.

Status vocabulary: active, pending, approved, rejected, expired, suspended, draft, published, error. كل StatusBadge يحتوي نصًا ونقطة، فلا يعتمد على اللون وحده.

Table strategy:

- desktop: headers/actions/hover مع scroll آمن.
- mobile data قصير: `mobile="list"` و`data-label` لكل cell.
- data معقد: route يقرر cards أو expandable rows؛ لا ضغط 12 عمودًا.

### State and feedback

- `EmptyState`: title + description + action مصرح به.
- `ErrorState`: section أو page.
- `Skeleton` و`SkeletonGroup`: هيكل يطابق المحتوى المتوقع.
- `Notice`: feedback ثابت داخل السياق.
- `Toast`: نجاح/معلومة لحظية قصيرة.
- `Modal`: native dialog مع Escape وfocus trap من المتصفح.
- `Sheet`: mobile/context flow مع trap يدوي وإعادة focus ومنع scroll.
- `ConfirmDialog`: إجراء مركز؛ destructive يتضمن معنى الخطر وليس لونًا فقط.
- `Menu`: aria-haspopup/expanded، إغلاق خارجي وEscape وإرجاع focus.

### Domain components

- `ServiceCards`: صورة، اسم، وصف، StatusBadge، plan/price/end date، CTA بحسب الحالة، وORBY contextual عند Active.
- `Avatar`: sm/md/lg، صورة crop عند توفرها، وsilhouette بشري افتراضي.
- Cart: IconLink صغير + badge حتى 99+، نفس موضعه في Public وAccount وWorkspace.
- ORBY: shell، context bar، message، markdown/code، citations، composer، tool status، Plus badge، floating face.

## 7. Icons

الاستراتيجية الرسمية هي `components/ui/Icons.tsx`: SVG outline موحد (`stroke 1.8`, round caps/joins) وحجم يرث السياق. لا emoji كأيقونة UI. أيقونة منفردة غير مألوفة يجب أن تحمل label؛ والإجراء الخطر لا يستخدم icon بلا نص في confirmation.

`lucide-react` الموجود في مسارين قديمين فقط ضمن خطة الترحيل؛ لا imports جديدة منه. عند اكتمال ترحيلهما تُراجع إمكانية حذفه من dependencies.

## 8. Formatting

- العملة العامة: `formatCurrency(amount, currency, locale)`؛ العرض الافتراضي عربي ولا يغيّر Currency Engine.
- التاريخ: `formatDate`.
- التاريخ والوقت: `formatDateTime` مع `Asia/Aden` افتراضيًا للمنصة العامة.
- Retail يحتفظ حاليًا بـhelpers المجال لأنها تراعي timezone/currency الخاصة بالـworkspace.
- Relative time لا يستخدم بدل timestamp في أحداث التدقيق أو المدفوعات.

## 9. Responsive behavior

العقد:

- Small mobile: 320–389px (QA مرجعي 360).
- Large mobile: 390–639px (QA مرجعي 390).
- Tablet: 640–1023px (QA مرجعي 768).
- Laptop: 1024–1279px (QA مرجعي 1024).
- Desktop: 1280px+ (QA مرجعي 1440).

قواعد:

- Global/Workspace sidebar تختفي تحت 1024 وتتحول إلى Sheet + bottom navigation المعتمدة.
- ORBY sidebar تتحول إلى Sheet؛ composer يبقى مثبتًا ضمن grid ولا يحجب الرسائل.
- Home hero يصبح عمودًا واحدًا على Tablet؛ CTA والـservice grid تصبحان عمودًا واحدًا على الهاتف.
- الجداول لا تعتمد على flex-wrap؛ يختار كل route scroll/list/cards.
- safe-area يضاف لمنطقة composer والتنقل السفلي حيث يلزم.

## 10. Accessibility baseline

- Skip link و`main#main-content` في shells المرجعية.
- focus ring مركزي واضح في Light/Dark.
- Icon controls لها `aria-label` وtitle.
- Menu/Sheet/Dialog لها Escape، focus management، وfocus return.
- حالات status والأخطاء لها نص و`role` مناسب.
- `aria-live` للـToast وحالة النسخ في ORBY.
- touch targets ≥44px للإجراءات الأساسية.
- heading order يبدأ بـH1 لكل route ثم sections.
- `prefers-reduced-motion` محترم.
- Back/chevrons تحمل `.md-icon-directional`; لا تُعكس الأرقام والأكواد.
- minimum viewport 320px مع zoom دون تعطيل.

## 11. ORBY visual foundation

ORBY واحد للحساب. الـShell يعرض Context الحالي آليًا، ولا يطلب mode لكل رسالة. المكوّنات المعتمدة: header، sidebar، assistant/user messages، markdown، code block، citations، errors، loading/status، composer، Plus badge، floating face.

الـcomposer يحمل `data-voice-ready="true"` ومساحة tools مستقلة، لكنه **لا يعرض زر ميكروفون وهميًا** قبل وجود logic فعلي. Voice سيكون input/output modality لنفس ORBY. لا AR/VR components في هذه المرحلة.

## 12. Reference surfaces migrated

- Global shell وTop Bar وmenus وCart/Avatar.
- Public Home والمنتجات المرجعية وCTA.
- Account shell والصفحة الرئيسية وبطاقات الخدمات.
- Login/Register primitives.
- MADAR Retail overview كمرجع Workspace.
- Enterprise/Native Workspace shell foundation.
- ORBY shell/chat/sidebar/floating face.
- Admin-only catalog: `/admin/design-system` (محمي عبر `requireAdmin`).

## 13. Migration strategy

1. أي Route جديد يستخدم `Enterprise.tsx` ولا يضيف primitive محليًا.
2. ترحيل كل route قديم يبدأ بإزالة اللون/spacing الخام ثم استبدال states/actions.
3. بعد ترحيل مجموعة routes، يُحذف selector المقابل من Legacy bridge.
4. لا تُنشأ أسماء `ButtonNew` أو `CardV2`; API الحالية هي الهدف النهائي.
5. قبل حذف Component قديم: `rg` للمراجع والـdynamic imports والـcallbacks.
6. لا تُزال ملفات `enterprise-compatibility.css` أو `ux-*` دفعة واحدة؛ تقلّص بحسب نسبة الترحيل.

### Priorities after phase 2

1. جداول ونماذج Retail التفصيلية.
2. Store/cart/checkout/library surfaces.
3. Account sections القديمة ذات Tailwind الخام.
4. Connected/Native domain pages عند اكتمال محتواها الحقيقي.
5. Admin surfaces؛ الـShell فقط يشارك الأساس حاليًا.
6. إزالة آخر imports من icon library الثانوية ثم مراجعة dependency.

## 14. Do / Don't

| Do | Don't |
|---|---|
| استخدم semantic token | لا تختَر hex داخل Component |
| استخدم Button/Field/StatusBadge | لا تنشئ CSS لزر محلي لنفس السلوك |
| افصل Global/Workspace/Local navigation | لا تستخدم Tabs كتنقل عالمي |
| أعط Empty State إجراءً مصرحًا | لا تكتب «لا توجد بيانات» فقط |
| استخدم Sheet لتدفق mobile قصير | لا تضغط modal طويلًا في 360px |
| نسّق money/date عبر helper | لا تخلط SAR ور.س بلا قاعدة |
| اختبر Light/Dark/RTL/keyboard | لا تعتمد على screenshot Desktop واحد |
| أضف motion لشرح التغيير | لا تستخدم animation للزينة |

## 15. Known gaps

- مرحلة الترحيل الكامل ما زالت تحتاج معالجة صفحات Legacy؛ bridge يبقيها مقروءة فقط.
- لا يوجد Combobox متقدم موحد بعد؛ لم توجد حاجة مرجعية تبرر مكتبة إضافية.
- Charts الفعلية خارج الأسطح المرجعية؛ tokens جاهزة لكن كل chart يحتاج QA عند ترحيله.
- Admin لم يُعد تصميمه؛ أضيف الكتالوج داخل الحماية الحالية فقط.
- Visual regression automation وaxe CI غير موجودين في pipeline الحالي؛ QA الحالية يدوية + اختبارات سلامة ثابتة، ويوصى إضافتهما في مرحلة هندسية لاحقة.
- تطبيقات الهاتف لم تُبنَ هنا؛ الرموز والقواعد هي contract وليست حزمة React Native بعد.

## 16. Acceptance checklist لأي مكوّن جديد

- [ ] semantic tokens فقط.
- [ ] Light/Dark/System بلا flash ملحوظ.
- [ ] RTL مع English/number sample.
- [ ] 360/390/768/1024/1440.
- [ ] keyboard + focus visible + accessible name.
- [ ] error/loading/empty/disabled عند انطباقها.
- [ ] reduced motion.
- [ ] لا dependency ثقيلة أو client boundary غير ضرورية.
- [ ] documented migration impact إذا استبدل Legacy.

