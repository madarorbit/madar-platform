import type {Connector,ConnectorBatch,ConnectorContext,ConnectorSyncRequest,JsonObject,JsonValue} from '../contracts';
import {IntegrationError} from '../errors';
import {historicalLabData,incrementalLabData,LAB_STREAMS,normalizeLabScenario,type LabStreamKey} from '../lab/fixtures';

const delay=(milliseconds:number,signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{if(milliseconds<=0)return resolve();const timer=setTimeout(resolve,milliseconds);signal.addEventListener('abort',()=>{clearTimeout(timer);reject(new DOMException('Aborted','AbortError'));},{once:true});});
const selectedStreams=(request:ConnectorSyncRequest)=>{const requested=request.streams?.filter((item):item is LabStreamKey=>(LAB_STREAMS as readonly string[]).includes(item));return requested?.length?requested:[...LAB_STREAMS];};
const cursorFor=(context:ConnectorContext,stream:LabStreamKey)=>{const value=context.checkpoints[stream]?.cursor;return typeof value==='number'&&Number.isInteger(value)&&value>=0?value:0;};

function authenticate(context:ConnectorContext){
 const scenario=normalizeLabScenario(context.connection.config),provided=typeof context.secret.value==='string'?context.secret.value:'';
 if(scenario.keyExpiresAt&&Date.parse(scenario.keyExpiresAt)<=Date.now())throw new IntegrationError('انتهت صلاحية مفتاح الموصل المرجعي.','AUTHENTICATION_FAILED',false,{connectorKey:context.connection.connectorKey,keyExpiresAt:scenario.keyExpiresAt});
 const expected=`madar-lab-key-v${scenario.expectedKeyVersion}`;
 if(provided!==expected)throw new IntegrationError('مفتاح الموصل المرجعي غير صالح أو يحتاج إلى تدوير.','AUTHENTICATION_FAILED',false,{connectorKey:context.connection.connectorKey,expectedKeyVersion:scenario.expectedKeyVersion});
 return scenario;
}

async function* synchronize(context:ConnectorContext,request:ConnectorSyncRequest,mode:'initial'|'incremental'):AsyncIterable<ConnectorBatch>{
 const scenario=authenticate(context),data=mode==='initial'?historicalLabData(scenario):incrementalLabData(),pageSize=Math.min(request.pageSize||scenario.pageSize,100);
 for(const stream of selectedStreams(request)){
  const records=data[stream];let offset=cursorFor(context,stream);
  while(offset<records.length){
   if(context.signal.aborted)throw new DOMException('Aborted','AbortError');
   await delay(scenario.latencyMs,context.signal);
   const end=Math.min(records.length,offset+pageSize),batchNumber=Math.floor(offset/pageSize)+1,page=records.slice(offset,end),watermark=page.reduce<string|null>((latest,record)=>typeof record.updated_at==='string'&&(!latest||record.updated_at>latest)?record.updated_at:latest,null);
   yield {streamKey:stream,records:page,nextCursor:end,watermark,hasMore:end<records.length,sourceRequestId:`reference:${mode}:${stream}:${offset}`,metadata:{mode,batchNumber,offset,end,synthetic:true}};
   if(scenario.failureStream===stream&&scenario.failAfterBatch===batchNumber)throw new IntegrationError('فشل مصطنع بعد حفظ دفعة ناجحة لاختبار الاستكمال من Checkpoint.','SOURCE_UNAVAILABLE',true,{stream,batchNumber,checkpoint:end});
   if(scenario.failureStream===stream&&scenario.disconnectAfterBatch===batchNumber)throw new IntegrationError('انقطع الاتصال بالنظام التجاري الافتراضي.','SOURCE_UNAVAILABLE',true,{stream,batchNumber,checkpoint:end,disconnected:true});
   offset=end;
  }
 }
}

export const referenceCommerceConnector:Connector={
 manifest:{key:'madar-reference-commerce',version:'1.0.0',displayName:'MADAR Reference Commerce',description:'نظام تجارة افتراضي حتمي لاختبار المزامنة التاريخية والتزايدية والأخطاء والتكرار والاستكمال قبل إدخال عميل حقيقي.',authSchemes:['api_key'],streams:LAB_STREAMS.map(key=>({key,label:key,supportsInitial:true,supportsIncremental:true,defaultPageSize:3})),capabilities:{read:true,write:false,webhooks:false,polling:true,files:false,database:false,localBridge:false},internalOnly:true},
 validateConfig(input){const scenario=normalizeLabScenario(input);return {valid:true,normalizedConfig:scenario as unknown as JsonObject};},
 async testConnection(context){
  const started=Date.now(),scenario=authenticate(context);await delay(scenario.latencyMs,context.signal);
  return {ok:true,latencyMs:Date.now()-started,accountLabel:'MADAR Synthetic Commerce',grantedScopes:['read:products','read:customers','read:orders','read:payments','read:inventory'],metadata:{expectedKeyVersion:scenario.expectedKeyVersion,readOnly:context.connection.mode==='READ_ONLY'} as JsonObject};
 },
 initialSync(context,request){return synchronize(context,request,'initial');},
 incrementalSync(context,request){return synchronize(context,request,'incremental');},
};

export function referenceApiKey(version=1):JsonObject{return {name:'x-madar-lab-key',value:`madar-lab-key-v${version}`,placement:'header'};}
export function referenceConnectorConfig(overrides:JsonObject={}):JsonObject{return {...normalizeLabScenario(overrides),...overrides} as unknown as JsonObject;}
export const referenceStreams=LAB_STREAMS as readonly LabStreamKey[];
export type ReferenceCheckpoint=Record<string,{streamKey:string;cursor:JsonValue|null;watermark:string|null;version:number}>;
