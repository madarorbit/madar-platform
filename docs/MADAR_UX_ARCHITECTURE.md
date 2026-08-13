# MADAR UX Architecture — المرحلة الأولى

> الحالة: دستور تنفيذي لبنية تجربة مَدار. هذا المستند يسبق Design System 2.0 ولا يعرّف ألوانًا أو أشكالًا نهائية.

## 1. مبادئ المنتج

1. **Simple first, powerful underneath:** الإجراء الأهم واضح أولًا، والوظائف المتقدمة داخل القسم الذي تنتمي إليه.
2. **حساب واحد يحيط بكل مَدار:** لا تدخل أي خدمة وكأنها موقع منفصل؛ شعار مَدار، الحساب، الإشعارات وORBY تبقى قابلة للوصول.
3. **كل مستوى تنقّل يجيب عن سؤال واحد:** Global = أين أنا في مَدار؟ Workspace = أين أنا في الخدمة؟ Local = أي جزء من الصفحة؟
4. **الحالة تقود الإجراء:** لا يظهر زر شراء لخدمة نشطة، ولا زر فتح لخدمة ما زالت قيد المراجعة.
5. **ORBY واحد بسياق متغيّر:** الهوية والمحادثات للحساب، وسياق مساحة العمل يُستنتج من نقطة الدخول.
6. **العربية وRTL هما الحالة الأساسية:** النصوص الإنجليزية، الأكواد، العملات والروابط تحتفظ باتجاهها المنطقي.
7. **لا طريق مسدود:** كل حالة فارغة أو خطأ تعطي تفسيرًا وخطوة آمنة عندما تسمح الصلاحية.
8. **لا تغيير خطِر لإثبات UX:** الحماية، الاستحقاقات، الدفع ومخطط البيانات تبقى المصدر الحقيقي للحالة.

## 2. أنواع المستخدمين الفعلية

| النوع | تعريفه في النظام | المدخل الأساسي | ما يجب أن يراه |
|---|---|---|---|
| Guest | لا توجد جلسة | `/`، `/services`، `/store` | الاستكشاف ثم تسجيل الدخول مع `next` للعودة |
| Registered | جلسة بلا اشتراك نشط | `/account` | حالة الحساب، الخدمات المتاحة، ORBY Free |
| Customer | اشتراك خدمة نشط | `/account/services` | زر فتح الخدمة وحالة الاشتراك الصحيحة |
| Plus | اشتراك ORBY Plus نشط | `/orby` | نفس ORBY بحدود Plus، لا مساعد ثانٍ |
| Admin | `is_admin = true` | `/admin` من قائمة الحساب | إدارة منفصلة مع عودة واضحة للمنصة |

> أدوار OWNER/MANAGER/STAFF/VIEWER داخل Retail وأدوار مساحة العمل ليست أنواع حساب عامة؛ هي صلاحيات داخل Workspace.

## 3. تدقيق الـSurfaces الحالية

### PUBLIC

| Surface | الوظيفة / المستخدم | الدخول → الخروج | Parent | القرار |
|---|---|---|---|---|
| `/` | تعريف مَدار للزائر | الزيارة → خدمة/متجر/دخول | مَدار العامة | تبقى |
| `/services`, `/services/[slug]`, `/subscriptions/[slug]` | اكتشاف الخدمات | الرئيسية → تسجيل/طلب | العامة | تبقى؛ المصطلح العام «الخدمات» |
| `/store`, `/products`, `/products/[slug]`, `/search`, collections | اكتشاف المنتجات | Navbar/بحث → منتج/سلة | التجارة العامة | تبقى؛ لا تدخل في Account shell |
| `/login`, `/register`, recovery/callback | الهوية | CTA/حماية → `next` أو الحساب | Auth | تبقى؛ الرجوع الآمن واجب |
| About, Blog, Careers, Help, Docs, policies | محتوى وتسويق ودعم | Footer/Search → العامة | العامة | تبقى؛ خارج IA التشغيلية |

### ACCOUNT

