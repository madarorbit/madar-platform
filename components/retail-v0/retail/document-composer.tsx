"use client";

import { useMemo, useState } from "react";
import { SubmitButton } from "@/components/retail-v0/ui/submit-button";
import { formatMoney, formatQuantity } from "@/src/lib/retail/format";
import { createPurchaseAction, createSaleAction } from "@/src/lib/retail/server/retail/actions";

interface ComposerProduct {
  id: string;
  name: string;
  sku: string | null;
  sale_price: number;
  purchase_price: number;
  stock_on_hand: number;
  unit: string;
}

interface Party { id: string; name: string; }
interface Line { productId: string; quantity: number; price: number; }

export function DocumentComposer({
  mode,
  products,
  parties,
  currency,
  operationId,
}: {
  mode: "sale" | "purchase";
  products: ComposerProduct[];
  parties: Party[];
  currency: string;
  operationId: string;
}) {
  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const [lines, setLines] = useState<Line[]>([]);
  const [discount, setDiscount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState("CASH");
  const [paid, setPaid] = useState(0);
  const [paidTouched, setPaidTouched] = useState(false);

  const subtotal = lines.reduce((sum, line) => sum + line.quantity * line.price, 0);
  const total = Math.max(0, subtotal - (mode === "sale" ? discount : 0));
  const effectivePaid = paymentMethod === "CREDIT" ? 0 : paidTouched ? Math.min(paid, total) : total;
  const serialized = JSON.stringify(lines.map((line) => ({
    product_id: line.productId,
    quantity: line.quantity,
    [mode === "sale" ? "unit_price" : "unit_cost"]: line.price,
  })));

  function addProduct(productId: string) {
    const product = productMap.get(productId);
    if (!product) return;
    setLines((current) => {
      const existing = current.find((line) => line.productId === productId);
      if (existing) return current.map((line) => line.productId === productId ? { ...line, quantity: line.quantity + 1 } : line);
      return [...current, { productId, quantity: 1, price: mode === "sale" ? Number(product.sale_price) : Number(product.purchase_price) }];
    });
  }

  function updateLine(productId: string, field: "quantity" | "price", value: number) {
    setLines((current) => current.map((line) => line.productId === productId ? { ...line, [field]: Number.isFinite(value) ? Math.max(0, value) : 0 } : line));
  }

  const action = mode === "sale" ? createSaleAction : createPurchaseAction;
  return (
    <form action={action} className="surface grid gap-5 p-5">
      <input type="hidden" name="operation_id" value={operationId} />
      <input type="hidden" name="items" value={serialized} />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><h2 className="text-xl font-black">{mode === "sale" ? "فاتورة بيع جديدة" : "عملية شراء جديدة"}</h2><p className="muted mt-1 text-sm">أضف الأصناف ثم راجع الدفع والإجمالي.</p></div>
        <label className="field min-w-64"><span>إضافة منتج</span><select className="input" value="" onChange={(event) => addProduct(event.target.value)}><option value="">اختر أو ابحث بالاسم…</option>{products.map((product) => <option value={product.id} key={product.id} disabled={mode === "sale" && Number(product.stock_on_hand) <= 0}>{product.name} {product.sku ? `(${product.sku})` : ""} — {mode === "sale" ? `${formatQuantity(product.stock_on_hand)} متاح` : formatMoney(product.purchase_price, currency)}</option>)}</select></label>
      </div>

      <div className="grid gap-3">
        {lines.map((line) => {
          const product = productMap.get(line.productId);
          if (!product) return null;
          const invalidStock = mode === "sale" && line.quantity > Number(product.stock_on_hand);
          return <div className="surface-soft grid gap-3 p-3 sm:grid-cols-[minmax(0,1fr)_120px_150px_130px_auto] sm:items-end" key={line.productId}>
            <div><strong>{product.name}</strong><p className={`mt-1 text-xs ${invalidStock ? "text-red-300" : "muted"}`}>{mode === "sale" ? `متاح: ${formatQuantity(product.stock_on_hand)} ${product.unit}` : product.sku ?? "دون SKU"}</p></div>
            <label className="field"><span>الكمية</span><input className="input" type="number" min="0.001" max={mode === "sale" ? Number(product.stock_on_hand) : undefined} step="0.001" value={line.quantity} onChange={(event) => updateLine(line.productId, "quantity", event.target.valueAsNumber)} required /></label>
            <label className="field"><span>{mode === "sale" ? "سعر الوحدة" : "تكلفة الوحدة"}</span><input className="input" type="number" min="0" step="0.01" value={line.price} onChange={(event) => updateLine(line.productId, "price", event.target.valueAsNumber)} required /></label>
            <div><span className="muted text-xs">الإجمالي</span><strong className="mt-2 block">{formatMoney(line.quantity * line.price, currency)}</strong></div>
            <button type="button" className="button-danger !min-h-10" onClick={() => setLines((current) => current.filter((candidate) => candidate.productId !== line.productId))}>حذف</button>
          </div>;
        })}
        {!lines.length ? <div className="rounded-xl border border-dashed border-slate-700 p-9 text-center text-sm text-slate-500">اختر منتجًا لبدء {mode === "sale" ? "البيع" : "الشراء"}.</div> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid content-start gap-4">
          <label className="field"><span>{mode === "sale" ? "العميل (اختياري للنقدي)" : "المورد (مطلوب للآجل)"}</span><select className="input" name={mode === "sale" ? "customer_id" : "supplier_id"}><option value="">دون اختيار</option>{parties.map((party) => <option value={party.id} key={party.id}>{party.name}</option>)}</select></label>
          {mode === "purchase" ? <label className="field"><span>مرجع فاتورة المورد</span><input className="input" name="supplier_reference" /></label> : null}
          <label className="field"><span>ملاحظات</span><textarea className="input" name="notes" /></label>
        </div>
        <div className="surface-soft grid gap-3 p-4">
          <div className="flex justify-between"><span className="muted">الإجمالي قبل الخصم</span><strong>{formatMoney(subtotal, currency)}</strong></div>
          {mode === "sale" ? <label className="field"><span>الخصم</span><input className="input" type="number" name="discount_total" min="0" max={subtotal} step="0.01" value={discount} onChange={(event) => setDiscount(Math.max(0, event.target.valueAsNumber || 0))} /></label> : null}
          <div className="flex justify-between border-t border-slate-700 pt-3 text-lg"><span>الصافي</span><strong className="text-mint">{formatMoney(total, currency)}</strong></div>
          <label className="field"><span>طريقة الدفع</span><select className="input" name="payment_method" value={paymentMethod} onChange={(event) => { setPaymentMethod(event.target.value); if (event.target.value === "CREDIT") { setPaid(0); setPaidTouched(true); } }}><option value="CASH">نقدًا</option><option value="BANK">حساب بنكي</option><option value="WALLET">محفظة</option><option value="CREDIT">آجل بالكامل</option><option value="OTHER">أخرى</option></select></label>
          <label className="field"><span>المدفوع الآن</span><input className="input" type="number" name="amount_paid" min="0" max={total} step="0.01" value={effectivePaid} disabled={paymentMethod === "CREDIT"} onChange={(event) => { setPaidTouched(true); setPaid(Math.max(0, event.target.valueAsNumber || 0)); }} required /><input type="hidden" name="amount_paid" value={effectivePaid} disabled={paymentMethod !== "CREDIT"} /></label>
          <div className="flex justify-between"><span className="muted">المتبقي</span><strong className={total - effectivePaid > 0 ? "text-amber-200" : ""}>{formatMoney(Math.max(0, total - effectivePaid), currency)}</strong></div>
        </div>
      </div>
      <SubmitButton pendingLabel="جارٍ ترحيل العملية…" className="button-primary w-full" >{mode === "sale" ? "إتمام البيع" : "إتمام الشراء"}</SubmitButton>
    </form>
  );
}
