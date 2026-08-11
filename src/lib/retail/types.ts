export type WorkspaceRole = "OWNER" | "MANAGER" | "STAFF" | "VIEWER";
export type PaymentMethod = "CASH" | "BANK" | "WALLET" | "CREDIT" | "OTHER";

export interface RetailWorkspace {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  subtype: string;
  allow_credit_sales: boolean;
  invoice_prefix: string;
  status: "active" | "suspended" | "archived";
}

export interface ProductSummary {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  sale_price: number;
  purchase_price: number;
  average_cost: number;
  stock_on_hand: number;
  minimum_stock: number;
  unit: string;
  status: "active" | "inactive";
}

export interface PartySummary {
  id: string;
  name: string;
  phone: string | null;
  notes: string | null;
}

export interface AnalyticsSnapshot {
  workspace_id: string;
  currency: string;
  timezone: string;
  as_of: string;
  period: { from: string; to: string; days: number };
  metrics: {
    revenue: number;
    gross_sales: number;
    returns: number;
    estimated_cost_of_goods: number;
    estimated_gross_profit: number;
    expenses: number;
    estimated_net_operating_result: number;
    orders: number;
    average_order_value: number;
    cash_position: number;
    cash_in: number;
    cash_out: number;
    receivables: number;
    payables: number;
    inventory_value: number;
  };
  comparison: {
    previous_from: string;
    previous_to: string;
    previous_revenue: number;
    revenue_change: number;
    revenue_change_percent: number | null;
  };
  top_products: Array<{
    id: string;
    name: string;
    sku: string | null;
    quantity_sold: number;
    revenue: number;
  }>;
  low_stock: Array<{
    id: string;
    name: string;
    sku: string | null;
    stock_on_hand: number;
    minimum_stock: number;
  }>;
  slow_moving: Array<{
    id: string;
    name: string;
    sku: string | null;
    stock_on_hand: number;
    last_sold_at: string | null;
    quantity_30d: number;
  }>;
  daily_sales: Array<{ day: string; revenue: number }>;
  recent_activity: Array<{
    kind: string;
    id: string;
    label: string;
    amount: number;
    occurred_at: string;
  }>;
  definitions: Record<string, string>;
}
