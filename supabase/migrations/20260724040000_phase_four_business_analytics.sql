-- Phase 4.3: tenant-safe business intelligence and comparable reporting.

create index if not exists business_customers_org_created_idx
  on public.business_customers(organization_id,created_at desc);
create index if not exists business_products_org_created_idx
  on public.business_products(organization_id,created_at desc);

create or replace function private.percentage_change(current_value numeric, previous_value numeric)
returns numeric
language sql
immutable
set search_path=''
as $$
  select case
    when coalesce(previous_value,0)=0 and coalesce(current_value,0)=0 then 0
    when coalesce(previous_value,0)=0 then 100
    else round(((coalesce(current_value,0)-previous_value)/abs(previous_value))*100,2)
  end
$$;
revoke all on function private.percentage_change(numeric,numeric) from public,anon,authenticated;

create or replace function private.business_analytics_impl(
  target_organization uuid,
  report_start date,
  report_end date
) returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  current_user_id uuid := (select auth.uid());
  start_date date := coalesce(report_start,date_trunc('month',current_date)::date);
  end_date date := coalesce(report_end,current_date);
  day_count integer;
  previous_start date;
  previous_end date;
  org_currency text;
  revenue numeric(14,2) := 0;
  orders_count integer := 0;
  discounts numeric(14,2) := 0;
  cogs numeric(14,2) := 0;
  expenses numeric(14,2) := 0;
  previous_revenue numeric(14,2) := 0;
  previous_orders integer := 0;
  previous_expenses numeric(14,2) := 0;
  active_customers integer := 0;
  new_customers integer := 0;
  returning_customers integer := 0;
  low_stock integer := 0;
  out_of_stock integer := 0;
  inventory_value numeric(14,2) := 0;
  open_tasks integer := 0;
  overdue_tasks integer := 0;
  daily_sales jsonb := '[]'::jsonb;
  daily_expenses jsonb := '[]'::jsonb;
  top_products jsonb := '[]'::jsonb;
  customer_segments jsonb := '[]'::jsonb;
