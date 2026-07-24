import type {DailyExpense,DailySale} from '@/src/lib/analytics';

export function AnalyticsBars({sales,expenses}:{sales:DailySale[];expenses:DailyExpense[]}){
 const expenseMap=new Map(expenses.map(item=>[item.date,Number(item.amount)]));
 const maximum=Math.max(1,...sales.map(item=>Number(item.revenue)),...expenses.map(item=>Number(item.amount)));
 return <div className="overflow-x-auto pb-2"><div className="flex h-72 min-w-max items-end gap-2 pt-8" role="img" aria-label="مقارنة المبيعات والمصروفات اليومية">{sales.map(item=>{
  const sale=Number(item.revenue),expense=expenseMap.get(item.date)||0,saleHeight=Math.max(sale?4:0,sale/maximum*220),expenseHeight=Math.max(expense?4:0,expense/maximum*220);
  return <div key={item.date} className="flex w-12 shrink-0 flex-col items-center gap-2"><div className="flex h-56 items-end gap-1"><span title={`المبيعات ${sale}`} className="w-3 rounded-t bg-emerald-300/80" style={{height:saleHeight}}/><span title={`المصروفات ${expense}`} className="w-3 rounded-t bg-violet-300/80" style={{height:expenseHeight}}/></div><span className="rotate-[-45deg] whitespace-nowrap text-[10px] text-slate-500">{item.date.slice(5)}</span></div>;
 })}</div><div className="mt-5 flex gap-5 text-xs text-slate-400"><span className="flex items-center gap-2"><i className="h-2 w-4 rounded bg-emerald-300/80"/> المبيعات</span><span className="flex items-center gap-2"><i className="h-2 w-4 rounded bg-violet-300/80"/> المصروفات</span></div></div>;
}
