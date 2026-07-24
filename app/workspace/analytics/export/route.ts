import {NextResponse} from 'next/server';
import {loadBusinessAnalytics,resolveAnalyticsRange} from '@/src/lib/analytics';
import {requireBusinessWorkspace} from '@/src/lib/business';

const escapeCsv=(value:unknown)=>`"${String(value??'').replaceAll('"','""')}"`;
export async function GET(request:Request){
 const{workspace}=await requireBusinessWorkspace(),url=new URL(request.url);
 let range;try{range=resolveAnalyticsRange(url.searchParams.get('start')||undefined,url.searchParams.get('end')||undefined)}catch(error){return NextResponse.json({error:error instanceof Error?error.message:'فترة غير صالحة'},{status:400})}
 let data;try{data=await loadBusinessAnalytics(workspace.id,range.start,range.end)}catch{return NextResponse.json({error:'غير مصرح أو تعذر إنشاء التقرير.'},{status:403})}
 const lines:string[][]=[
  ['تقرير مَدار',workspace.name],['الفترة',`${data.period.start} — ${data.period.end}`],['العملة',data.currency],[],
  ['المؤشر','القيمة'],
  ['إجمالي المبيعات',String(data.kpis.revenue)],['عدد الطلبات',String(data.kpis.orders)],['متوسط قيمة الطلب',String(data.kpis.average_order_value)],
  ['تكلفة البضاعة',String(data.kpis.cost_of_goods)],['إجمالي الربح',String(data.kpis.gross_profit)],['المصروفات',String(data.kpis.expenses)],['صافي الربح التقديري',String(data.kpis.net_profit_estimate)],
  ['قيمة المخزون',String(data.kpis.inventory_value)],['العملاء النشطون',String(data.kpis.active_customers)],['العملاء الجدد',String(data.kpis.new_customers)],['العملاء العائدون',String(data.kpis.returning_customers)],
  [],['الحركة اليومية'],['التاريخ','المبيعات','الطلبات','المصروفات'],
 ];
 const expenseMap=new Map(data.daily_expenses.map(item=>[item.date,item.amount]));
 data.daily_sales.forEach(item=>lines.push([item.date,String(item.revenue),String(item.orders),String(expenseMap.get(item.date)||0)]));
 lines.push([],['المنتجات الأعلى أداءً'],['المنتج','الكمية','الإيراد','الربح الإجمالي']);
 data.top_products.forEach(item=>lines.push([item.name,String(item.quantity),String(item.revenue),String(item.profit)]));
 const csv='\uFEFF'+lines.map(line=>line.map(escapeCsv).join(',')).join('\r\n');
 return new NextResponse(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="madar-report-${range.start}-${range.end}.csv"`,'Cache-Control':'private, no-store'}});
}
