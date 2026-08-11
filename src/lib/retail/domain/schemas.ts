import { z } from "zod";

const uuid = z.string().uuid();
const money = z.coerce.number().finite().nonnegative().max(999_999_999_999);
const quantity = z.coerce.number().finite().positive().max(999_999_999);

export const productInputSchema = z.object({
  name: z.string().trim().min(1).max(180),
  sku: z.string().trim().max(80).optional(),
  barcode: z.string().trim().max(120).optional(),
  category_id: z.union([uuid, z.literal("")]).optional(),
  purchase_price: money,
  sale_price: money,
  opening_quantity: z.coerce.number().finite().nonnegative(),
  minimum_stock: z.coerce.number().finite().nonnegative(),
  unit: z.string().trim().min(1).max(30),
  notes: z.string().trim().max(1000).optional(),
});

const documentItemSchema = z.object({
  product_id: uuid,
  quantity,
  unit_price: money.optional(),
  unit_cost: money.optional(),
});

export const saleInputSchema = z.object({
  customer_id: z.union([uuid, z.literal("")]).optional(),
  items: z.array(documentItemSchema).min(1).max(100),
  discount_total: money.default(0),
  amount_paid: money.default(0),
  payment_method: z.enum(["CASH", "BANK", "WALLET", "CREDIT", "OTHER"]),
  notes: z.string().trim().max(1000).optional(),
});

export const purchaseInputSchema = z.object({
  supplier_id: z.union([uuid, z.literal("")]).optional(),
  items: z.array(documentItemSchema).min(1).max(100),
  amount_paid: money.default(0),
  payment_method: z.enum(["CASH", "BANK", "WALLET", "CREDIT", "OTHER"]),
  supplier_reference: z.string().trim().max(120).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const expenseInputSchema = z.object({
  category: z.string().trim().min(1).max(80),
  amount: money.positive(),
  description: z.string().trim().min(1).max(240),
  payment_method: z.enum(["CASH", "BANK", "WALLET", "OTHER"]),
  expense_date: z.iso.date(),
});

export const partyInputSchema = z.object({
  id: z.union([uuid, z.literal("")]).optional(),
  name: z.string().trim().min(1).max(180),
  phone: z.string().trim().max(40).optional(),
  notes: z.string().trim().max(1000).optional(),
});

export const inventoryAdjustmentSchema = z.discriminatedUnion("movement_type", [
  z.object({
    movement_type: z.literal("MANUAL_ADJUSTMENT"),
    product_id: uuid,
    quantity_delta: z.coerce.number().finite().refine((value) => value !== 0),
    notes: z.string().trim().min(3).max(500),
  }),
  z.object({
    movement_type: z.literal("COUNT_ADJUSTMENT"),
    product_id: uuid,
    counted_quantity: z.coerce.number().finite().nonnegative(),
    notes: z.string().trim().min(3).max(500),
  }),
]);

export const settlementSchema = z.object({
  ledger_id: uuid,
  amount: money.positive(),
  payment_method: z.enum(["CASH", "BANK", "WALLET", "OTHER"]),
  notes: z.string().trim().max(500).optional(),
});

export const orbyQuestionSchema = z.object({
  workspace_id: uuid,
  conversation_id: z.union([uuid, z.null()]).optional(),
  question: z.string().trim().min(2).max(1000),
  date_from: z.iso.date().optional(),
  date_to: z.iso.date().optional(),
});
