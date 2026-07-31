# مَدار للهاتف — MADAR Mobile V1

تطبيق Expo/React Native عربي بنمط عرض فقط لعملاء مَدار. يستخدم نفس حساب Supabase ونفس سياسات RLS الخاصة بمنصة الويب، ويعرض لوحة القيادة والتقارير وتنبيهات أوربي ومحادثة أوربي دون أدوات إدارة المنتجات أو المخزون أو المستخدمين.

## نطاق V1

- تسجيل الدخول بالبريد وكلمة المرور.
- حفظ جلسة الدخول داخل SecureStore المشفّر واستعادتها وتحديثها تلقائيًا، لذلك لا يطلب تسجيل الدخول في كل تشغيل.
- مركز قيادة يوضح حالة العمل والمؤشرات والتنبيهات مرتبة حسب الأولوية.
- تقارير آخر 30 يومًا ورسم مبسط لآخر 7 أيام.
- تنبيهات المخزون والمهام المتأخرة وتنبيهات أوربي الاستباقية.
- محادثة أوربي ضمن صلاحيات مساحة العمل.
- مزامنة شبه لحظية عبر Supabase Realtime، مع تحديث عند عودة التطبيق للواجهة وكل 30 ثانية كمسار احتياطي.
- نسخة محلية لآخر Dashboard متاح عند ضعف الشبكة.
- أيقونة Android وشاشة بداية رسمية بهوية مَدار.
- لا توجد عمليات إنشاء أو تعديل أو حذف لبيانات الأعمال.

## التشغيل

```bash
cd mobile
cp .env.example .env
npm install
npm run typecheck
npm start
```

متغيرات `EXPO_PUBLIC_*` عامة بطبيعتها. الأمان يعتمد على جلسة المستخدم وRLS؛ لا تُضف `SUPABASE_SERVICE_ROLE_KEY` أو مفاتيح مزودي أوربي إلى التطبيق.

## إنشاء APK مستقل عبر EAS

ثبّت EAS وسجّل الدخول بالحساب المخصص لمَدار، ثم اربط المشروع مرة واحدة:

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest init
npm run build:apk
```

ملف `eas.json` يضبط ملف `preview` على `android.buildType=apk` ليكون الناتج إصدارًا مستقلًا قابلًا للتثبيت المباشر على أجهزة أندرويد، مع تضمين JavaScript bundle داخل الـAPK. إصدار Google Play يستخدم ملف `production` وينتج AAB.

## إنشاء أول APK من GitHub Actions

يوجد Workflow باسم `Build MADAR Android APK` داخل `.github/workflows/eas-apk.yml` ويعمل يدويًا، وعلى Pull Request، وبعد الدمج إلى `main` عند تغير ملفات الهاتف.

قبل تشغيله لأول مرة:

1. أنشئ حساب Expo/EAS الرسمي لمَدار.
2. أنشئ Expo access token من لوحة حساب مَدار.
3. أضف الرمز داخل GitHub Repository Secrets بالاسم `EXPO_TOKEN`. لا تضع الرمز داخل الكود أو المحادثات.
4. افتح GitHub Actions وشغّل Workflow يدويًا.

الـWorkflow ينفذ ما يلي:

- يتحقق من TypeScript وExpo Doctor.
- ينشئ أو يربط مشروع EAS تلقائيًا عبر `eas init --force --non-interactive`.
- يستخدم ملف `preview` لبناء Release APK مستقل وموقّع عبر EAS، وليس Debug APK الذي يحتاج Metro.
- يتحقق من وجود JavaScript bundle داخل الـAPK قبل رفعه.
- ينتظر اكتمال EAS Build ثم يحمّل الملف داخل GitHub Artifact باسم `madar-mobile-release-apk` لمدة 14 يومًا.

قبل Google Play استخدم ملف `production` لإنتاج AAB بمفتاح التوقيع الدائم الذي تديره EAS.

## واجهة الخادم

- `GET /api/mobile/v1/dashboard`: يرجع Snapshot مجمعًا باستخدام Bearer access token وسياسات RLS نفسها.
- `POST /api/orby`: يقبل جلسة الويب الحالية أو Bearer token من التطبيق.

لا يحتاج V1 إلى migration جديدة.
