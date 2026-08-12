alter table public.order_items drop column line_total;
alter table public.products alter column price type numeric(30,12),alter column compare_at_price type numeric(30,12);
alter table public.services alter column price_from type numeric(30,12);
alter table public.orders alter column subtotal type numeric(30,12),alter column discount_total type numeric(30,12),alter column total type numeric(30,12);
alter table public.order_items alter column unit_price type numeric(30,12);
alter table public.order_items add column line_total numeric(30,12) generated always as(unit_price*quantity) stored;
alter table public.coupons alter column discount_value type numeric(30,12),alter column minimum_order type numeric(30,12),alter column maximum_discount type numeric(30,12);
alter table public.coupon_redemptions alter column discount_amount type numeric(30,12);
