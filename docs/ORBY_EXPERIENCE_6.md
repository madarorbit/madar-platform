# ORBY Experience 6.0

مرجع تنفيذي لواجهة وتجربة ORBY داخل مَدار. يعتمد على `MADAR_UX_ARCHITECTURE.md` و`MADAR_DESIGN_SYSTEM_2.md` و`MADAR_GLOBAL_SHELL.md` و`MADAR_ACCOUNT_HOME_4.md` و`MADAR_SERVICES_EXPERIENCE_5.md`.

## مبادئ المنتج

- ORBY مساعد واحد للحساب، وليس مساعدًا منفصلًا لكل خدمة.
- Chat-first: يكتب المستخدم طلبه طبيعيًا، ويكتشف الـCore النية داخليًا. لا يوجد Mode selector.
- Simple first, powerful underneath: المحرر بسيط، بينما السياق والأدوات والحصص والحماية تعمل على الخادم.
- لا بيانات وهمية ولا مصادر أو أدوات أو Voice مزيفة.
- Shell تبقى قابلة للاستخدام إذا فشل الرد أو سياق جزء من الخدمة.
- العربية وRTL هما الحالة الأساسية، مع إبقاء الكود والروابط والمعرفات LTR.

## Chat architecture

| الطبقة | المسؤولية |
|---|---|
| `app/orby/page.tsx` | حل هوية المستخدم، المحادثة المملوكة، المساحات المصرح بها، الحصة، وأحدث 200 رسالة |
| `OrbyShell` | Header، الرجوع، طبقات مَدار، سجل المحادثات، الحساب، Plus |
| `OrbyConversationSidebar` | البحث، التجميع الزمني، إعادة التسمية، الأرشفة، الحذف، السياق، الخطة والحصة |
| `OrbyChat` | الرسائل، Streaming، Stop، Retry، Offline، Composer، auto-scroll وحالات الحد |
| `OrbyMarkdown` | نص منسق آمن، قوائم، اقتباس، روابط آمنة، جداول، وكود LTR قابل للنسخ |
| `/api/orby/stream` | التحقق، الحصة، عزل السياق، Core routing، Streaming والحفظ |

تظهر واجهة المحادثة والمحرر أولًا، ثم تُحمّل المحادثات والبيانات ضمن Server Components. المحادثة الطويلة تعرض آخر 200 رسالة ويظهر إشعار بذلك، بينما يحتفظ الخادم بالسجل الكامل.

## Header وSidebar

- Header يعرض هوية ORBY، سياق المساحة، Plus، محادثة جديدة، وحساب مَدار.
- يمكن إخفاء سجل المحادثات على Desktop وفتحه كـSheet على Mobile.
- السجل مجمّع إلى: اليوم، أمس، هذا الأسبوع، أقدم.
- البحث محلي في أحدث 100 محادثة محملة، مع Rename/Archive/Delete وتأكيد الحذف.
- اختصارات التحليل والخطة والتقرير تملأ طلبًا طبيعيًا فقط؛ ليست Modes ولا تغيّر الـAPI.

## Composer

- Textarea متوسعة حتى ارتفاع مضبوط، `Enter` للإرسال و`Shift+Enter` لسطر جديد.
- يحترم IME/تركيب النص العربي ولا يرسل أثناء composition.
- زر الإرسال يتحول إلى Stop أثناء البث ويوقف `AbortController` فعليًا.
- عند Offline يُعطل الإرسال وتبقى الرسالة في المحرر.
- لا يظهر زر Microphone أو Attachment ما لم يكن التنفيذ متصلًا بمسار الويب.
- يحتفظ `data-voice-ready` بنقطة تركيب مستقبلية دون واجهة مزيفة.

## Streaming والتغذية الراجعة

