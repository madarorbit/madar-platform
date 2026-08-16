-- Phase 7.0 — Native Business Dashboard & Overview
-- Read-only, tenant-scoped facts for sector-aware Native Decision Overviews.
-- SECURITY INVOKER preserves the existing table RLS/privilege boundary.

create or replace function public.native_dashboard_facts(
  target_organization uuid,
  target_vertical text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $function$
declare
  requested_vertical text := lower(coalesce(target_vertical, ''));
  organization_created_at timestamptz;
  facts jsonb;
begin
  if requested_vertical not in ('commerce', 'food_service', 'hospitality') then
    raise exception 'INVALID_NATIVE_DASHBOARD_VERTICAL';
  end if;

  select o.created_at
    into organization_created_at
  from public.organizations o
  where o.id = target_organization;

  if organization_created_at is null then
    raise exception 'NATIVE_DASHBOARD_ORGANIZATION_NOT_FOUND';
  end if;

  if requested_vertical = 'commerce' then
    with completed_sales as (
      select s.id, s.currency, s.total, s.updated_at
      from public.business_sales s
      where s.organization_id = target_organization
        and s.status = 'completed'
    ), sales_by_currency as (
      select s.currency,
             count(*)::integer as completed_sales_count,
             coalesce(sum(s.total), 0)::numeric as revenue,
             max(s.updated_at) as data_as_of
      from completed_sales s
      group by s.currency
    ), cogs_by_currency as (
      select s.currency,
             coalesce(sum(i.quantity * i.unit_cost), 0)::numeric as cogs,
             max(greatest(s.updated_at, i.created_at)) as data_as_of
      from public.business_sale_items i
      join completed_sales s on s.id = i.sale_id
      where i.organization_id = target_organization
      group by s.currency
    ), returns_by_currency as (
      select s.currency,
             coalesce(sum(r.refund_amount), 0)::numeric as returns,
             max(r.created_at) as data_as_of
      from public.commerce_sales_returns r
      join public.business_sales s
        on s.id = r.sale_id
       and s.organization_id = target_organization
      where r.organization_id = target_organization
        and r.status = 'POSTED'
      group by s.currency
    ), expenses_by_currency as (
      select e.currency,
             coalesce(sum(e.amount), 0)::numeric as expenses,
             max(e.updated_at) as data_as_of
      from public.business_expenses e
      where e.organization_id = target_organization
      group by e.currency
    ), inventory_summary as (
      select count(*)::integer as active_product_count,
             coalesce(sum(p.stock_quantity * p.cost), 0)::numeric as inventory_value,
             count(*) filter (where p.stock_quantity = 0)::integer as stock_out_count,
             count(*) filter (where p.stock_quantity > 0 and p.stock_quantity <= p.low_stock_threshold)::integer as low_stock_count,
             max(p.updated_at) as data_as_of
      from public.business_products p
      where p.organization_id = target_organization
        and p.is_active = true
    )
    select jsonb_build_object(
      'sales_by_currency', coalesce((
        select jsonb_agg(jsonb_build_object(
          'currency', s.currency,
          'completed_sales_count', s.completed_sales_count,
          'revenue', s.revenue,
          'data_as_of', s.data_as_of
        ) order by s.currency)
        from sales_by_currency s
      ), '[]'::jsonb),
      'cogs_by_currency', coalesce((
        select jsonb_agg(jsonb_build_object(
          'currency', c.currency,
          'amount', c.cogs,
          'data_as_of', c.data_as_of
        ) order by c.currency)
        from cogs_by_currency c
      ), '[]'::jsonb),
      'returns_by_currency', coalesce((
        select jsonb_agg(jsonb_build_object(
          'currency', r.currency,
          'amount', r.returns,
          'data_as_of', r.data_as_of
        ) order by r.currency)
        from returns_by_currency r
      ), '[]'::jsonb),
      'expenses_by_currency', coalesce((
        select jsonb_agg(jsonb_build_object(
          'currency', e.currency,
          'amount', e.expenses,
          'data_as_of', e.data_as_of
        ) order by e.currency)
        from expenses_by_currency e
      ), '[]'::jsonb),
      'inventory', jsonb_build_object(
        'active_product_count', i.active_product_count,
        'inventory_value', i.inventory_value,
        'stock_out_count', i.stock_out_count,
        'low_stock_count', i.low_stock_count,
        'data_as_of', i.data_as_of,
        'stock_out_sample', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', x.id,
            'name', x.name,
            'stock_quantity', x.stock_quantity,
            'low_stock_threshold', x.low_stock_threshold
          ) order by x.name, x.id)
          from (
            select p.id, p.name, p.stock_quantity, p.low_stock_threshold
            from public.business_products p
            where p.organization_id = target_organization
              and p.is_active = true
              and p.stock_quantity = 0
            order by p.name, p.id
            limit 5
          ) x
        ), '[]'::jsonb),
        'low_stock_sample', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', x.id,
            'name', x.name,
            'stock_quantity', x.stock_quantity,
            'low_stock_threshold', x.low_stock_threshold
          ) order by x.stock_quantity, x.name, x.id)
          from (
            select p.id, p.name, p.stock_quantity, p.low_stock_threshold
            from public.business_products p
            where p.organization_id = target_organization
              and p.is_active = true
              and p.stock_quantity > 0
              and p.stock_quantity <= p.low_stock_threshold
            order by p.stock_quantity, p.name, p.id
            limit 5
          ) x
        ), '[]'::jsonb)
      )
    ) into facts
    from inventory_summary i;

  elsif requested_vertical = 'food_service' then
    with completed_orders as (
      -- SERVED is the status written by the kitchen completion operation.
      -- COMPLETED is also accepted by the table contract and is therefore a
      -- terminal completed state. IN_KITCHEN/READY are intentionally excluded.
      select o.id, o.total, o.ingredient_cost, o.opened_at, o.completed_at
      from public.restaurant_orders o
      where o.organization_id = target_organization
        and o.status in ('SERVED', 'COMPLETED')
    ), order_summary as (
      select count(*)::integer as completed_orders,
             coalesce(sum(o.total), 0)::numeric as revenue,
             coalesce(sum(o.ingredient_cost), 0)::numeric as ingredient_cost,
             coalesce(sum(o.total - o.ingredient_cost), 0)::numeric as gross_profit,
             max(coalesce(o.completed_at, o.opened_at)) as data_as_of
      from completed_orders o
    ), all_orders as (
      select count(*)::integer as order_count
      from public.restaurant_orders o
      where o.organization_id = target_organization
    ), recipe_summary as (
      select count(*)::integer as recipe_count
      from public.restaurant_recipes r
      where r.organization_id = target_organization
        and r.is_active = true
    ), kitchen_summary as (
      select count(*) filter (where k.status in ('NEW','PREPARING','READY'))::integer as active_count,
             count(*) filter (
               where k.status in ('NEW','PREPARING','READY')
                 and k.priority in ('HIGH','URGENT')
             )::integer as attention_count,
             avg(extract(epoch from (k.ready_at - k.opened_at)) / 60.0)
               filter (where k.ready_at is not null and k.status <> 'CANCELLED') as avg_ticket_minutes,
             max(coalesce(k.served_at, k.ready_at, k.started_at, k.opened_at)) as data_as_of
      from public.restaurant_kitchen_tickets k
      where k.organization_id = target_organization
    ), ingredient_products as (
      select distinct p.id, p.name, p.stock_quantity, p.low_stock_threshold, p.updated_at
      from public.restaurant_recipe_ingredients ri
      join public.restaurant_recipes r
        on r.id = ri.recipe_id
       and r.organization_id = target_organization
       and r.is_active = true
      join public.business_products p
        on p.id = ri.product_id
       and p.organization_id = target_organization
       and p.is_active = true
      where ri.organization_id = target_organization
    ), ingredient_summary as (
      select count(*)::integer as ingredient_product_count,
             count(*) filter (where p.stock_quantity = 0)::integer as stock_out_count,
             count(*) filter (where p.stock_quantity > 0 and p.stock_quantity <= p.low_stock_threshold)::integer as low_stock_count,
             max(p.updated_at) as data_as_of
      from ingredient_products p
    )
    select jsonb_build_object(
      'order_count', ao.order_count,
      'recipe_count', rs.recipe_count,
      'completed_orders', os.completed_orders,
      'revenue', os.revenue,
      'ingredient_cost', os.ingredient_cost,
      'gross_profit', os.gross_profit,
      'orders_data_as_of', os.data_as_of,
      'kitchen', jsonb_build_object(
        'active_count', ks.active_count,
        'attention_count', ks.attention_count,
        'avg_ticket_minutes', ks.avg_ticket_minutes,
        'data_as_of', ks.data_as_of,
        'attention_sample', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', x.id,
            'ticket_number', x.ticket_number,
            'status', x.status,
            'priority', x.priority,
            'opened_at', x.opened_at
          ) order by case x.priority when 'URGENT' then 0 else 1 end, x.opened_at, x.id)
          from (
            select k.id, k.ticket_number, k.status, k.priority, k.opened_at
            from public.restaurant_kitchen_tickets k
            where k.organization_id = target_organization
              and k.status in ('NEW','PREPARING','READY')
              and k.priority in ('HIGH','URGENT')
            order by case k.priority when 'URGENT' then 0 else 1 end, k.opened_at, k.id
            limit 5
          ) x
        ), '[]'::jsonb)
      ),
      'ingredients', jsonb_build_object(
        'ingredient_product_count', ins.ingredient_product_count,
        'stock_out_count', ins.stock_out_count,
        'low_stock_count', ins.low_stock_count,
        'data_as_of', ins.data_as_of,
        'stock_out_sample', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', x.id,
            'name', x.name,
            'stock_quantity', x.stock_quantity,
            'low_stock_threshold', x.low_stock_threshold
          ) order by x.name, x.id)
          from (
            select p.id, p.name, p.stock_quantity, p.low_stock_threshold
            from ingredient_products p
            where p.stock_quantity = 0
            order by p.name, p.id
            limit 5
          ) x
        ), '[]'::jsonb),
        'low_stock_sample', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', x.id,
            'name', x.name,
            'stock_quantity', x.stock_quantity,
            'low_stock_threshold', x.low_stock_threshold
          ) order by x.stock_quantity, x.name, x.id)
          from (
            select p.id, p.name, p.stock_quantity, p.low_stock_threshold
            from ingredient_products p
            where p.stock_quantity > 0
              and p.stock_quantity <= p.low_stock_threshold
            order by p.stock_quantity, p.name, p.id
            limit 5
          ) x
        ), '[]'::jsonb)
      )
    ) into facts
    from order_summary os
    cross join all_orders ao
    cross join recipe_summary rs
    cross join kitchen_summary ks
    cross join ingredient_summary ins;

  else
    with active_properties as (
      select p.id, p.timezone
      from public.hotel_properties p
      where p.organization_id = target_organization
        and p.is_active = true
    ), valid_properties as (
      select p.id, p.timezone
      from active_properties p
      join pg_catalog.pg_timezone_names tz on tz.name = p.timezone
    ), property_summary as (
      select (select count(*)::integer from active_properties) as property_count,
             (select count(*)::integer from active_properties p
               where not exists (
                 select 1 from pg_catalog.pg_timezone_names tz where tz.name = p.timezone
               )) as invalid_timezone_count,
             coalesce((select jsonb_agg(t.timezone order by t.timezone)
               from (select distinct p.timezone from active_properties p) t), '[]'::jsonb) as property_timezones
    ), room_summary as (
      select count(r.id)::integer as total_rooms,
             count(r.id) filter (where r.status = 'OCCUPIED')::integer as occupied_rooms
      from active_properties p
      left join public.hotel_rooms r
        on r.property_id = p.id
       and r.organization_id = target_organization
    ), revenue_by_currency as (
      select f.currency,
             coalesce(sum(c.amount), 0)::numeric as amount,
             max(c.posted_at) as data_as_of
      from public.hotel_folio_charges c
      join public.hotel_folios f
        on f.id = c.folio_id
       and f.organization_id = target_organization
      join public.hotel_stays s
        on s.id = f.stay_id
       and s.organization_id = target_organization
      join public.hotel_reservations r
        on r.id = s.reservation_id
       and r.organization_id = target_organization
      join valid_properties p on p.id = r.property_id
      where c.organization_id = target_organization
        and c.charge_type = 'ROOM'
        and (c.posted_at at time zone p.timezone)::date = (now() at time zone p.timezone)::date
      group by f.currency
    ), stay_summary as (
      select count(*)::integer as in_house_stays
      from public.hotel_stays s
      join public.hotel_reservations r
        on r.id = s.reservation_id
       and r.organization_id = target_organization
      join active_properties p on p.id = r.property_id
      where s.organization_id = target_organization
        and s.status = 'IN_HOUSE'
    ), housekeeping_summary as (
      select count(*) filter (where h.status in ('PENDING','ASSIGNED','IN_PROGRESS','INSPECTION','BLOCKED'))::integer as active_count,
             count(*) filter (where h.status = 'BLOCKED')::integer as blocked_count
      from public.hotel_housekeeping_tasks h
      join public.hotel_rooms r
        on r.id = h.room_id
       and r.organization_id = target_organization
      join active_properties p on p.id = r.property_id
      where h.organization_id = target_organization
    ), maintenance_summary as (
      select count(*) filter (
               where m.status in ('OPEN','ASSIGNED','IN_PROGRESS') and m.priority = 'EMERGENCY'
             )::integer as emergency_count,
             count(*) filter (
               where m.status in ('OPEN','ASSIGNED','IN_PROGRESS') and m.priority = 'HIGH'
             )::integer as high_count,
             count(*) filter (where m.status in ('OPEN','ASSIGNED','IN_PROGRESS'))::integer as active_count
      from public.hotel_maintenance_requests m
      where m.organization_id = target_organization
    )
    select jsonb_build_object(
      'property_count', ps.property_count,
      'property_timezones', ps.property_timezones,
      'invalid_timezone_count', ps.invalid_timezone_count,
      'total_rooms', rooms.total_rooms,
      'occupied_rooms', rooms.occupied_rooms,
      'room_revenue_by_currency', coalesce((
        select jsonb_agg(jsonb_build_object(
          'currency', rev.currency,
          'amount', rev.amount,
          'data_as_of', rev.data_as_of
        ) order by rev.currency)
        from revenue_by_currency rev
      ), '[]'::jsonb),
      'in_house_stays', stays.in_house_stays,
      'housekeeping', jsonb_build_object(
        'active_count', hk.active_count,
        'blocked_count', hk.blocked_count,
        'blocked_sample', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', x.id,
            'room_number', x.room_number,
            'task_type', x.task_type,
            'status', x.status,
            'service_date', x.service_date
          ) order by x.service_date, x.room_number, x.id)
          from (
            select h.id, r.room_number, h.task_type, h.status, h.service_date
            from public.hotel_housekeeping_tasks h
            join public.hotel_rooms r
              on r.id = h.room_id
             and r.organization_id = target_organization
            join active_properties p on p.id = r.property_id
            where h.organization_id = target_organization
              and h.status = 'BLOCKED'
            order by h.service_date, r.room_number, h.id
            limit 5
          ) x
        ), '[]'::jsonb)
      ),
      'maintenance', jsonb_build_object(
        'active_count', ms.active_count,
        'emergency_count', ms.emergency_count,
        'high_count', ms.high_count,
        'emergency_sample', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', x.id,
            'title', x.title,
            'priority', x.priority,
            'status', x.status,
            'created_at', x.created_at
          ) order by x.created_at, x.id)
          from (
            select m.id, m.title, m.priority, m.status, m.created_at
            from public.hotel_maintenance_requests m
            where m.organization_id = target_organization
              and m.status in ('OPEN','ASSIGNED','IN_PROGRESS')
              and m.priority = 'EMERGENCY'
            order by m.created_at, m.id
            limit 5
          ) x
        ), '[]'::jsonb),
        'high_sample', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', x.id,
            'title', x.title,
            'priority', x.priority,
            'status', x.status,
            'created_at', x.created_at
          ) order by x.created_at, x.id)
          from (
            select m.id, m.title, m.priority, m.status, m.created_at
            from public.hotel_maintenance_requests m
            where m.organization_id = target_organization
              and m.status in ('OPEN','ASSIGNED','IN_PROGRESS')
              and m.priority = 'HIGH'
            order by m.created_at, m.id
            limit 5
          ) x
        ), '[]'::jsonb)
      )
    ) into facts
    from property_summary ps
    cross join room_summary rooms
    cross join stay_summary stays
    cross join housekeeping_summary hk
    cross join maintenance_summary ms;
  end if;

  return jsonb_build_object(
    'vertical', requested_vertical,
    'organization_created_at', organization_created_at,
    'facts', facts
  );
