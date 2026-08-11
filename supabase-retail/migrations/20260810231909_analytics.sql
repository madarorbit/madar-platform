-- MADAR Retail V0 — deterministic analytics. ORBY consumes this function;
-- the language model never calculates financial totals itself.

create index sale_returns_workspace_date_idx
  on public.sale_returns(workspace_id, returned_at desc);

create or replace function public.retail_analytics_snapshot(
  target_workspace uuid,
  date_from date,
  date_to date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.require_workspace_actor(target_workspace, array['OWNER', 'MANAGER', 'STAFF', 'VIEWER']::text[]);
  workspace_timezone text;
  workspace_currency text;
  start_at timestamptz;
  end_at timestamptz;
  previous_start timestamptz;
  period_days integer;
  result jsonb;
begin
  if date_from is null or date_to is null or date_to < date_from then
    raise exception 'INVALID_ANALYTICS_PERIOD';
  end if;
  period_days := date_to - date_from + 1;
  if period_days > 366 then raise exception 'ANALYTICS_PERIOD_TOO_LARGE'; end if;

  select timezone, currency into workspace_timezone, workspace_currency
  from public.retail_workspaces where id = target_workspace;
  start_at := date_from::timestamp at time zone workspace_timezone;
  end_at := (date_to + 1)::timestamp at time zone workspace_timezone;
  previous_start := start_at - make_interval(days => period_days);

  with
  current_sales as (
    select coalesce(sum(total), 0)::numeric(18,2) as total, count(*)::integer as orders
    from public.sales
    where workspace_id = target_workspace and status = 'completed'
      and sold_at >= start_at and sold_at < end_at
  ),
  current_returns as (
    select coalesce(sum(refund_total), 0)::numeric(18,2) as total
    from public.sale_returns
    where workspace_id = target_workspace
      and returned_at >= start_at and returned_at < end_at
  ),
  current_cost as (
    select coalesce(sum(si.quantity * si.unit_cost), 0)::numeric(18,2) as sold_cost
    from public.sale_items si
    join public.sales s on s.workspace_id = si.workspace_id and s.id = si.sale_id
    where s.workspace_id = target_workspace and s.status = 'completed'
      and s.sold_at >= start_at and s.sold_at < end_at
  ),
  current_return_cost as (
    select coalesce(sum(sri.quantity * sri.unit_cost), 0)::numeric(18,2) as returned_cost
    from public.sale_return_items sri
    join public.sale_returns sr
      on sr.workspace_id = sri.workspace_id and sr.id = sri.sale_return_id
    where sr.workspace_id = target_workspace
      and sr.returned_at >= start_at and sr.returned_at < end_at
  ),
  current_expenses as (
    select coalesce(sum(amount), 0)::numeric(18,2) as total
    from public.expenses
    where workspace_id = target_workspace
      and occurred_at >= start_at and occurred_at < end_at
  ),
  previous_sales as (
    select coalesce(sum(total), 0)::numeric(18,2) as total, count(*)::integer as orders
    from public.sales
    where workspace_id = target_workspace and status = 'completed'
      and sold_at >= previous_start and sold_at < start_at
  ),
  previous_returns as (
    select coalesce(sum(refund_total), 0)::numeric(18,2) as total
    from public.sale_returns
    where workspace_id = target_workspace
      and returned_at >= previous_start and returned_at < start_at
  ),
  cash_movement as (
    select
      coalesce(sum(amount) filter (where direction = 'IN'), 0)::numeric(18,2) as cash_in,
      coalesce(sum(amount) filter (where direction = 'OUT'), 0)::numeric(18,2) as cash_out
    from public.cash_transactions
    where workspace_id = target_workspace
      and occurred_at >= start_at and occurred_at < end_at
  ),
  balances as (
    select
      coalesce((select sum(current_balance) from public.cash_accounts where workspace_id = target_workspace), 0)::numeric(18,2) as cash_position,
      coalesce((select sum(balance_due) from public.receivables where workspace_id = target_workspace and status in ('open', 'partial')), 0)::numeric(18,2) as receivables,
      coalesce((select sum(balance_due) from public.payables where workspace_id = target_workspace and status in ('open', 'partial')), 0)::numeric(18,2) as payables,
      coalesce((select sum(stock_on_hand * average_cost) from public.products where workspace_id = target_workspace and deleted_at is null), 0)::numeric(18,2) as inventory_value
  ),
  product_flow as (
    select si.product_id, sum(si.quantity)::numeric(18,3) as quantity_delta,
           sum(si.net_line_total)::numeric(18,2) as revenue_delta
    from public.sale_items si
    join public.sales s on s.workspace_id = si.workspace_id and s.id = si.sale_id
    where s.workspace_id = target_workspace and s.status = 'completed'
      and s.sold_at >= start_at and s.sold_at < end_at
    group by si.product_id
    union all
    select sri.product_id, -sum(sri.quantity)::numeric(18,3),
           -sum(sri.refund_amount)::numeric(18,2)
    from public.sale_return_items sri
    join public.sale_returns sr
      on sr.workspace_id = sri.workspace_id and sr.id = sri.sale_return_id
    where sr.workspace_id = target_workspace
      and sr.returned_at >= start_at and sr.returned_at < end_at
    group by sri.product_id
  ),
  top_product_rows as (
    select p.id, p.name, p.sku,
           sum(pf.quantity_delta)::numeric(18,3) as quantity_sold,
           sum(pf.revenue_delta)::numeric(18,2) as revenue
    from product_flow pf
    join public.products p on p.workspace_id = target_workspace and p.id = pf.product_id
    group by p.id, p.name, p.sku
    having sum(pf.quantity_delta) > 0
    order by quantity_sold desc, revenue desc
    limit 10
  ),
  low_stock_rows as (
    select id, name, sku, stock_on_hand, minimum_stock
    from public.products
    where workspace_id = target_workspace and deleted_at is null and status = 'active'
      and stock_on_hand <= minimum_stock
    order by (stock_on_hand = 0) desc, stock_on_hand asc, name
    limit 20
  ),
  last_sale_by_product as (
    select si.product_id, max(s.sold_at) as last_sold_at,
           sum(si.quantity) filter (where s.sold_at >= now() - interval '30 days') as quantity_30d
    from public.sale_items si
    join public.sales s on s.workspace_id = si.workspace_id and s.id = si.sale_id
    where s.workspace_id = target_workspace and s.status = 'completed'
    group by si.product_id
  ),
  slow_product_rows as (
    select p.id, p.name, p.sku, p.stock_on_hand, l.last_sold_at,
           coalesce(l.quantity_30d, 0)::numeric(18,3) as quantity_30d
    from public.products p
    left join last_sale_by_product l on l.product_id = p.id
    where p.workspace_id = target_workspace and p.deleted_at is null
      and p.status = 'active' and p.stock_on_hand > 0
    order by l.last_sold_at asc nulls first, quantity_30d asc, p.stock_on_hand desc
    limit 10
  ),
  sales_by_day as (
    select (sold_at at time zone workspace_timezone)::date as day,
           sum(total)::numeric(18,2) as total
    from public.sales
    where workspace_id = target_workspace and status = 'completed'
      and sold_at >= start_at and sold_at < end_at
    group by day
  ),
  returns_by_day as (
    select (returned_at at time zone workspace_timezone)::date as day,
           sum(refund_total)::numeric(18,2) as total
    from public.sale_returns
    where workspace_id = target_workspace
      and returned_at >= start_at and returned_at < end_at
    group by day
  ),
  daily_rows as (
    select d::date as day,
           (coalesce(s.total, 0) - coalesce(r.total, 0))::numeric(18,2) as revenue
    from generate_series(date_from::timestamp, date_to::timestamp, interval '1 day') d
    left join sales_by_day s on s.day = d::date
    left join returns_by_day r on r.day = d::date
  ),
  recent_rows as (
    select kind, id, label, amount, occurred_at
    from (
      select 'sale'::text as kind, id, invoice_number as label, total as amount, sold_at as occurred_at
      from public.sales where workspace_id = target_workspace and status = 'completed'
      union all
      select 'purchase', id, purchase_number, total, purchased_at
      from public.purchases where workspace_id = target_workspace and status = 'completed'
      union all
      select 'expense', id, description, amount, occurred_at
      from public.expenses where workspace_id = target_workspace
      union all
      select 'collection', id, coalesce(notes, 'تحصيل من عميل'), amount, occurred_at
      from public.debt_transactions
      where workspace_id = target_workspace and transaction_type = 'COLLECTION'
    ) activity
    order by occurred_at desc
    limit 12
  )
  select jsonb_build_object(
    'workspace_id', target_workspace,
    'currency', workspace_currency,
    'timezone', workspace_timezone,
    'period', jsonb_build_object('from', date_from, 'to', date_to, 'days', period_days),
    'as_of', now(),
    'metrics', jsonb_build_object(
      'revenue', cs.total - cr.total,
      'gross_sales', cs.total,
      'returns', cr.total,
      'estimated_cost_of_goods', cc.sold_cost - crc.returned_cost,
      'estimated_gross_profit', (cs.total - cr.total) - (cc.sold_cost - crc.returned_cost),
      'expenses', ce.total,
      'estimated_net_operating_result', ((cs.total - cr.total) - (cc.sold_cost - crc.returned_cost)) - ce.total,
      'orders', cs.orders,
      'average_order_value', case when cs.orders = 0 then 0 else round((cs.total - cr.total) / cs.orders, 2) end,
      'cash_position', b.cash_position,
      'cash_in', cm.cash_in,
      'cash_out', cm.cash_out,
      'receivables', b.receivables,
      'payables', b.payables,
      'inventory_value', b.inventory_value
    ),
    'comparison', jsonb_build_object(
      'previous_from', (date_from - period_days),
      'previous_to', (date_from - 1),
      'previous_revenue', ps.total - pr.total,
      'revenue_change', (cs.total - cr.total) - (ps.total - pr.total),
      'revenue_change_percent', case
        when ps.total - pr.total = 0 then null
        else round((((cs.total - cr.total) - (ps.total - pr.total)) / abs(ps.total - pr.total)) * 100, 1)
      end
    ),
    'top_products', coalesce((select jsonb_agg(to_jsonb(t) order by quantity_sold desc, revenue desc) from top_product_rows t), '[]'::jsonb),
    'low_stock', coalesce((select jsonb_agg(to_jsonb(l) order by (stock_on_hand = 0) desc, stock_on_hand, name) from low_stock_rows l), '[]'::jsonb),
    'slow_moving', coalesce((select jsonb_agg(to_jsonb(s) order by last_sold_at asc nulls first, quantity_30d) from slow_product_rows s), '[]'::jsonb),
    'daily_sales', coalesce((select jsonb_agg(to_jsonb(d) order by day) from daily_rows d), '[]'::jsonb),
    'recent_activity', coalesce((select jsonb_agg(to_jsonb(r) order by occurred_at desc) from recent_rows r), '[]'::jsonb),
    'definitions', jsonb_build_object(
      'revenue', 'صافي المبيعات بعد المرتجعات خلال الفترة',
      'estimated_gross_profit', 'الإيراد ناقص تكلفة البضاعة التقديرية بطريقة متوسط التكلفة',
      'cash_position', 'الرصيد الحالي للصندوق النقدي وليس الإيراد',
      'receivables', 'المبالغ المتبقية لدى العملاء وليست نقدًا محصلًا'
    )
  ) into result
  from current_sales cs, current_returns cr, current_cost cc,
       current_return_cost crc, current_expenses ce, previous_sales ps,
       previous_returns pr, cash_movement cm, balances b;

  perform private.write_audit(
    target_workspace, actor, 'analytics.read', 'analytics_snapshot', null,
    gen_random_uuid(), jsonb_build_object('date_from', date_from, 'date_to', date_to)
  );
  return result;
end;
$$;

revoke all on function public.retail_analytics_snapshot(uuid, date, date) from public, anon, authenticated;

create or replace function public.retail_customer_summaries(target_workspace uuid)
returns table(
  id uuid, name text, phone text, notes text, status text,
  total_sales numeric, balance_due numeric, last_transaction_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_workspace_actor(target_workspace, array['OWNER', 'MANAGER', 'STAFF', 'VIEWER']::text[]);
  return query
  with sale_totals as (
    select customer_id, sum(total - returned_total) as total_sales, max(sold_at) as last_sale
    from public.sales
    where workspace_id = target_workspace and status = 'completed' and customer_id is not null
    group by customer_id
  ), debt_totals as (
    select customer_id, sum(balance_due) as balance_due
    from public.receivables
    where workspace_id = target_workspace and status in ('open', 'partial')
    group by customer_id
  ), debt_activity as (
    select customer_id, max(occurred_at) as last_debt
    from public.debt_transactions
    where workspace_id = target_workspace and party_type = 'CUSTOMER'
    group by customer_id
  )
  select c.id, c.name, c.phone, c.notes, c.status,
         coalesce(s.total_sales, 0), coalesce(d.balance_due, 0),
         greatest(s.last_sale, a.last_debt)
  from public.customers c
  left join sale_totals s on s.customer_id = c.id
  left join debt_totals d on d.customer_id = c.id
  left join debt_activity a on a.customer_id = c.id
  where c.workspace_id = target_workspace and c.deleted_at is null
  order by c.name;
end;
$$;

revoke all on function public.retail_customer_summaries(uuid) from public, anon, authenticated;

create or replace function public.retail_supplier_summaries(target_workspace uuid)
returns table(
  id uuid, name text, phone text, notes text, status text,
  total_purchases numeric, balance_due numeric, last_transaction_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_workspace_actor(target_workspace, array['OWNER', 'MANAGER', 'STAFF', 'VIEWER']::text[]);
  return query
  with purchase_totals as (
    select supplier_id, sum(total) as total_purchases, max(purchased_at) as last_purchase
    from public.purchases
    where workspace_id = target_workspace and status = 'completed' and supplier_id is not null
    group by supplier_id
  ), debt_totals as (
    select supplier_id, sum(balance_due) as balance_due
    from public.payables
    where workspace_id = target_workspace and status in ('open', 'partial')
    group by supplier_id
  ), debt_activity as (
    select supplier_id, max(occurred_at) as last_debt
    from public.debt_transactions
    where workspace_id = target_workspace and party_type = 'SUPPLIER'
    group by supplier_id
  )
  select s.id, s.name, s.phone, s.notes, s.status,
         coalesce(p.total_purchases, 0), coalesce(d.balance_due, 0),
         greatest(p.last_purchase, a.last_debt)
  from public.suppliers s
  left join purchase_totals p on p.supplier_id = s.id
  left join debt_totals d on d.supplier_id = s.id
  left join debt_activity a on a.supplier_id = s.id
  where s.workspace_id = target_workspace and s.deleted_at is null
  order by s.name;
end;
$$;

revoke all on function public.retail_supplier_summaries(uuid) from public, anon, authenticated;
