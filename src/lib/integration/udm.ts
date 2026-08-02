import type {JsonObject,JsonValue} from './contracts';

export const UDM_ENTITY_TYPES=['organization','workspace','branch','product','category','customer','order','order_item','sale','payment','inventory','inventory_movement','supplier','expense','employee','operational_event','purchase_order','goods_receipt','sales_return','recipe','restaurant_order','kitchen_ticket','hotel_property','hotel_room','hotel_rate','hotel_reservation','hotel_stay','hotel_folio'] as const;
export type UdmEntityType=typeof UDM_ENTITY_TYPES[number];
export type UdmSeverity='info'|'warning'|'error'|'critical';
export type UdmIssue={severity:UdmSeverity;category:'validation'|'missing'|'duplicate'|'reference'|'timezone'|'currency'|'unit'|'mapping'|'processing';ruleKey:string;fieldPath?:string;message:string;sourceValue?:JsonValue};
export type UdmDefinition={required:readonly string[];identity:readonly string[][];dates?:readonly string[];money?:readonly string[];quantities?:readonly string[];recommended?:readonly string[]};

export const UDM_DEFINITIONS:Record<UdmEntityType,UdmDefinition>={
 organization:{required:['name'],identity:[['external_id'],['registration_number'],['name']],recommended:['country_code','timezone']},
 workspace:{required:['name'],identity:[['external_id'],['slug'],['name']],recommended:['organization_external_id','timezone']},
 branch:{required:['name'],identity:[['external_id'],['code'],['name','workspace_external_id']],recommended:['timezone','country_code']},
 product:{required:['name'],identity:[['external_id'],['sku'],['barcode'],['name']],money:['price','cost'],quantities:['quantity','reorder_level'],recommended:['sku','category_external_id']},
 category:{required:['name'],identity:[['external_id'],['slug'],['name','parent_external_id']]},
 customer:{required:[],identity:[['external_id'],['email'],['phone'],['name']],recommended:['name','email','phone']},
 order:{required:['order_number','ordered_at'],identity:[['external_id'],['order_number']],dates:['ordered_at','fulfilled_at','cancelled_at'],money:['subtotal','discount_amount','tax_amount','shipping_amount','total_amount'],recommended:['currency','customer_external_id','status']},
 order_item:{required:['quantity'],identity:[['external_id'],['order_external_id','line_number'],['order_external_id','product_external_id']],money:['unit_price','discount_amount','tax_amount','line_total'],quantities:['quantity'],recommended:['order_external_id','product_external_id']},
 sale:{required:['sold_at','total_amount'],identity:[['external_id'],['invoice_number'],['sold_at','total_amount','customer_external_id']],dates:['sold_at'],money:['subtotal','discount_amount','tax_amount','total_amount'],recommended:['currency','customer_external_id']},
 payment:{required:['paid_at','amount'],identity:[['external_id'],['transaction_reference'],['paid_at','amount','order_external_id']],dates:['paid_at'],money:['amount','fee_amount'],recommended:['currency','method','status']},
 inventory:{required:['product_external_id','quantity'],identity:[['external_id'],['product_external_id','branch_external_id']],quantities:['quantity','reserved_quantity','available_quantity'],recommended:['unit']},
 inventory_movement:{required:['product_external_id','movement_type','quantity','occurred_at'],identity:[['external_id'],['product_external_id','occurred_at','movement_type','quantity']],dates:['occurred_at'],quantities:['quantity'],recommended:['unit','branch_external_id','reference']},
 supplier:{required:['name'],identity:[['external_id'],['registration_number'],['email'],['phone'],['name']],recommended:['email','phone']},
 expense:{required:['incurred_at','amount'],identity:[['external_id'],['reference'],['incurred_at','amount','supplier_external_id']],dates:['incurred_at','paid_at'],money:['amount','tax_amount'],recommended:['currency','category','description']},
 employee:{required:['name'],identity:[['external_id'],['employee_number'],['email'],['phone'],['name']],dates:['hired_at','terminated_at'],recommended:['role','branch_external_id']},
 operational_event:{required:['event_type','occurred_at'],identity:[['external_id'],['event_type','occurred_at','reference']],dates:['occurred_at'],recommended:['severity','reference']},
 purchase_order:{required:['ordered_at','supplier_external_id'],identity:[['external_id'],['order_number']],dates:['ordered_at','expected_at'],money:['subtotal','total_amount'],recommended:['currency','status']},
 goods_receipt:{required:['received_at'],identity:[['external_id'],['receipt_number']],dates:['received_at'],money:['total_cost'],recommended:['purchase_order_external_id','status']},
 sales_return:{required:['returned_at'],identity:[['external_id'],['return_number']],dates:['returned_at'],money:['refund_amount'],recommended:['sale_external_id','reason']},
 recipe:{required:['name','yield_quantity'],identity:[['external_id'],['recipe_code'],['name']],money:['menu_price','ingredient_cost'],quantities:['yield_quantity'],recommended:['menu_item_external_id']},
 restaurant_order:{required:['opened_at'],identity:[['external_id'],['order_number']],dates:['opened_at','completed_at'],money:['subtotal','ingredient_cost','total_amount'],recommended:['location_external_id','service_mode','status']},
 kitchen_ticket:{required:['status'],identity:[['external_id'],['ticket_number']],dates:['opened_at','started_at','ready_at','served_at'],recommended:['order_external_id','priority']},
 hotel_property:{required:['name'],identity:[['external_id'],['code'],['name']],recommended:['timezone']},
 hotel_room:{required:['room_number'],identity:[['external_id'],['room_number','property_external_id']],recommended:['room_type','status']},
 hotel_rate:{required:['name','amount'],identity:[['external_id'],['rate_code','property_external_id']],money:['amount'],recommended:['currency','room_type']},
 hotel_reservation:{required:['check_in_date','check_out_date'],identity:[['external_id'],['confirmation_number']],dates:['check_in_date','check_out_date','created_at'],money:['room_total','total_amount'],recommended:['guest_name','room_external_id','rate_external_id','status']},
 hotel_stay:{required:['checked_in_at'],identity:[['external_id'],['stay_number']],dates:['checked_in_at','checked_out_at'],recommended:['reservation_external_id','room_external_id','status']},
 hotel_folio:{required:['currency'],identity:[['external_id'],['folio_number']],dates:['closed_at'],money:['total_charges','total_payments','balance'],recommended:['stay_external_id','status']},
};

