# مَدار | MADAR ORBIT

واجهة مَدار العربية للمنتجات الرقمية وحلول الأتمتة والتجارة. المشروع مبني بـNext.js App Router وTypeScript وTailwind، مع أساس آمن لتوسعة التجارة إلى PostgreSQL وتخزين خاص وبريد معاملاتي.

> **حالة مهمة:** الواجهة والهوية والتوثيق الأمني جاهزة، لكن المصادقة وقاعدة البيانات والطلبات ورفع الإثباتات والتسليم الموقّع لم تُربط بعد. زر إنشاء الطلب معطل عمداً إلى أن تُنفذ طبقة الاستمرارية؛ لا تستخدم النسخة الحالية لاستلام مدفوعات.

## التشغيل المحلي

```bash
npm ci
cp .env.example .env
npm run dev
```

افتح `http://localhost:3000`. افحص الجودة قبل أي دمج:

```bash
npm run lint
npx tsc --noEmit
npm run build
```

## متغيرات البيئة

راجع [توثيق المتغيرات](docs/environment-variables.md). لا ترفع `.env`. يجب أن يبقى `SUPER_ADMIN_EMAIL` مضبوطاً على بريد المالك الرسمي، ولا يحتوي المشروع على كلمة مرور للمالك.

## إعداد قاعدة البيانات والمالك (بعد تنفيذ طبقة الاستمرارية)

1. جهز PostgreSQL واضبط `DATABASE_URL` و`AUTH_SECRET` عشوائياً.
2. شغّل migrations الخاصة بالـORM الذي يُعتمد في مرحلة الاستمرارية.
3. أنشئ حساب المالك عبر التسجيل والتحقق من البريد.
4. شغّل seed إدارياً لمرة واحدة؛ لا يرقّي إلا البريد المطابق لـ`SUPER_ADMIN_EMAIL` والمتحقق منه.
5. راجع سجلات التدقيق، ثم اختبر رفض المستخدم العادي لمسارات الإدارة.

تفاصيل المخطط في [database-schema.md](docs/database-schema.md)، ودورة التحويل في [payment-workflow.md](docs/payment-workflow.md).

## النشر

لا تنشر checkout كمسار مدفوع قبل ربط PostgreSQL والتخزين الخاص والبريد والمصادقة. خطوات النشر وخيارات الاستضافة في [deployment.md](docs/deployment.md)، وقائمة الاعتماد في [launch-checklist.md](docs/launch-checklist.md).

## التوثيق

- [تدقيق المشروع](docs/current-project-audit.md)
- [خارطة الطريق](docs/madar-platform-roadmap.md)
- [المعمارية](docs/architecture.md)
- [الوصول الإداري](docs/admin-access.md)
- [الأمان](docs/security-checklist.md)
- [النسخ والاستعادة](docs/backup-and-recovery.md)
