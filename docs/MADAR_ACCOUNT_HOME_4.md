# MADAR Account & Home Experience 4.0

هذه الوثيقة هي العقد التنفيذي للصفحة الرئيسية بعد تسجيل الدخول وأقسام الحساب. تعتمد
`MADAR_UX_ARCHITECTURE.md` و`MADAR_DESIGN_SYSTEM_2.md` و`MADAR_GLOBAL_SHELL.md`،
ولا تغيّر منطق الدفع أو الاشتراك أو الاستحقاقات أو ORBY Core.

## 1. Home hierarchy

Home هي مركز تحكم خفيف للحساب، وليست Dashboard تشغيلية للخدمات. ترتيب المحتوى:

1. ترحيب مضغوط: هوية المستخدم وحالة الحساب، مع CTA واحد فقط عند وجود إجراء ضروري.
2. «يحتاج انتباهك»: الدفع غير المكتمل، الرفض، الإيقاف، الانتهاء أو قربه، وحالة المراجعة.
3. «خدماتي»: الخدمات الثلاث وحالاتها الحقيقية مرتبة Active ثم ما يحتاج متابعة ثم Available.
4. ORBY: حقل سؤال عام ينقل النص إلى Composer الحقيقي دون بناء Chat داخل Home.
5. الاشتراكات: الخدمات النشطة وORBY Plus فقط، والتفاصيل في قسم الاشتراكات.
6. المكتبة: آخر ثلاثة منتجات فقط عندما توجد مشتريات؛ لا Empty card كبيرة للمستخدم الجديد.
7. آخر التحديثات: آخر خمسة إشعارات من المصدر نفسه الذي يغذي Top bar.
8. وصول سريع إلى المدفوعات والمكتبة وخطة ORBY والملف الشخصي.

لا تُسحب مبيعات Retail أو المخزون أو Sync أو تقارير الخدمات إلى Home.

## 2. User states

| الحالة | ما يظهر في Home | الإجراء الصحيح |
|---|---|---|
| Registered بلا خدمة | الخدمات الثلاث + ORBY Free | طلب أول خدمة، دون Wizard إجباري |
| طلب Pending Payment | عنصر يحتاج انتباهك + بطاقة الحالة | إكمال الدفع |
| Under Review | حالة معلوماتية غير مضللة | عرض حالة الطلب؛ لا زر فتح |
| Active | الخدمة أولًا + ملخص الاشتراك | فتح Workspace عبر route الاستحقاق |
| Expired/Suspended | تحذير مع بقاء البيانات | تجديد أو عرض التفاصيل |
| Rejected | السبب الفعلي إن وجد | مراجعة السبب/إعادة الطلب بحسب النظام |
| ORBY Plus | Badge Plus واستخدام مرن | إدارة Plus أو فتح ORBY |
| لديه مشتريات | آخر ثلاثة عناصر | مكتبتي ثم download route الحالي |

مصدر حالات الخدمات الوحيد هو `getAccountServices()`؛ لا تستنتج Home حالة مستقلة.

## 3. My Services وPending Actions

- كل Service card تستخدم `ServiceCards` و`serviceStateCtas` من كتالوج الخدمات.
- الصور تبقى ظاهرة حتى في النسخة المختصرة.
- ترتيب الخدمات في `src/lib/account/presentation.ts`، وكذلك تفسير الحالات التي تحتاج انتباهًا.
- Pending Approval حالة متابعة وليست مطالبة بدفع جديد.
- قرب الانتهاء يُعرض خلال 14 يومًا، ولا يُحذف Workspace عند الانتهاء.
- دفعة متجر `unpaid/rejected` ودفعة Plus المرفوضة تظهران كإجراء واضح.
- يختفي القسم كاملًا عند عدم وجود عناصر؛ لا Empty state ضخمة.

## 4. Account IA

### منصة مَدار

- الرئيسية: `/account`
- خدماتي: `/account/services`
- ORBY Chat: `/orby`

### المتجر والملكية

- المتجر: `/store`
- طلباتي: `/account/orders`
- مدفوعاتي: `/account/payments`
- مكتبتي: `/account/purchases`

### الحساب والإعدادات

- الملف الشخصي: `/account/profile`
- الحساب والأمان: `/account/security`
- الاشتراكات: `/account/subscriptions`
- ORBY والخطة: `/account/orby`
- الإشعارات: `/account/notifications`
- المظهر واللغة: `/account/appearance`
- الخصوصية والبيانات: `/account/privacy`
- الدعم: `/account/support`

القائمة تحت Avatar تبقى مختصرة؛ تحتوي الوصول المتكرر ولا تنسخ كل الإعدادات.

## 5. Desktop وMobile

### Desktop

- Account rail من Global Shell يعرض الأقسام والمجموعة الحالية.
- Content panel يحافظ على عرض قراءة مضبوط؛ لا Tabs أفقية طويلة.
- Home تستخدم عمودين للملخصات فقط عندما تسمح المساحة، والخدمات ثلاث بطاقات مرجعية.

### Mobile

- لا Sidebar مضغوطة؛ Bottom navigation و«المزيد» في Global Shell هما قائمة الأقسام.
- الصفحات الفرعية Deep links مستقلة، وBack يعود إلى Account fallback عند عدم وجود history داخلي.
- جميع grids تتحول إلى عمود واحد، باستثناء وصول سريع 2×2 ثم عمود واحد عند 389px.
- Composer Home والأزرار والإجراءات الخطرة تصبح بعرض مناسب للمس.
- Floating ORBY ومسافة Bottom navigation تُداران في Global Shell ولا يضاف Floating جديد.