begin
  if current_user_id is null
    or not private.can_manage_business(target_organization,'financials') then
    raise exception 'NOT_AUTHORIZED';
  end if;
  if end_date < start_date then raise exception 'INVALID_DATE_RANGE'; end if;
  day_count := end_date-start_date+1;
  if day_count > 366 then raise exception 'DATE_RANGE_TOO_LARGE'; end if;
  previous_end := start_date-1;
  previous_start := previous_end-day_count+1;

  select currency into org_currency
  from public.organizations
  where id=target_organization and status='active' and type<>'STUDENT';
  if org_currency is null then raise exception 'INVALID_ORGANIZATION'; end if;

  select coalesce(sum(s.total),0),count(*)::integer,coalesce(sum(s.discount_total),0)
  into revenue,orders_count,discounts
  from public.business_sales s
  where s.organization_id=target_organization
    and s.status='completed'
    and s.payment_status<>'refunded'
    and s.sold_at>=start_date::timestamptz
    and s.sold_at<(end_date+1)::timestamptz;

  select coalesce(sum(i.quantity*i.unit_cost),0)
  into cogs
  from public.business_sale_items i
  join public.business_sales s on s.id=i.sale_id
  where i.organization_id=target_organization
    and s.status='completed'
    and s.payment_status<>'refunded'
    and s.sold_at>=start_date::timestamptz
    and s.sold_at<(end_date+1)::timestamptz;

  select coalesce(sum(e.amount),0)
  into expenses
  from public.business_expenses e
  where e.organization_id=target_organization
    and e.incurred_at between start_date and end_date;

  select coalesce(sum(s.total),0),count(*)::integer
  into previous_revenue,previous_orders
  from public.business_sales s
  where s.organization_id=target_organization
    and s.status='completed'
    and s.payment_status<>'refunded'
    and s.sold_at>=previous_start::timestamptz
    and s.sold_at<(previous_end+1)::timestamptz;

  select coalesce(sum(e.amount),0)
  into previous_expenses
  from public.business_expenses e
  where e.organization_id=target_organization
    and e.incurred_at between previous_start and previous_end;

  select count(distinct s.customer_id)::integer
  into active_customers
  from public.business_sales s
  where s.organization_id=target_organization and s.customer_id is not null
    and s.status='completed' and s.payment_status<>'refunded'
    and s.sold_at>=start_date::timestamptz and s.sold_at<(end_date+1)::timestamptz;

  select count(*)::integer into new_customers
  from public.business_customers c
  where c.organization_id=target_organization
    and c.created_at>=start_date::timestamptz and c.created_at<(end_date+1)::timestamptz;

  select count(*)::integer into returning_customers
  from (
    select s.customer_id
    from public.business_sales s
    where s.organization_id=target_organization and s.customer_id is not null
      and s.status='completed' and s.payment_status<>'refunded'
      and s.sold_at>=start_date::timestamptz and s.sold_at<(end_date+1)::timestamptz
      and exists (
        select 1 from public.business_sales older
        where older.organization_id=target_organization
          and older.customer_id=s.customer_id
          and older.status='completed' and older.payment_status<>'refunded'
          and older.sold_at<start_date::timestamptz
      )
    group by s.customer_id
  ) returning_set;

  select
    count(*) filter(where p.is_active and p.stock_quantity<=p.low_stock_threshold)::integer,
    count(*) filter(where p.is_active and p.stock_quantity=0)::integer,
    coalesce(sum(p.stock_quantity*p.cost) filter(where p.is_active),0)
  into low_stock,out_of_stock,inventory_value
  from public.business_products p
  where p.organization_id=target_organization;

  select
    count(*) filter(where t.status in ('todo','in_progress'))::integer,
    count(*) filter(where t.status in ('todo','in_progress') and t.due_at<now())::integer
  into open_tasks,overdue_tasks
  from public.business_tasks t
  where t.organization_id=target_organization;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date',d.day_value::date,
    'revenue',coalesce(ds.revenue,0),
    'orders',coalesce(ds.orders_count,0)
  ) order by d.day_value),'[]'::jsonb)
  into daily_sales
  from generate_series(start_date,end_date,'1 day'::interval) as d(day_value)
  left join (
    select s.sold_at::date sale_date,sum(s.total) revenue,count(*) orders_count
    from public.business_sales s
    where s.organization_id=target_organization
      and s.status='completed' and s.payment_status<>'refunded'
      and s.sold_at>=start_date::timestamptz and s.sold_at<(end_date+1)::timestamptz
    group by s.sold_at::date
  ) ds on ds.sale_date=d.day_value::date;

  select coalesce(jsonb_agg(jsonb_build_object(
    'date',d.day_value::date,
    'amount',coalesce(de.amount,0)
  ) order by d.day_value),'[]'::jsonb)
  into daily_expenses
  from generate_series(start_date,end_date,'1 day'::interval) as d(day_value)
  left join (
    select e.incurred_at expense_date,sum(e.amount) amount
    from public.business_expenses e
    where e.organization_id=target_organization and e.incurred_at between start_date and end_date
    group by e.incurred_at
  ) de on de.expense_date=d.day_value::date;

  select coalesce(jsonb_agg(row_data order by (row_data->>'revenue')::numeric desc),'[]'::jsonb)
  into top_products
  from (
    select jsonb_build_object(
      'product_id',coalesce(i.product_id::text,''),
      'name',max(i.title_snapshot),
      'quantity',sum(i.quantity),
      'revenue',sum(i.line_total),
      'profit',sum(i.line_total-(i.quantity*i.unit_cost))
    ) row_data
    from public.business_sale_items i
    join public.business_sales s on s.id=i.sale_id
    where i.organization_id=target_organization
      and s.status='completed' and s.payment_status<>'refunded'
      and s.sold_at>=start_date::timestamptz and s.sold_at<(end_date+1)::timestamptz
    group by i.product_id
    order by sum(i.line_total) desc
    limit 10
  ) products_ranked;

  select coalesce(jsonb_agg(jsonb_build_object('status',segments.status,'count',segments.segment_count) order by segments.segment_count desc),'[]'::jsonb)
  into customer_segments
  from (
    select status,count(*)::integer segment_count
    from public.business_customers
    where organization_id=target_organization
    group by status
  ) segments;

  return jsonb_build_object(
    'organization_id',target_organization,
    'currency',org_currency,
    'period',jsonb_build_object('start',start_date,'end',end_date,'days',day_count),
    'previous_period',jsonb_build_object('start',previous_start,'end',previous_end),
    'kpis',jsonb_build_object(
      'revenue',revenue,
      'orders',orders_count,
      'discounts',discounts,
      'average_order_value',case when orders_count=0 then 0 else round(revenue/orders_count,2) end,
      'cost_of_goods',cogs,
      'gross_profit',revenue-cogs,
      'expenses',expenses,
      'net_profit_estimate',revenue-cogs-expenses,
      'active_customers',active_customers,
      'new_customers',new_customers,
      'returning_customers',returning_customers,
      'low_stock',low_stock,
      'out_of_stock',out_of_stock,
      'inventory_value',inventory_value,
      'open_tasks',open_tasks,
      'overdue_tasks',overdue_tasks
    ),
    'comparison',jsonb_build_object(
      'previous_revenue',previous_revenue,
      'previous_orders',previous_orders,
      'previous_expenses',previous_expenses,
      'revenue_change',private.percentage_change(revenue,previous_revenue),
      'orders_change',private.percentage_change(orders_count,previous_orders),
      'expenses_change',private.percentage_change(expenses,previous_expenses)
    ),
    'daily_sales',daily_sales,
    'daily_expenses',daily_expenses,
    'top_products',top_products,
    'customer_segments',customer_segments,
    'generated_at',now()
  );
end
$$;
revoke all on function private.business_analytics_impl(uuid,date,date) from public,anon,authenticated;

create or replace function public.business_analytics(
  target_organization uuid,
  report_start date default null,
  report_end date default null
) returns jsonb
language sql
security invoker
set search_path=''
as $$
  select private.business_analytics_impl(target_organization,report_start,report_end)
$$;
revoke all on function public.business_analytics(uuid,date,date) from public,anon;
grant execute on function public.business_analytics(uuid,date,date) to authenticated;
