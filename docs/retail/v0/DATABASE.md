# Database

## migrations

| الملف | المحتوى |
|---|---|
| `...1904_retail_foundation.sql` | profiles/workspaces/onboarding/plans/payments/catalog/storage |
| `...1905_retail_ledgers.sql` | sales/purchases/expenses/inventory/cash/debt/returns/sync receipts |
| `...1906_retail_core_operations.sql` | auth helpers، onboarding، product/inventory/cash/expense RPCs |
| `...1907_retail_financial_operations.sql` | sale/purchase/settlements/returns/payment approval |
| `...1908_sync_orby.sql` | change feed، devices، ORBY history/usage |
| `...1909_analytics.sql` | snapshot وparty summaries الحتمية |
| `...1910_management_operations.sql` | profile/settings/catalog/admin/ORBY mutations |
| `...1911_security.sql` | RLS، grants، policies، storage policies |
| `...033000_onboarding_slug_collision_fix.sql` | يجعل slug الافتراضي فريدًا باستخدام UUID كاملًا بعد اكتشاف التصادم باختبار مستأجرين |
| `...040000_performance_hardening.sql` | فهارس تغطية لجميع foreign keys وسياسة SELECT واحدة لكل role |
| `...180000_platform_integration.sql` | ربط منظمة مَدار، هوية Platform، وجسر RPC service-only ثابت العمليات |
| `...181500_platform_bridge_hardening.sql` | إغلاق التنفيذ المباشر القديم لدوال SECURITY DEFINER أمام `authenticated` |

## أنواع الأرقام

- Money: `numeric(18,2)`.
- Unit cost/average cost: `numeric(18,4)`.
- Quantity: `numeric(18,3)`.
- Counters/cursors/version: `bigint`.
- IDs/operation/device: UUID.

## الفهارس

الفهارس تغطي `(workspace_id, date desc)` للوثائق والحركات، المنتجات النشطة وlow stock، الديون المفتوحة، change cursor، audit/action، subscription expiry، جميع foreign keys، ومفاتيح SKU/barcode الجزئية.

## النسخ والتحديث

صفوف قابلة للتحديث تحمل `updated_at` و`version` عبر trigger. السجلات المالية append-only من جهة Data API؛ لا تمنح الأدوار العميلة UPDATE/DELETE. `stock_on_hand` و`current_balance` caches داخلية لا تُعدل إلا في RPC مع ledger.

## Demo

`supabase-retail/seed.sql` محلي فقط: مستخدم، متجر، 25 منتجًا، عملاء، موردون، شراء نقدي وآجل، مبيعات، مصروفات، ديون وتسويات. Production migrations لا تستدعيه.
