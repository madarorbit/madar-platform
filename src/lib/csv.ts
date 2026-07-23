export type CsvRecord=Record<string,string>;
export type ImportEntity='products'|'customers'|'suppliers'|'expenses'|'sales';
export type ImportField={key:string;label:string;required?:boolean;aliases:string[]};

export const importFields:Record<ImportEntity,ImportField[]>={
 products:[
  {key:'name',label:'اسم المنتج',required:true,aliases:['name','product','product_name','اسم','اسم المنتج','المنتج']},
  {key:'sku',label:'رمز SKU',aliases:['sku','code','product_code','الرمز','كود','كود المنتج']},
  {key:'description',label:'الوصف',aliases:['description','details','الوصف','التفاصيل']},
  {key:'category',label:'التصنيف',aliases:['category','type','التصنيف','الفئة']},
  {key:'cost',label:'التكلفة',aliases:['cost','unit_cost','التكلفة','سعر التكلفة']},
  {key:'price',label:'سعر البيع',aliases:['price','sale_price','selling_price','السعر','سعر البيع']},
  {key:'stock_quantity',label:'المخزون الافتتاحي',aliases:['stock','quantity','qty','stock_quantity','المخزون','الكمية']},
  {key:'low_stock_threshold',label:'حد التنبيه',aliases:['low_stock','threshold','low_stock_threshold','حد التنبيه','الحد الأدنى']},
 ],
 customers:[
  {key:'name',label:'اسم العميل',required:true,aliases:['name','customer','customer_name','اسم','اسم العميل','العميل']},
  {key:'phone',label:'الهاتف',aliases:['phone','mobile','whatsapp','الهاتف','الجوال','واتساب']},
  {key:'email',label:'البريد',aliases:['email','e-mail','البريد','البريد الإلكتروني']},
  {key:'address',label:'العنوان',aliases:['address','location','العنوان','الموقع']},
  {key:'status',label:'الحالة',aliases:['status','state','الحالة']},
  {key:'notes',label:'ملاحظات',aliases:['notes','note','ملاحظات','ملاحظة']},
 ],
 suppliers:[
  {key:'name',label:'اسم المورد',required:true,aliases:['name','supplier','supplier_name','اسم','اسم المورد','المورد']},
  {key:'contact_name',label:'مسؤول التواصل',aliases:['contact','contact_name','person','مسؤول التواصل','المسؤول']},
  {key:'phone',label:'الهاتف',aliases:['phone','mobile','whatsapp','الهاتف','الجوال']},
  {key:'email',label:'البريد',aliases:['email','e-mail','البريد','البريد الإلكتروني']},
  {key:'address',label:'العنوان',aliases:['address','location','العنوان','الموقع']},
  {key:'balance_due',label:'الرصيد المستحق',aliases:['balance','balance_due','due','الرصيد','المستحق']},
  {key:'notes',label:'ملاحظات',aliases:['notes','note','ملاحظات','ملاحظة']},
 ],
 expenses:[
  {key:'title',label:'اسم المصروف',required:true,aliases:['title','name','expense','expense_name','المصروف','اسم المصروف']},
  {key:'category',label:'التصنيف',aliases:['category','type','التصنيف','الفئة']},
  {key:'amount',label:'المبلغ',required:true,aliases:['amount','total','value','المبلغ','القيمة']},
  {key:'incurred_at',label:'التاريخ',aliases:['date','incurred_at','created_at','التاريخ']},
  {key:'payment_status',label:'حالة الدفع',aliases:['payment_status','paid','حالة الدفع','الدفع']},
  {key:'notes',label:'ملاحظات',aliases:['notes','note','ملاحظات','ملاحظة']},
 ],
 sales:[
  {key:'sale_number',label:'رقم العملية',aliases:['sale_number','order_number','number','رقم العملية','رقم الطلب']},
  {key:'total',label:'الإجمالي',required:true,aliases:['total','amount','grand_total','الإجمالي','المبلغ']},
  {key:'discount_total',label:'الخصم',aliases:['discount','discount_total','الخصم']},
  {key:'status',label:'حالة العملية',aliases:['status','order_status','الحالة']},
  {key:'payment_status',label:'حالة الدفع',aliases:['payment_status','paid','حالة الدفع']},
  {key:'sold_at',label:'تاريخ البيع',aliases:['sold_at','date','created_at','تاريخ البيع','التاريخ']},
  {key:'notes',label:'ملاحظات',aliases:['notes','note','ملاحظات','ملاحظة']},
 ],
};

