import type {OrbyJsonObject,OrbyJsonValue} from '../../core/contracts';
import type {MadarIntegrationContextReader,MadarIntegrationSnapshot} from '../../adapters/integration';
import {IntegrationDatabase} from '@/src/lib/integration/platform';
import {params} from './supabase-shared';

export class SupabaseMadarIntegrationContextReader implements MadarIntegrationContextReader {
 constructor(private readonly database=new IntegrationDatabase()){}
 async readSnapshot(input:{organizationId:string;workspaceId?:string;userId:string;query:string;signal?:AbortSignal}):Promise<MadarIntegrationSnapshot|null>{if(input.signal?.aborted)throw new DOMException('Aborted','AbortError');const rows=await this.database.select<{entity_type:string;quality_score:number;canonical_data:OrbyJsonObject;updated_at:string}>('integration_udm_records',params({select:'entity_type,quality_score,canonical_data,updated_at',organization_id:`eq.${input.organizationId}`,lifecycle_status:'eq.active',order:'updated_at.desc',limit:'100'}));if(!rows.length)return null;const counts:Record<string,number>={};let quality=0;for(const row of rows){counts[row.entity_type]=(counts[row.entity_type]||0)+1;quality+=Number(row.quality_score||0);}return{generatedAt:new Date().toISOString(),sourceVersion:'UDM-1.0.0',summary:{recordCount:rows.length,entityCounts:counts as unknown as OrbyJsonValue,recent:rows.slice(0,20).map(row=>({entityType:row.entity_type,data:row.canonical_data,updatedAt:row.updated_at})) as unknown as OrbyJsonValue},quality:{averageScore:quality/rows.length},lineage:{source:'integration_udm_records',readOnly:true}};}
}