const STREAM_ENTITY_HINTS:Record<string,UdmEntityType>={organizations:'organization',organization:'organization',workspaces:'workspace',workspace:'workspace',branches:'branch',branch:'branch',products:'product',product:'product',categories:'category',category:'category',customers:'customer',customer:'customer',orders:'order',order:'order',order_items:'order_item',items:'order_item',sales:'sale',sale:'sale',payments:'payment',payment:'payment',inventory:'inventory',stock:'inventory',inventory_movements:'inventory_movement',stock_movements:'inventory_movement',suppliers:'supplier',supplier:'supplier',expenses:'expense',expense:'expense',employees:'employee',employee:'employee',events:'operational_event',operational_events:'operational_event',purchase_orders:'purchase_order',goods_receipts:'goods_receipt',sales_returns:'sales_return',recipes:'recipe',restaurant_orders:'restaurant_order',kitchen_tickets:'kitchen_ticket',hotel_properties:'hotel_property',hotel_rooms:'hotel_room',hotel_rates:'hotel_rate',hotel_reservations:'hotel_reservation',hotel_stays:'hotel_stay',hotel_folios:'hotel_folio'};
const UNIT_ALIASES:Record<string,string>={ea:'EA',each:'EA',piece:'EA',pieces:'EA',pcs:'EA',unit:'EA',units:'EA','حبة':'EA','قطعة':'EA',kg:'KGM',kilogram:'KGM',kilograms:'KGM','كجم':'KGM',g:'GRM',gram:'GRM',grams:'GRM',l:'LTR',liter:'LTR',litre:'LTR',ml:'MLT',m:'MTR',meter:'MTR',cm:'CMT',box:'BOX',carton:'CTN',service:'SERVICE'};
const MONEY_FIELDS=new Set(['price','cost','subtotal','discount_amount','tax_amount','shipping_amount','total_amount','unit_price','line_total','amount','fee_amount']);