const normalized=(value:string)=>value.trim().toLocaleLowerCase('ar').replace(/[\s_-]+/g,' ').replace(/[إأآ]/g,'ا').replace(/ة/g,'ه');

function delimiterFor(text:string){
 const firstLine=text.split(/\r?\n/,1)[0]||'';
 const candidates=[',',';','\t'];
 return candidates.sort((a,b)=>firstLine.split(b).length-firstLine.split(a).length)[0];
}

export function parseCsv(input:string,{maxRows=500,maxColumns=100}:{maxRows?:number;maxColumns?:number}={}){
 const text=input.replace(/^\uFEFF/,'');
 if(!text.trim())throw new Error('ملف CSV فارغ.');
 const delimiter=delimiterFor(text),matrix:string[][]=[];
 let row:string[]=[],cell='',quoted=false;
 for(let index=0;index<text.length;index++){
  const char=text[index],next=text[index+1];
  if(char==='"'){
   if(quoted&&next==='"'){cell+='"';index++;continue}
   quoted=!quoted;continue;
  }
  if(char===delimiter&&!quoted){row.push(cell.trim());cell='';continue}
  if((char==='\n'||char==='\r')&&!quoted){
   if(char==='\r'&&next==='\n')index++;
   row.push(cell.trim());cell='';
   if(row.some(value=>value!==''))matrix.push(row);
   row=[];
   if(matrix.length>maxRows+1)throw new Error(`الملف يتجاوز الحد المسموح: ${maxRows} صفًا.`);
   continue;
  }
  cell+=char;
 }
 if(quoted)throw new Error('يوجد حقل نصي غير مغلق بعلامة اقتباس.');
 row.push(cell.trim());if(row.some(value=>value!==''))matrix.push(row);
 if(matrix.length<2)throw new Error('يجب أن يحتوي الملف على عناوين وصف بيانات واحد على الأقل.');
 if(matrix[0].length>maxColumns)throw new Error(`عدد الأعمدة يتجاوز الحد المسموح: ${maxColumns}.`);
 const used=new Map<string,number>();
 const headers=matrix[0].map((value,index)=>{
  const base=value||`column_${index+1}`,count=used.get(base)||0;
  used.set(base,count+1);return count?`${base}_${count+1}`:base;
 });
 const rows=matrix.slice(1).map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]||''])));
 return{delimiter,headers,rows};
}

export function autoMap(headers:string[],entity:ImportEntity){
 const byNormalized=new Map(headers.map(header=>[normalized(header),header]));
 return Object.fromEntries(importFields[entity].map(field=>{
  const header=field.aliases.map(normalized).map(alias=>byNormalized.get(alias)).find(Boolean)||'';
  return[field.key,header];
 }));
}

export function validateMapping(entity:ImportEntity,mapping:Record<string,string>,headers:string[]){
 const available=new Set(headers);
 for(const field of importFields[entity]){
  const selected=mapping[field.key]||'';
  if(field.required&&!selected)throw new Error(`طابق الحقل المطلوب: ${field.label}.`);
  if(selected&&!available.has(selected))throw new Error(`العمود المحدد لحقل ${field.label} غير موجود.`);
 }
 return Object.fromEntries(importFields[entity].map(field=>[field.key,mapping[field.key]||'']));
}
