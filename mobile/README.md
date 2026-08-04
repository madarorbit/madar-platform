# مَدار للهاتف — MADAR Mobile V2.0

تطبيق Expo/React Native عربي مخصص لحسابات الأعمال في مَدار. يستخدم Expo Router، وجلسة Supabase محفوظة داخل Secure Storage، وعقود API مشتركة مع منصة الويب. تتغير لوحة القيادة حسب نشاط مساحة العمل وطريقة تشغيلها، ولا يحتوي التطبيق أي مفتاح Connector أو مفتاح خاص بأوربي.

## البنية

- `app/(auth)`: تسجيل الدخول واستعادة كلمة المرور عبر Deep Link.
- `app/(app)`: الرئيسية، التنبيهات، العمليات، التقارير، أوربي، الحساب.
- `src/providers`: الجلسة، البيانات، المظهر، القفل الحيوي.
- `src/lib`: API V2، Supabase، التخزين الآمن، Push Notifications.
- `packages/contracts/mobile-v2`: العقود المشتركة بين التطبيق والمنصة.

## سلوك البيانات

- التطبيق يقبل حساب `BUSINESS` ومساحة عمل تجارية نشطة فقط.
- آخر Snapshot صالح يُحفظ داخل Secure Storage ويظهر بوضوح كنسخة قديمة عند انقطاع الشبكة.
- `MADAR_NATIVE`: الأوامر الداخلية تُنفذ عبر Command API في مَدار.
- `CONNECTED_EXTERNAL`: الأمر يمر عبر المعاينة والتأكيد والصلاحيات وConnector والتحقق والمزامنة.
- الكتابة الخارجية مغلقة افتراضيًا حتى ينجح ربط عميل حقيقي ويُفعّل المسار صراحة.
- الأسعار والمدفوعات والحذف الحساس وإدارة الفريق وبيانات الربط والعمليات الجماعية محظورة داخل V2.0.

## التشغيل المحلي

```bash
cd mobile
cp .env.example .env
npm install
npm run check
npm start
```

المتغيرات المطلوبة:

```env
EXPO_PUBLIC_MADAR_API_URL=https://www.orbitmadar.com
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLIC_PUBLISHABLE_KEY
EXPO_PUBLIC_RELEASE_CHANNEL=development
```

متغيرات `EXPO_PUBLIC_*` عامة بطبيعتها. لا تضف `SUPABASE_SERVICE_ROLE_KEY` أو مفاتيح Connector أو مفاتيح مزودي أوربي إلى التطبيق.

## التحقق والبناء

- `Mobile V2 CI`: TypeScript، Expo Lint، Expo Doctor، وتصدير Android.
- `Mobile V2 Android APK`: يولد مشروع Android ويبني `MADAR-V2.0-beta.apk` قابلًا للتثبيت، ثم يرفعه كـGitHub Artifact.
- `Mobile V2 EAS Build`: يعمل بعد الدمج إلى `main` ويبني:
  - ملف `preview`: APK موقّع للاختبار الداخلي.
  - ملف `production`: AAB موقّع للنشر في Google Play.

التوقيع الرسمي يُدار داخل EAS ولا يُحفظ keystore داخل المستودع. يحتاج GitHub إلى الأسرار التالية:

- `EXPO_TOKEN`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

ويجب أن يكون مشروع Expo مرتبطًا مسبقًا؛ يتحقق Workflow من ذلك بواسطة `eas project:info` قبل البناء.

## واجهات الخادم

- `GET /api/mobile/v2/bootstrap`
- `GET /api/mobile/v2/alerts`
- `GET /api/mobile/v2/operations`
- `POST /api/mobile/v2/commands/preview`
- `POST /api/mobile/v2/commands/confirm`
- `/api/mobile/v2/orby/*`
- `POST /api/mobile/v2/push-token`

كل طلب يستخدم Bearer access token، ويتحقق من عضوية مساحة العمل وسياسات RLS. لا يظهر نجاح لأي أمر خارجي قبل تأكيد النظام ثم مزامنة مَدار.