function isObject(value:unknown):value is Record<string,unknown>{return Boolean(value)&&typeof value==='object'&&!Array.isArray(value);}
export function isUdmEntityType(value:unknown):value is UdmEntityType{return typeof value==='string'&&(UDM_ENTITY_TYPES as readonly string[]).includes(value);}
export function getPath(input:unknown,path:string):unknown{return path.split('.').filter(Boolean).reduce<unknown>((value,key)=>isObject(value)?value[key]:undefined,input);}
function setPath(target:Record<string,unknown>,path:string,value:unknown){const keys=path.split('.').filter(Boolean);if(!keys.length)return;let cursor=target;for(const key of keys.slice(0,-1)){const next=cursor[key];cursor[key]=isObject(next)?next:{};cursor=cursor[key] as Record<string,unknown>;}cursor[keys[keys.length-1]]=value;}
function jsonValue(value:unknown):JsonValue{return value===undefined?null:value as JsonValue;}
function cleanObject(value:Record<string,unknown>):JsonObject{return Object.fromEntries(Object.entries(value).filter(([,item])=>item!==undefined).map(([key,item])=>[key,jsonValue(item)]));}
function text(value:unknown){if(value===null||value===undefined)return null;const result=String(value).trim();return result||null;}
function numberValue(value:unknown){if(value===null||value===undefined||value==='')return null;const result=typeof value==='number'?value:Number(String(value).replace(/,/g,''));return Number.isFinite(result)?result:null;}
function normalizedIdentity(value:unknown){const result=text(value);return result?result.toLocaleLowerCase('en').normalize('NFKC').replace(/\s+/g,' ').replace(/[^\p{L}\p{N}@.+_-]+/gu,'').trim():'';}
function isoDate(value:unknown,timezone:string){const raw=text(value);if(!raw)return null;const hasZone=/([zZ]|[+-]\d{2}:?\d{2})$/.test(raw);const candidate=hasZone?raw:`${raw}${timezone==='UTC'?'Z':''}`;const date=new Date(candidate);return Number.isFinite(date.getTime())?date.toISOString():null;}
export function normalizeCurrency(value:unknown){const result=text(value)?.toUpperCase();return result&&/^[A-Z]{3}$/.test(result)?result:null;}
export function normalizeUnit(value:unknown){const result=text(value);if(!result)return null;return UNIT_ALIASES[result.toLocaleLowerCase('en')]||(/^[A-Z0-9_-]{2,12}$/.test(result.toUpperCase())?result.toUpperCase():null);}
export function inferEntityType(streamKey:string,record:JsonObject,configured?:string|null):UdmEntityType|null{if(isUdmEntityType(configured))return configured;for(const candidate of [record.entity_type,record._entity_type,record.type])if(isUdmEntityType(candidate))return candidate;const normalized=streamKey.toLowerCase().replace(/[.-]/g,'_');for(const [hint,type] of Object.entries(STREAM_ENTITY_HINTS))if(normalized===hint||normalized.endsWith(`_${hint}`))return type;return null;}

export function mapSourceRecord(source:JsonObject,fieldMap:JsonObject={},defaults:JsonObject={}):JsonObject{
 const output:Record<string,unknown>={...defaults};
 for(const [target,sourcePath] of Object.entries(fieldMap)){if(typeof sourcePath==='string')setPath(output,target,getPath(source,sourcePath));else if(isObject(sourcePath)&&typeof sourcePath.path==='string'){const value=getPath(source,sourcePath.path);setPath(output,target,value??sourcePath.default);}}
 if(!Object.keys(fieldMap).length)Object.assign(output,source);
 return cleanObject(output);
}

