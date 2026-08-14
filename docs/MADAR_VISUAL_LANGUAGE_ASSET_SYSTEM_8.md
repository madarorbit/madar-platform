# MADAR Visual Language & Asset System 8.0

الحالة: **تنفيذ المرحلة الثامنة — Visual Assets only**  
خط الأساس وقت التدقيق: `main` عند `df120a645cc73522c6d2d84a99fb5fa8051e3afd`.  
هذه المرحلة لا تعيد بناء UX Architecture أو Design System أو Shell أو Business Logic أو قاعدة البيانات.

## 1. Brand Lock

شعار مَدار أصل مقفل. لم يُعاد تصميم `public/brand/logo.svg` ولم تتغير هندسته أو ألوانه أو نصه. Git blob SHA-1 المرجعي قبل المرحلة: `2e87bf5ec0df8f919880da1e317f074a4830179f`. اختبار المرحلة يثبت هذا الـhash حرفيًا لمنع تغيير الشعار عرضيًا.

## 2. Visual Asset Audit

تم فحص المسارات الفعلية للأصول واستخداماتها قبل التعديل، بما في ذلك `public/brand`, `public/services`, صور الخدمات في `src/lib/services/catalog.ts`, `ServiceCards`, ORBY في الـShell/About/Home، وأصل فيديو الصفحة الرئيسية.

### أهم نتيجة تقنية

صور الخدمات السابقة في المستودع كانت WebP بحجم 400×400 فقط:

| الأصل القديم | أبعاد repo | الحجم التقريبي |
|---|---:|---:|
| `/services/connect-existing.webp` | 400×400 | 12.1 KB |
| `/services/build-on-madar.webp` | 400×400 | 13.9 KB |
| `/services/madar-retail.webp` | 400×400 | 13.1 KB |

في الوقت نفسه كانت بطاقة الخدمة تستخدم `next/image fill` مع `object-cover`، وفي العرض compact كانت مساحة الصورة `16:6` و`sizes="96px"`. لذلك كان المتصفح يستطيع طلب rendition أصغر من المساحة المرئية ثم تكبيره، بينما `object-cover` يقص أجزاء من التكوين المربع. السبب الحقيقي لانخفاض الجودة كان إذًا **مصدرًا صغيرًا + sizing غير دقيق + crop غير مناسب**، وليس مجرد قيمة `quality`.

### Masters المرفقة

| Master | Source dimensions | Source bytes | SHA-256 |
|---|---:|---:|---|
| Native Business | 1254×1254 PNG | 2,325,350 | `3466fac360f9a346557036c27169fb7b487a71aa312f6299ca45bbbb571513c6` |
| MADAR Retail | 1254×1254 PNG | 2,194,404 | `398ee11e7164696db7916b1ab3e60da0517c112bc4942de23e647dad0ecdcbab` |
| Connected Business | 1254×1254 PNG | 2,212,239 | `ea6bec6a7f763a0a3039efca523074070ba466964dc1f32c77600c99355b5247` |
| ORBY Master | 1536×1536 JPEG payload supplied with `.png` filename | 137,218 | `1460c30f8514bed9df2bc3ee280ad3927e315b15112faafbad1e3226d61c238e` |

لم تُعد رسم أي صورة. تم إنشاء production delivery derivatives WebP من نفس الـMasters، بنفس الأبعاد الكاملة وبدون crop، لتجنب تحميل PNGs متعددة الميغابايت في الويب.

| Production derivative | Dimensions | Bytes | SHA-256 |
|---|---:|---:|---|
| `public/assets/services/native-business-master.webp` | 1254×1254 | 91,016 | `083032838be4edb638d384975a9a667f849b187665512ae2fe4fb423523842ed` |
| `public/assets/services/madar-retail-master.webp` | 1254×1254 | 83,354 | `0f781f4bf2a30507acd24b96fd0c318e76ecb655cbe4a69cacd025fd9d8a4691` |
| `public/assets/services/connected-business-master.webp` | 1254×1254 | 77,790 | `11ce11a0361357138dcfc3a31a6fdda7359ffddc73f342716f2c4ff3271c9bd8` |
| `public/assets/orby/orby-master.webp` | 1536×1536 | 65,714 | `c90707f8f966ccea28c8e7a0c7bcb51feb1446115d9fc5003864c75cf92d92e9` |

هذه الملفات derivatives للتسليم وليست مصادر تصميم جديدة. Source of Truth يبقى الصور الأربع المقدمة للمهمة، والـhashes أعلاه توثقها.

## 3. MADAR Visual Language

### Level 1 — Functional UI icons

النظام التنفيذي الرسمي يبقى `components/ui/Icons.tsx`: outline موحد، stroke 1.8، round caps/joins، أحجام ترث السياق، وألوان semantic. تم إيقاف الاستيراد المباشر لـ`lucide-react` في صفحتي Retail المستهدفتين وربطهما بالنظام المركزي بدل خلط مكتبتين في نفس التجربة. لم تُضف icon package جديدة ولم تُحذف dependency موجودة على نحو قد يكسر legacy غير مدقق.

الأيقونة الوظيفية لا تتحول إلى artwork كبير لمجرد ملء الفراغ، ولا تستخدم Emoji كبديل لأيقونة UI.

### Level 2 — Illustrative language

- **Duotone Line** هو الأساس للرسومات الدلالية الجديدة عند الحاجة.
- **Geometric Minimal** طبقة مكملة للاتصال والبيانات والعُقد والتدفقات والأتمتة.
- **Soft 3D** accent محدود في لحظات الهوية البارزة فقط، وأبرز أمثلته المعتمدة حاليًا Masters الخدمات وORBY.
- لم تُنشأ رسومات جديدة لمجرد زيادة عدد الرسومات؛ القاعدة هي أقل عدد من الأصول مع وضوح أعلى.

