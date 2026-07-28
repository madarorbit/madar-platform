# ORBY Stage 2 — Agent Execution Layer

**المرجع:** ORBY Initial Architecture & Build Roadmap  
**الموقع المعماري:** مرجع فرعي تابع لـ MADAR Integration Master Roadmap، وليس خارطة مستقلة.  
**الحالة الافتراضية:** مبني، لكن التخطيط والتنفيذ والأدوات مغلقة افتراضيًا حتى التفعيل الإداري الصريح.

## 1. الهدف والنطاق

تضيف هذه المرحلة طبقة تنفيذ منظمة فوق نواة ORBY التي بُنيت في المرحلة الأولى، بحيث تتحول النتيجة من إجابة نصية فقط إلى دورة وكيل كاملة:

1. فهم الهدف.
2. إنشاء خطة صريحة قبل التنفيذ.
3. التحقق من الخطة والأدوات والحدود.
4. إدخال التشغيل في Queue.
5. فحص العضوية والصلاحيات والسياسات لكل Action.
6. طلب الموافقة عند الحاجة.
7. تنفيذ الأداة عبر الواجهة القياسية فقط.
8. إعادة المحاولة أو الانتظار أو التراجع.
9. حفظ النتيجة والأحداث وسجل التدقيق.
10. إرسال إشعار بالحالة.

لا تنفذ هذه المرحلة الذاكرة طويلة المدى أو التعلم الذاتي أو قاعدة معرفة دائمة؛ تبقى هذه وظائف المرحلة الثالثة.

## 2. العلاقة بما بُني سابقًا

هذه الطبقة إضافية ولا تستبدل:

- ORBY Kernel ومزوداته وسجل نماذجه وجلساته.
- ORBY التشغيلي القديم ومسودات إجراءاته.
- Connector SDK وConnector Registry.
- Integration Gateway وIntegration Queue.
- REST وWebhook وFile وDatabase وLocal Bridge Connectors.
- Initial/Incremental Sync، Checkpoints، Idempotency وRetries.
- UDM وخط الجودة والمراقبة وLineage.
- جدول الإشعارات الحالي في مَدار.

الربط يتم عبر `OrbyMadarToolGateway` وAdapters محددة. لا يستورد Kernel منطق أداة، ولا تستدعي الأدوات موصلًا أو قاعدة بيانات أعمال مباشرة.

## 3. البنية البرمجية

المجلد الرئيسي:

```text
src/lib/orby/execution/
```

ويحتوي على:

```text
contracts.ts             العقود والأنواع الموحدة
errors.ts                أخطاء التنفيذ والتوقف القابل للاستئناف
tools.ts                 Registry/Loader/Validator/Dispatcher/Timeout/Result
builtin-tools.ts         الأدوات الرسمية المسجلة بالكود
governance.ts            Permission/Policy/Approval/Limits
planning.ts              Model/Manifest/Composite Planner وPlan Validator
workflow-helpers.ts      القوالب والشروط وأدوات حالة Workflow
sandbox.ts               بيئة المعاينة المعزولة
 action-engine.ts         دورة Action والموافقات وRetry
rollback.ts              Compensation وPartial Undo
workflow-engine.ts       Sequential/Parallel/Conditional/Loop/Delay/Event
agent-runtime.ts          Submit/Queue/Worker/Status/Cancel
memory.ts                تطبيقات الذاكرة للاختبارات
http.ts                  هوية الطلب وتحويل الأخطاء إلى HTTP
server.ts                تركيب الخادم مع ORBY وSupabase ومحرك الربط
adapters/                 حدود التخزين وMADAR Integration Gateway
index.ts                 نقطة التصدير الرسمية
```

## 4. Tool System

### Tool Interface

كل أداة تطبق `OrbyTool` ولا توجد قناة تنفيذ بديلة. العقد الإلزامي:

```ts
metadata()
validate()
authorize()
execute()
cancel()
health()
```

### Tool Manifest

كل Manifest يحمل دون دمج أو حذف:

- الاسم.
- الوصف.
- الإصدار.
- التصنيف.
- الصلاحيات المطلوبة.
- نوع التنفيذ.
- مخطط المدخلات.
- مخطط المخرجات.
- مستوى الخطورة.
- الحالة.
- مستوى الدعم.
- المتطلبات.
- الحد الأقصى للزمن.
- دعم Sandbox.
- اسم العملية الداخلية.
- Metadata اختيارية.

### Tool Registry

`OrbyToolRegistry`:

