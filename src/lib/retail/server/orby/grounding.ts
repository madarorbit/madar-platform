import { formatMoney, formatQuantity } from "../../format.ts";
import type { OrbyEvidence, OrbyGrounding } from "../../orby/types.ts";
import type { AnalyticsSnapshot } from "../../types.ts";

const MUTATION_WORDS = /(?:(?:أنشئ|إنشاء|اضف|أضف|إضافة|عدّل|عدل|تعديل|احذف|حذف|نفّذ|نفذ|تنفيذ|سجّل|سجل|تسجيل)\s+(?:فاتورة|بيع|شراء|منتج|مخزون|رصيد|مصروف)|(?:create|add|update|edit|delete|execute|record)\s+(?:an?\s+)?(?:invoice|sale|purchase|product|inventory|balance|expense))/iu;

function evidence(
  source: OrbyEvidence["source"],
  label: string,
  value: string | number,
  snapshot: AnalyticsSnapshot,
  unit?: string,
): OrbyEvidence {
  return {
    id: `${source}:${label}`,
    source,
    label,
    value,
    unit,
    as_of: snapshot.as_of,
    period: { from: snapshot.period.from, to: snapshot.period.to },
  };
}

export function buildGroundedAnswer(
  question: string,
  snapshot: AnalyticsSnapshot,
  customers: Array<{ name: string; balance_due: number }>,
  suppliers: Array<{ name: string; balance_due: number }>,
): OrbyGrounding {
  const currency = snapshot.currency;
  const m = snapshot.metrics;
  if (MUTATION_WORDS.test(question)) {
    return { intent: "mutation_refusal", evidence: [], fallbackAnswer: "أنا ORBY Retail في V0 للقراءة والتحليل فقط. لا أستطيع إنشاء فاتورة أو تعديل مخزون أو رصيد. يمكنك تنفيذ العملية من قسمها داخل MADAR Retail." };
  }

  if (/مورد|الموردين|علينا|مستحقات/i.test(question)) {
    const top = [...suppliers].filter((item) => Number(item.balance_due) > 0).sort((a, b) => Number(b.balance_due) - Number(a.balance_due))[0];
    const items = [evidence("retail_analytics_snapshot", "مستحقات الموردين", m.payables, snapshot, currency)];
    if (top) items.push(evidence("retail_supplier_summaries", `أعلى مورد مستحق: ${top.name}`, top.balance_due, snapshot, currency));
    return { intent: "supplier_payables", evidence: items, fallbackAnswer: top ? `إجمالي المستحق للموردين هو ${formatMoney(m.payables, currency)}. أعلى رصيد حالي للمورد ${top.name}: ${formatMoney(top.balance_due, currency)}.` : `لا توجد مستحقات موردين مفتوحة في البيانات الحالية.` };
  }

  if (/عميل|العملاء|دين|ديون|تحصيل/i.test(question)) {
    const top = [...customers].filter((item) => Number(item.balance_due) > 0).sort((a, b) => Number(b.balance_due) - Number(a.balance_due))[0];
    const items = [evidence("retail_analytics_snapshot", "ديون العملاء", m.receivables, snapshot, currency)];
    if (top) items.push(evidence("retail_customer_summaries", `أعلى عميل مديون: ${top.name}`, top.balance_due, snapshot, currency));
    return { intent: "customer_receivables", evidence: items, fallbackAnswer: top ? `إجمالي المبالغ المتبقية لدى العملاء هو ${formatMoney(m.receivables, currency)}. أعلى رصيد على ${top.name}: ${formatMoney(top.balance_due, currency)}.` : "لا توجد ديون عملاء مفتوحة في البيانات الحالية." };
  }

  if (/مخزون|سينفد|تنفد|نفاد|منخفض/i.test(question)) {
    const low = snapshot.low_stock.slice(0, 5);
    const items = low.map((item) => evidence("retail_analytics_snapshot", `مخزون ${item.name}`, item.stock_on_hand, snapshot, "وحدة"));
    return { intent: "low_stock", evidence: items, fallbackAnswer: low.length ? `هناك ${low.length} منتجات أولى عند حد التنبيه: ${low.map((item) => `${item.name} (${formatQuantity(item.stock_on_hand)})`).join("، ")}. راجع قسم المخزون قبل نفادها.` : "لا توجد منتجات عند حد المخزون المنخفض وفق الحدود المسجلة حاليًا." };
  }

  if (/أفضل|اكثر منتج|أكثر منتج|مبيع/i.test(question)) {
    const top = snapshot.top_products[0];
    const items = top ? [evidence("retail_analytics_snapshot", `كمية ${top.name} المباعة`, top.quantity_sold, snapshot, "وحدة"), evidence("retail_analytics_snapshot", `إيراد ${top.name}`, top.revenue, snapshot, currency)] : [];
    return { intent: "best_product", evidence: items, fallbackAnswer: top ? `المنتج الأكثر مبيعًا في الفترة هو ${top.name} بكمية ${formatQuantity(top.quantity_sold)} وإيراد ${formatMoney(top.revenue, currency)}.` : "لا توجد مبيعات كافية لتحديد منتج أكثر مبيعًا في هذه الفترة." };
  }

  if (/مصروف|المصروفات|تكاليف التشغيل/i.test(question)) {
    return { intent: "expenses", evidence: [evidence("retail_analytics_snapshot", "المصروفات", m.expenses, snapshot, currency), evidence("retail_analytics_snapshot", "النتيجة التشغيلية التقديرية", m.estimated_net_operating_result, snapshot, currency)], fallbackAnswer: `المصروفات في الفترة هي ${formatMoney(m.expenses, currency)}، والنتيجة التشغيلية التقديرية بعد المصروفات هي ${formatMoney(m.estimated_net_operating_result, currency)}.` };
  }

  const comparison = snapshot.comparison.revenue_change;
  const direction = comparison > 0 ? "أعلى" : comparison < 0 ? "أقل" : "مساوية";
  const items = [
    evidence("retail_analytics_snapshot", "الإيراد", m.revenue, snapshot, currency),
    evidence("retail_analytics_snapshot", "الربح الإجمالي التقديري", m.estimated_gross_profit, snapshot, currency),
    evidence("retail_analytics_snapshot", "الصندوق الحالي", m.cash_position, snapshot, currency),
    evidence("retail_analytics_snapshot", "التغير عن الفترة السابقة", comparison, snapshot, currency),
  ];
  return { intent: "overview", evidence: items, fallbackAnswer: `صافي المبيعات هو ${formatMoney(m.revenue, currency)}، والربح الإجمالي التقديري ${formatMoney(m.estimated_gross_profit, currency)}. المبيعات ${direction} من الفترة السابقة بمقدار ${formatMoney(Math.abs(comparison), currency)}. رصيد الصندوق الحالي ${formatMoney(m.cash_position, currency)}، وهو مختلف عن الإيراد.` };
}
