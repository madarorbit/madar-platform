# MADAR Polish, Accessibility & Performance 7.0

تاريخ التدقيق: 15 أغسطس 2026

هذه الوثيقة تسجل المرحلة السابعة فقط. لا تغيّر معمارية مَدار أو Business Logic السليم، ولا تبدأ Production Readiness & Security 8.0.

## Audit baseline

بدأ التدقيق من `main` عند SHA `c69348222ef28813a81ccae5213b66f17a7daef0`، وهو نفسه آخر Production READY في Vercel قبل المرحلة السابعة.

تمت مراجعة عقود المراحل السابقة وتنفيذها الفعلي في Design System، Global Shell، Account/Home، Services وORBY، مع مسح خاص للـerror states وCheckout والمكونات المشتركة.

أكبر الخشونة المؤكدة قبل الإصلاح:

- بقايا ألوان ثابتة في صفحات الخطأ و404 وCheckout تؤدي إلى تناقض Light/Dark.
- عناصر Menu وPagination أصغر من معيار touch target المعتمد 44px.
- Menu يفتح بالماوس وTab، لكنه لم يكن يعلن علاقة `aria-controls` ولم يوفر دخول ArrowDown/ArrowUp مباشرًا إلى العناصر.
- ORBY كان يعطّل الـtextarea عند Offline، مع أن السلوك المطلوب هو إبقاء المسودة قابلة للكتابة ومنع الإرسال فقط.
- إيقاف ORBY قبل وصول أول token يمكن أن يترك assistant message فارغة في الحالة المحلية.
- فشل Clipboard في ORBY لم يكن له feedback قابل للاسترداد.
- Checkout ظل بصريًا من الطبقة القديمة، مع feedback ألوان مباشر بدل Notices semantic وتسلسل دفع أقل وضوحًا.
- Motion transition للثيم استخدم 360ms بينما token البطيء المعتمد 320ms.

## Visual consistency / Light-Dark

- نُقلت صفحات `app/error.tsx` و`app/not-found.tsx` إلى semantic MADAR surfaces/text/state tokens بدل `text-slate-*`, `bg-white/*`, rose/violet hardcoding.
- Checkout أصبح يعتمد `Panel`, `Field`, `Input`, `Notice`, `Button` من Design System.
- أضيفت طبقة `app/polish-accessibility-performance-7.css` بعد CSS المرحلة السادسة لتثبيت polish contracts من دون إعادة بناء Design System.
- لم تُحذف legacy compatibility layers عشوائيًا لأن عدداً من الصفحات القديمة لا يزال يعتمدها؛ إزالة هذه الطبقات مؤجلة حتى يثبت عدم وجود consumers.

## Typography / BiDi

- حافظت النصوص الطويلة ورسائل المساعدة على `overflow-wrap` لتقليل overflow مع URLs/IDs والنص المختلط.
- بيانات البريد والعملات والأكواد في Checkout تستخدم اتجاه LTR مع `unicode-bidi: isolate` حيث يلزم.
- لم تُغيّر أحجام الخطوط الأساسية أو hierarchy المعتمدة في Design System.

## Accessibility baseline

الخط الأساسي بعد المرحلة:

- touch target موحد إلى 44px لعناصر Menu وPagination التي كانت أصغر.
- focus-visible الأساسي في Design System محفوظ، مع focus واضح لمصادر ORBY.
- Menu يعلن `aria-expanded` + `aria-controls` ويدعم ArrowDown/ArrowUp للوصول لأول/آخر عنصر، وEscape يعيد focus للمشغّل.
- Sheet focus trap وModal native dialog الموجودان من المراحل السابقة بقيا كما هما.
- Checkout يستخدم labels حقيقية عبر `Field` ولا يعتمد على placeholder كاسم للحقل.
- صفحات الخطأ تستخدم semantic main/alert وعناوين واضحة.
- Status system لا يزال يستخدم label + visual status بدل الاعتماد على اللون وحده.
- `prefers-reduced-motion` يبقى authoritative، بما في ذلك theme transitions.
- أضيف forced-colors fallback للنقاط وبعض controls الأساسية.

لم تتم إضافة framework Accessibility ثقيل؛ أضيف Gate ثابت في `tests/madar-polish-accessibility-performance-7.test.mjs` لحماية العقود الحرجة، مع الاستمرار في ESLint/Next checks الحالية.

## Responsive QA

العقود الموجودة للمراحل السابقة تغطي 320/360/390/430 تقريبًا عبر breakpoints 389/639/767/1023/1440، وتم تعزيزها في المرحلة السابعة بدل إنشاء نظام Responsive ثانٍ.

