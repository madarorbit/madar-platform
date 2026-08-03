import {randomUUID} from 'node:crypto';
import type {OrbyJsonObject,OrbyJsonValue} from '../core/contracts';
import type {OrbyChannelManifest,OrbyEvaluationResult,OrbyOsLifecycle,OrbyRelease} from './contracts';

export type OrbyAdminRole='SUPER_ADMIN'|'ADMIN'|'AUDITOR';
export type OrbyManagedResourceKind='provider'|'model'|'prompt'|'tool'|'capability'|'plan_limit'|'policy';
export type OrbyManagedResource={kind:OrbyManagedResourceKind;key:string;version:string;enabled:boolean;configuration:OrbyJsonObject;updatedAt:string;updatedBy:string};
export type OrbyAdminAuditEvent={id:string;actorId:string;action:string;resourceKind?:OrbyManagedResourceKind;resourceKey?:string;before?:OrbyJsonValue;after?:OrbyJsonValue;reason:string;createdAt:string};
export type OrbyReleaseGateKey='provider_swap'|'personality_stability'|'memory_isolation'|'read_tools'|'sensitive_write_approval'|'write_verify_reverse_sync'|'proactive_deduplication'|'cross_device_parity'|'commerce_suite'|'food_service_suite'|'hospitality_suite'|'security'|'evaluation'|'performance'|'cost'|'rollback';
export type OrbyReleaseGateEvidence={key:OrbyReleaseGateKey;passed:boolean;score?:number;artifact?:string;details?:OrbyJsonObject};
export type OrbyDataClassification='public'|'internal'|'sensitive'|'restricted';
export type OrbyDataSubjectRequestType='export'|'delete'|'correct';

function now(){return new Date().toISOString();}
function assertAdmin(role:OrbyAdminRole,write=false){if(role==='AUDITOR'&&write)throw new Error('ORBY_ADMIN_READ_ONLY');if(write&&role!=='SUPER_ADMIN')throw new Error('ORBY_SUPER_ADMIN_REQUIRED');}
function resourceId(kind:OrbyManagedResourceKind,key:string){return`${kind}:${key}`;}

export class OrbyAdminControlCenter{
 private readonly resources=new Map<string,OrbyManagedResource>();private readonly audit:OrbyAdminAuditEvent[]=[];
 upsert(actor:{userId:string;role:OrbyAdminRole},input:Omit<OrbyManagedResource,'updatedAt'|'updatedBy'>,reason:string){assertAdmin(actor.role,true);const id=resourceId(input.kind,input.key),before=this.resources.get(id),next={...input,configuration:structuredClone(input.configuration),updatedAt:now(),updatedBy:actor.userId};this.resources.set(id,next);this.record(actor.userId,'resource.upsert',reason,input.kind,input.key,before,next);return next;}
 disable(actor:{userId:string;role:OrbyAdminRole},kind:OrbyManagedResourceKind,key:string,reason:string){assertAdmin(actor.role,true);const id=resourceId(kind,key),before=this.resources.get(id);if(!before)throw new Error('ORBY_ADMIN_RESOURCE_NOT_FOUND');const next={...before,enabled:false,updatedAt:now(),updatedBy:actor.userId};this.resources.set(id,next);this.record(actor.userId,'resource.disable',reason,kind,key,before,next);return next;}
 rollback(actor:{userId:string;role:OrbyAdminRole},kind:OrbyManagedResourceKind,key:string,previous:OrbyManagedResource,reason:string){assertAdmin(actor.role,true);if(previous.kind!==kind||previous.key!==key)throw new Error('ORBY_ADMIN_ROLLBACK_TARGET_INVALID');const before=this.resources.get(resourceId(kind,key)),next={...previous,updatedAt:now(),updatedBy:actor.userId};this.resources.set(resourceId(kind,key),next);this.record(actor.userId,'resource.rollback',reason,kind,key,before,next);return next;}
 get(actor:{role:OrbyAdminRole},kind:OrbyManagedResourceKind,key:string){assertAdmin(actor.role);return this.resources.get(resourceId(kind,key))||null;}
 snapshot(actor:{role:OrbyAdminRole}){assertAdmin(actor.role);return{resources:[...this.resources.values()],audit:[...this.audit]};}
 private record(actorId:string,action:string,reason:string,resourceKind?:OrbyManagedResourceKind,resourceKey?:string,before?:OrbyJsonValue,after?:OrbyJsonValue){this.audit.push({id:randomUUID(),actorId,action,resourceKind,resourceKey,before,after,reason,createdAt:now()});}
}