| Surface | الوظيفة | الدخول → الخروج | Parent | القرار |
|---|---|---|---|---|
| `/account` | حالة الحساب والإجراءات والتحديثات | Avatar/Login → خدمة/ORBY/قسم | Account layer | أُعيد ترتيب أولوياته |
| `/account/services` | ملكية الخدمة وحالتها والإجراء | Home/Nav → open/setup/store | Account | Canonical جديد |
| `/account/subscriptions` | الخطط والحالات والتواريخ | Nav/Services → إجراء الحالة | Account | Canonical جديد |
| `/account/profile` | بيانات المستخدم | Account menu → Account | Account | يبقى كقسم |
| `/account/security` | البريد وكلمة المرور والجلسة | Settings nav → Login عند الخروج | Account | قسم جديد؛ لا يغيّر Auth core |
| `/account/appearance` | Light/Dark/System | Account menu/nav → Account | Account | قسم جديد |
| `/account/notifications` | تاريخ الأحداث المهمة | Top bar/Nav → الوجهة المرتبطة | Account | يبقى، بلا Shell عام مكرر |
| `/account/orders`, `/account/orders/[id]` | طلبات الدفع والمراجعة | Commerce/Account → Order/Library | Account | تبقى تحت Account shell |
| `/account/purchases` | المكتبة والتنزيل | Commerce/Account → Download | Account | تبقى؛ الاسم المرئي «مكتبتي» |
| `/account/privacy`, `/account/support`, `/account/business/*` | إعدادات أقل تكرارًا | Settings nav → Account | Account | تبقى؛ تحتاج ترحيل بصري لاحق |
| `/account/setup`, `/account/subscription`, `/onboarding` | مداخل Legacy متداخلة | روابط محفوظة → Canonical | Legacy | Redirect ولا تُحذف |

### SERVICE

| Surface | الوظيفة | الدخول → الخروج | Parent | القرار |
|---|---|---|---|---|
| `/retail/workspace/*` | تشغيل MADAR Retail | خدماتي/open → Account | Retail Workspace | Shell موحد وملاحة مجمعة |
| `/workspace/*` + Native mode | تجارة منشأة على مَدار | خدماتي/open → Account | Native Workspace | تشغيل/ربط/إدارة بحسب الموجود |
| `/workspace/*` + Connected mode | تجارة مرتبطة | خدماتي/open → Account | Connected Workspace | IA مستقلة منطقيًا حسب mode |
| `/workspace-payment/[id]` | خطوة دفع طلب مساحة | Setup → حالة الطلب | Service acquisition | تبقى؛ لا تعاد هندسة الدفع |
| `/retail/onboarding` | إعداد Retail | Services/setup → Workspace | Retail acquisition | تبقى وراء الاستحقاق |

### ORBY

| Surface | السياق | الدخول → العودة | القرار |
|---|---|---|---|
| `/orby` | عام أو Organization من query/الحساب | Global/Floating → Account أو الخدمة النشطة | ORBY الأساسي الواحد |
| `/workspace/orby` | مساحة Connected/Native الحالية | Workspace nav → Workspace | Contextual entry، لا هوية جديدة |
| `/retail/workspace/orby` | Retail الحالية | Retail nav → Retail | Contextual entry، لا هوية جديدة |
| `/orby/plus` | ترقية/إدارة Plus | Account/ORBY → Account/ORBY | Commerce adjunct |

### COMMERCE

| Surface | الوظيفة | الدخول → الخروج | Parent | القرار |
|---|---|---|---|---|
| `/cart` | مراجعة السلة | Top bar/Product → Checkout | Commerce | Top bar entry دائم وبادج عند وجود عناصر |
| `/checkout`, `/checkout/product/[slug]` | بدء الدفع | Cart/Product → Confirmation/Payment state | Commerce | تبقى خارج Account shell |
| `/order-confirmation`, `/payment/success`, `/payment/failed` | نتيجة العملية | Checkout → Order/Library/Retry | Commerce | تبقى؛ يجب ألا تكون نهاية مسدودة |
| Orders + Purchases | حالة الطلب ثم الملكية | Account → Library | Account commerce | مرجع المستخدم بعد الشراء |