- يمنع تكرار الاسم.
- يرفض الأداة غير المطابقة للعقد.
- يعيد الأدوات عبر الاسم فقط.
- يوفر اكتشاف Manifests المفعلة.
- لا يحمل كودًا من قاعدة البيانات.

### Tool Loader

`OrbyToolLoader` لا يحمل إلا Factories مسجلة داخل الكود الموثوق. جدول `orby_tool_catalog` يخزن Metadata وحالة التفعيل فقط، ولا يخزن JavaScript أو SQL أو أي كود ديناميكي.

### Tool Validator

`OrbyToolValidator` يتحقق من JSON Schema المصغر المعتمد، بما يشمل:

- النوع.
- الحقول المطلوبة.
- الحدود النصية والرقمية.
- Enum.
- عناصر القوائم.
- منع الحقول الإضافية عندما يحدد Manifest ذلك.

### Tool Dispatcher

`OrbyToolDispatcher` هو المدخل الوحيد للأداة، ويطبق بالترتيب:

1. جلب الأداة من Registry.
2. التحقق من Payload.
3. استدعاء Authorize الخاص بالأداة.
4. إنشاء AbortController.
5. تطبيق Timeout.
6. تنفيذ الأداة.
7. توحيد النتيجة.
8. إلغاء التنفيذ عند انتهاء الزمن أو طلب الإلغاء.

### Result Parser

كل نتيجة تتحول إلى `OrbyToolResult` موحد:

- `ok`.
- `data`.
- `warnings`.
- `metrics`.
- `error.code`.
- `error.message`.
- `error.retryable`.
- `error.details`.

## 5. الأدوات الأولية الرسمية

تم تسجيل الأدوات التالية، وجميعها تكون Disabled في قاعدة البيانات حتى التفعيل الإداري:

### Data

`madar.data.search`

- قراءة فقط من `integration_udm_records`.
- مقيدة بالمؤسسة.
- لا تقرأ الأسرار أو Raw credentials.

### Files

`madar.files.export.request`

- تنشئ طلب تصدير كمسودة داخل `orby_action_drafts`.
- لا تنشئ ملفًا أو تحمله مباشرة في هذه المرحلة.

### Platform

`madar.platform.notify.self`

- تنشئ إشعارًا للمستخدم الطالب نفسه فقط.
- لا تختار مستخدمًا آخر من Payload.

### Business

`madar.business.action.draft`

- تنشئ مسودة إجراء أعمال.
- لا تعدل الطلبات أو العملاء أو المخزون مباشرة.
- التنفيذ الفعلي للمسودة يظل في مسار مَدار المعتمد.

### Intelligence

`orby.intelligence.analyze`

- يستدعي ORBY Kernel للتحليل فقط.
- يمرر `toolsDisabled` في Metadata.
- لا يسمح بتحويل التحليل إلى استدعاء أداة متداخل.

### Integration

`madar.integration.connection.test`  
`madar.integration.sync.initial`  
`madar.integration.sync.incremental`

- تتحقق من أن الاتصال يخص المؤسسة.
- لا تستدعي Connector مباشرة.
- تتحقق من Feature Flag `integration_engine_enabled` قبل الإرسال الفعلي، وترفض المزامنة إذا لم يكن الاتصال Active.
- ترسل Job إلى `IntegrationQueue` الموجودة.
- تعمل مع REST/Webhook/File/Database/Local Bridge بحسب Connector المسجل؛ لذلك لا يعاد بناء أداة منفصلة لكل نوع موصل.

## 6. Task Planner

يوجد ثلاثة Planners:

### ModelTaskPlanner

- يستخدم ORBY Kernel لإنشاء JSON Plan فقط.
- يرسل قائمة الأدوات المفعلة وحدها.
- يمنع ادعاء التنفيذ في Prompt التخطيط.
- لا ينفذ أداة أثناء التخطيط.

### ManifestTaskPlanner

- Fallback حتمي.
- يختار أداة من Manifest حسب الهدف أو `metadata.toolName`.
- مفيد عند غياب مزود لغوي أو لخطة أداة واحدة صريحة.

### CompositeTaskPlanner

- يجرب مخطط النموذج أولًا.
- ينتقل إلى Manifest Planner عند فشل مخطط النموذج.
- لا يتجاوز Validator بعد إنشاء الخطة.

### Plan Validator

يفحص قبل Queue:

- اكتمال الهدف والملخص ونقطة النهاية.
- فرادة معرفات الخطوات.
- وجود جميع الأدوات في Registry.
- صحة Dependencies.
- تطابق `toolNames` مع الإجراءات.
- Maximum Steps.
- Maximum Parallel Tasks.
- Maximum Loop Iterations.
- Maximum Payload Bytes.
- حدود Delay.