الإصلاحات المحددة:

- Checkout يتحول من عمودين إلى عمود واحد تحت 768px، ويُلغي sticky summary على الهاتف.
- Feedback في ORBY يلتف بدل دفع المحتوى خارج الشاشة، وأزرار error تصبح touch-sized.
- Context bar في ORBY يسمح بالالتفاف، وتحت 390px يتحول إلى stack.
- مجموعات CTA في الحالات الضيقة يمكنها التمدد بعرض كامل بدل ضغط الأزرار.
- Hover transforms لا تُفرض على أجهزة `hover: none`.

الـTablet يستمر في استخدام عقد Shell عند 1024px وعقد content عند 768px، وليس مجرد تكبير نسخة الهاتف.

## ORBY polish

- Offline لا يقفل الكتابة: يبقى composer قابلًا لكتابة المسودة، بينما زر الإرسال يبقى معطلًا حتى عودة الشبكة.
- إيقاف stream قبل أول token ينظف assistant placeholder الفارغ.
- فشل Clipboard يعطي feedback مفهومًا بدل unhandled rejection.
- scroll container يستخدم stable scrollbar gutter لتقليل اهتزاز العرض عند ظهور شريط التمرير.
- long responses تستفيد من `content-visibility` و`contain-intrinsic-size` الموجودين من المرحلة السادسة، مع حماية min-width/overflow.
- لا Voice أو Attachment fake feature أضيفت.

## Checkout / Store polish

لم يُعاد بناء الدفع. التعديل UX فقط:

- Checkout يشرح بوضوح أنه الخطوة 1 من 2، وأن الدفع يُرسل بعد إنشاء الطلب ويحتاج مراجعة.
- العملات المختلطة تُعرض كحالة Warning واضحة ويُمنع إنشاء الطلب حتى فصل العملات.
- summary يفصل المبالغ حسب العملة ولا يجمعها حسابيًا.
- الهاتف والبريد read-only يظهران بحالة Design System الصحيحة، ورقم التواصل يستخدم `inputMode=tel` وautocomplete مناسب.
- الأخطاء والسلة الفارغة تستخدم Notices متسقة.
- زر الإنشاء يحتفظ بحجمه أثناء loading عبر Button primitive.

## Loading / errors / empty states

- Error و404 أصبحا متوافقين مع النظام الدلالي للثيم.
- ORBY offline/retry/save states تبقى recoverable ولا تدّعي نجاح الحفظ عند فقد الشبكة.
- لم يُضف optimistic UI للعمليات المالية.
- Loading architecture الموجودة في Account/ORBY/Shell لم تُستبدل؛ المرحلة السابعة حافظت على shell-first والسياقات الجزئية بدل blank screens.

## Navigation / keyboard

- Menu keyboard entry تحسن من دون تغيير route architecture.
- Escape يعيد التركيز إلى trigger.
- لم تتغير URLs أو deep-link contracts.
- Global Shell / bottom navigation / context switcher بقيت من المرحلة الثالثة، ولم يُنشأ Shell ثانٍ.

## Performance baseline

قبل المرحلة السابعة كان آخر Vercel Production READY يبني في نحو 59 ثانية حسب build log، مع Build Cache upload بحجم 173.66 MB. حجم Build Cache ليس client bundle ولا يُستخدم كمقياس لحجم JavaScript للمستخدم.

تحسينات المرحلة السابعة منخفضة المخاطر:

- لا dependency جديدة.
- لا animation library جديدة.
- لا icon package جديدة.
- أبقي `content-visibility` في رسائل ORBY الطويلة.
- أبقي request-level React `cache()` في Shell/Account.
- Account Home يجلب الأقسام المستقلة عبر `Promise.all` بدل waterfall.
- لم تُحوّل صفحات Server إلى Client من أجل polish.
- طبقة CSS الجديدة صغيرة ومحددة، بدل تكرار style logic داخل كل route.

### Duplicate fetches

لم يُكتشف duplicate fetch آمن يمكن حذفه في مسار Account Home من دون تغيير freshness/authorization. الكود الحالي يشارك Shell identity عبر React request cache، ويوازي services/usage/orders/library/Plus data. لذلك لم يتم ادعاء تقليل fetches لم يحدث فعليًا.

### Client bundle

لم يُحذف `lucide-react` لأن التدقيق أثبت وجود consumers فعليين في Retail، وحذفه الآن سيكسر الواجهة. لم تُضف مكتبات جديدة، ولم تُحوّل checkout أو صفحات errors إلى dependencies أثقل.

## Lighthouse / Web Vitals

