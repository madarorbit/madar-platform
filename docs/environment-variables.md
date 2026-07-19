# متغيرات البيئة

انسخ `.env.example` إلى `.env` محلياً. القيم المطلوبة: `NEXT_PUBLIC_SITE_URL`, `DATABASE_URL`, `AUTH_SECRET`, `SUPER_ADMIN_EMAIL`, وإعدادات البريد والتخزين. لا تضع قيمة سرية في Git أو في متغير `NEXT_PUBLIC_*`. استخدم manager أسرار لدى الاستضافة ودوّر `AUTH_SECRET` وفق خطة جلسات مدروسة.
