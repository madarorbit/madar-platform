# مخطط بيانات PostgreSQL المقترح

يُنفذ عبر ORM ومهاجرات مراجعة، لا عبر بيانات ثابتة في الواجهة. تستخدم كل الجداول `id` UUID و`created_at` و`updated_at` حيث يلزم.

| المجال | الجداول |
| --- | --- |
| الهوية | `users`, `accounts`, `sessions`, `verification_tokens`, `password_reset_tokens`, `user_profiles` |
| التفويض | `roles`, `permissions`, `user_roles`, `role_permissions` |
| الكتالوج | `products`, `product_categories`, `product_images`, `product_files`, `product_versions`, `product_tags`, `product_features`, `product_faqs` |
| الخدمات | `services`, `service_categories`, `service_packages`, `service_features`, `service_faqs`, `service_requests` |
| التجارة | `carts`, `cart_items`, `orders`, `order_items`, `order_status_history`, `payments`, `payment_proofs`, `invoices`, `customer_notes`, `admin_notes` |
| العروض | `coupons`, `coupon_usages`, `discount_rules` |
| المحتوى | `pages`, `blog_posts`, `blog_categories`, `blog_tags`, `faqs`, `testimonials`, `announcements`, `navigation_items` |
| التسليم | `media_files`, `downloads`, `secure_download_tokens`, `external_links`, `notion_links`, `resource_links` |
| الإعدادات | `platform_settings`, `contact_settings`, `payment_settings`, `social_links`, `seo_settings`, `email_templates` |
| القياس والتدقيق | `page_views`, `product_views`, `service_views`, `cart_events`, `checkout_events`, `conversion_events`, `search_events`, `download_events`, `admin_audit_logs`, `login_audit_logs`, `security_events` |

## قيود لازمة

- `users.email` فريد ومطبع إلى lower-case؛ لا تسجل كلمات المرور أو الرموز الخام.
- `roles.code` فريد. يربط `user_roles(user_id, role_id)` بفهرس فريد.
- يمنع منطق الخدمة إضافة `SUPER_ADMIN` إلا للـ`SUPER_ADMIN_EMAIL` المتحقق منه، ويمنع خفضه/تغيير بريده دون إجراء أمني منفصل.
- `products.slug`, `services.slug`, `orders.number`, `coupons.code` فريدة. تفهرس حالات الطلب مع `created_at`، ومفاتيح المستخدم، وحقول البحث العامة.
- `payment_proofs` تشير إلى `media_files` الخاص، و`secure_download_tokens.token_hash` فريد؛ لا تخزن رمز التنزيل الخام.
- انتقالات الطلب مسجلة في `order_status_history` داخل المعاملة نفسها مع الدفع والتنزيلات و`admin_audit_logs`.