- SSE events: `status`, `start`, `delta`, `usage`, `citations`, `complete`, `error`.
- حالات العمل تظهر بلغة مفهومة، ولا تعرض provider logs أو chain-of-thought.
- الأخطاء مصنفة إلى Offline، Network، Provider، Context، Limit، Save.
- Retry يعيد الرسالة الفاشلة بدون إعادة كتابتها. فشل الحفظ يبقي الرد ظاهرًا ويصرّح أنه قد لا يبقى بعد refresh.
- Copy متاح للرد، وCopy مستقل لكتل الكود.
- auto-scroll يعمل فقط إذا كان المستخدم قرب الأسفل؛ إذا صعد للقراءة يظهر زر العودة لآخر رسالة.

## Context model

| نقطة الفتح | السياق |
|---|---|
| Home / Account / `/orby` | General/User |
| MADAR Retail | Retail workspace المصرح بها |
| Connected Business | Connected workspace المصرح بها |
| Native Business | Native workspace المصرح بها |

- السياق يُحل من اشتراك Active غير منتهٍ ومملوك للمستخدم، وليس من route parsing وحده.
- فتح محادثة محفوظة يعيد سياقها بعد التحقق من `user_id` وعضوية المساحة.
- تبديل السياق يبدأ محادثة جديدة لتجنب الخلط غير المقصود.
- سياق Retail يستخدم بيانات Retail الفعلية. بقية مساحات الأعمال تستخدم `orby_business_context`.
- فشل سياق مساحة لا يسقط إلى مساحة أخرى ولا يخلط بيانات؛ يظهر Context error.

## المحادثات والخصوصية

- Guest: حالة مؤقتة وCookie HttpOnly للحصة؛ لا Conversation rows دائمة.
- Registered: المحادثات والرسائل تحفظ عبر `save_orby_exchange` وتبقى بعد refresh.
- Rename/Archive/Delete تتحقق من `user_id` في API، وRLS تتحقق من صاحب الحساب وعضوية المساحة.
- Production audit أكد سياسات RLS للمحادثات والرسائل، وعدم إتاحة حصة الزائر مباشرة لـ`anon` أو `authenticated`؛ استدعاؤها للخادم فقط عبر `service_role`.
- لا API keys أو prompts داخلية أو raw tool credentials تصل إلى العميل.

## Tiers وحدود الاستخدام

| الحالة | الحصة اليومية في المنتج |
|---|---:|
| Guest | 5 |
| Registered Free | 5 |
| مستخدم لديه خدمة Active | 20 |
| ORBY Plus | لا عداد يومي ظاهر، مع Fair-use وحماية إساءة |

- Accepted user prompt = وحدة واحدة. Internal tool calls/render لا تُحتسب.
- للمستخدم المسجل، يُحمّل سياق الخدمة قبل حجز الحصة، فلا تُحسب محاولة فشلت لأن السياق نفسه غير متاح.
- الحصة Server-side عبر RPC مع قيود التوازي، الأحرف، bursts، والحد اليومي.
- قرب الحد يظهر العداد بخفة في الشريط والسجل. عند النفاد يظهر CTA للتسجيل أو Plus حسب الهوية.
- انتهاء Plus لا يحذف الحساب أو المحادثات؛ تعود الحصة إلى 20 أو 5 حسب الخدمات النشطة.

## ORBY Plus

- السعر والخطة والعملات وأسعار التحويل وطرق الدفع تأتي من إدارة مَدار وقاعدة البيانات؛ لا سعر Hardcoded.
- الرحلة الحالية: Upgrade → عملة الدفع → وسيلة الدفع → رقم العملية → إيصال اختياري → Under review → Admin approval → Plus active.
- صفحة Plus تستخدم `OrbyShell` وDesign System semantic tokens وتعمل في Light/Dark.
- تفعيل/انتهاء Plus ومنع الطلبات المتكررة يبقى في المنطق الحالي ولا يُعاد بناؤه في الواجهة.

## Voice والمرفقات والأدوات