### ADMIN

| Surface | الوظيفة | الدخول → الخروج | Parent | القرار |
|---|---|---|---|---|
| `/admin/*` | إدارة المنصة/المتجر/ORBY/Retail | Account menu → `/account` | Admin shell | يبقى منفصلًا؛ لا Design overhaul الآن |

واجهات `/api/*` وملفات download/export ليست Navigation surfaces، لكنها تمنع حذف المسارات التي تعتمد عليها.

## 4. المشكلة البنيوية القديمة

- الحساب كان صفحة طويلة داخل الـPublic Navbar/Footer، مع أقسام query (`?view=`) بدل IA قابلة للربط المباشر.
- Retail وBusiness Workspace وORBY استخدمت Shells ومصادر تنقّل منفصلة؛ الدخول إلى خدمة قطع الإحساس بطبقة حساب واحدة.
- `Retail` ظهر في تنقل كل Business workspace حتى عندما لم يكن استحقاق المستخدم Retail.
- Connected وNative تقاسما قائمة واحدة رغم أن سؤال المستخدم في الأولى هو «هل الربط يعمل؟» وفي الثانية «كيف أشغّل التجارة؟».
- Avatar كان رابطًا مباشرًا لصفحة الحساب؛ لا Account menu مختصرة. السلة لم يكن لها موضع ثابت في الشريط العلوي.
- حالات الخدمة الداخلية كانت تُترجم إلى عبارات عامة؛ وبعض الحالات Pending لم تملك مسارًا لعرض الحالة.
- زر ORBY العائم كان يفتح السياق العام حتى من داخل Workspace.
- Light/Dark كان toggle ثنائيًا بلا System preference صريحة، مع مساحات Legacy تعتمد ألوانًا ثابتة.

السبب الجذري: **لا توجد طبقة Account مشتركة ولا مصدر واحد لتعريف Global/Service navigation وحالة الخدمة.**

## 5. الـGlobal IA الجديدة

```text
مَدار
├── العامة: الرئيسية · الخدمات · المتجر
├── حساب مَدار
│   ├── الرئيسية
│   ├── خدماتي
│   ├── ORBY
│   ├── المتجر والطلبات والمكتبة
│   └── الحساب والإعدادات
├── MADAR Workspace
│   ├── Retail
│   ├── Connected Business
│   └── Native Business
└── الإدارة (للمدير فقط، Shell مستقل)
```

القاعدة: Account layer هي نقطة التجميع. Workspaces تبقى محمية باستحقاقاتها الحالية، وتعرض دائمًا العودة إلى `/account` مع Global user actions نفسها.

## 6. نموذج التنقّل

### Desktop

- **Public:** Navbar خفيفة للاستكشاف + ORBY/Cart/Notifications/Avatar للمسجل.
- **Account:** Sidebar للأقسام، Top bar للسياق والبحث في المتجر وGlobal actions، محتوى القسم.
- **Workspace:** Sidebar خاص بالخدمة، Top bar للسياق/البحث الخاص بالمساحة/Global actions، ثم local tabs عند الحاجة فقط.
- **Admin:** Admin shell مستقل، و«العودة إلى المنصة» واضحة.

لا تُعرض Global links كاملة داخل Workspace sidebar؛ يكفي Account entry وGlobal actions حتى لا تتنافس ثلاثة مستويات.

### Mobile

- Bottom navigation بحد أقصى خمسة عناصر: Home، الخدمة/العملية الأهم، ORBY، وجهة رابعة مرتبطة بالسياق، More.
- More يفتح Drawer بأقسام السياق كاملة؛ لا يتم تصغير Desktop sidebar.
- Top bar يحتفظ باسم الصفحة، زر More، السلة وAvatar. العناصر الثانوية تختفي من الشريط وتبقى في Drawer/Account menu.
- الجداول ذات الأعمدة الكثيرة تتحول في المرحلة التالية إلى list/detail أو cards؛ إخفاء الأعمدة الحالي حل انتقالي وليس التصميم النهائي.

