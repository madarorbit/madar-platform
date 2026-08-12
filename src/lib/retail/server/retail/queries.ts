import { cache } from "react";
import { createClient } from "@/src/lib/retail/supabase/server";
import { assertRetailWorkspaceAccess } from "@/src/lib/retail/server/auth/context";
import { executeRetailRpc } from "@/src/lib/retail/server/rpc";
import type { PartySummary, ProductSummary } from "@/src/lib/retail/types";

async function authorizedClient(workspaceId: string) {
  await assertRetailWorkspaceAccess(workspaceId);
  return createClient();
}

export const getProducts = cache(async (workspaceId: string) => {
  const supabase = await authorizedClient(workspaceId);
  const { data, error } = await supabase
    .from("retail_products")
    .select(
      "id,name,sku,barcode,sale_price,purchase_price,average_cost,stock_on_hand,minimum_stock,unit,status,category_id,categories:retail_categories(name)",
    )
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("name")
    .limit(500);
  if (error) throw error;
  return (data ?? []) as unknown as Array<
    ProductSummary & { category_id: string | null; categories: { name: string } | null }
  >;
});

export const getCategories = cache(async (workspaceId: string) => {
  const supabase = await authorizedClient(workspaceId);
  const { data, error } = await supabase
    .from("retail_categories")
    .select("id,name")
    .eq("workspace_id", workspaceId)
    .is("deleted_at", null)
    .order("name");
  if (error) throw error;
  return data ?? [];
});

export const getCustomers = cache(async (workspaceId: string) => {
  const { user } = await assertRetailWorkspaceAccess(workspaceId);
  return executeRetailRpc<
    Array<
      PartySummary & {
        status: string;
        total_sales: number;
        balance_due: number;
        last_transaction_at: string | null;
      }
    >
  >(user.id, "retail_customer_summaries", {
    target_workspace: workspaceId,
  });
});

export const getSuppliers = cache(async (workspaceId: string) => {
  const { user } = await assertRetailWorkspaceAccess(workspaceId);
  return executeRetailRpc<
    Array<
      PartySummary & {
        status: string;
        total_purchases: number;
        balance_due: number;
        last_transaction_at: string | null;
      }
    >
  >(user.id, "retail_supplier_summaries", {
    target_workspace: workspaceId,
  });
});

export async function getRecentSales(workspaceId: string) {
  const supabase = await authorizedClient(workspaceId);
  const { data, error } = await supabase
    .from("retail_sales")
    .select("id,invoice_number,total,amount_paid,payment_status,payment_method,sold_at,customers:retail_customers(name)")
    .eq("workspace_id", workspaceId)
    .order("sold_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function getRecentPurchases(workspaceId: string) {
  const supabase = await authorizedClient(workspaceId);
  const { data, error } = await supabase
    .from("retail_purchases")
    .select("id,purchase_number,total,amount_paid,payment_status,payment_method,purchased_at,suppliers:retail_suppliers(name)")
    .eq("workspace_id", workspaceId)
    .order("purchased_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function getRecentExpenses(workspaceId: string) {
  const supabase = await authorizedClient(workspaceId);
  const { data, error } = await supabase
    .from("retail_expenses")
    .select("id,category,amount,description,payment_method,expense_date,occurred_at")
    .eq("workspace_id", workspaceId)
    .order("occurred_at", { ascending: false })
    .limit(50);
  if (error) throw error;
  return data ?? [];
}

export async function getInventoryMovements(workspaceId: string) {
  const supabase = await authorizedClient(workspaceId);
  const { data, error } = await supabase
    .from("retail_inventory_movements")
    .select("id,movement_type,quantity_delta,balance_after,unit_cost,notes,occurred_at,products:retail_products(name,sku)")
    .eq("workspace_id", workspaceId)
    .order("occurred_at", { ascending: false })
    .limit(100);
  if (error) throw error;
  return data ?? [];
}

export async function getCashTransactions(workspaceId: string) {
  const supabase = await authorizedClient(workspaceId);
  const [accountResult, transactionResult] = await Promise.all([
    supabase
      .from("retail_cash_accounts")
      .select("id,name,current_balance,currency")
      .eq("workspace_id", workspaceId)
      .eq("is_primary", true)
      .maybeSingle(),
    supabase
      .from("retail_cash_transactions")
      .select("id,direction,transaction_type,amount,balance_after,notes,occurred_at")
      .eq("workspace_id", workspaceId)
      .order("occurred_at", { ascending: false })
      .limit(100),
  ]);
  if (accountResult.error) throw accountResult.error;
  if (transactionResult.error) throw transactionResult.error;
  return { account: accountResult.data, transactions: transactionResult.data ?? [] };
}

export async function getOpenDebts(workspaceId: string) {
  const supabase = await authorizedClient(workspaceId);
  const [receivablesResult, payablesResult] = await Promise.all([
    supabase
      .from("retail_receivables")
      .select("id,original_amount,balance_due,status,due_date,created_at,customers:retail_customers(name),sales:retail_sales(invoice_number)")
      .eq("workspace_id", workspaceId)
      .in("status", ["open", "partial"])
      .order("created_at", { ascending: false }),
    supabase
      .from("retail_payables")
      .select("id,original_amount,balance_due,status,due_date,created_at,suppliers:retail_suppliers(name),purchases:retail_purchases(purchase_number)")
      .eq("workspace_id", workspaceId)
      .in("status", ["open", "partial"])
      .order("created_at", { ascending: false }),
  ]);
  if (receivablesResult.error) throw receivablesResult.error;
  if (payablesResult.error) throw payablesResult.error;
  return {
    receivables: receivablesResult.data ?? [],
    payables: payablesResult.data ?? [],
  };
}
