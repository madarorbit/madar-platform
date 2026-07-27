import type {Connector,ConnectorBatch,ConnectorContext,ConnectorSyncRequest,JsonObject} from '../contracts';

function config(input:unknown){
 const value=input&&typeof input==='object'&&!Array.isArray(input)?input as Record<string,unknown>:{};
 const recordCount=Math.min(500,Math.max(1,Number(value.recordCount)||25));
 const pageSize=Math.min(100,Math.max(1,Number(value.pageSize)||10));
 return {recordCount,pageSize};
}

function record(index:number):JsonObject{return {external_id:`diagnostic-${index}`,name:`Diagnostic record ${index}`,sequence:index,updated_at:new Date(1_700_000_000_000+index*60_000).toISOString()};}

async function* initial(context:ConnectorContext,request:ConnectorSyncRequest):AsyncIterable<ConnectorBatch>{
 const settings=config(context.connection.config),pageSize=Math.min(request.pageSize||settings.pageSize,100);
 for(let offset=0;offset<settings.recordCount;offset+=pageSize){
  if(context.signal.aborted)throw new DOMException('Aborted','AbortError');
  const end=Math.min(settings.recordCount,offset+pageSize),records=Array.from({length:end-offset},(_,position)=>record(offset+position+1));
  yield {streamKey:'diagnostic.records',records,nextCursor:end,watermark:records.at(-1)?.updated_at as string,hasMore:end<settings.recordCount,metadata:{offset,end}};
 }
}

async function* incremental(context:ConnectorContext):AsyncIterable<ConnectorBatch>{
 const previous=context.checkpoints['diagnostic.records']?.cursor,sequence=typeof previous==='number'?previous+1:1,next=record(sequence);
 yield {streamKey:'diagnostic.records',records:[next],nextCursor:sequence,watermark:next.updated_at as string,hasMore:false,metadata:{incremental:true}};
}

export const diagnosticConnector:Connector={
 manifest:{key:'madar-diagnostic',version:'1.0.0',displayName:'MADAR Diagnostic Connector',description:'موصل داخلي حتمي لاختبار عقد المحرك والمزامنة دون الاتصال بنظام عميل.',authSchemes:['none'],streams:[{key:'diagnostic.records',label:'Diagnostic records',supportsInitial:true,supportsIncremental:true,defaultPageSize:10}],capabilities:{read:true,write:false,webhooks:false,polling:true,files:false,database:false,localBridge:false},internalOnly:true},
 validateConfig(input){return {valid:true,normalizedConfig:config(input)};},
 async testConnection(){return {ok:true,latencyMs:0,accountLabel:'MADAR internal diagnostic',grantedScopes:['read:diagnostic']};},
 initialSync:initial,
 incrementalSync:incremental,
};
