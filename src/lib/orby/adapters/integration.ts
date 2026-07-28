import type {OrbyContextRequest,OrbyContextSegment,OrbyJsonObject,OrbyJsonValue} from '../core/contracts';
import {OrbyError} from '../core/errors';

export type MadarIntegrationSnapshot={
 generatedAt:string;
 sourceVersion:string;
 summary:OrbyJsonObject;
 quality?:OrbyJsonObject;
 lineage?:OrbyJsonObject;
};

export interface MadarIntegrationContextReader {
 readSnapshot(input:{organizationId:string;workspaceId?:string;userId:string;query:string;signal?:AbortSignal}):Promise<MadarIntegrationSnapshot|null>;
}

function stable(value:OrbyJsonValue):string{
 if(Array.isArray(value))return `[${value.map(stable).join(',')}]`;
 if(value&&typeof value==='object')return `{${Object.keys(value).sort().map(key=>`${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
 return JSON.stringify(value);
}

export class MadarIntegrationContextSource {
 readonly key='madar.integration.snapshot';
 readonly priority:number;
 constructor(private readonly reader:MadarIntegrationContextReader,options:{priority?:number;maxCharacters?:number}={}){this.priority=options.priority||900;this.maxCharacters=options.maxCharacters||16000;}
 private readonly maxCharacters:number;
 async load(request:OrbyContextRequest):Promise<OrbyContextSegment|null>{
  const snapshot=await this.reader.readSnapshot({organizationId:request.identity.organizationId,workspaceId:request.identity.workspaceId,userId:request.identity.userId,query:request.message,signal:request.signal});
  if(!snapshot)return null;
  if(!snapshot.generatedAt||!snapshot.sourceVersion)throw new OrbyError('لقطة بيانات مَدار لا تحمل بيانات المصدر المطلوبة.','CONTEXT_SOURCE_FAILED',false,{source:this.key});
  const content=stable({generatedAt:snapshot.generatedAt,sourceVersion:snapshot.sourceVersion,summary:snapshot.summary,quality:snapshot.quality||{},lineage:snapshot.lineage||{}}).slice(0,this.maxCharacters);
  return {key:this.key,title:'Mَدار Unified Business Snapshot',content,priority:this.priority,trusted:true,metadata:{generatedAt:snapshot.generatedAt,sourceVersion:snapshot.sourceVersion}};
 }
}
