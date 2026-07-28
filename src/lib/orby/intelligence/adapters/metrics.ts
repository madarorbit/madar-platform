import type {OrbyJsonObject,OrbyJsonValue} from '../../core/contracts';
import type {OrbyBusinessMetricReader,OrbyMetricSnapshot} from '../analytics';
import type {OrbyCitation,OrbyDetectorInput} from '../contracts';
import {IntegrationDatabase} from '@/src/lib/integration/platform';
import {params} from '../../execution/adapters/supabase-shared';

type UdmRow={id:string;entity_type:string;canonical_data:OrbyJsonObject;quality_score:number;updated_at:string};
function stringValue(data:OrbyJsonObject,keys:readonly string[]){for(const key of keys){const value=data[key];if(typeof value==='string'&&value.trim())return value.toLowerCase();}return'';}
function numberValue(data:OrbyJsonObject,keys:readonly string[]){for(const key of keys){const value=data[key];if(typeof value==='number'&&Number.isFinite(value))return value;if(typeof value==='string'&&value.trim()&&Number.isFinite(Number(value)))return Number(value);}return 0;}
function dateValue(data:OrbyJsonObject,fallback:string){for(const key of ['occurred_at','created_at','updated_at','date','ordered_at','paid_at','timestamp']){const value=data[key];if(typeof value==='string'&&Number.isFinite(Date.parse(value)))return Date.parse(value);}return Date.parse(fallback);}
function typeIncludes(type:string,values:readonly string[]){const normalized=type.toLowerCase();return values.some(value=>normalized.includes(value));}
function period(row:UdmRow,start:number,end:number){const time=dateValue(row.canonical_data,row.updated_at);return time>=start&&time<=end;}
function amount(row:UdmRow){return numberValue(row.canonical_data,['revenue','total','total_amount','amount','net_amount','grand_total','price']);}
function isCancelled(row:UdmRow){return ['cancelled','canceled','refunded','void'].includes(stringValue(row.canonical_data,['status','state']));}
function evidence(rows:readonly UdmRow[]):OrbyCitation[]{return rows.slice(0,8).map((row,index)=>({id:`udm:${row.id}`,sourceId:'integration-udm',documentId:row.id,chunkId:row.id,label:`D${index+1}`,title:`بيانات مَدار الموحدة — ${row.entity_type}`,excerpt:JSON.stringify(row.canonical_data).slice(0,320),score:Number(row.quality_score||0),metadata:{source:'integration_udm_records',recordId:row.id,updatedAt:row.updated_at}}));}

export class SupabaseOrbyBusinessMetricReader implements OrbyBusinessMetricReader {
 constructor(private readonly database=new IntegrationDatabase()){}
 async read(input:OrbyDetectorInput):Promise<OrbyMetricSnapshot>{
  const end=Date.parse(input.windowEnd),start=Date.parse(input.windowStart),duration=Math.max(3600000,end-start),previousStart=start-duration,limit=Math.min(5000,Math.max(100,Number(input.configuration.recordLimit||1500)));
  const rows=await this.database.select<UdmRow>('integration_udm_records',params({select:'id,entity_type,canonical_data,quality_score,updated_at',organization_id:`eq.${input.identity.organizationId}`,lifecycle_status:'eq.active',updated_at:`gte.${new Date(previousStart).toISOString()}`,order:'updated_at.desc',limit:String(limit)}));
  const current=rows.filter(row=>period(row,start,end)),previous=rows.filter(row=>period(row,previousStart,start-1));
  const aggregate=(values:readonly UdmRow[])=>{
   const orders=values.filter(row=>typeIncludes(row.entity_type,['order','sale'])&&!isCancelled(row));
   const customerIds=new Set(values.filter(row=>typeIncludes(row.entity_type,['customer','client'])).map(row=>String(row.canonical_data.id||row.canonical_data.customer_id||row.id)));
   const trafficRows=values.filter(row=>typeIncludes(row.entity_type,['traffic','visit','session','pageview']));
   const support=values.filter(row=>typeIncludes(row.entity_type,['support','ticket','case'])&&!['closed','resolved'].includes(stringValue(row.canonical_data,['status','state'])));
   const overdue=values.filter(row=>typeIncludes(row.entity_type,['payment','invoice'])&&(['overdue','failed','unpaid'].includes(stringValue(row.canonical_data,['status','state']))||Boolean(row.canonical_data.overdue)));
   const lowInventory=values.filter(row=>typeIncludes(row.entity_type,['product','inventory','stock'])&&(Boolean(row.canonical_data.low_stock)||numberValue(row.canonical_data,['stock','quantity','available_quantity','inventory'])<=numberValue(row.canonical_data,['reorder_point','minimum_stock','low_stock_threshold'])));
   return {sales:orders.reduce((sum,row)=>sum+amount(row),0),revenue:orders.reduce((sum,row)=>sum+amount(row),0),orders:orders.length,customers:customerIds.size,traffic:trafficRows.length,supportOpen:support.length,paymentOverdue:overdue.length,lowInventory:lowInventory.length,systemErrors:0};
  };
  const connections=await this.database.select<{status:string;last_error_code:string|null}>('integration_connections',params({select:'status,last_error_code',organization_id:`eq.${input.identity.organizationId}`,deleted_at:'is.null'})).catch(()=>[]);
  const currentAggregate=aggregate(current),previousAggregate=aggregate(previous);currentAggregate.systemErrors=connections.filter(row=>row.status==='error'||Boolean(row.last_error_code)).length;
  const quality=rows.length?rows.reduce((sum,row)=>sum+Number(row.quality_score||0),0)/rows.length:0,freshest=rows[0]?.updated_at?Math.max(0,(Date.now()-Date.parse(rows[0].updated_at))/1000):Number.MAX_SAFE_INTEGER;
  return {current:currentAggregate,previous:previousAggregate,sampleSize:current.length,qualityScore:Math.max(0,Math.min(1,quality)),freshnessSeconds:freshest,dimensions:{currentRecords:current.length,previousRecords:previous.length,windowStart:input.windowStart,windowEnd:input.windowEnd} as OrbyJsonObject,evidence:evidence(current)};
 }
}