عقود QA المرجعية: 360/390/768/1024/1440. CSS الخاص بالمرحلة يعرّف التحولات عند
389/767/1023 ويستفيد من سلوك Shell عند 1440.

## 6. Profile وAvatar

- الاسم والهاتف فقط لأنهما الحقول الفعلية الحالية.
- الصورة تستخدم bucket `avatars` الحالي؛ لا Bucket ولا Schema جديدان.
- الرفع يدعم preview وreplace وfeedback وفحص النوع والحجم وmagic bytes الموجود.
- الإزالة تحذف object الحالي ثم تجعل `avatar_url = null`، فيعود Default MADAR Avatar.
- Header وHome وProfile تستخدم `/account/avatar` نفسه، وتُعاد صلاحية المسارات بعد Server Action.

## 7. Security وAppearance وNotifications

- Security تعرض البريد، التحقق، provider، تغيير كلمة المرور، وتسجيل الخروج فقط.
- لا Active sessions وهمية لأن Backend لا يقدم Session manager للمستخدم.
- Light/Dark/System تبقى في Appearance وتُطبق فورًا عبر Theme Provider وتستمر محليًا.
- العربية وRTL هما الخيار الفعلي الوحيد؛ لا selector لغة شكلي.
- Notification Center هو التاريخ، وTop bar/Home ملخصان من المصدر نفسه. Toast ليس Notification.
- Privacy تقسم التنزيل، طلب التصدير، والإجراءات الخطرة. الحذف موثق ومؤكد ولا ينفذ تلقائيًا.

## 8. Subscriptions وPayments وLibrary

- Subscriptions تجمع الخدمات الثلاث وORBY Plus، مع الخطة والحالة والبداية والانتهاء والإجراء.
- Payments تجمع سجلات المتجر وتفعيل الخدمة والتجديد وPlus وRetail، مع رابط المصدر.
- لا تُجمع العملات في Total واحد. كل مبلغ يعرض بعملته المخزنة عبر `formatCurrency`.
- Store orders تبقى رحلة شراء؛ Workspace subscriptions تبقى ملكية مستمرة؛ لا يختلط المفهومان.
- Library تعرض entitlements المعتمدة فقط وتستخدم download route والحماية الحاليين.
- فشل مصدر دفع واحد يظهر تحذيرًا بأن السجل جزئي بدل إسقاط الصفحة أو اختراع قيمة.

## 9. ORBY

- ORBY واحد للحساب. `/account/orby` لإدارة الخطة والاستخدام، و`/orby` للمحادثة.
- سؤال Home ينتقل في query `starter` ويملأ Composer دون auto-send.
- presets القديمة `analysis/plan/report` باقية للروابط المحفوظة، والنص الطبيعي محدود إلى 500 حرف.
- Free/Customer/Plus تُقرأ من RPC الحالي؛ لا حد أو plan مخترع.
- Upgrade يستخدم `/orby/plus` ونظام الدفع الحالي.

## 10. Data fetching وFailure isolation

- `getOptionalShellIdentity()` المحفوظ بـReact `cache` هو مصدر profile والإشعارات والهوية.
- `getAccountServices()` محفوظ لكل request ويشارك session المحسومة مع Shell.
- استعلامات Home المستقلة تعمل بالتوازي؛ ORBY والمكتبة والطلبات وPlus لا تُسلسل.
- `AccountSection<T>` يحمل `failed` مستقلًا حتى لا يسقط فشل المكتبة Home كلها.
- لا تُخزن بيانات حساسة في client state، ولا يتحول Account إلى Client Component عام.

## 11. Loading وError وFeedback

- Route loading يعرض shell skeleton، ولا يخفي Global Shell.
- فشل قسم اختياري يظهر Section Error/ملاحظة محلية.
- فشل صفحة الحساب الأساسي يبقي Shell ويقدم Retry.
- الحفظ والرفع والإزالة وطلبات الدعم والخصوصية تعطي feedback مرئيًا و`role` مناسبًا.
- Validation يبقى Server-side، مع خصائص الحقول الأساسية في العميل.

## 12. Accessibility

- headings مترابطة عبر `aria-labelledby` في Home.
- labels صريحة لكل Form وComposer، وأزرار الأيقونات من Design System لها أسماء.
- touch targets من tokens، وfocus من النظام، والحالات لا تعتمد على اللون وحده.
- البريد والمراجع والمسارات الرقمية تعرض LTR موضعيًا دون قلب RTL العام.
- `prefers-reduced-motion` يعطل transitions غير الضرورية.
- الإجراءات الخطرة منفصلة بعنوان وDanger style وعبارة تأكيد.

## 13. Routes وRedirects

الجديد: `/account/payments` و`/account/orby`. لا URL قائم تغيّر ولا Redirect جديد مطلوب.
يبقى `/account/subscription` redirect إلى `/account/subscriptions` للروابط القديمة.
تبقى redirects القديمة لـ`?view=services|orby|account` كما هي.

## 14. Deferred

- إعادة تصميم صفحات التشغيل الداخلية لـRetail/Connected/Native مؤجلة للمرحلة الخامسة.
- ORBY Chat الكامل، الذاكرة والمحادثات والصوت ليست ضمن هذه المرحلة.
- Store وCheckout وPayment backend وAdmin لم تُعد هندستها.
- Session manager متعدد الأجهزة غير معروض لأن Backend لا يدعمه.
- إعدادات Notification preferences لا تظهر لأن النظام الحالي لا يقدم preferences حقيقية.
- Account business/member legacy surfaces تبقى Service settings وستُعالج ضمن تجربة الخدمات.
- لا Schema أو RLS أو Bucket أو Entitlement أو Currency engine تغير في المرحلة الرابعة.