export function validateAndNormalize(entityType:UdmEntityType,input:JsonObject,options:{timezone?:string;defaultCurrency?:string|null;defaultUnit?:string|null}={}){
 const definition=UDM_DEFINITIONS[entityType],timezone=text(input.timezone)||options.timezone||'UTC',canonical:Record<string,unknown>={...input,entity_type:entityType,timezone},errors:UdmIssue[]=[],warnings:UdmIssue[]=[];
 for(const field of definition.dates||[]){const raw=getPath(input,field);if(raw===undefined||raw===null||raw==='')continue;const normalized=isoDate(raw,timezone);if(normalized)setPath(canonical,field,normalized);else errors.push({severity:'error',category:'timezone',ruleKey:'invalid_datetime',fieldPath:field,message:`قيمة التاريخ في ${field} غير صالحة.`,sourceValue:jsonValue(raw)});}
 const currency=normalizeCurrency(input.currency||options.defaultCurrency);if(currency)canonical.currency=currency;else if((definition.money||[]).some(field=>getPath(input,field)!==undefined))errors.push({severity:'error',category:'currency',ruleKey:'missing_or_invalid_currency',fieldPath:'currency',message:'رمز العملة مطلوب ويجب أن يتكون من ثلاثة أحرف وفق ISO 4217.',sourceValue:jsonValue(input.currency)});
 for(const field of definition.money||[]){const raw=getPath(input,field);if(raw===undefined||raw===null||raw==='')continue;const normalized=numberValue(raw);if(normalized===null)errors.push({severity:'error',category:'validation',ruleKey:'invalid_money',fieldPath:field,message:`القيمة المالية في ${field} غير رقمية.`,sourceValue:jsonValue(raw)});else setPath(canonical,field,normalized);}
 for(const field of definition.quantities||[]){const raw=getPath(input,field);if(raw===undefined||raw===null||raw==='')continue;const normalized=numberValue(raw);if(normalized===null)errors.push({severity:'error',category:'unit',ruleKey:'invalid_quantity',fieldPath:field,message:`الكمية في ${field} غير رقمية.`,sourceValue:jsonValue(raw)});else setPath(canonical,field,normalized);}
 if((definition.quantities||[]).length){const unit=normalizeUnit(input.unit||options.defaultUnit);if(unit)canonical.unit=unit;else warnings.push({severity:'warning',category:'unit',ruleKey:'missing_unit',fieldPath:'unit',message:'لم تُحدد وحدة قياس موحدة؛ حُفظت الكمية دون تحويل.',sourceValue:jsonValue(input.unit)});}
 for(const field of definition.required){const value=getPath(canonical,field);if(value===undefined||value===null||value==='')errors.push({severity:'error',category:'missing',ruleKey:'required_field',fieldPath:field,message:`الحقل ${field} مطلوب لهذا النوع من البيانات.`});}
 if(entityType==='customer'&&!['name','email','phone','external_id'].some(field=>text(getPath(canonical,field))))errors.push({severity:'error',category:'missing',ruleKey:'customer_identity_required',message:'يجب أن يحتوي العميل على اسم أو بريد أو هاتف أو معرّف خارجي.'});
 for(const field of definition.recommended||[]){const value=getPath(canonical,field);if(value===undefined||value===null||value==='')warnings.push({severity:'warning',category:'missing',ruleKey:'recommended_field_missing',fieldPath:field,message:`الحقل ${field} مفقود وقد يقلل دقة المطابقة.`});}
 const sourceCreated=isoDate(input.source_created_at||input.created_at,timezone),sourceUpdated=isoDate(input.source_updated_at||input.updated_at,timezone);
 if(sourceCreated)canonical.source_created_at=sourceCreated;if(sourceUpdated)canonical.source_updated_at=sourceUpdated;
 const qualityScore=Math.max(0,Math.min(100,100-errors.length*18-warnings.length*4));
 return {canonical:cleanObject(canonical),errors,warnings,qualityScore,timezone,currency:currency||null,unit:normalizeUnit(canonical.unit),quantity:numberValue(canonical.quantity),sourceCreatedAt:sourceCreated,sourceUpdatedAt:sourceUpdated};
}

export function identityParts(entityType:UdmEntityType,data:JsonObject){for(const group of UDM_DEFINITIONS[entityType].identity){const values=group.map(field=>normalizedIdentity(getPath(data,field)));if(values.every(Boolean))return {naturalKey:`${entityType}:${group.join('+')}:${values.join('|')}`,parts:values,fields:group};}return null;}
export function sourceKey(data:JsonObject){for(const field of ['external_id','source_id','id','uuid','key','order_number','sku','transaction_reference','employee_number']){const value=text(getPath(data,field));if(value)return value;}return null;}
export function primaryMoneyValue(entityType:UdmEntityType,data:JsonObject){for(const field of UDM_DEFINITIONS[entityType].money||[]){if(MONEY_FIELDS.has(field)){const value=numberValue(getPath(data,field));if(value!==null)return value;}}return null;}
