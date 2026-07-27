import type {JsonObject} from '../contracts';

export const LAB_STREAMS=['products','customers','orders','order_items','payments','inventory'] as const;
export type LabStreamKey=typeof LAB_STREAMS[number];

export type LabScenario={
 pageSize:number;
 expectedKeyVersion:number;
 keyExpiresAt:string|null;
 latencyMs:number;
 failureStream:LabStreamKey|null;
 failAfterBatch:number|null;
 disconnectAfterBatch:number|null;
 includeDuplicates:boolean;
 includeInvalid:boolean;
 includeMissing:boolean;
};

const BASE=Date.parse('2026-01-01T00:00:00.000Z');
const iso=(minutes:number)=>new Date(BASE+minutes*60_000).toISOString();
const object=(value:unknown):Record<string,unknown>=>value&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:{};
const integer=(value:unknown,fallback:number,min:number,max:number)=>{const parsed=Number(value);return Number.isInteger(parsed)?Math.min(max,Math.max(min,parsed)):fallback;};
const optionalInteger=(value:unknown,min:number,max:number)=>{const parsed=Number(value);return Number.isInteger(parsed)?Math.min(max,Math.max(min,parsed)):null;};

export function normalizeLabScenario(input:unknown):LabScenario{
 const value=object(input),stream=typeof value.failureStream==='string'&&(LAB_STREAMS as readonly string[]).includes(value.failureStream)?value.failureStream as LabStreamKey:null;
 return {
  pageSize:integer(value.pageSize,3,1,100),
  expectedKeyVersion:integer(value.expectedKeyVersion,1,1,99),
  keyExpiresAt:typeof value.keyExpiresAt==='string'&&value.keyExpiresAt.trim()?value.keyExpiresAt:null,
  latencyMs:integer(value.latencyMs,0,0,10_000),
  failureStream:stream,
  failAfterBatch:optionalInteger(value.failAfterBatch,1,100),
  disconnectAfterBatch:optionalInteger(value.disconnectAfterBatch,1,100),
  includeDuplicates:value.includeDuplicates!==false,
  includeInvalid:value.includeInvalid!==false,
  includeMissing:value.includeMissing!==false,
 };
}

function product(id:string,sku:string,name:string,price:number,minute:number):JsonObject{return {entity_type:'product',external_id:id,sku,name,price,cost:Number((price*.62).toFixed(2)),currency:'YER',unit:'EA',category_external_id:'category-general',quantity:20,reorder_level:5,updated_at:iso(minute),created_at:iso(minute-300)};}
function customer(id:string,name:string,email:string,phone:string,minute:number):JsonObject{return {entity_type:'customer',external_id:id,name,email,phone,country_code:'YE',updated_at:iso(minute),created_at:iso(minute-200)};}
function order(id:string,customerId:string,total:number,minute:number):JsonObject{return {entity_type:'order',external_id:id,order_number:id.toUpperCase(),customer_external_id:customerId,ordered_at:iso(minute),status:'paid',subtotal:total,discount_amount:0,tax_amount:0,shipping_amount:0,total_amount:total,currency:'YER',updated_at:iso(minute+1),created_at:iso(minute)};}
function orderItem(id:string,orderId:string,productId:string,line:number,quantity:number,unitPrice:number,minute:number):JsonObject{return {entity_type:'order_item',external_id:id,order_external_id:orderId,product_external_id:productId,line_number:line,quantity,unit:'EA',unit_price:unitPrice,discount_amount:0,tax_amount:0,line_total:quantity*unitPrice,currency:'YER',updated_at:iso(minute),created_at:iso(minute)};}
function payment(id:string,orderId:string,amount:number,minute:number):JsonObject{return {entity_type:'payment',external_id:id,transaction_reference:`TX-${id.toUpperCase()}`,order_external_id:orderId,paid_at:iso(minute),amount,fee_amount:0,currency:'YER',method:'wallet',status:'succeeded',updated_at:iso(minute),created_at:iso(minute)};}
function inventory(id:string,productId:string,quantity:number,minute:number):JsonObject{return {entity_type:'inventory',external_id:id,product_external_id:productId,branch_external_id:'branch-main',quantity,reserved_quantity:0,available_quantity:quantity,unit:'EA',updated_at:iso(minute),created_at:iso(minute-100)};}