## 7. الصفحة الرئيسية للحساب

ترتيب المحتوى الملزم:

1. **من أنا؟** الاسم والبريد وحالة الجلسة.
2. **ماذا ينتظر؟** خدمات تحتاج دفعًا/مراجعة/تجديدًا وإشعارات غير مقروءة.
3. **ماذا أملك؟** الخدمات النشطة مع زر «فتح الخدمة» فقط.
4. **أين ORBY؟** مدخل عام، مع توضيح أن الدخول من الخدمة يضيف السياق تلقائيًا.
5. **ماذا حدث؟** آخر أحداث ذات معنى.
6. **إجراءات سريعة:** الاشتراكات، الطلبات، المكتبة، الملف الشخصي.

لا تُضاف Stat cards إلا عندما تساعد قرارًا فوريًا.

## 8. حالات الخدمات والإجراءات

| الحالة المعروضة | المصدر الحالي | الإجراء الأساسي |
|---|---|---|
| غير مفعّلة | لا subscription/request | استعراض الخدمة |
| بانتظار الدفع | `SETUP_REQUIRED` | إكمال الإعداد أو الدفع |
| قيد المراجعة | `PENDING_APPROVAL` | عرض حالة الطلب |
| نشطة | `ACTIVE` | فتح الخدمة |
| موقوفة | `SUSPENDED` | مراجعة الاشتراك |
| منتهية | `EXPIRED` | تجديد |
| مرفوضة | `REJECTED` | مراجعة السبب وإعادة الطلب عند السماح |

`/account/services/[code]/open` يبقى بوابة الاستحقاق server-side؛ التنقل لا يتجاوز الحماية.

## 9. Workspace Shell

العناصر المشتركة: شعار مَدار والعودة للحساب، اسم Workspace، موقع المستخدم الحالي، تنقل الخدمة، ORBY السياقي، الإشعارات، السلة، Avatar menu. لا تتشارك الخدمات محتواها أو صلاحياتها؛ تتشارك طريقة معرفة «أين أنا وكيف أعود».

### MADAR Retail IA

| المستوى | الأقسام الفعلية |
|---|---|
| نظرة عامة | الرئيسية |
| البيع والمخزون | المبيعات، المنتجات، المخزون |
| التوريد والعلاقات | المشتريات، الموردون، العملاء |
| المال والذمم | المصروفات، الديون، الصندوق |
| الذكاء والتقارير | التقارير، ORBY |
| الإدارة | إعدادات Retail |

Mobile primary: الرئيسية، المبيعات، المنتجات، ORBY، ثم More. تم حذف تعريف التنقل المكرر كمصدر قرار؛ المصدر هو `platform-navigation.ts`.

### Connected Business IA

| المستوى | الأقسام الفعلية |
|---|---|
| نظرة عامة | الملخص، الربط والمزامنة، ORBY |
| البيانات الواصلة | الوحدات الفعلية المفعلة: منتجات/مبيعات/مخزون/عملاء… |
| المراقبة والتقارير | التحليلات، سجل النشاط |
| المهام | المهام وسير العمل |
| الإدارة | الفريق والصلاحيات، إعدادات النشاط |

السؤال الأساسي في الـOverview: حالة الاتصال، آخر مزامنة، الأخطاء، وما وصل من بيانات. الصفحات الموجودة تُستخدم كما هي؛ لا تُنشأ صفحة بيانات وهمية.

### Native Business IA

| المستوى | الأقسام الفعلية |
|---|---|
| نظرة عامة | الملخص، ORBY، التقارير والتحليلات |
| التشغيل | الوحدات المدعومة حسب vertical/enabled modules |
| الربط والأتمتة | الربط والمزامنة، المهام |
| الإدارة | الفريق، الإعداد، سجل النشاط |

Native لا يعيد إحياء أنظمة Legacy ولا يعرض modules غير مفعّلة. Mobile primary يتغير حسب التخصص (المبيعات/المطعم/الفندق).