## 7. Workflow Engine

يدعم كل الأنواع المعتمدة:

- `sequence`: تنفيذ متسلسل.
- `parallel`: تنفيذ متوازٍ على دفعات محدودة.
- `condition`: Branching حسب شرط موحد.
- `loop`: تكرار على قائمة مع حد أقصى صارم.
- `delay`: توقف قابل للاستئناف عبر Queue.
- `approval`: نقطة موافقة مستقلة داخل Workflow.
- `event`: إطلاق حدث وحفظه.
- `action`: إنشاء Action مستقل وتشغيله.

يحفظ `completedNodeIds` و`results` و`variables`، ولذلك يستطيع الاستئناف دون إعادة الخطوات المكتملة.

## 8. Action Engine

كل استدعاء أداة يتحول إلى صف مستقل في `orby_actions`.

الدورة:

```text
pending
→ running
→ waiting_approval أو retry
→ completed أو failed أو cancelled
→ compensated عند التراجع
```

قبل التنفيذ يقوم Action Engine بـ:

- إنشاء/استرجاع Action Idempotently عبر `run_id + step_key`.
- حل عضوية المستخدم.
- التحقق من Permission Engine.
- تقييم Policy Engine.
- استهلاك حدود الاستخدام.
- تنفيذ Sandbox عند وجوبه.
- طلب الموافقة عند وجوبها.
- تطبيق Retry وTimeout.
- حفظ الأحداث والتدقيق والنتيجة.

## 9. Approval Engine

الحالات:

- Pending.
- Approved.
- Rejected.
- Expired.

النطاقات:

- `user`: الطالب نفسه، ويستطيع OWNER/ADMIN أيضًا اتخاذ القرار.
- `manager`: OWNER أو ADMIN فقط.
- `system`: لا يقبله أي مستخدم عبر واجهة الموافقات؛ يقرره مسار خادمي داخلي عبر `decideSystemApproval()` فقط، ثم يعيد التشغيل إلى Queue.

عند الموافقة يعاد إدخال التشغيل إلى Queue بمفتاح Idempotency جديد. عند الرفض يغلق التشغيل بفشل واضح ولا ينفذ الإجراء.

## 10. Permission Engine

يتحقق من:

- المستخدم.
- المؤسسة.
- حالة المؤسسة.
- مساحة العمل.
- دور العضوية.
- صلاحيات الأداة.
- صلاحية اتخاذ قرار الموافقة.

الصلاحيات الافتراضية:

### OWNER وADMIN

- `data.read`
- `files.export`
- `platform.notify`
- `business.action.draft`
- `integration.manage`
- `integration.sync`
- `intelligence.analyze`
- `orby.execute`
- `orby.approve.user`
- `orby.approve.manager`

### MEMBER

لا يملك `integration.manage` أو `integration.sync` أو موافقة المدير.

لا توجد صلاحية `*` ولا دور يمنح ORBY وصولًا مطلقًا.

## 11. Policy Engine

السياسات منفصلة عن الأدوات ومرتبة بالأولوية، مع Default Deny.

السياسات الافتراضية:

1. رفض الأداة غير النشطة.
2. رفض الحذف إذا كان Switch الحذف مغلقًا.
3. رفض الكتابة الخارجية إذا كان Switch الكتابة الخارجية مغلقًا.
4. موافقة مدير للعملية الحرجة.
5. موافقة مدير للعملية عالية الخطورة.
6. موافقة مدير للحذف.
7. موافقة مستخدم للعملية الخارجية.
8. موافقة مستخدم للكتابة متوسطة الخطورة.
9. السماح بالقراءة والتحليل منخفضي/متوسطي الخطورة.
10. السماح بالكتابة الداخلية منخفضة الخطورة.
11. رفض أي حالة لا تطابق سماحًا صريحًا.

## 12. Retry Engine

يدعم:

- Fixed Retry.
- Exponential Backoff.
- `maxAttempts` على مستوى الخطة أو الأداة.
- `retryableCodes` على مستوى Action.
- حد أقصى للتأخير.
- Retry مستقل للـQueue عند خطأ Worker قابل لإعادة المحاولة.

## 13. Rollback Engine

يدعم Compensation وPartial Undo:

- لا يحاول التراجع إلا عن Actions المكتملة.
- ينفذ بترتيب عكسي.
- لا يخترع عكسًا تلقائيًا؛ يجب أن تحمل Action خطة Compensation صريحة.
- Compensation نفسها أداة مسجلة وتمر عبر Dispatcher.
- يسجل عدد الإجراءات المعوضة والفاشلة.