## 4. Service Masters Integration

`src/lib/services/catalog.ts` أصبح يشير إلى derivatives عالية الدقة. `ServiceCards` لم يعد يطلب `96px` في compact ولم يعد يستخدم `object-cover`. الصورة تحفظ التكوين المربع عبر `object-fit: contain` و`aspect-ratio: 1/1` مع `sizes` responsive مناسب للبطاقات.

هذا يمنع stretching/cropping ويعطي Next Image معلومات أقرب إلى الحجم الحقيقي على الهاتف والكمبيوتر والشاشات عالية الكثافة.

## 5. ORBY Visual Identity

تم التفريق صراحة بين:

- `orbyMaster`: `public/assets/orby/orby-master.webp` للاستخدامات التعريفية البارزة.
- `orbyCompact`: `public/brand/orby-assistant.svg` للاستخدامات الصغيرة القائمة مثل navigation/avatar.
- `orby` بقي alias متوافقًا مع compact حتى لا تنكسر consumers القديمة.

قسم ORBY البارز في `/about` أصبح يستخدم Master 1536×1536 مع `next/image` و`sizes` بدل تكبير compact asset 256×256 إلى 640px مع `unoptimized`.

## 6. Logo, marks, favicon

تم التحقق من أن المنتج يستخدم `public/brand/logo.svg` كالشعار الرئيسي. توجد أصول/نسخ تاريخية مكررة في `public` و`public/brand`; لم تُحذف تلقائيًا لأن هذه المرحلة لا تحذف أصلًا قبل إثبات عدم وجود consumers. تنظيف duplicates المتبقية يؤجل لتدقيق المرحلة التاسعة.

## 7. Home identity video

المحتوى لم يتغير ولم يُعد إنتاجه. التنفيذ الحالي يستخدم `autoplay`, `muted`, `loop`, `playsInline`, `preload="metadata"` وposter ثابت. لم توجد ضرورة موثقة لاستبدال الفيديو أو رفع preload إلى eager؛ لذلك حُفظ المحتوى ومسار التحميل بدل إضافة عبء بصري جديد.

## 8. Light / Dark / System

الصور الرسمية ذات تكوين داكن ثابت، لذلك لم تُنشأ variants مزيفة أو recoloring. الإطارات والخلفيات والحدود المحيطة بها تستخدم semantic tokens (`--md-surface-sunken`, `--md-border-default`) كي تظل مندمجة في Light/Dark/System. Functional icons ترث `currentColor` من النظام الدلالي.

## 9. Responsive assets

العقود المضافة تمنع خروج الصور من البطاقة وتحافظ على 1:1، وتضع حدًا بصريًا معقولًا على الشاشات دون 390px. `sizes` لخدمات الحساب وORBY التعريفي يصف العرض المتوقع بدل thumbnail ثابت. هذا contract-level responsive validation؛ لم يُنفذ فحص pixel-perfect على أجهزة 320/360/390/430 فعلية داخل هذه البيئة.

## 10. Accessibility

- صور الخدمات meaningful وتحمل alt يصف أنها الصورة الرسمية للخدمة.
- ORBY Master يحمل alt دلاليًا.
- أيقونات النظام المركزي `aria-hidden` افتراضيًا ويأتي الاسم من النص/زر الـprimitive المحيط.
- Forced Colors له حدود واضحة على أطر الأصول.
- لا animation جديدة؛ reduced-motion يظل authoritative.

## 11. Performance impact

الـMasters الأصلية الثلاثة للخدمات كانت أكثر من 2MB لكل PNG. derivatives الجديدة تحت 100KB لكل خدمة مع الحفاظ على 1254×1254، وORBY derivative ~65.7KB عند 1536×1536. لم تضف المرحلة dependency أو 3D runtime أو Base64 داخل JS، ولم تحول Server Components إلى Client Components من أجل الصور.

## 12. Visual regression gate

`tests/madar-visual-language-asset-system-8.test.mjs` يفحص:
- ترتيب استيراد CSS للمرحلة.
- hash الشعار المقفل.
- hashes وأبعاد derivatives الأربعة.
- مسارات الخدمات الصحيحة.
- `sizes` وعدم العودة إلى `96px`/`object-cover`.
- Master/Compact ORBY contracts.
- عدم وجود direct `lucide-react` في Retail المستهدف.
- semantic colors في طبقة المرحلة.
- بقاء عقد الفيديو المقفل.

## 13. Boundaries / Known gaps for Phase 9

- توجد duplicates/legacy assets في `public` و`public/brand` تحتاج consumer-by-consumer cleanup قبل حذفها.
- `manifest.ts` يصف `/brand/symbol.png` كـ192×192 بينما اسم/الأصل التاريخي يستحق تدقيقًا مستقلًا بدل تعديل branding في هذه المرحلة.
- بعض الصفحات القديمة، ومنها أجزاء من About، ما زالت تحمل legacy utility colors؛ لم تُعاد هيكلة Layout/Theme لأن المطلوب هنا Visual Assets فقط.
- أي مشاكل Admin/Foundation، currencies، RPC/RLS، navigation العامة أو Retail DB ليست ضمن هذه المرحلة.

## 14. Validation honesty

لم يتم ادعاء pixel-perfect أو Safari/Firefox أو physical-device testing إذا لم تتوفر أدوات المتصفح المناسبة. الـQA المرئي النهائي يجب أن يميّز بوضوح بين source/static contracts وProduction HTTP smoke وبين فحص screenshot حقيقي إن توفر لاحقًا.
