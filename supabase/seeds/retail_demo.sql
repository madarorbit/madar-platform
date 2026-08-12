-- DEVELOPMENT ONLY. Load explicitly into a disposable local MADAR database.
-- It is never included in production migrations.

insert into auth.users(
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  '10000000-0000-0000-0000-000000000001',
  'authenticated', 'authenticated', 'demo@retail.local',
  crypt('MadarDemo!2026', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"full_name":"مالك متجر مدار التجريبي"}'::jsonb,
  now(), now(), '', '', '', ''
)
on conflict (id) do nothing;

insert into public.retail_profiles(id, email, full_name, identity_source)
values (
  '10000000-0000-0000-0000-000000000001',
  'demo@retail.local',
  'مالك متجر مدار التجريبي',
  'MADAR_PLATFORM'
)
on conflict (id) do update
set email = excluded.email,
    full_name = excluded.full_name,
    identity_source = excluded.identity_source,
    updated_at = now();

do $$
declare
  demo_user constant uuid := '10000000-0000-0000-0000-000000000001';
  workspace_id uuid;
  plan_id uuid;
  result jsonb;
  category_id uuid;
  customer_one uuid;
  customer_two uuid;
  supplier_one uuid;
  supplier_two uuid;
  product_ids uuid[] := array[]::uuid[];
  product_names text[] := array[
    'عطر مدار 12','عطر ليلي','بخور عدني','مبخرة صغيرة','زيت عطري وردي',
    'ساعة يد كلاسيك','سماعة لاسلكية','شاحن سريع','كابل USB-C','حافظة هاتف',
    'قميص قطني','بنطال يومي','حزام جلدي','نظارة شمسية','محفظة صغيرة',
    'مصباح LED','بطاريات AA','وصلة كهربائية','مفك متعدد','شريط لاصق',
    'دفتر ملاحظات','قلم فاخر','كيس هدايا','علبة تغليف','بطاقة تهنئة'
  ];
  index_value integer;
  receivable_id uuid;
  payable_id uuid;