## 14. Queue System

جدول مستقل: `orby_execution_queue`.

الحالات:

- Pending.
- Running.
- Waiting.
- Retry.
- Failed.
- Completed.
- Cancelled.

خصائص الأمان والاستقرار:

- `FOR UPDATE SKIP LOCKED`.
- Lease وHeartbeat.
- Worker ID.
- Available At.
- Priority.
- Attempts وMax Attempts.
- Idempotency Key فريد داخل المؤسسة.
- RPCs محصورة في `service_role`.
- Worker endpoint محمي بسر Server-only.

لا ينفذ `submit()` خطة مباشرة؛ يحفظ Workflow/Run ثم يرسل Queue Job فقط.

## 15. Event-driven Execution

الأحداث البرمجية تشمل:

- Workflow Planned.
- Workflow Queued.
- Workflow Started.
- Workflow Waiting.
- Workflow Completed.
- Workflow Failed.
- Workflow Cancelled.
- Tool Started.
- Tool Finished.
- Tool Failed.
- Approval Requested.
- Approval Granted.
- Approval Rejected.
- Rollback Started.
- Rollback Completed.
- Sandbox Completed.

كما تحفظ أحداث دائمة في `orby_execution_events`، ولا يعتمد النظام على listeners الذاكرية وحدها.

## 16. Audit Trail

`orby_execution_audit` يسجل:

- Run.
- Action.
- Approval.
- Organization.
- Actor.
- Event Type.
- Reason.
- Outcome.
- Metadata.
- Timestamp.

أي Action يمر بمسار تدقيق حتى لو رفضته الصلاحية أو السياسة.

## 17. Notification Engine

يعيد استخدام جدول `notifications` الموجود في مَدار، ويرسل عند:

- طلب الموافقة؛ موافقة المستخدم ترسل لصاحب الطلب، وموافقة المدير ترسل إلى OWNER/ADMIN في المؤسسة.
- اكتمال Workflow.
- فشل Workflow.

ويمكن إضافة مستمعين لاحقًا لبقية أحداث المخاطر دون تعديل Kernel.

## 18. Execution Limits

الإعدادات المدعومة:

- Tool Timeout.
- Maximum Tool Timeout.
- Maximum Workflow Steps.
- Maximum Parallel Actions.
- Maximum Loop Iterations.
- Maximum Attempts.
- Retry Base/Maximum Delay.
- Approval TTL.
- Daily Action Limit.
- Per-minute Action Limit.
- Maximum Payload Bytes.
- Allow External Writes.
- Allow Deletes.
- Sandbox Required for High Risk.

الاستهلاك يحفظ في `orby_execution_usage` عبر RPC ذرية.

## 19. Sandbox

`OrbySandboxRunner`:

- لا يعمل إلا إذا أعلن Manifest دعم Sandbox.
- ينفذ Context بوضع `sandbox`.
- يحفظ الإدخال والنتيجة في `orby_sandbox_runs`.
- الأدوات الرسمية لا تكتب إلى الإنتاج في هذا الوضع.
- العملية عالية/حرجة الخطورة يمكن أن تمر أولًا بالمعاينة، ثم تنتظر موافقة، ثم تنفذ في Production.

هذا Sandbox على مستوى تأثير الأداة، وليس حاوية عامة لتشغيل كود غير موثوق؛ تشغيل كود العميل الديناميكي ممنوع أصلًا.

## 20. Result Engine

`OrbyToolResultParser`:

- يتحقق من وجود نتيجة.
- يوحد النجاح والفشل.
- يرفض الاستجابة غير الصالحة.
- يحفظ النتيجة داخل Action.
- يعيدها إلى Workflow state.
- يتيح استخدامها في Conditions وLoops وTemplates.

## 21. قاعدة البيانات

الجداول الجديدة:

1. `orby_execution_config`
2. `orby_tool_catalog`
3. `orby_workflows`
4. `orby_workflow_runs`
5. `orby_actions`
6. `orby_approvals`
7. `orby_execution_queue`
8. `orby_execution_events`
9. `orby_execution_audit`
10. `orby_sandbox_runs`
11. `orby_execution_usage`

كل جدول في `public` مفعّل عليه RLS، وله فهارس تغطي المفاتيح الخارجية ومسارات التشغيل.

### صلاحيات المتصفح