export const ORBY_V2_REQUIRED_GATES:readonly OrbyReleaseGateKey[]=['provider_swap','personality_stability','memory_isolation','read_tools','sensitive_write_approval','write_verify_reverse_sync','proactive_deduplication','cross_device_parity','commerce_suite','food_service_suite','hospitality_suite','security','evaluation','performance','cost','rollback'];
export class OrbyV2ReleaseGate{
 evaluate(evidence:readonly OrbyReleaseGateEvidence[]){const byKey=new Map(evidence.map(item=>[item.key,item])),missing=ORBY_V2_REQUIRED_GATES.filter(key=>!byKey.get(key)?.passed),failed=evidence.filter(item=>!item.passed);return{passed:missing.length===0&&failed.length===0,missing,failed,score:evidence.length?evidence.reduce((sum,item)=>sum+(item.score??(item.passed?1:0)),0)/evidence.length:0};}
 assertReady(evidence:readonly OrbyReleaseGateEvidence[]){const result=this.evaluate(evidence);if(!result.passed)throw new Error(`ORBY_V2_RELEASE_BLOCKED:${[...result.missing,...result.failed.map(item=>item.key)].join(',')}`);return result;}
 fromEvaluation(results:readonly OrbyEvaluationResult[],mapping:Readonly<Record<string,OrbyReleaseGateKey>>):OrbyReleaseGateEvidence[]{return results.map(result=>({key:mapping[result.caseId],passed:result.passed,score:result.score,details:{findings:[...result.findings],durationMs:result.durationMs,cost:result.cost}}));}
}

export class OrbyDataGovernanceEngine{
 classify(field:string):OrbyDataClassification{const normalized=field.toLowerCase();if(/password|secret|token|private_key|cvv|cvc|pin/.test(normalized))return'restricted';if(/email|phone|address|identity|payment|invoice|salary/.test(normalized))return'sensitive';if(/internal|audit|cost|margin|memory/.test(normalized))return'internal';return'public';}
 retention(classification:OrbyDataClassification){return{public:null,internal:365,sensitive:180,restricted:30}[classification] as number|null;}
 canAccess(input:{role:OrbyAdminRole;classification:OrbyDataClassification;reason:string;breakGlass?:boolean}){if(!input.reason.trim())return false;if(input.classification==='restricted')return input.role==='SUPER_ADMIN'&&input.breakGlass===true;if(input.classification==='sensitive')return input.role==='SUPER_ADMIN'||input.role==='ADMIN';return true;}
 request(input:{organizationId:string;userId:string;type:OrbyDataSubjectRequestType;scope:readonly string[]}){if(!input.scope.length)throw new Error('ORBY_DATA_REQUEST_SCOPE_REQUIRED');return{id:randomUUID(),...input,status:'pending' as const,createdAt:now()};}
}