## 10. ORBY: الهوية والسياق

- الهوية والمحادثات واحدة على الحساب.
- دخول `/orby` من Account = **سياق عام** ما لم يُمرر Organization صالح.
- دخول `/workspace/orby` = **سياق Connected/Native الحالي**.
- دخول `/retail/workspace/orby` أو الزر العائم داخل Retail = **سياق Retail الحالي**.
- يعرض Shell اسم السياق ومسار العودة. لا يختار المستخدم mode مع كل رسالة.
- Voice مستقبلًا input/output modality في Composer نفسه، وليس تطبيقًا أو Route منفصلًا.

## 11. Top bar وAccount menu

| العنصر | Guest | Registered desktop | Registered mobile |
|---|---|---|---|
| طبقة/مسار الصفحة | Public nav | اسم القسم + Back/Forward | اسم مختصر + More |
| ORBY | CTA عام حيث يلزم | ظاهر | في Bottom nav؛ لا يكرر في الشريط الصغير |
| Cart | ظاهر مع badge إن وُجد | ظاهر مع badge | ظاهر |
| Notifications | — | ظاهر مع unread indicator | داخل More/Account عند ضيق الشاشة |
| Avatar | Login/Register بدلًا منه | صورة أو هيئة بشرية افتراضية | الهيئة نفسها |

ضغط Avatar يفتح قائمة قصيرة: الرئيسية، الخدمات/الاشتراكات، الملف الشخصي، المظهر، الإدارة إن كان المستخدم مديرًا، تسجيل الخروج. الإعدادات التفصيلية تبقى في صفحات الحساب.

## 12. Account IA

- مَدار: الرئيسية، خدماتي، ORBY.
- المتجر والمشتريات: المتجر، طلباتي، مكتبتي.
- الحساب والإعدادات: الملف الشخصي، الحساب والأمان، الاشتراكات، الإشعارات، المظهر واللغة، الخصوصية، الدعم.
- Desktop = section sidebar. Mobile = primary bottom nav + قائمة الأقسام؛ لا scrolling في صفحة إعداد واحدة.

## 13. Commerce وSubscriptions

### Commerce journey

`اكتشاف /store أو /products` → `المنتج` → `السلة` → `Checkout` → `نتيجة الدفع/الطلب` → `طلباتي` → `مكتبتي` → `تحميل`.

- السلة Global action، والطلبات/المكتبة داخل Account.
- الدفع والموافقة لا يُعاد بناؤهما في هذه المرحلة.
- نتيجة فاشلة تقود لإعادة المحاولة أو الطلب، والنجاح يقود إلى الطلب/المكتبة بحسب الحالة.

### Subscription journey

`خدماتي` → `الخدمة + الخطة + الحالة` → `الإجراء المسموح` → `الاشتراكات` للمرجع والتواريخ → `فتح الخدمة` عند Active.

ORBY Plus يظهر في المرجع نفسه ولا ينشئ IA مستقلة لكل خدمة.

## 14. Route map والـRedirects

| Legacy/current entry | Canonical | السياسة |
|---|---|---|
| `/account?view=services` | `/account/services` | server redirect |
| `/account?view=orby` | `/orby` | server redirect |
| `/account?view=account` | `/account/profile` | server redirect |
| `/account/subscription` | `/account/subscriptions` | permanent navigation redirect في route component |
| `/account/setup` | `/account/services` | redirect |
| `/onboarding` | `/account/services` | redirect |
| `/workspace` | نفسه | يحسم Connected/Native من `operating_mode` |
| `/retail/workspace` | نفسه | protected Retail entry |
| `/orby` | نفسه | الهوية العامة الموحدة |

لا تُحذف مسارات Legacy الآن لأن bookmarks وروابط الإشعارات قد تعتمدها. لا تغيير في callbacks أو API routes.

## 15. حالات الواجهة

### Empty

