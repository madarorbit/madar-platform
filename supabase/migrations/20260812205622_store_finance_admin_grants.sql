grant insert,update,delete on public.currencies to authenticated;
grant insert,update,delete on public.exchange_rates to authenticated;
grant insert,update,delete on public.payment_method_currencies to authenticated;
grant usage,select on all sequences in schema public to authenticated;
