"use client";

import Link from "next/link";
import { useCart } from "@/components/cart/CartProvider";
import { Icon } from "@/components/ui/Icons";
import { cx } from "@/components/ui/Enterprise";

export default function CartStatusLink({ className }: { className?: string }) {
  const { count } = useCart();
  return (
    <Link href="/cart" className={cx("md-icon-link md-topbar-icon md-cart-status-link", className)} aria-label={count ? `السلة، ${count} عناصر` : "السلة"} title="السلة">
      <Icon name="cart" className="h-4 w-4" />
      {count ? <span className="md-icon-badge md-cart-count" aria-hidden="true">{count > 99 ? "99+" : count}</span> : null}
    </Link>
  );
}