export function historicalLabData(input:unknown={}):Record<LabStreamKey,JsonObject[]>{
 const scenario=normalizeLabScenario(input);
 const products=[
  product('product-001','REF-001','حاسوب محمول تجريبي',450000,10),
  product('product-002','REF-002','طابعة فواتير تجريبية',85000,20),
  product('product-003','REF-003','قارئ باركود تجريبي',55000,30),
  product('product-004','REF-004','اشتراك نظام إدارة',120000,40),
  product('product-005','REF-005','جهاز نقاط بيع',210000,50),
 ];
 const customers=[
  customer('customer-001','أحمد علي','ahmed@example.test','+967700000001',60),
  customer('customer-002','سارة محمد','sara@example.test','+967700000002',70),
  customer('customer-003','مؤسسة النور','sales@alnoor.example.test','+967700000003',80),
  customer('customer-004','متجر الساحل','hello@coast.example.test','+967700000004',90),
 ];
 const orders=[order('order-001','customer-001',450000,100),order('order-002','customer-002',170000,110),order('order-003','customer-003',210000,120),order('order-004','customer-004',120000,130)];
 const orderItems=[orderItem('item-001','order-001','product-001',1,1,450000,101),orderItem('item-002','order-002','product-002',1,2,85000,111),orderItem('item-003','order-003','product-005',1,1,210000,121),orderItem('item-004','order-004','product-004',1,1,120000,131)];
 const payments=[payment('payment-001','order-001',450000,102),payment('payment-002','order-002',170000,112),payment('payment-003','order-003',210000,122),payment('payment-004','order-004',120000,132)];
 const stocks=[inventory('inventory-001','product-001',9,140),inventory('inventory-002','product-002',16,141),inventory('inventory-003','product-003',22,142),inventory('inventory-004','product-004',999,143),inventory('inventory-005','product-005',7,144)];
 if(scenario.includeDuplicates){products.push({...product('product-001','REF-001','حاسوب محمول تجريبي',450000,150),source_note:'exact_duplicate'});customers.push({...customer('customer-shadow','أحمد علي','ahmed@example.test','+967700000001',151),source_note:'probable_duplicate'});}
 if(scenario.includeInvalid){products.push({entity_type:'product',external_id:'product-invalid',sku:'BROKEN-1',name:'',price:'not-a-number',currency:'YR',updated_at:iso(160)});payments.push({entity_type:'payment',external_id:'payment-invalid',order_external_id:'order-001',paid_at:'not-a-date',amount:'NaN',currency:'YER'});}
 if(scenario.includeMissing){orders.push({entity_type:'order',external_id:'order-missing',order_number:'ORDER-MISSING',customer_external_id:'customer-001',total_amount:70000,currency:'YER'});stocks.push({entity_type:'inventory',external_id:'inventory-missing-unit',product_external_id:'product-003',branch_external_id:'branch-main',quantity:4,updated_at:iso(170)});}
 return {products,customers,orders,order_items:orderItems,payments,inventory:stocks};
}

export function incrementalLabData():Record<LabStreamKey,JsonObject[]>{
 return {
  products:[{...product('product-002','REF-002','طابعة فواتير تجريبية — تحديث',90000,500),change_type:'updated'},product('product-006','REF-006','ماسح مستندات جديد',145000,510)],
  customers:[customer('customer-005','شركة التجربة','ops@trial.example.test','+967700000005',520)],
  orders:[order('order-005','customer-005',145000,530)],
  order_items:[orderItem('item-005','order-005','product-006',1,1,145000,531)],
  payments:[payment('payment-005','order-005',145000,532)],
  inventory:[inventory('inventory-006','product-006',11,540),{...inventory('inventory-002','product-002',14,541),change_type:'updated'}],
 };
}

export function operationalWebhookEvents():JsonObject[]{return [
 {entity_type:'operational_event',external_id:'event-001',event_type:'order.created',occurred_at:iso(600),severity:'info',reference:'order-005',payload:{order_id:'order-005'}},
 {entity_type:'operational_event',external_id:'event-002',event_type:'payment.succeeded',occurred_at:iso(601),severity:'info',reference:'payment-005',payload:{payment_id:'payment-005'}},
 {entity_type:'operational_event',external_id:'event-003',event_type:'inventory.low',occurred_at:iso(602),severity:'warning',reference:'product-005',payload:{quantity:4}},
 ];}

export function defaultCsvFixture(){return 'external_id,sku,name,price,currency,unit\nfile-product-001,FILE-001,منتج CSV تجريبي,25000,YER,EA\nfile-product-002,FILE-002,منتج CSV ثانٍ,35000,YER,EA';}
export function defaultExcelXmlFixture(){return '<?xml version="1.0"?><Workbook><Worksheet><Table><Row><Cell><Data>external_id</Data></Cell><Cell><Data>sku</Data></Cell><Cell><Data>name</Data></Cell><Cell><Data>price</Data></Cell><Cell><Data>currency</Data></Cell><Cell><Data>unit</Data></Cell></Row><Row><Cell><Data>excel-product-001</Data></Cell><Cell><Data>XLS-001</Data></Cell><Cell><Data>منتج Excel تجريبي</Data></Cell><Cell><Data>47000</Data></Cell><Cell><Data>YER</Data></Cell><Cell><Data>EA</Data></Cell></Row></Table></Worksheet></Workbook>';}
