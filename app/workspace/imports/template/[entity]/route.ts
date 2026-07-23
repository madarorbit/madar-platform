import {NextResponse} from 'next/server';
import {importFields,type ImportEntity} from '@/src/lib/csv';

const samples:Record<ImportEntity,Record<string,string>>={
 products:{name:'منتج تجريبي',sku:'SKU-001',description:'وصف المنتج',category:'التصنيف',cost:'1000',price:'1500',stock_quantity:'20',low_stock_threshold:'5'},
 customers:{name:'اسم العميل',phone:'777000000',email:'customer@example.com',address:'عدن',status:'active',notes:'ملاحظة اختيارية'},
 suppliers:{name:'اسم المورد',contact_name:'مسؤول التواصل',phone:'777000000',email:'supplier@example.com',address:'عدن',balance_due:'0',notes:'ملاحظة اختيارية'},
 expenses:{title:'إيجار المتجر',category:'تشغيل',amount:'50000',incurred_at:'2026-07-24',payment_status:'paid',notes:'ملاحظة اختيارية'},
 sales:{sale_number:'OLD-001',total:'10000',discount_total:'0',status:'completed',payment_status:'paid',sold_at:'2026-07-24 10:00:00+03',notes:'عملية سابقة'},
};

const escape=(value:string)=>`"${value.replaceAll('"','""')}"`;
export async function GET(_request:Request,{params}:{params:Promise<{entity:string}>}){
 const{entity:raw}=await params,entity=raw as ImportEntity;
 if(!Object.hasOwn(importFields,entity))return new NextResponse('غير موجود',{status:404});
 const keys=importFields[entity].map(field=>field.key),sample=samples[entity];
 const csv='\uFEFF'+keys.map(escape).join(',')+'\r\n'+keys.map(key=>escape(sample[key]||'')).join(',')+'\r\n';
 return new NextResponse(csv,{headers:{'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="madar-${entity}-template.csv"`,'Cache-Control':'public, max-age=3600'}});
}