- Voice input: **غير مفعّل في Web** لأن Speech/Voice backend متصل غير موجود. موضع composer جاهز فقط.
- Voice output: **غير مفعّل** لعدم وجود TTS حقيقي.
- Attachments: يوجد مسار آمن خاص بعميل Mobile V2، لكنه غير موصول بمسار Web streaming؛ لذلك لا يظهر زر مرفقات في Web.
- Tool execution: مسار Chat الحالي يقرأ السياق المصرح به ولا يعرّض executor حساسًا من العميل. لن تظهر Confirmations أو Tool progress وهمية. عند توصيل عمليات كتابة لاحقًا يجب أن تكون Server-side وتطلب confirmation صريحًا.
- Sources: تعرض فقط إذا قدمها الخادم، والروابط تُقيد إلى HTTP/HTTPS؛ لا source IDs خام.

## Error / Loading / Empty

- Route shell skeleton يحافظ على بنية Header وComposer أثناء التحميل.
- Conversation جديدة تعرض سؤالًا بسيطًا واقتراحات اختيارية، لا Mode cards.
- Network/Provider/Context/Limit/Save رسائل مستقلة وإجراء مناسب.
- فشل Section أو الرد لا يخفي الـShell أو Navigation.

## Responsive behavior

- 360/390: محادثة Full-screen، History Sheet، Header مختصر، Composer مع safe area، جداول الرد داخل scroll مستقل.
- 768: نفس منطق الهاتف مع مساحة قراءة أوسع.
- 1024+: عمود محادثات قابل للإخفاء + عمود Chat بعرض قراءة محدود.
- 1440+: لا تتمدد المحادثة بعرض الشاشة؛ يبقى عرض القراءة نحو 54rem.
- لوحة المفاتيح لا تحجب Composer لأنه جزء من grid ثابت الارتفاع مع `100dvh`.

## Accessibility baseline

- Skip link إلى المحادثة، وتسميات لأزرار الأيقونات، و`aria-expanded`/`aria-controls` للسجل.
- الرسائل داخل `role=log`، والحالات والأخطاء داخل live/status/alert مناسبة.
- Touch targets من Design System، وFocus visible من primitives.
- status لا يعتمد على اللون وحده، والأخطاء لها عنوان ونص.
- Reduced motion يوقف pulse/transitions غير الضرورية.
- الكود والجداول قابلة للتمرير دون كسر RTL.

## Mobile Translation Notes

### MADAR Retail App ORBY

- ORBY وجهة واحدة من Workspace وبزر عائم واحد.
- يفتح Full-screen، والسياق هو Retail workspace الحالية تلقائيًا.
- History في شاشة/Sheet مستقلة، وComposer native مثبت فوق لوحة المفاتيح.
- Copy/Stop/Retry وحالة الاستخدام تُعاد كما هي؛ لا Mode selector.

### MADAR Business App ORBY

- نفس ORBY يخدم Connected وNative مع Context indicator واضح.
- تبديل المساحة يبدأ محادثة جديدة ولا يحمل route محليًا من خدمة أخرى.
- Connected يعرض freshness/status من أدواته الفعلية فقط.

### Shared ORBY Core

- يعاد استخدام provider/model router، personality/intent، metering، conversation schema، RLS، memory والـtool boundaries.
- التطبيقات لا تستدعي provider أو tool credentials مباشرة.

## Known gaps والمؤجل للمرحلة السابعة

- لا يوجد Web voice backend أو TTS، لذلك لا توجد أزرار صوت.
- Web attachments مؤجلة حتى توصيل ownership/storage بالـstreaming، رغم وجود Mobile V2 endpoint.
- لا virtualization كاملة؛ حُدّد العرض بأحدث 200 رسالة كحل أداء آمن، ويمكن إضافة cursor pagination لاحقًا.
- Search يعمل على أحدث 100 Conversation فقط؛ يحتاج Server search/pagination إذا تضخم السجل.
- لم تُنفذ كتابة Business tools أو confirmations لأنها غير موصولة بمسار Chat الحالي.
- المرحلة السابعة تتولى القياسات التفصيلية للأداء، تدقيق contrast آلي شامل، والـcross-browser polish؛ لا تغيّر منطق ORBY هنا.