بيئة التنفيذ المتاحة لهذه المرحلة لا توفر Browser/Lighthouse runner متصلًا بالمستودع أو جلسة مستخدم Production authenticated، لذلك **لم تُخترع أرقام Lighthouse أو LCP/CLS/INP**.

القياس الفعلي المستخدم:

- Vercel build output ومدة build baseline.
- Vercel runtime error groups.
- CSS/DOM/accessibility contracts.
- CI: tests + lint + typecheck + production build بعد commit.
- Production route/runtime validation بعد النشر.

يجب في المرحلة الثامنة أو عند توفر Browser runner تسجيل Lighthouse Mobile/Desktop وfield Web Vitals كأرقام مرجعية، لا كقيم تقديرية.

## Runtime findings

في نافذة Vercel التاريخية لسبعة أيام ظهرت أخطاء من deployments أقدم تشمل Supabase schema/permission وRetail ambiguous status وORBY save failures. لا تُنسب كلها إلى Production الحالي.

المهم للمتابعة: آخر Production قبل المرحلة السابعة سجل حالتين `P0001` في `retail_create_expense` و`retail_create_sale`. لم تُغيّر المرحلة السابعة قواعد البيانات أو RPC لتفادي تخريب Business Logic. يجب عزل سبب هاتين الحالتين في Production Readiness 8.0 إذا استمرتا بعد النشر.

## Responsive / Light-Dark / Slow network QA boundaries

- Light/Dark/System: تم تدقيق tokens/bootstrap وsurfaces المعدلة على مستوى الكود، وProduction routes ستُفحص بعد النشر.
- Slow network: ORBY يحتفظ بالمسودة ويقدم recoverable state؛ لا توجد نتيجة نجاح وهمية.
- Mobile keyboard: composer يستخدم 100dvh layout وsafe-area من المرحلة السادسة، والتعديل الجديد يمنع قفل الكتابة عند offline.
- لا يمكن ادعاء اختبار بصري فعلي لكل viewport 320–1440 بدون browser viewport runner؛ العقود اختبرت عبر CSS/tests وProduction response checks.

## Known gaps

هذه الفجوات متروكة عمدًا لأنها خارج إصلاح آمن للمرحلة السابعة أو تحتاج Browser/Production-security validation:

1. قياسات Lighthouse وfield Core Web Vitals الرقمية.
2. فحص بصري فعلي Safari/Firefox مع viewport automation.
3. سببا Retail `P0001` إذا استمرا في أحدث deployment.
4. أخطاء Admin تاريخية مثل local-payments icon/system-health إن أعيد إنتاجها على أحدث Production.
5. إزالة legacy CSS/dependencies على نطاق واسع تحتاج usage proof كامل، ولا تتم بالحدس.
6. Security/RLS/permission hardening الشامل مؤجل للمرحلة الثامنة.
7. Native-specific keyboard, haptics, permissions وnavigation ليست ضمن Web polish.

## Mobile readiness

Patterns الجاهزة للترجمة للتطبيقين:

- hierarchy الخاصة بـHome/Account/Services.
- bottom navigation + contextual service navigation.
- ORBY full-screen conversation, message states, stop/retry/offline draft.
- Field/Input/Notice/Button semantics.
- 44px touch baseline.
- RTL typography وBiDi isolation.
- service state language وstatus badges.
- Checkout summary وحالات pending/error دون optimistic financial mutation.

قرارات Native التي تبقى لاحقًا:

- native navigation stack/tab implementation.
- keyboard avoidance APIs بدل CSS viewport فقط.
- native file/voice permissions.
- haptics.
- secure local storage/offline sync policy.
- platform-specific accessibility APIs and screen-reader QA.

## الاختبارات التقنية

الـGate الخاص بالمرحلة السابعة يتحقق من:

- ترتيب استيراد CSS.
- 44px touch contracts.
- reduced motion/theme timing.
- menu keyboard/focus relationship.
- ORBY offline draft/stop/copy recovery.
- semantic Checkout.
- semantic Error/404.
- request parallelism وORBY content visibility.
- وجود حدود القياس وعدم اختلاق Lighthouse.

بعد الدفع إلى `main` تكون GitHub CI وVercel Production هما مرجع النجاح النهائي للـtypecheck/lint/tests/build والنشر.

## المرحلة الثامنة

لم تبدأ ضمن هذه المهمة. المرحلة التالية تبقى: **Production Readiness, Security & Final UX Validation 8.0**، وتشمل التحقق الأمني/Production النهائي، المشاكل المعمارية أو البيانات التي تحتاج تغييرات أعلى خطورة، والقياسات البصرية/المتصفحية النهائية عندما تتوفر أدواتها.