| Surface | الرسالة | CTA المشروط |
|---|---|---|
| خدمات نشطة | لا توجد خدمة نشطة بعد | عرض كل الخدمات |
| منتجات | لا توجد منتجات بعد | إضافة أول منتج إن كانت الصلاحية تسمح |
| طلبات | لا توجد طلبات بعد | استعراض المتجر |
| مكتبة | لا توجد مشتريات متاحة | استعراض المتجر |
| إشعارات | لا توجد تحديثات بعد | بلا CTA مصطنع |

### Error

- Inline: خطأ حقل، ملاصق للحقل مع label.
- Section: الجزء الفاشل يحتفظ ببقية الصفحة ويعرض Retry.
- Page: عنوان واضح + العودة للـparent + Retry آمن.
- System outage: banner عام واحد، لا تكرار toast في كل مكوّن.

### Loading / success

- Skeleton لبنية الصفحة/القائمة، spinner لإجراء قصير داخل الزر، progress لرفع/استيراد متعدد الخطوات، background refresh دون حجب.
- Toast للأفعال العابرة (نسخ/حفظ)، inline للحالة المستمرة، modal للتأكيد الخطر فقط، وتحديث status لطلبات الدفع/المراجعة.

## 16. Responsive baseline

| الحجم | السلوك |
|---|---|
| Small/Large mobile | Bottom nav + Drawer؛ صفحة بحواف صغيرة؛ list/detail بدل الجدول الواسع عند الترحيل |
| Tablet | Drawer سياقي، وقد تتحول البطاقات إلى عمودين؛ لا sidebar دائم |
| Laptop/Desktop | Sidebar للسياق الحالي وTop bar؛ المحتوى بعرض أقصى مقروء |

Back: browser back يبقى افتراضيًا، logo/account entry يعود للطبقة الأعلى، إغلاق modal لا يغير history إن لم ينشئ Route. لا يُستخدم back لإعادة POST أو خطوة Checkout مكتملة.

## 17. Accessibility baseline

- ترتيب focus يتبع DOM: context → global actions → content → local actions.
- روابط الأيقونات لها `aria-label`، والحالة لا تعتمد اللون وحده بل Badge نصي.
- touch target مستهدف 44×44px؛ بعض عناصر Legacy الأصغر مسجلة للمرحلة الثانية.
- headings: H1 واحد للصفحة، H2 للأقسام، H3 للكيانات.
- Drawer/Menu يجب أن يضيف focus trap وEscape/focus return في ترحيل Components؛ التنفيذ الحالي بـ`details` وoverlay ليس كاملًا لقارئ الشاشة.
- الجداول تحتاج captions/headers واستراتيجية mobile card في المرحلة الثانية.
- `prefers-reduced-motion` يلغي transitions البنيوية.
- لا تُعكس الأكواد/URLs/اختصارات لوحة المفاتيح؛ تُستخدم `dir=ltr` موضعيًا.

## 18. Theme, typography, icons

### Theme architecture

التفضيل أصبح `light | dark | system` محفوظًا في `localStorage`، والـresolved theme يُطبّق قبل الرسم لتقليل الوميض. الهدف النهائي للمرحلة الثانية:

`background / surface / surface-raised / text / text-muted / border / accent / success / warning / danger`

الفجوات المؤجلة: Tailwind colors مباشرة (`text-slate-*`, `bg-white/*`, hex values)، light-mode compatibility overrides الواسعة، ألوان charts، وبعض inline styles في صفحات Legacy. لا تُصلح يدويًا عنصرًا عنصرًا الآن.

### Typography

السلم المعتمد لاحقًا: Display، H1، H2، H3، Body، Secondary، Caption، Label، Numeric. يجب اختبار line-height العربي، النص المختلط، العملات والأرقام. أحجام Tailwind العشوائية الحالية gap موثق للمرحلة الثانية.

### Icons

المصدر الأساسي الحالي `components/ui/Icons` مع SVGs للعلامة وORBY. تُمنع emoji كأيقونة إجراء، ويظهر text label للأيقونات غير المألوفة أو الخطرة. توحيد stroke/fill وحذف SVG duplicates مؤجل للمرحلة الثانية.

