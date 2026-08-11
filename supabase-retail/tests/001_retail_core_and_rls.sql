-- Run against a disposable/local MADAR Retail database only:
-- psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/001_retail_core_and_rls.sql
begin;

insert into auth.users(
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
values
('00000000-0000-0000-0000-000000000000','20000000-0000-4000-8000-000000000001','authenticated','authenticated','rls-a@retail.test',crypt('Testing!123',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Tenant A"}',now(),now(),'','','',''),
('00000000-0000-0000-0000-000000000000','20000000-0000-4000-8000-000000000002','authenticated','authenticated','rls-b@retail.test',crypt('Testing!123',gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"full_name":"Tenant B"}',now(),now(),'','','','');

do $$
declare
  user_a constant uuid := '20000000-0000-4000-8000-000000000001';
  user_b constant uuid := '20000000-0000-4000-8000-000000000002';
  workspace_a constant uuid := '30000000-0000-4000-8000-000000000001';
  workspace_b constant uuid := '30000000-0000-4000-8000-000000000002';
  plan_id uuid;
  product_a uuid;
  product_b uuid;
  customer_a uuid;
  supplier_a uuid;
  receivable_a uuid;
  payable_a uuid;
  result jsonb;
  sale_operation constant uuid := '40000000-0000-4000-8000-000000000001';
  stock_before numeric;
  sale_count_before bigint;
begin
  select id into plan_id from public.plans where code = 'RETAIL_V0_TRIAL';

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  insert into public.onboarding_drafts(user_id,reserved_workspace_id,current_step,trade_name,country,currency,subtype,selected_plan_id)
  values(user_a,workspace_a,5,'Tenant A Shop','YE','YER','GENERAL_RETAIL',plan_id);
  perform public.complete_retail_onboarding(gen_random_uuid());

  perform set_config('request.jwt.claim.sub', user_b::text, true);
  insert into public.onboarding_drafts(user_id,reserved_workspace_id,current_step,trade_name,country,currency,subtype,selected_plan_id)
  values(user_b,workspace_b,5,'Tenant B Shop','YE','YER','GENERAL_RETAIL',plan_id);
  perform public.complete_retail_onboarding(gen_random_uuid());
  result := public.retail_create_product(workspace_b,gen_random_uuid(),'{"name":"B private product","purchase_price":1,"sale_price":2,"opening_quantity":5,"minimum_stock":1,"unit":"قطعة"}',null);
  product_b := (result->>'product_id')::uuid;

  perform set_config('request.jwt.claim.sub', user_a::text, true);
  result := public.retail_create_product(workspace_a,gen_random_uuid(),'{"name":"A tracked product","purchase_price":100,"sale_price":180,"opening_quantity":10,"minimum_stock":2,"unit":"قطعة"}',null);
  product_a := (result->>'product_id')::uuid;
  result := public.retail_upsert_customer(workspace_a,gen_random_uuid(),'{"name":"Customer A"}',null);
  customer_a := (result->>'customer_id')::uuid;
  result := public.retail_upsert_supplier(workspace_a,gen_random_uuid(),'{"name":"Supplier A"}',null);
  supplier_a := (result->>'supplier_id')::uuid;
  perform public.retail_adjust_cash(workspace_a,gen_random_uuid(),'{"amount_delta":10000,"transaction_type":"OPENING","notes":"test opening"}',null);

  perform public.retail_create_purchase(
    workspace_a,gen_random_uuid(),
    jsonb_build_object('supplier_id',supplier_a,'payment_method','CASH','amount_paid',500,'items',jsonb_build_array(jsonb_build_object('product_id',product_a,'quantity',5,'unit_cost',100))),null
  );

  result := public.retail_create_purchase(
    workspace_a,gen_random_uuid(),
    jsonb_build_object('supplier_id',supplier_a,'payment_method','CREDIT','amount_paid',0,'items',jsonb_build_array(jsonb_build_object('product_id',product_a,'quantity',5,'unit_cost',100))),null
  );
  select id into payable_a from public.payables where purchase_id=(result->>'purchase_id')::uuid;
  perform public.retail_pay_payable(workspace_a,gen_random_uuid(),jsonb_build_object('payable_id',payable_a,'amount',200,'payment_method','CASH'),null);

  -- The same operation ID must return the same receipt and create one sale.
  result := public.retail_create_sale(
    workspace_a,sale_operation,
    jsonb_build_object('payment_method','CASH','amount_paid',360,'items',jsonb_build_array(jsonb_build_object('product_id',product_a,'quantity',2,'unit_price',180))),null
  );
  perform public.retail_create_sale(
    workspace_a,sale_operation,
    jsonb_build_object('payment_method','CASH','amount_paid',360,'items',jsonb_build_array(jsonb_build_object('product_id',product_a,'quantity',2,'unit_price',180))),null
  );
  if (select count(*) from public.sales where workspace_id=workspace_a and operation_id=sale_operation) <> 1 then raise exception 'IDEMPOTENCY_FAILED'; end if;

  result := public.retail_create_sale(
    workspace_a,gen_random_uuid(),
    jsonb_build_object('customer_id',customer_a,'payment_method','CREDIT','amount_paid',0,'items',jsonb_build_array(jsonb_build_object('product_id',product_a,'quantity',1,'unit_price',180))),null
  );
  select id into receivable_a from public.receivables where sale_id=(result->>'sale_id')::uuid;
  perform public.retail_collect_receivable(workspace_a,gen_random_uuid(),jsonb_build_object('receivable_id',receivable_a,'amount',80,'payment_method','CASH'),null);
  perform public.retail_create_expense(workspace_a,gen_random_uuid(),'{"category":"Test","amount":50,"description":"Atomic expense","payment_method":"CASH","expense_date":"2026-08-11"}',null);

  if (select balance_due from public.receivables where id=receivable_a) <> 100 then raise exception 'PARTIAL_COLLECTION_FAILED'; end if;
  if (select balance_due from public.payables where id=payable_a) <> 300 then raise exception 'PARTIAL_SUPPLIER_PAYMENT_FAILED'; end if;
  if not exists(select 1 from public.debt_transactions where receivable_id=receivable_a and transaction_type='COLLECTION') then raise exception 'DEBT_LEDGER_MISSING'; end if;
  if not exists(select 1 from public.debt_transactions where payable_id=payable_a and transaction_type='SUPPLIER_PAYMENT') then raise exception 'PAYABLE_LEDGER_MISSING'; end if;
  if not exists(select 1 from public.cash_transactions where workspace_id=workspace_a and transaction_type='EXPENSE') then raise exception 'CASH_LEDGER_MISSING'; end if;

  -- A failed oversized sale must roll back every touched table and stock value.
  select stock_on_hand into stock_before from public.products where id=product_a;
  select count(*) into sale_count_before from public.sales where workspace_id=workspace_a;
  begin
    perform public.retail_create_sale(
      workspace_a,gen_random_uuid(),
      jsonb_build_object('payment_method','CASH','amount_paid',180000,'items',jsonb_build_array(jsonb_build_object('product_id',product_a,'quantity',1000,'unit_price',180))),null
    );
    raise exception 'EXPECTED_INSUFFICIENT_STOCK';
  exception when others then
    if sqlerrm='EXPECTED_INSUFFICIENT_STOCK' or sqlerrm not like 'INSUFFICIENT_STOCK:%' then raise; end if;
  end;
  if (select stock_on_hand from public.products where id=product_a) <> stock_before then raise exception 'FAILED_SALE_CHANGED_STOCK'; end if;
  if (select count(*) from public.sales where workspace_id=workspace_a) <> sale_count_before then raise exception 'FAILED_SALE_CREATED_DOCUMENT'; end if;
end;
$$;

-- Tenant A can read A and cannot read B under the actual authenticated role.
set local role authenticated;
select set_config('request.jwt.claim.sub','20000000-0000-4000-8000-000000000001',true);
do $$
begin
  if (select count(*) from public.products where workspace_id='30000000-0000-4000-8000-000000000001') < 1 then raise exception 'OWN_WORKSPACE_NOT_VISIBLE'; end if;
  if (select count(*) from public.products where workspace_id='30000000-0000-4000-8000-000000000002') <> 0 then raise exception 'RLS_TENANT_LEAK'; end if;
  begin
    update public.products set stock_on_hand=999 where workspace_id='30000000-0000-4000-8000-000000000001';
    raise exception 'DIRECT_STOCK_UPDATE_WAS_ALLOWED';
  exception when insufficient_privilege then null;
  end;
end;
$$;
reset role;

rollback;