export type OrbyBackupComponent='configuration'|'prompts'|'tools'|'memory'|'knowledge'|'conversations'|'approvals'|'workflows'|'insights';
export type OrbyBackupManifest={id:string;version:string;components:readonly OrbyBackupComponent[];encrypted:boolean;checksum:string;storageRegion:string;createdAt:string;restoreTestedAt?:string;metadata:OrbyJsonObject};
export class OrbyBackupRecoveryEngine{
 create(input:Omit<OrbyBackupManifest,'id'|'createdAt'>){if(!input.encrypted)throw new Error('ORBY_BACKUP_ENCRYPTION_REQUIRED');if(!input.components.length||!input.checksum.trim())throw new Error('ORBY_BACKUP_INVALID');return{id:randomUUID(),createdAt:now(),...input};}
 verify(manifest:OrbyBackupManifest){return{valid:manifest.encrypted&&manifest.components.length>0&&manifest.checksum.length>=16,restoreTested:Boolean(manifest.restoreTestedAt)};}
 recoveryPlan(cause:'provider_outage'|'database_outage'|'bad_release'){if(cause==='provider_outage')return['فتح Circuit Breaker','التحويل إلى المزود الاحتياطي','مراقبة ثبات الشخصية والتكلفة','استعادة المزود الأساسي تدريجيًا'];if(cause==='database_outage')return['إيقاف الكتابات','تفعيل وضع القراءة المحدود','استعادة أحدث نسخة متحققة','إعادة تشغيل الطوابير Idempotently','فحص العزل والتدقيق'];return['إيقاف Feature Flag','Rollback إلى الإصدار السابق','إعادة تشغيل بوابة التقييم','فتح Canary محدود'];}
}

export class OrbyChannelRegistry{
 private readonly channels=new Map<string,OrbyChannelManifest>();
 constructor(channels:readonly OrbyChannelManifest[]=builtinOrbyChannels()){for(const channel of channels)this.register(channel);}
 register(channel:OrbyChannelManifest){if(this.channels.has(channel.key))throw new Error('ORBY_CHANNEL_EXISTS');this.channels.set(channel.key,Object.freeze({...channel}));return this;}
 resolve(key:OrbyChannelManifest['key']){const channel=this.channels.get(key);if(!channel)throw new Error('ORBY_CHANNEL_NOT_FOUND');return channel;}
 assertUsable(key:OrbyChannelManifest['key'],direction:'inbound'|'outbound'){const channel=this.resolve(key);if(!['active','canary'].includes(channel.status))throw new Error('ORBY_CHANNEL_NOT_ACTIVE');if(direction==='inbound'&&!channel.supportsInbound)throw new Error('ORBY_CHANNEL_INBOUND_DISABLED');if(direction==='outbound'&&!channel.supportsOutbound)throw new Error('ORBY_CHANNEL_OUTBOUND_DISABLED');return channel;}
 list(){return[...this.channels.values()];}
}
export function builtinOrbyChannels():readonly OrbyChannelManifest[]{return[
 {key:'in_app',name:'مَدار داخل المنصة',status:'active',requiresIdentity:true,permissions:['orby.chat'],supportsInbound:true,supportsOutbound:true,metadata:{kernel:'shared'}},
 {key:'mobile',name:'تطبيق مَدار',status:'active',requiresIdentity:true,permissions:['orby.chat'],supportsInbound:true,supportsOutbound:true,metadata:{kernel:'shared'}},
 {key:'push',name:'إشعارات التطبيق',status:'active',requiresIdentity:true,permissions:['notifications.receive'],supportsInbound:false,supportsOutbound:true,metadata:{kernel:'shared'}},
 {key:'email',name:'البريد الإلكتروني',status:'paused',requiresIdentity:true,permissions:['notifications.receive'],supportsInbound:false,supportsOutbound:true,metadata:{future:true}},
 {key:'whatsapp',name:'واتساب',status:'paused',requiresIdentity:true,permissions:['channel.whatsapp'],supportsInbound:false,supportsOutbound:false,metadata:{future:true,requiresSecurityReview:true}},
 {key:'webhook',name:'Webhook',status:'paused',requiresIdentity:true,permissions:['channel.webhook'],supportsInbound:false,supportsOutbound:false,metadata:{future:true,requiresSecurityReview:true}},
 ];}

export class OrbyCertifiedReleaseManager{
 constructor(private readonly gate=new OrbyV2ReleaseGate()){}
 certify(release:OrbyRelease,evidence:readonly OrbyReleaseGateEvidence[]){const result=this.gate.assertReady(evidence);return{...release,status:'testing' as OrbyOsLifecycle,metadata:{...release.metadata,certified:true,gateScore:result.score,gateKeys:[...ORBY_V2_REQUIRED_GATES],certifiedAt:now()}};}
}