end;
$function$;

create or replace function public.native_dashboard_task_facts(target_organization uuid)
returns jsonb
language sql
stable
security invoker
set search_path = public
as $function$
select jsonb_build_object(
  'overdue_count', count(*) filter (
    where t.status in ('todo','in_progress')
      and t.due_at is not null
      and t.due_at < now()
  )::integer,
  'high_urgent_overdue_count', count(*) filter (
    where t.status in ('todo','in_progress')
      and t.due_at is not null
      and t.due_at < now()
      and t.priority in ('high','urgent')
  )::integer,
  'data_as_of', max(t.updated_at),
  'overdue_sample', coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', x.id,
      'title', x.title,
      'priority', x.priority,
      'due_at', x.due_at
    ) order by case x.priority when 'urgent' then 0 when 'high' then 1 else 2 end, x.due_at, x.id)
    from (
      select bt.id, bt.title, bt.priority, bt.due_at
      from public.business_tasks bt
      where bt.organization_id = target_organization
        and bt.status in ('todo','in_progress')
        and bt.due_at is not null
        and bt.due_at < now()
      order by case bt.priority when 'urgent' then 0 when 'high' then 1 else 2 end, bt.due_at, bt.id
      limit 5
    ) x
  ), '[]'::jsonb)
)
from public.business_tasks t
where t.organization_id = target_organization;
$function$;

revoke all on function public.native_dashboard_facts(uuid, text) from public;
revoke execute on function public.native_dashboard_facts(uuid, text) from anon;
grant execute on function public.native_dashboard_facts(uuid, text) to authenticated, service_role;

revoke all on function public.native_dashboard_task_facts(uuid) from public;
revoke execute on function public.native_dashboard_task_facts(uuid) from anon;
grant execute on function public.native_dashboard_task_facts(uuid) to authenticated, service_role;