- `anon`: لا صلاحيات.
- `authenticated`: قراءة السجلات المسموحة عبر RLS، وإدارة Config/Catalog فقط عند تحقق دور الإدارة.
- Queue وUsage: لا صلاحيات متصفح.

### صلاحيات الخادم

`service_role` يملك CRUD الضروري فقط، ولا يمنح `TRUNCATE` أو `TRIGGER` أو `REFERENCES` عبر هذه المهاجرة.

### RPCs

- `orby_enqueue_execution_job`
- `orby_claim_execution_jobs`
- `orby_heartbeat_execution_job`
- `orby_complete_execution_job`
- `orby_fail_execution_job`
- `orby_cancel_execution_run`
- `orby_consume_execution_budget`

كلها:

- `SECURITY DEFINER`.
- `SET search_path=''`.
- مسحوبة من PUBLIC وanon وauthenticated.
- ممنوحة لـservice_role فقط.

## 22. واجهات HTTP

```text
POST   /api/orby/agent/plan
POST   /api/orby/agent/runs
GET    /api/orby/agent/runs/:runId
DELETE /api/orby/agent/runs/:runId
POST   /api/orby/agent/approvals/:approvalId
GET    /api/orby/agent/worker
POST   /api/orby/agent/worker
```

واجهات المستخدم تتطلب جلسة Supabase موثقة. Worker يتطلب Bearer secret أو `x-orby-worker-secret`.

## 23. التفعيل

المرحلة مبنية لكنها مغلقة افتراضيًا. التفعيل الآمن يتطلب بالترتيب:

1. ضبط `SUPABASE_SERVICE_ROLE_KEY` على الخادم.
2. ضبط `MADAR_ORBY_WORKER_SECRET` أو استخدام Worker secret الحالي.
3. وجود مزود ونموذج ORBY مفعّل إذا كان Model Planner مطلوبًا.
4. تفعيل Manifests المختارة في `orby_tool_catalog`.
5. إنشاء Config عامة أو خاصة بالمؤسسة مع:
   - `planningEnabled=true` للتخطيط.
   - `enabled=true` للتنفيذ.
6. إبقاء `allowExternalWrites=false` و`allowDeletes=false` حتى اختبار كل أداة خطرة.
7. جدولة Worker بعد اختبارات القبول في بيئة غير إنتاجية.

لا تؤدي المهاجرة وحدها إلى تنفيذ أي مهمة أو الاتصال بأي عميل.

## 24. الموانع المعمارية المثبتة

- لا Action خارج Execution Engine.
- لا أداة خارج Tool Registry.
- لا تجاوز لـPermission أوPolicy Engine.
- لا صلاحيات مطلقة.
- لا تنفيذ حساس دون Approval عندما تفرض السياسة ذلك.
- لا Tool logic داخل Kernel.
- لا اتصال مباشر من Kernel بالموصلات أو قواعد الأعمال.
- لا استدعاء Connector مباشر من أدوات ORBY.
- لا تخزين مفاتيح مزودات أو أسرار اتصالات.
- لا تحميل كود ديناميكي من Tool Catalog.
- لا ذاكرة طويلة المدى أو تعلم ذاتي في المرحلة الثانية.

## 25. اختبارات القبول

مجموعة `ORBY-STAGE-2-AGENT-EXECUTION-1.0.0` تتحقق من:

- العقد القياسي للأدوات والتصنيفات الستة.
- التخطيط قبل التنفيذ.
- Queue-only submission.
- طلب الموافقة قبل الكتابة.
- الاستئناف بعد الموافقة.
- الموافقة النظامية الداخلية فقط.
- Retry.
- Parallel/Conditional/Loop/Event.
- Delay والاستئناف.
- Sandbox عالي الخطورة.
- Rollback/Compensation.
- رفض الصلاحيات قبل التنفيذ.
- Audit/Events/Notifications.
- Execution limits.
- RLS وRPCs وعدم تخزين الأسرار.
- إعادة استخدام Integration Queue وUDM وAction Drafts.

## 26. حدود هذه المرحلة

هذه المرحلة تبني **المحرك والبنية الآمنة**. لا تفعل تلقائيًا:

- حذف سجلات أعمال.
- تعديل أنظمة خارجية.
- تنفيذ Action Drafts فعليًا.
- تشغيل أدوات غير مسجلة.
- إضافة ذاكرة دائمة أو RAG أو تعلم تلقائي.
- تفعيل الأدوات أو Worker على الإنتاج.

هذه الحدود مقصودة، وتضمن أن امتلاك ORBY لقدرة التخطيط لا يعني امتلاكه صلاحية التنفيذ بلا قيود.
