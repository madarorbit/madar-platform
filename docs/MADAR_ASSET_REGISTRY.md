# MADAR Asset Registry

مرجع بسيط للأصول البصرية الأساسية. لا يُنشئ Design System جديدًا؛ هدفه منع تعدد النسخ غير الموثقة.

| Asset name | Role | File path | Type | Status | Source of Truth | Allowed usage | Light/Dark behavior | Notes |
|---|---|---|---|---|---|---|---|---|
| MADAR Logo | الشعار الرسمي الكامل | `public/brand/logo.svg` | SVG | LOCKED | الأصل الحالي المقفل؛ Git blob `2e87bf5ec0df8f919880da1e317f074a4830179f` | Navbar, Shell, Footer, Admin brand presentation | لا recolor ولا redesign؛ اضبط container فقط | ممنوع تغيير geometry/text/colors في Phase 8 |
| MADAR Symbol | brand mark / app mark | `public/brand/symbol.png` + المقاسات القائمة | PNG | LOCKED / LEGACY SET | الأصول الحالية في `public/brand` | favicon/PWA/app marks حسب consumer الحالي | لا variant جديد بلا ضرورة | توجد نسخ تاريخية/مكررة؛ لا حذف قبل consumer audit |
| ORBY Master | الشخصية الرسمية في المساحات البارزة | `public/assets/orby/orby-master.webp` | WebP 1536×1536 | ACTIVE MASTER DERIVATIVE | الملف المرفق للمهمة SHA-256 `1460c30f...c238e` | About/intro/major explanation | لا recolor؛ semantic frame حوله | derivative SHA-256 `c90707f8...d92e9` |
| ORBY Compact | تمثيل ORBY المصغر | `public/brand/orby-assistant.svg` | SVG wrapper | ACTIVE COMPACT | الأصل الرسمي الموجود قبل Phase 8 | nav/avatar/floating face/small badges | نفس الأصل؛ semantic container | لا يُكبّر كـhero artwork |
| Connected Business Service | Master لخدمة ربط تجارة قائمة | `public/assets/services/connected-business-master.webp` | WebP 1254×1254 | ACTIVE MASTER DERIVATIVE | Master المرفق SHA-256 `ea6bec6a...b5247` | Service cards / service selection | لا recolor؛ contain داخل semantic surface | لا تستخدم thumbnail 400px القديم |
| Native Business Service | Master لخدمة بناء تجارة على مَدار | `public/assets/services/native-business-master.webp` | WebP 1254×1254 | ACTIVE MASTER DERIVATIVE | Master المرفق SHA-256 `3466fac3...13c6` | Service cards / service selection | لا recolor؛ contain داخل semantic surface | لا crop للتكوين الأصلي |
| MADAR Retail Service | Master لخدمة MADAR Retail | `public/assets/services/madar-retail-master.webp` | WebP 1254×1254 | ACTIVE MASTER DERIVATIVE | Master المرفق SHA-256 `398ee11e...cbab` | Service cards / service selection | لا recolor؛ contain داخل semantic surface | لا crop للتكوين الأصلي |
| MADAR Identity Poster | poster/OG/hero fallback | `public/brand/madar-identity.jpg` | JPG | ACTIVE | الأصل الحالي في المستودع | Home video poster / identity preview / OG حسب config | ثابت؛ لا recolor runtime | افحص أي redesign فقط ضمن Branding مستقل |
| MADAR Identity Motion | فيديو الهوية في Home | `public/brand/madar-identity-motion.mp4` | MP4 | LOCKED CONTENT | الفيديو الحالي | Home identity visual فقط | ثابت؛ container دلالي | preload metadata + muted + playsInline؛ لا إعادة إنتاج في Phase 8 |
| Functional Icon System | الوظائف المباشرة | `components/ui/Icons.tsx` | Inline SVG | ACTIVE | Design System 2.0 | buttons, nav, status, utilities | `currentColor` + semantic tokens | stroke 1.8، round caps/joins، لا emoji UI |
| Core Illustration Language | قواعد الرسومات الدلالية | `docs/MADAR_VISUAL_LANGUAGE_ASSET_SYSTEM_8.md` | Rule family | ACTIVE RULE | Phase 8 visual language | Feature/onboarding/important empty state عند الحاجة | semantic colors؛ Light/Dark من tokens | Duotone Line + Geometric Minimal؛ Soft 3D accent فقط |

## Naming rule

استخدم أسماء مستقرة تصف الدور: `domain-role-master.ext` أو `brand-role-size.ext`. لا تستخدم سلاسل من نوع `final-new-v2-real-final`.

## Change rule

أي استبدال لـLOCKED أو MASTER يحتاج مقارنة مع Source of Truth، توثيق dimensions/hash/consumers، وعدم حذف النسخة السابقة قبل إثبات أن لا consumer يعتمد عليها.
