# Database

## migrations

| الملف | المحتوى |
|---|---|
| `20260812180712_retail_foundation_unified.sql` | retail_profiles/workspaces/onboarding/plans/payments/catalog/storage |
| `20260812180722_retail_ledgers_unified.sql` | sales/purchases/expenses/inventory/cash/debt/returns |
| `20260812180730…20260812180757` | RPCs الذرية، sync، analytics، وإدارة Retail |
| `20260812180807_retail_security_unified.sql` | RLS وgrants وسياسات Storage دون تعديل صلاحيات جداول مَدار |
| `20260812180816…20260812180820` | slug وفهارس foreign keys |
| `20260812180827…20260812180844` | ربط المنظمة والتفعيل وجسر الخدمة وتقويته |

كل جدول Retail يحمل بادئة `retail_`، وكل سجل أعمال يحمل `workspace_id`. لا تشترك الخدمة مع جداول `products` أو `profiles` العامة في مَدار.

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

`supabase/seeds/retail_demo.sql` محلي فقط: مستخدم، متجر، 25 منتجًا، عملاء، موردون، شراء نقدي وآجل، مبيعات، مصروفات، ديون وتسويات. Production migrations لا تستدعيه.