## 19. Search وNotifications

- البحث العام الحالي مبرر للمتجر فقط (`/search` و`/api/store/search`).
- بحث Workspace/Command palette نطاقه الكيانات والصفحات داخل المساحة؛ لا يُسمى Global search للمنصة.
- لا يُنشأ بحث موحد للمحادثات والخدمات قبل فهرس وصلاحيات موثوقين.
- Notification Center = تاريخ أحداث، Toast = نتيجة لحظية، Alert = إجراء مطلوب، System banner = عطل عام.

## 20. الأداء المدرك والحركة

- منع theme flash عبر bootstrap قبل hydration.
- Shell يبقى ثابتًا أثناء انتقال child routes، ما يقلل layout shift والشاشة البيضاء.
- fetches الحساب المستقلة تُنفذ بالتوازي؛ فشل usage/notifications لا يحجب الصفحة.
- Full-page reloads وfetches المتكررة داخل Legacy pages تحتاج قياسًا في مرحلة performance منفصلة.
- الحركة 150–300ms لتوضيح فتح menu/drawer وتغير الحالة، بلا animation زخرفي، مع reduced motion.

## 21. Terminology map

| المفهوم | المصطلح المعتمد | لا يُستخدم لنفس المعنى |
|---|---|---|
| طبقة المستخدم | حساب مَدار | لوحة التحكم العامة |
| ما يملكه المستخدم | خدماتي | أنظمتي / منتجاتي |
| بيئة خدمة | مساحة العمل / Workspace | موقع منفصل |
| المتاح للشراء | المتجر | المكتبة |
| ما تم شراؤه | مكتبتي | المتجر |
| معاملات الشراء | طلباتي | الاشتراكات |
| خدمة دورية | الاشتراكات | الطلبات |
| AI assistant | ORBY / أوربي | بوت مستقل لكل خدمة |
| Connected | ربط تجارة قائمة | إنشاء تجارة |
| Native | إنشاء تجارة على مَدار | ربط خارجي |

## 22. ما نُفذ وما لم يتغير

نُفذ: Account shell، canonical account sections، مصدر Navigation للحساب وRetail، IA مشروطة لـConnected/Native، Global user actions، Cart badge، Avatar menu، ORBY contextual entries/return، حالات الخدمة وإجراء Pending، Light/Dark/System، mobile navigation foundation، redirects الآمنة.

لم يتغير: Supabase schema، Payments، Store backend، ORBY Core، Retail domain logic، entitlement gates، Admin IA التفصيلية. هذه حدود أمان مقصودة.

## 23. Known gaps للمراحل التالية

1. Design System 2.0: token migration كاملة، typography/icons/contrast/touch targets.
2. Account business/privacy/support ما زالت تستخدم مكوّنات Legacy داخل Shell الجديد.
3. Focus trap وroving focus لـDrawer/Account menu، وmobile table transformations.
4. Connected overview يحتاج عرض last sync/error/data received من مصدر موثوق؛ لا نختلقها إن لم تتوفر.
5. Empty/error/loading patterns تحتاج Components مشتركة ثم ترحيل تدريجي للصفحات.
6. Commerce result pages تحتاج تدقيق محتوى ورجوع end-to-end مع مزود الدفع الفعلي.
7. Global performance/auth flashing يحتاج قياس Production لا تخمينًا.
8. Voice يضاف إلى Composer نفسه عندما يصبح backend جاهزًا. AR/VR لا Route ولا Navigation حتى يظهر use case حقيقي.

## 24. Quality gate لهذه المرحلة

لا تعد Architecture مثبتة حتى تنجح: typecheck، lint، tests، production build، ثم رحلات Guest/Registered/Customer/Retail/Commerce/Account/Theme على Desktop وMobile، وفحص deep links والاستحقاقات وProduction deployment/logs. نتائج التشغيل تُسجل في تقرير التسليم، لا في هذا الدستور الثابت.
