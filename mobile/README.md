# مَدار للهاتف — MADAR Mobile V1

تطبيق Expo/React Native عربي بنمط عرض فقط لعملاء مَدار. يستخدم نفس حساب Supabase ونفس سياسات RLS الخاصة بمنصة الويب، ويعرض لوحة القيادة والتقارير وتنبيهات أوربي ومحادثة أوربي دون أدوات إدارة المنتجات أو المخزون أو المستخدمين.

## نطاق V1

- تسجيل الدخول بالبريد وكلمة المرور.
- استعادة الجلسة وتحديثها تلقائيًا.
- مركز قيادة يوضح حالة العمل والمؤشرات والتنبيهات مرتبة حسب الأولوية.
- تقارير آخر 30 يومًا ورسم مبسط لآخر 7 أيام.
- تنبيهات المخزون والمهام المتأخرة وتنبيهات أوربي الاستباقية.
- محادثة أوربي ضمن صلاحيات مساحة العمل.
- نسخة محلية لآخر Dashboard متاح عند ضعف الشبكة.
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

## إنشاء APK تجريبي محليًا

ثبّت EAS وسجّل الدخول بالحساب المخصص لمَدار، ثم اربط المشروع مرة واحدة:

```bash
cd mobile
npx eas-cli@latest login
npx eas-cli@latest init
npm run build:apk
```

ملف `eas.json` يضبط ملف `preview` على `android.buildType=apk` ليكون الناتج قابلًا للتثبيت المباشر على أجهزة أندرويد. إصدار Google Play لاحقًا يستخدم ملف `production` وينتج AAB.

## إنشاء أول APK من GitHub Actions

يوجد Workflow يدوي باسم `Build MADAR Prototype APK` داخل `.github/workflows/eas-apk.yml`.

قبل تشغيله لأول مرة:

1. أنشئ حساب Expo/EAS الرسمي لمَدار.
2. أنشئ Expo access token من لوحة حساب مَدار.
3. أضف الرمز داخل GitHub Repository Secrets بالاسم `EXPO_TOKEN`. لا تضع الرمز داخل الكود أو المحادثات.
4. افتح GitHub Actions وشغّل Workflow يدويًا.

الـWorkflow ينفذ ما يلي:

- يتحقق من TypeScript وExpo Doctor.
- ينشئ أو يربط مشروع EAS تلقائيًا عبر `eas init --force --non-interactive`.
- يستخدم ملف `prototype` لبناء Debug APK قابل للتثبيت دون إعداد Android production credentials.
- ينتظر اكتمال EAS Build ثم يحمّل الملف داخل GitHub Artifact باسم `madar-mobile-prototype-apk` لمدة 14 يومًا.

ملف `prototype` مخصص للاختبار المبكر فقط. قبل Google Play يجب إنشاء مفتاح توقيع دائم واستخدام ملف `production` لإنتاج AAB.

## واجهة الخادم

- `GET /api/mobile/v1/dashboard`: يرجع Snapshot مجمعًا باستخدام Bearer access token وسياسات RLS نفسها.
- `POST /api/orby`: يقبل جلسة الويب الحالية أو Bearer token من التطبيق.

لا يحتاج V1 إلى migration جديدة.
