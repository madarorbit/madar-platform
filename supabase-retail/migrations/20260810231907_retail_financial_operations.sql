-- MADAR Retail V0 — atomic sales, purchases, debts, collections and returns.

create or replace function public.retail_create_sale(
  target_workspace uuid,
  target_operation uuid,
  payload jsonb,
  source_device uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_workspace_actor(target_workspace);
  existing jsonb;
  workspace public.retail_workspaces%rowtype;
  item jsonb;
  product public.products%rowtype;
  quantity_value numeric(18,3);
  unit_price_value numeric(18,2);
  line_total_value numeric(18,2);
  item_discount_value numeric(18,2);
  allocated_discount_value numeric(18,2) := 0;
  item_index integer := 0;
  item_count integer;
  subtotal_value numeric(18,2) := 0;
  discount_value numeric(18,2) := coalesce(nullif(payload->>'discount_total', '')::numeric, 0);
  total_value numeric(18,2);
  paid_value numeric(18,2) := coalesce(nullif(payload->>'amount_paid', '')::numeric, 0);
  due_value numeric(18,2);
  payment_status_value text;
  payment_method_value text := coalesce(payload->>'payment_method', 'CASH');
  customer_value uuid := nullif(payload->>'customer_id', '')::uuid;
  sale_id uuid;
  receivable_id uuid;
  invoice_number_value text;
  sold_time timestamptz := coalesce(nullif(payload->>'sold_at', '')::timestamptz, now());
  party_balance numeric(18,2);
  result jsonb;
begin
  existing := private.begin_operation(target_workspace, actor, target_operation, 'SALE_CREATE', source_device, nullif(payload->>'client_created_at', '')::timestamptz);
  if existing is not null then return existing; end if;
  if jsonb_typeof(payload->'items') <> 'array'
    or jsonb_array_length(payload->'items') < 1
    or jsonb_array_length(payload->'items') > 100 then
    raise exception 'INVALID_SALE_ITEMS';
  end if;
  if exists (
    select 1 from (
      select value->>'product_id' as product_id
      from jsonb_array_elements(payload->'items')
      group by value->>'product_id'
      having count(*) > 1
    ) duplicates
  ) then raise exception 'DUPLICATE_PRODUCT_IN_SALE'; end if;
  if payment_method_value not in ('CASH', 'BANK', 'WALLET', 'CREDIT', 'OTHER') then raise exception 'INVALID_PAYMENT_METHOD'; end if;

  select * into workspace from public.retail_workspaces where id = target_workspace for update;
  if workspace.id is null then raise exception 'WORKSPACE_NOT_FOUND'; end if;
  if customer_value is not null and not exists (
    select 1 from public.customers
    where workspace_id = target_workspace and id = customer_value and deleted_at is null and status = 'active'
  ) then raise exception 'CUSTOMER_NOT_FOUND'; end if;

  for item in select value from jsonb_array_elements(payload->'items')
  loop
    quantity_value := nullif(item->>'quantity', '')::numeric;
    if quantity_value is null or quantity_value <= 0 then raise exception 'INVALID_QUANTITY'; end if;
    select * into product
    from public.products
    where workspace_id = target_workspace
      and id = (item->>'product_id')::uuid
      and status = 'active'
      and deleted_at is null
    for update;
    if product.id is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
    if product.stock_on_hand < quantity_value then raise exception 'INSUFFICIENT_STOCK:%', product.name; end if;
    unit_price_value := coalesce(nullif(item->>'unit_price', '')::numeric, product.sale_price);
    if unit_price_value < 0 then raise exception 'INVALID_UNIT_PRICE'; end if;
    subtotal_value := subtotal_value + round(quantity_value * unit_price_value, 2);
  end loop;

  if discount_value < 0 or discount_value > subtotal_value then raise exception 'INVALID_DISCOUNT'; end if;
  total_value := subtotal_value - discount_value;
  item_count := jsonb_array_length(payload->'items');
  if paid_value < 0 or paid_value > total_value then raise exception 'INVALID_PAID_AMOUNT'; end if;
  due_value := total_value - paid_value;
  if due_value > 0 and (customer_value is null or not workspace.allow_credit_sales) then raise exception 'CREDIT_SALE_NOT_ALLOWED'; end if;
  if payment_method_value = 'CREDIT' and paid_value > 0 then raise exception 'CREDIT_PAYMENT_METHOD_WITH_PAID_AMOUNT'; end if;
  payment_status_value := case
    when paid_value = total_value then 'paid'
    when paid_value = 0 then 'credit'
    else 'partial'
  end;

  invoice_number_value := workspace.invoice_prefix || '-S-' || lpad(workspace.next_sale_number::text, 7, '0');
  update public.retail_workspaces set next_sale_number = next_sale_number + 1 where id = target_workspace;

  insert into public.sales(
    workspace_id, customer_id, invoice_number, payment_status, payment_method,
    subtotal, discount_total, total, amount_paid, currency, notes, sold_at,
    created_by, operation_id
  ) values (
    target_workspace, customer_value, invoice_number_value, payment_status_value,
    payment_method_value, subtotal_value, discount_value, total_value, paid_value,
    workspace.currency, nullif(btrim(payload->>'notes'), ''), sold_time,
    actor, target_operation
  ) returning id into sale_id;

  for item in select value from jsonb_array_elements(payload->'items')
  loop
    item_index := item_index + 1;
    quantity_value := (item->>'quantity')::numeric;
    select * into product
    from public.products
    where workspace_id = target_workspace and id = (item->>'product_id')::uuid
    for update;
    unit_price_value := coalesce(nullif(item->>'unit_price', '')::numeric, product.sale_price);
    line_total_value := round(quantity_value * unit_price_value, 2);
    item_discount_value := case
      when item_index = item_count then discount_value - allocated_discount_value
      when subtotal_value = 0 then 0
      else round(line_total_value * discount_value / subtotal_value, 2)
    end;
    allocated_discount_value := allocated_discount_value + item_discount_value;

    update public.products
    set stock_on_hand = stock_on_hand - quantity_value
    where id = product.id;

    insert into public.sale_items(
      workspace_id, sale_id, product_id, product_name_snapshot, sku_snapshot,
      quantity, unit_price, unit_cost, line_total, discount_allocated,
      net_line_total
    ) values (
      target_workspace, sale_id, product.id, product.name, product.sku,
      quantity_value, unit_price_value, product.average_cost,
      line_total_value, item_discount_value,
      line_total_value - item_discount_value
    );

    insert into public.inventory_movements(
      workspace_id, product_id, movement_type, quantity_delta, balance_after,
      unit_cost, reference_type, reference_id, notes, occurred_at, created_by, operation_id
    ) values (
      target_workspace, product.id, 'SALE', -quantity_value,
      product.stock_on_hand - quantity_value, product.average_cost,
      'sale', sale_id, invoice_number_value, sold_time, actor, target_operation
    );
  end loop;

  if due_value > 0 then
    insert into public.receivables(
      workspace_id, customer_id, sale_id, original_amount, balance_due, status,
      due_date
    ) values (
      target_workspace, customer_value, sale_id, due_value, due_value, 'open',
      nullif(payload->>'due_date', '')::date
    ) returning id into receivable_id;

    select coalesce(sum(balance_due), 0) into party_balance
    from public.receivables
    where workspace_id = target_workspace and customer_id = customer_value
      and status in ('open', 'partial');

    insert into public.debt_transactions(
      workspace_id, party_type, customer_id, receivable_id, transaction_type,
      amount, direction, balance_after, reference_type, reference_id,
      notes, occurred_at, created_by, operation_id
    ) values (
      target_workspace, 'CUSTOMER', customer_value, receivable_id, 'SALE_CHARGE',
      due_value, 'INCREASE', party_balance, 'sale', sale_id,
      invoice_number_value, sold_time, actor, target_operation
    );
  end if;

  if paid_value > 0 and payment_method_value = 'CASH' then
    perform private.post_cash(
      target_workspace, actor, 'IN', 'CASH_SALE', paid_value,
      'sale', sale_id, target_operation, invoice_number_value, sold_time
    );
  end if;

  result := jsonb_build_object(
    'sale_id', sale_id,
    'invoice_number', invoice_number_value,
    'total', total_value,
    'amount_paid', paid_value,
    'balance_due', due_value,
    'payment_status', payment_status_value
  );
  perform private.finish_operation(target_workspace, target_operation, 'sale', sale_id, result);
  perform private.write_audit(target_workspace, actor, 'sale.created', 'sale', sale_id, target_operation, jsonb_build_object('invoice_number', invoice_number_value, 'total', total_value, 'balance_due', due_value));
  return result;
end;
$$;

revoke all on function public.retail_create_sale(uuid, uuid, jsonb, uuid) from public, anon, authenticated;

create or replace function public.retail_create_purchase(
  target_workspace uuid,
  target_operation uuid,
  payload jsonb,
  source_device uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_workspace_actor(target_workspace);
  existing jsonb;
  workspace public.retail_workspaces%rowtype;
  item jsonb;
  product public.products%rowtype;
  quantity_value numeric(18,3);
  unit_cost_value numeric(18,4);
  total_value numeric(18,2) := 0;
  paid_value numeric(18,2) := coalesce(nullif(payload->>'amount_paid', '')::numeric, 0);
  due_value numeric(18,2);
  payment_status_value text;
  payment_method_value text := coalesce(payload->>'payment_method', 'CASH');
  supplier_value uuid := nullif(payload->>'supplier_id', '')::uuid;
  purchase_id uuid;
  payable_id uuid;
  purchase_number_value text;
  purchase_time timestamptz := coalesce(nullif(payload->>'purchased_at', '')::timestamptz, now());
  next_stock numeric(18,3);
  next_average_cost numeric(18,4);
  party_balance numeric(18,2);
  result jsonb;
begin
  existing := private.begin_operation(target_workspace, actor, target_operation, 'PURCHASE_CREATE', source_device, nullif(payload->>'client_created_at', '')::timestamptz);
  if existing is not null then return existing; end if;
  if jsonb_typeof(payload->'items') <> 'array'
    or jsonb_array_length(payload->'items') < 1
    or jsonb_array_length(payload->'items') > 100 then
    raise exception 'INVALID_PURCHASE_ITEMS';
  end if;
  if exists (
    select 1 from (
      select value->>'product_id' as product_id
      from jsonb_array_elements(payload->'items')
      group by value->>'product_id'
      having count(*) > 1
    ) duplicates
  ) then raise exception 'DUPLICATE_PRODUCT_IN_PURCHASE'; end if;
  if payment_method_value not in ('CASH', 'BANK', 'WALLET', 'CREDIT', 'OTHER') then raise exception 'INVALID_PAYMENT_METHOD'; end if;

  select * into workspace from public.retail_workspaces where id = target_workspace for update;
  if supplier_value is not null and not exists (
    select 1 from public.suppliers
    where workspace_id = target_workspace and id = supplier_value and deleted_at is null and status = 'active'
  ) then raise exception 'SUPPLIER_NOT_FOUND'; end if;

  for item in select value from jsonb_array_elements(payload->'items')
  loop
    quantity_value := nullif(item->>'quantity', '')::numeric;
    unit_cost_value := nullif(item->>'unit_cost', '')::numeric;
    if quantity_value is null or quantity_value <= 0 then raise exception 'INVALID_QUANTITY'; end if;
    if unit_cost_value is null or unit_cost_value < 0 then raise exception 'INVALID_UNIT_COST'; end if;
    select * into product
    from public.products
    where workspace_id = target_workspace
      and id = (item->>'product_id')::uuid
      and deleted_at is null
    for update;
    if product.id is null then raise exception 'PRODUCT_NOT_FOUND'; end if;
    total_value := total_value + round(quantity_value * unit_cost_value, 2);
  end loop;

  if paid_value < 0 or paid_value > total_value then raise exception 'INVALID_PAID_AMOUNT'; end if;
  due_value := total_value - paid_value;
  if due_value > 0 and supplier_value is null then raise exception 'SUPPLIER_REQUIRED_FOR_CREDIT'; end if;
  if payment_method_value = 'CREDIT' and paid_value > 0 then raise exception 'CREDIT_PAYMENT_METHOD_WITH_PAID_AMOUNT'; end if;
  payment_status_value := case
    when paid_value = total_value then 'paid'
    when paid_value = 0 then 'credit'
    else 'partial'
  end;

  purchase_number_value := workspace.invoice_prefix || '-P-' || lpad(workspace.next_purchase_number::text, 7, '0');
  update public.retail_workspaces set next_purchase_number = next_purchase_number + 1 where id = target_workspace;

  insert into public.purchases(
    workspace_id, supplier_id, purchase_number, supplier_reference,
    payment_status, payment_method, total, amount_paid, currency, notes,
    purchased_at, created_by, operation_id
  ) values (
    target_workspace, supplier_value, purchase_number_value,
    nullif(btrim(payload->>'supplier_reference'), ''), payment_status_value,
    payment_method_value, total_value, paid_value, workspace.currency,
    nullif(btrim(payload->>'notes'), ''), purchase_time, actor, target_operation
  ) returning id into purchase_id;

  for item in select value from jsonb_array_elements(payload->'items')
  loop
    quantity_value := (item->>'quantity')::numeric;
    unit_cost_value := (item->>'unit_cost')::numeric;
    select * into product
    from public.products
    where workspace_id = target_workspace and id = (item->>'product_id')::uuid
    for update;
    next_stock := product.stock_on_hand + quantity_value;
    next_average_cost := case
      when next_stock = 0 then unit_cost_value
      else round(((product.stock_on_hand * product.average_cost) + (quantity_value * unit_cost_value)) / next_stock, 4)
    end;

    update public.products
    set stock_on_hand = next_stock,
        purchase_price = round(unit_cost_value, 2),
        average_cost = next_average_cost
    where id = product.id;

    insert into public.purchase_items(
      workspace_id, purchase_id, product_id, product_name_snapshot,
      quantity, unit_cost, line_total
    ) values (
      target_workspace, purchase_id, product.id, product.name,
      quantity_value, unit_cost_value, round(quantity_value * unit_cost_value, 2)
    );

    insert into public.inventory_movements(
      workspace_id, product_id, movement_type, quantity_delta, balance_after,
      unit_cost, reference_type, reference_id, notes, occurred_at, created_by, operation_id
    ) values (
      target_workspace, product.id, 'PURCHASE', quantity_value, next_stock,
      unit_cost_value, 'purchase', purchase_id, purchase_number_value,
      purchase_time, actor, target_operation
    );
  end loop;

  if due_value > 0 then
    insert into public.payables(
      workspace_id, supplier_id, purchase_id, original_amount, balance_due,
      status, due_date
    ) values (
      target_workspace, supplier_value, purchase_id, due_value, due_value,
      'open', nullif(payload->>'due_date', '')::date
    ) returning id into payable_id;

    select coalesce(sum(balance_due), 0) into party_balance
    from public.payables
    where workspace_id = target_workspace and supplier_id = supplier_value
      and status in ('open', 'partial');

    insert into public.debt_transactions(
      workspace_id, party_type, supplier_id, payable_id, transaction_type,
      amount, direction, balance_after, reference_type, reference_id,
      notes, occurred_at, created_by, operation_id
    ) values (
      target_workspace, 'SUPPLIER', supplier_value, payable_id, 'PURCHASE_CHARGE',
      due_value, 'INCREASE', party_balance, 'purchase', purchase_id,
      purchase_number_value, purchase_time, actor, target_operation
    );
  end if;

  if paid_value > 0 and payment_method_value = 'CASH' then
    perform private.post_cash(
      target_workspace, actor, 'OUT', 'PURCHASE_PAYMENT', paid_value,
      'purchase', purchase_id, target_operation, purchase_number_value, purchase_time
    );
  end if;

  result := jsonb_build_object(
    'purchase_id', purchase_id,
    'purchase_number', purchase_number_value,
    'total', total_value,
    'amount_paid', paid_value,
    'balance_due', due_value,
    'payment_status', payment_status_value
  );
  perform private.finish_operation(target_workspace, target_operation, 'purchase', purchase_id, result);
  perform private.write_audit(target_workspace, actor, 'purchase.created', 'purchase', purchase_id, target_operation, jsonb_build_object('purchase_number', purchase_number_value, 'total', total_value, 'balance_due', due_value));
  return result;
end;
$$;

revoke all on function public.retail_create_purchase(uuid, uuid, jsonb, uuid) from public, anon, authenticated;

create or replace function public.retail_collect_receivable(
  target_workspace uuid,
  target_operation uuid,
  payload jsonb,
  source_device uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_workspace_actor(target_workspace);
  existing jsonb;
  receivable public.receivables%rowtype;
  amount_value numeric(18,2) := nullif(payload->>'amount', '')::numeric;
  method text := coalesce(payload->>'payment_method', 'CASH');
  next_due numeric(18,2);
  party_balance numeric(18,2);
  transaction_id uuid;
  result jsonb;
begin
  existing := private.begin_operation(target_workspace, actor, target_operation, 'RECEIVABLE_COLLECTION', source_device, nullif(payload->>'client_created_at', '')::timestamptz);
  if existing is not null then return existing; end if;
  if amount_value is null or amount_value <= 0 then raise exception 'INVALID_COLLECTION_AMOUNT'; end if;
  if method not in ('CASH', 'BANK', 'WALLET', 'OTHER') then raise exception 'INVALID_PAYMENT_METHOD'; end if;

  select * into receivable
  from public.receivables
  where workspace_id = target_workspace and id = (payload->>'receivable_id')::uuid
  for update;
  if receivable.id is null then raise exception 'RECEIVABLE_NOT_FOUND'; end if;
  if receivable.status not in ('open', 'partial') or amount_value > receivable.balance_due then raise exception 'INVALID_COLLECTION_AMOUNT'; end if;
  next_due := receivable.balance_due - amount_value;

  update public.receivables
  set balance_due = next_due,
      status = case when next_due = 0 then 'settled' else 'partial' end
  where id = receivable.id;

  select coalesce(sum(balance_due), 0) into party_balance
  from public.receivables
  where workspace_id = target_workspace and customer_id = receivable.customer_id
    and status in ('open', 'partial');

  insert into public.debt_transactions(
    workspace_id, party_type, customer_id, receivable_id, transaction_type,
    amount, direction, balance_after, reference_type, reference_id,
    notes, occurred_at, created_by, operation_id
  ) values (
    target_workspace, 'CUSTOMER', receivable.customer_id, receivable.id,
    'COLLECTION', amount_value, 'DECREASE', party_balance, 'receivable',
    receivable.id, nullif(btrim(payload->>'notes'), ''),
    coalesce(nullif(payload->>'occurred_at', '')::timestamptz, now()), actor,
    target_operation
  ) returning id into transaction_id;

  if method = 'CASH' then
    perform private.post_cash(
      target_workspace, actor, 'IN', 'CUSTOMER_COLLECTION', amount_value,
      'debt_transaction', transaction_id, target_operation, payload->>'notes',
      coalesce(nullif(payload->>'occurred_at', '')::timestamptz, now())
    );
  end if;

  result := jsonb_build_object('debt_transaction_id', transaction_id, 'receivable_id', receivable.id, 'remaining_due', next_due, 'customer_balance', party_balance);
  perform private.finish_operation(target_workspace, target_operation, 'debt_transaction', transaction_id, result);
  perform private.write_audit(target_workspace, actor, 'receivable.collected', 'receivable', receivable.id, target_operation, jsonb_build_object('amount', amount_value, 'remaining_due', next_due));
  return result;
end;
$$;

revoke all on function public.retail_collect_receivable(uuid, uuid, jsonb, uuid) from public, anon, authenticated;

create or replace function public.retail_pay_payable(
  target_workspace uuid,
  target_operation uuid,
  payload jsonb,
  source_device uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_workspace_actor(target_workspace);
  existing jsonb;
  payable public.payables%rowtype;
  amount_value numeric(18,2) := nullif(payload->>'amount', '')::numeric;
  method text := coalesce(payload->>'payment_method', 'CASH');
  next_due numeric(18,2);
  party_balance numeric(18,2);
  transaction_id uuid;
  result jsonb;
begin
  existing := private.begin_operation(target_workspace, actor, target_operation, 'PAYABLE_PAYMENT', source_device, nullif(payload->>'client_created_at', '')::timestamptz);
  if existing is not null then return existing; end if;
  if amount_value is null or amount_value <= 0 then raise exception 'INVALID_PAYMENT_AMOUNT'; end if;
  if method not in ('CASH', 'BANK', 'WALLET', 'OTHER') then raise exception 'INVALID_PAYMENT_METHOD'; end if;

  select * into payable
  from public.payables
  where workspace_id = target_workspace and id = (payload->>'payable_id')::uuid
  for update;
  if payable.id is null then raise exception 'PAYABLE_NOT_FOUND'; end if;
  if payable.status not in ('open', 'partial') or amount_value > payable.balance_due then raise exception 'INVALID_PAYMENT_AMOUNT'; end if;
  next_due := payable.balance_due - amount_value;

  if method = 'CASH' then
    perform private.post_cash(
      target_workspace, actor, 'OUT', 'SUPPLIER_PAYMENT', amount_value,
      'payable', payable.id, target_operation, payload->>'notes',
      coalesce(nullif(payload->>'occurred_at', '')::timestamptz, now())
    );
  end if;

  update public.payables
  set balance_due = next_due,
      status = case when next_due = 0 then 'settled' else 'partial' end
  where id = payable.id;

  select coalesce(sum(balance_due), 0) into party_balance
  from public.payables
  where workspace_id = target_workspace and supplier_id = payable.supplier_id
    and status in ('open', 'partial');

  insert into public.debt_transactions(
    workspace_id, party_type, supplier_id, payable_id, transaction_type,
    amount, direction, balance_after, reference_type, reference_id,
    notes, occurred_at, created_by, operation_id
  ) values (
    target_workspace, 'SUPPLIER', payable.supplier_id, payable.id,
    'SUPPLIER_PAYMENT', amount_value, 'DECREASE', party_balance, 'payable',
    payable.id, nullif(btrim(payload->>'notes'), ''),
    coalesce(nullif(payload->>'occurred_at', '')::timestamptz, now()), actor,
    target_operation
  ) returning id into transaction_id;

  result := jsonb_build_object('debt_transaction_id', transaction_id, 'payable_id', payable.id, 'remaining_due', next_due, 'supplier_balance', party_balance);
  perform private.finish_operation(target_workspace, target_operation, 'debt_transaction', transaction_id, result);
  perform private.write_audit(target_workspace, actor, 'payable.paid', 'payable', payable.id, target_operation, jsonb_build_object('amount', amount_value, 'remaining_due', next_due));
  return result;
end;
$$;

revoke all on function public.retail_pay_payable(uuid, uuid, jsonb, uuid) from public, anon, authenticated;

create or replace function public.retail_record_sale_return(
  target_workspace uuid,
  target_operation uuid,
  payload jsonb,
  source_device uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_workspace_actor(target_workspace);
  existing jsonb;
  sale public.sales%rowtype;
  sale_item public.sale_items%rowtype;
  product public.products%rowtype;
  receivable public.receivables%rowtype;
  item jsonb;
  quantity_value numeric(18,3);
  refund_total_value numeric(18,2) := 0;
  item_refund_value numeric(18,2);
  receivable_credit_value numeric(18,2) := 0;
  external_refund_value numeric(18,2);
  refund_method_value text := coalesce(payload->>'refund_method', 'CASH');
  return_id uuid;
  return_number_value text;
  party_balance numeric(18,2);
  result jsonb;
begin
  existing := private.begin_operation(target_workspace, actor, target_operation, 'SALE_RETURN', source_device, nullif(payload->>'client_created_at', '')::timestamptz);
  if existing is not null then return existing; end if;
  if jsonb_typeof(payload->'items') <> 'array' or jsonb_array_length(payload->'items') < 1 then raise exception 'INVALID_RETURN_ITEMS'; end if;
  if refund_method_value not in ('CASH', 'BANK', 'WALLET', 'OTHER') then raise exception 'INVALID_REFUND_METHOD'; end if;
  if exists (
    select 1 from (
      select value->>'sale_item_id' as sale_item_id
      from jsonb_array_elements(payload->'items')
      group by value->>'sale_item_id'
      having count(*) > 1
    ) duplicates
  ) then raise exception 'DUPLICATE_RETURN_ITEM'; end if;

  select * into sale
  from public.sales
  where workspace_id = target_workspace and id = (payload->>'sale_id')::uuid and status = 'completed'
  for update;
  if sale.id is null then raise exception 'SALE_NOT_FOUND'; end if;

  for item in select value from jsonb_array_elements(payload->'items')
  loop
    quantity_value := nullif(item->>'quantity', '')::numeric;
    if quantity_value is null or quantity_value <= 0 then raise exception 'INVALID_RETURN_QUANTITY'; end if;
    select * into sale_item
    from public.sale_items
    where workspace_id = target_workspace
      and sale_id = sale.id
      and id = (item->>'sale_item_id')::uuid
    for update;
    if sale_item.id is null then raise exception 'SALE_ITEM_NOT_FOUND'; end if;
    if sale_item.returned_quantity + quantity_value > sale_item.quantity then raise exception 'RETURN_QUANTITY_EXCEEDS_SALE'; end if;
    -- Full returns consume the exact remaining net amount. Partial returns use
    -- the immutable line allocation and are capped by that remainder.
    item_refund_value := case
      when sale_item.returned_quantity + quantity_value = sale_item.quantity
        then sale_item.net_line_total - sale_item.returned_refund_amount
      else least(
        round(quantity_value * sale_item.net_line_total / sale_item.quantity, 2),
        sale_item.net_line_total - sale_item.returned_refund_amount
      )
    end;
    refund_total_value := refund_total_value + item_refund_value;
  end loop;
  if refund_total_value <= 0 or sale.returned_total + refund_total_value > sale.total then raise exception 'INVALID_REFUND_TOTAL'; end if;

  select * into receivable
  from public.receivables
  where workspace_id = target_workspace and sale_id = sale.id
  for update;
  if receivable.id is not null and receivable.balance_due > 0 then
    receivable_credit_value := least(refund_total_value, receivable.balance_due);
    update public.receivables
    set balance_due = balance_due - receivable_credit_value,
        status = case when balance_due - receivable_credit_value = 0 then 'settled' else 'partial' end
    where id = receivable.id;
  end if;
  external_refund_value := refund_total_value - receivable_credit_value;

  return_number_value := sale.invoice_number || '-R' || (
    select (count(*) + 1)::text from public.sale_returns
    where workspace_id = target_workspace and sale_id = sale.id
  );
  insert into public.sale_returns(
    workspace_id, sale_id, return_number, refund_total, receivable_credit,
    cash_refund, refund_method, reason, returned_at, created_by, operation_id
  ) values (
    target_workspace, sale.id, return_number_value, refund_total_value,
    receivable_credit_value, external_refund_value, refund_method_value,
    nullif(btrim(payload->>'reason'), ''),
    coalesce(nullif(payload->>'returned_at', '')::timestamptz, now()), actor,
    target_operation
  ) returning id into return_id;

  for item in select value from jsonb_array_elements(payload->'items')
  loop
    quantity_value := (item->>'quantity')::numeric;
    select * into sale_item
    from public.sale_items
    where workspace_id = target_workspace and id = (item->>'sale_item_id')::uuid
    for update;
    select * into product
    from public.products
    where workspace_id = target_workspace and id = sale_item.product_id
    for update;

    update public.sale_items
    set returned_quantity = returned_quantity + quantity_value,
        returned_refund_amount = returned_refund_amount + case
          when returned_quantity + quantity_value = quantity
            then net_line_total - returned_refund_amount
          else least(
            round(quantity_value * net_line_total / quantity, 2),
            net_line_total - returned_refund_amount
          )
        end
    where id = sale_item.id;
    update public.products
    set stock_on_hand = stock_on_hand + quantity_value
    where id = product.id;

    insert into public.sale_return_items(
      workspace_id, sale_return_id, sale_item_id, product_id,
      quantity, unit_price, unit_cost, line_total, refund_amount
    ) values (
      target_workspace, return_id, sale_item.id, product.id, quantity_value,
      sale_item.unit_price, sale_item.unit_cost,
      round(quantity_value * sale_item.unit_price, 2),
      case
        when sale_item.returned_quantity + quantity_value = sale_item.quantity
          then sale_item.net_line_total - sale_item.returned_refund_amount
        else least(
          round(quantity_value * sale_item.net_line_total / sale_item.quantity, 2),
          sale_item.net_line_total - sale_item.returned_refund_amount
        )
      end
    );

    insert into public.inventory_movements(
      workspace_id, product_id, movement_type, quantity_delta, balance_after,
      unit_cost, reference_type, reference_id, notes, occurred_at, created_by, operation_id
    ) values (
      target_workspace, product.id, 'SALE_RETURN', quantity_value,
      product.stock_on_hand + quantity_value, sale_item.unit_cost,
      'sale_return', return_id, return_number_value,
      coalesce(nullif(payload->>'returned_at', '')::timestamptz, now()), actor,
      target_operation
    );
  end loop;

  update public.sales
  set returned_total = returned_total + refund_total_value,
      payment_status = case when returned_total + refund_total_value = total then 'refunded' else payment_status end
  where id = sale.id;

  if receivable_credit_value > 0 then
    select coalesce(sum(balance_due), 0) into party_balance
    from public.receivables
    where workspace_id = target_workspace and customer_id = receivable.customer_id
      and status in ('open', 'partial');
    insert into public.debt_transactions(
      workspace_id, party_type, customer_id, receivable_id, transaction_type,
      amount, direction, balance_after, reference_type, reference_id,
      notes, occurred_at, created_by, operation_id
    ) values (
      target_workspace, 'CUSTOMER', receivable.customer_id, receivable.id,
      'SALE_RETURN_CREDIT', receivable_credit_value, 'DECREASE', party_balance,
      'sale_return', return_id, return_number_value,
      coalesce(nullif(payload->>'returned_at', '')::timestamptz, now()), actor,
      target_operation
    );
  end if;

  if external_refund_value > 0 and refund_method_value = 'CASH' then
    perform private.post_cash(
      target_workspace, actor, 'OUT', 'SALE_REFUND', external_refund_value,
      'sale_return', return_id, target_operation, return_number_value,
      coalesce(nullif(payload->>'returned_at', '')::timestamptz, now())
    );
  end if;

  result := jsonb_build_object('sale_return_id', return_id, 'return_number', return_number_value, 'refund_total', refund_total_value, 'receivable_credit', receivable_credit_value, 'external_refund', external_refund_value);
  perform private.finish_operation(target_workspace, target_operation, 'sale_return', return_id, result);
  perform private.write_audit(target_workspace, actor, 'sale.returned', 'sale_return', return_id, target_operation, jsonb_build_object('sale_id', sale.id, 'refund_total', refund_total_value));
  return result;
end;
$$;

revoke all on function public.retail_record_sale_return(uuid, uuid, jsonb, uuid) from public, anon, authenticated;

create or replace function public.retail_submit_payment_request(
  target_workspace uuid,
  target_operation uuid,
  payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  -- Renewal requests remain available after a trial expires; financial
  -- mutations still use require_workspace_actor and remain blocked.
  actor uuid := private.require_membership_actor(target_workspace, array['OWNER']::text[]);
  existing jsonb;
  selected_plan public.plans%rowtype;
  selected_method public.payment_methods%rowtype;
  subscription_id_value uuid;
  request_id uuid;
  amount_value numeric(18,2) := nullif(payload->>'amount', '')::numeric;
  result jsonb;
begin
  existing := private.begin_operation(target_workspace, actor, target_operation, 'PAYMENT_REQUEST_SUBMIT', null, null);
  if existing is not null then return existing; end if;
  select * into selected_plan from public.plans where id = (payload->>'plan_id')::uuid and status = 'active' and is_public;
  select * into selected_method from public.payment_methods where id = (payload->>'payment_method_id')::uuid and status = 'active';
  if selected_plan.id is null then raise exception 'PLAN_UNAVAILABLE'; end if;
  if selected_method.id is null then raise exception 'PAYMENT_METHOD_UNAVAILABLE'; end if;
  if selected_plan.price_amount is null then raise exception 'PLAN_PRICE_NOT_CONFIGURED'; end if;
  if amount_value is null or amount_value <> selected_plan.price_amount or selected_plan.currency <> selected_method.currency then raise exception 'PAYMENT_AMOUNT_MISMATCH'; end if;
  if coalesce(payload->>'proof_path', '') not like target_workspace::text || '/%' then raise exception 'INVALID_PROOF_PATH'; end if;
  if not exists (
    select 1 from storage.objects
    where bucket_id = 'payment-proofs' and name = payload->>'proof_path'
      and lower(coalesce(metadata->>'mimetype', '')) = lower(payload->>'proof_mime_type')
      and coalesce((metadata->>'size')::bigint, 0) = (payload->>'proof_size_bytes')::bigint
  ) then raise exception 'PAYMENT_PROOF_NOT_FOUND'; end if;
  select id into subscription_id_value from public.subscriptions where workspace_id = target_workspace;

  insert into public.payment_requests(
    workspace_id, subscription_id, plan_id, payment_method_id, requested_by,
    amount, currency, payment_reference, proof_path, proof_filename,
    proof_mime_type, proof_size_bytes
  ) values (
    target_workspace, subscription_id_value, selected_plan.id, selected_method.id,
    actor, amount_value, selected_plan.currency,
    btrim(payload->>'payment_reference'), btrim(payload->>'proof_path'),
    btrim(payload->>'proof_filename'), payload->>'proof_mime_type',
    (payload->>'proof_size_bytes')::bigint
  ) returning id into request_id;
  result := jsonb_build_object('payment_request_id', request_id, 'status', 'under_review');
  perform private.finish_operation(target_workspace, target_operation, 'payment_request', request_id, result);
  perform private.write_audit(target_workspace, actor, 'payment_request.submitted', 'payment_request', request_id, target_operation, jsonb_build_object('plan_id', selected_plan.id, 'amount', amount_value));
  return result;
end;
$$;

revoke all on function public.retail_submit_payment_request(uuid, uuid, jsonb) from public, anon, authenticated;

create or replace function public.admin_review_retail_payment(
  target_request uuid,
  decision text,
  note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  request public.payment_requests%rowtype;
  selected_plan public.plans%rowtype;
  new_end timestamptz;
  new_grace_end timestamptz;
  result jsonb;
begin
  if actor is null or not private.is_platform_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if decision not in ('approve', 'reject') then raise exception 'INVALID_DECISION'; end if;
  select * into request from public.payment_requests where id = target_request for update;
  if request.id is null or request.status <> 'under_review' then raise exception 'PAYMENT_NOT_REVIEWABLE'; end if;

  if decision = 'approve' then
    select * into selected_plan from public.plans where id = request.plan_id and status = 'active';
    if selected_plan.id is null or selected_plan.billing_months is null then raise exception 'PLAN_BILLING_NOT_CONFIGURED'; end if;
    new_end := greatest(
      coalesce((select ends_at from public.subscriptions where workspace_id = request.workspace_id), now()),
      coalesce((select trial_ends_at from public.subscriptions where workspace_id = request.workspace_id), now()),
      now()
    )
      + make_interval(months => selected_plan.billing_months);
    new_grace_end := new_end + make_interval(days => selected_plan.grace_days);
    update public.subscriptions
    set plan_id = selected_plan.id,
        status = 'active',
        starts_at = least(starts_at, now()),
        ends_at = new_end,
        grace_ends_at = new_grace_end,
        approved_by = actor,
        approved_at = now()
    where workspace_id = request.workspace_id;
    update public.payment_requests
    set status = 'approved', reviewed_by = actor, reviewed_at = now(), review_note = nullif(btrim(note), '')
    where id = request.id;
  else
    update public.payment_requests
    set status = 'rejected', reviewed_by = actor, reviewed_at = now(), review_note = nullif(btrim(note), '')
    where id = request.id;
  end if;
  result := jsonb_build_object('payment_request_id', request.id, 'status', case when decision = 'approve' then 'approved' else 'rejected' end, 'subscription_ends_at', new_end);
  perform private.write_audit(request.workspace_id, actor, 'payment_request.' || case when decision = 'approve' then 'approved' else 'rejected' end, 'payment_request', request.id, gen_random_uuid(), jsonb_build_object('review_note_present', note is not null));
  return result;
end;
$$;

revoke all on function public.admin_review_retail_payment(uuid, text, text) from public, anon, authenticated;

create or replace function public.admin_set_retail_workspace_status(
  target_workspace uuid,
  target_status text,
  note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare actor uuid := (select auth.uid());
begin
  if actor is null or not private.is_platform_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if target_status not in ('active', 'suspended') then raise exception 'INVALID_WORKSPACE_STATUS'; end if;
  update public.retail_workspaces set status = target_status where id = target_workspace;
  if not found then raise exception 'WORKSPACE_NOT_FOUND'; end if;
  perform private.write_audit(target_workspace, actor, 'workspace.' || target_status, 'workspace', target_workspace, gen_random_uuid(), jsonb_build_object('note', nullif(btrim(note), '')));
  return jsonb_build_object('workspace_id', target_workspace, 'status', target_status);
end;
$$;

revoke all on function public.admin_set_retail_workspace_status(uuid, text, text) from public, anon, authenticated;
