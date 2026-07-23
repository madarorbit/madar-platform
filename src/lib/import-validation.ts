import {importFields,type CsvRecord,type ImportEntity} from '@/src/lib/csv';

const numericFields:Partial<Record<ImportEntity,string[]>>={
 products:['cost','price','stock_quantity','low_stock_threshold'],
 suppliers:['balance_due'],
 expenses:['amount'],
 sales:['total','discount_total'],
};

const parseNumber=(value:string)=>Number(value.replaceAll(',','').replaceAll('٬','').trim());

export function validateImportRows(entity:ImportEntity,rows:CsvRecord[],mapping:Record<string,string>){
 if(!rows.length)throw new Error('لا توجد صفوف قابلة للاستيراد.');
 const required=importFields[entity].filter(field=>field.required);
 const seenSku=new Set<string>(),seenSaleNumber=new Set<string>();
 rows.forEach((row,index)=>{
  const displayRow=index+2;
  for(const field of required){
   const column=mapping[field.key];
   if(!column||!String(row[column]||'').trim())throw new Error(`الصف ${displayRow}: حقل ${field.label} مطلوب.`);
  }
  for(const field of numericFields[entity]||[]){
   const column=mapping[field],raw=column?String(row[column]||'').trim():'';
   if(!raw)continue;
   const value=parseNumber(raw);
   if(!Number.isFinite(value)||value<0)throw new Error(`الصف ${displayRow}: قيمة ${field} ليست رقمًا صالحًا.`);
   if((entity==='expenses'&&field==='amount'||entity==='sales'&&field==='total')&&value<=0)throw new Error(`الصف ${displayRow}: يجب أن تكون القيمة أكبر من صفر.`);
  }
  if(entity==='products'&&mapping.sku){
   const sku=String(row[mapping.sku]||'').trim().toLowerCase();
   if(sku&&seenSku.has(sku))throw new Error(`الصف ${displayRow}: رمز SKU مكرر داخل الملف.`);
   if(sku)seenSku.add(sku);
  }
  if(entity==='sales'&&mapping.sale_number){
   const number=String(row[mapping.sale_number]||'').trim().toLowerCase();
   if(number&&seenSaleNumber.has(number))throw new Error(`الصف ${displayRow}: رقم عملية البيع مكرر داخل الملف.`);
   if(number)seenSaleNumber.add(number);
  }
 });
 return true;
}