begin
  perform set_config('request.jwt.claim.sub', demo_user::text, true);
  select id into plan_id from public.retail_plans where code = 'RETAIL_V0_TRIAL';

  select active_workspace_id into workspace_id from public.retail_profiles where id = demo_user;
  if workspace_id is null then
    insert into public.retail_onboarding_drafts(
      user_id, current_step, trade_name, owner_name, phone, city, country,
      currency, subtype, allow_credit_sales, selected_plan_id
    ) values (
      demo_user, 5, 'متجر مدار التجريبي', 'مالك المتجر', '777000111',
      'صنعاء', 'YE', 'YER', 'GENERAL_RETAIL', true, plan_id
    ) on conflict (user_id) do update set selected_plan_id = excluded.selected_plan_id;
    result := public.complete_retail_onboarding(gen_random_uuid());
    workspace_id := (result->>'workspace_id')::uuid;
  end if;

  result := public.retail_upsert_category(workspace_id, gen_random_uuid(), '{"name":"منتجات متنوعة"}'::jsonb, null);
  category_id := (result->>'category_id')::uuid;

  for index_value in 1..array_length(product_names, 1) loop
    result := public.retail_create_product(
      workspace_id,
      gen_random_uuid(),
      jsonb_build_object(
        'name', product_names[index_value],
        'sku', 'DEMO-' || lpad(index_value::text, 3, '0'),
        'barcode', '99000000' || lpad(index_value::text, 4, '0'),
        'category_id', category_id,
        'purchase_price', 900 + index_value * 125,
        'sale_price', 1500 + index_value * 220,
        'opening_quantity', 8 + (index_value % 12),
        'minimum_stock', 5,
        'unit', 'قطعة',
        'notes', 'بيانات تطوير تجريبية'
      ),
      null
    );
    product_ids := array_append(product_ids, (result->>'product_id')::uuid);
  end loop;

  result := public.retail_upsert_customer(workspace_id, gen_random_uuid(), '{"name":"أحمد علي","phone":"777111222"}'::jsonb, null);
  customer_one := (result->>'customer_id')::uuid;
  result := public.retail_upsert_customer(workspace_id, gen_random_uuid(), '{"name":"سارة محمد","phone":"733444555"}'::jsonb, null);
  customer_two := (result->>'customer_id')::uuid;
  result := public.retail_upsert_supplier(workspace_id, gen_random_uuid(), '{"name":"مؤسسة النور للتوريد","phone":"771222333"}'::jsonb, null);
  supplier_one := (result->>'supplier_id')::uuid;
  result := public.retail_upsert_supplier(workspace_id, gen_random_uuid(), '{"name":"مخازن اليمن","phone":"770555666"}'::jsonb, null);
  supplier_two := (result->>'supplier_id')::uuid;

  perform public.retail_adjust_cash(workspace_id, gen_random_uuid(), '{"amount_delta":2000000,"transaction_type":"OPENING","notes":"رصيد الصندوق التجريبي"}'::jsonb, null);

  perform public.retail_create_purchase(
    workspace_id, gen_random_uuid(),
    jsonb_build_object(
      'supplier_id', supplier_one,
      'payment_method', 'CASH', 'amount_paid', 190000,
      'items', jsonb_build_array(
        jsonb_build_object('product_id', product_ids[1], 'quantity', 40, 'unit_cost', 1800),
        jsonb_build_object('product_id', product_ids[2], 'quantity', 35, 'unit_cost', 2000),
        jsonb_build_object('product_id', product_ids[3], 'quantity', 30, 'unit_cost', 1600)
      ), 'notes', 'شراء نقدي تجريبي'
    ), null
  );

  result := public.retail_create_purchase(
    workspace_id, gen_random_uuid(),
    jsonb_build_object(
      'supplier_id', supplier_two,
      'payment_method', 'CREDIT', 'amount_paid', 0,
      'items', jsonb_build_array(
        jsonb_build_object('product_id', product_ids[7], 'quantity', 25, 'unit_cost', 3200),
        jsonb_build_object('product_id', product_ids[8], 'quantity', 30, 'unit_cost', 2100)
      ), 'notes', 'شراء آجل تجريبي'
    ), null
  );
  select id into payable_id from public.retail_payables where purchase_id = (result->>'purchase_id')::uuid;
  perform public.retail_pay_payable(workspace_id, gen_random_uuid(), jsonb_build_object('payable_id', payable_id, 'amount', 15000, 'payment_method', 'CASH', 'notes', 'دفعة جزئية للمورد'), null);

  for index_value in 1..9 loop
    perform public.retail_create_sale(
      workspace_id, gen_random_uuid(),
      jsonb_build_object(
        'customer_id', case when index_value % 3 = 0 then customer_one else null end,
        'payment_method', 'CASH',
        'amount_paid', (1500 + index_value * 220) * (1 + index_value % 3),
        'items', jsonb_build_array(jsonb_build_object('product_id', product_ids[index_value], 'quantity', 1 + index_value % 3, 'unit_price', 1500 + index_value * 220)),
        'sold_at', now() - make_interval(days => 9 - index_value),
        'notes', 'بيع نقدي تجريبي'
      ), null
    );
  end loop;

  result := public.retail_create_sale(
    workspace_id, gen_random_uuid(),
    jsonb_build_object(
      'customer_id', customer_two, 'payment_method', 'CREDIT', 'amount_paid', 0,
      'items', jsonb_build_array(
        jsonb_build_object('product_id', product_ids[10], 'quantity', 2, 'unit_price', 3700),
        jsonb_build_object('product_id', product_ids[11], 'quantity', 1, 'unit_price', 3920)
      ), 'notes', 'بيع آجل تجريبي'
    ), null
  );
  select id into receivable_id from public.retail_receivables where sale_id = (result->>'sale_id')::uuid;
  perform public.retail_collect_receivable(workspace_id, gen_random_uuid(), jsonb_build_object('receivable_id', receivable_id, 'amount', 3000, 'payment_method', 'CASH', 'notes', 'تحصيل جزئي'), null);

  perform public.retail_create_expense(workspace_id, gen_random_uuid(), '{"category":"نقل","amount":12000,"description":"نقل بضاعة تجريبي","payment_method":"CASH"}'::jsonb, null);
  perform public.retail_create_expense(workspace_id, gen_random_uuid(), '{"category":"كهرباء","amount":8500,"description":"فاتورة تشغيل تجريبية","payment_method":"CASH"}'::jsonb, null);
  perform public.retail_create_expense(workspace_id, gen_random_uuid(), '{"category":"تغليف","amount":6000,"description":"مواد تغليف","payment_method":"CASH"}'::jsonb, null);
end;
$$;
