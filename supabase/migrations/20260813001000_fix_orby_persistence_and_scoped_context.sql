-- Production regression fix: unified ORBY persistence + scoped business/Retail context.
-- Applied first to the existing primary MADAR Supabase project, then committed here.

-- The legacy V2 guard required a workspace for every ORBY write. Unified ORBY now
-- supports account-level general conversations, while RLS and the save RPC still
-- enforce user ownership and workspace membership for scoped conversations.
drop trigger if exists madar_v2_orby_access_guard on public.orby_conversations;
drop trigger if exists madar_v2_orby_access_guard on public.orby_messages;

-- The public wrapper owns the membership/entitlement checks. SECURITY INVOKER could
-- no longer call its private helpers after the production privilege lockdown.
alter function public.orby_business_context(uuid) security definer;
revoke all on function public.orby_business_context(uuid) from public, anon;
grant execute on function public.orby_business_context(uuid) to authenticated;

-- PL/pgSQL OUT parameters expose balance_due as a variable. The old unqualified
-- aggregates were therefore ambiguous (42702) when ORBY loaded Retail evidence.
create or replace function public.retail_customer_summaries(target_workspace uuid)
returns table(id uuid, name text, phone text, notes text, status text, total_sales numeric, balance_due numeric, last_transaction_at timestamptz)
language plpgsql
stable security definer
set search_path=''
as $$
begin
  perform private.retail_require_workspace_actor(target_workspace, array['OWNER','MANAGER','STAFF','VIEWER']::text[]);
  return query
  with sale_totals as (
    select rs.customer_id, sum(rs.total - rs.returned_total) as total_sales, max(rs.sold_at) as last_sale
    from public.retail_sales rs
    where rs.workspace_id = target_workspace and rs.status = 'completed' and rs.customer_id is not null
    group by rs.customer_id
  ), debt_totals as (
    select rr.customer_id, sum(rr.balance_due) as open_balance
    from public.retail_receivables rr
    where rr.workspace_id = target_workspace and rr.status in ('open','partial')
    group by rr.customer_id
  ), debt_activity as (
    select rdt.customer_id, max(rdt.occurred_at) as last_debt
    from public.retail_debt_transactions rdt
    where rdt.workspace_id = target_workspace and rdt.party_type = 'CUSTOMER'
    group by rdt.customer_id
  )
  select c.id,c.name,c.phone,c.notes,c.status,
         coalesce(st.total_sales,0),coalesce(dt.open_balance,0),greatest(st.last_sale,da.last_debt)
  from public.retail_customers c
  left join sale_totals st on st.customer_id=c.id
  left join debt_totals dt on dt.customer_id=c.id
  left join debt_activity da on da.customer_id=c.id
  where c.workspace_id=target_workspace and c.deleted_at is null
  order by c.name;
end;
$$;

create or replace function public.retail_supplier_summaries(target_workspace uuid)
returns table(id uuid, name text, phone text, notes text, status text, total_purchases numeric, balance_due numeric, last_transaction_at timestamptz)
language plpgsql
stable security definer
set search_path=''
as $$
begin
  perform private.retail_require_workspace_actor(target_workspace, array['OWNER','MANAGER','STAFF','VIEWER']::text[]);
  return query
  with purchase_totals as (
    select rp.supplier_id, sum(rp.total) as total_purchases, max(rp.purchased_at) as last_purchase
    from public.retail_purchases rp
    where rp.workspace_id=target_workspace and rp.status='completed' and rp.supplier_id is not null
    group by rp.supplier_id
  ), debt_totals as (
    select rpay.supplier_id, sum(rpay.balance_due) as open_balance
    from public.retail_payables rpay
    where rpay.workspace_id=target_workspace and rpay.status in ('open','partial')
    group by rpay.supplier_id
  ), debt_activity as (
    select rdt.supplier_id, max(rdt.occurred_at) as last_debt
    from public.retail_debt_transactions rdt
    where rdt.workspace_id=target_workspace and rdt.party_type='SUPPLIER'
    group by rdt.supplier_id
  )
  select s.id,s.name,s.phone,s.notes,s.status,
         coalesce(pt.total_purchases,0),coalesce(dt.open_balance,0),greatest(pt.last_purchase,da.last_debt)
  from public.retail_suppliers s
  left join purchase_totals pt on pt.supplier_id=s.id
  left join debt_totals dt on dt.supplier_id=s.id
  left join debt_activity da on da.supplier_id=s.id
  where s.workspace_id=target_workspace and s.deleted_at is null
  order by s.name;
end;
$$;
