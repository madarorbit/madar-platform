# Retail Security

## هوية وقاعدة واحدة مع عزل الخدمة

- Supabase الرئيسي يصدر الجلسة وGoogle PKCE ويحدد profile وorganization membership.
- لا توجد جلسة أو مفاتيح Retail ثانية في المتصفح.
- جداول `retail_*` منفصلة اسميًا عن جداول المنصة، وكل صف أعمال مرتبط بـ`workspace_id`.
- RLS يتحقق من `retail_workspace_members`، واختبار مستأجرين يثبت أن مستخدم المتجر A لا يرى المتجر B.
- BFF يتحقق server-side من المستخدم، حالة profile، منظمة الأعمال، عضويته، وقرار `authorizeOrganizationAction`/OpenFGA، ثم يطابق `platform_organization_id` قبل الوصول إلى البيانات.
- قدرة ORBY تمر كذلك عبر `can_use_orby`، وطلب الدفع عبر `can_manage_billing`؛ OpenFGA يستطيع تضييق صلاحية مَدار ولا يستطيع منح ما رفضته مَدار.
- كل استعلام Retail يحمل workspace filter مأخوذًا من الربط الموثق لا من form.

## الكتابات المالية

`retail_platform_execute(actor_user, operation_name, operation_args)`:

1. قابل للتنفيذ من `service_role` فقط.
2. يرفض actor غير متزامن من مَدار.
3. يقبل allowlist ثابتة؛ لا SQL ديناميكي من اسم العملية.
4. يعيد `auth.uid()` للactor داخل المعاملة.
5. يستدعي RPC الأصلية التي تتحقق من الدور والاشتراك والمخزون والصندوق وUUID idempotency.
6. أي خطأ يسبب rollback كاملًا.

بعد migration التقوية، لا يستطيع `authenticated` استدعاء أي SECURITY DEFINER RPC مالي لـRetail مباشرة. RLS وسياسات workspace باقية كطبقة دفاع إضافية. Security Advisor لا يعرض ملاحظات مرتبطة بجداول أو دوال Retail بعد التطبيق.

## الملفات وORBY

- upload يتم من Server Action بعد MIME/magic-byte/size validation، وبمسار يبدأ بـworkspace UUID.
- مفاتيح service role ومزودات ORBY server-only.
- ORBY يستلم evidence صغيرًا من analytics الحتمية، لا dump للقاعدة.
- أدوات ORBY المالية غير موجودة؛ طلبات التعديل تُرفض. أي جواب موديل يضيف رقمًا غير موجود في evidence يُستبدل بالجواب الحتمي.
- logging لا يسجل tokens أو cookies أو secrets أو raw prompts.

## التحقق

- اختبار bridge guard يثبت رفض authenticated وقبول service role ثم رفض عملية خارج allowlist.
- اختبار مالي remote داخل `BEGIN … ROLLBACK` نفذ onboarding، منتجًا، شراءً، بيعًا نقديًا وآجلًا، مصروفًا وتحصيلًا، ثم تحقق من stock/cash/debt/revenue دون إبقاء بيانات اختبار.
- `tests/madar-retail-integration.test.mjs` يحرس حدود الهوية، الأسرار، ORBY، allowlist والمنطق المالي.
