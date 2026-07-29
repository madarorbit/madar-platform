import {createHash} from 'node:crypto';
import type {OrbyFeatureFlag,OrbyGovernanceContext,OrbyGovernanceDecision,OrbyGovernanceRule,OrbyOsScope} from './contracts';

function scopeMatches(rule:OrbyOsScope,context:OrbyGovernanceContext){return(!rule.environment||rule.environment===context.environment)&&(!rule.organizationId||rule.organizationId===context.identity.organizationId)&&(!rule.workspaceId||rule.workspaceId===context.identity.workspaceId)&&(!rule.userId||rule.userId===context.identity.userId);}
function percentage(identity:string,key:string){const digest=createHash('sha256').update(`${key}:${identity}`).digest();return digest.readUInt32BE(0)%100;}
export class OrbyFeatureFlagEngine{
 constructor(private readonly flags:readonly OrbyFeatureFlag[]){}
 resolve(key:string,context:OrbyGovernanceContext){const candidates=this.flags.filter(item=>item.key===key&&scopeMatches(item.scope,context)).sort((a,b)=>Object.values(b.scope).filter(Boolean).length-Object.values(a.scope).filter(Boolean).length);const flag=candidates[0];if(!flag||!flag.enabled)return{enabled:false,reason:'flag-disabled'};const now=Date.now();if(flag.startsAt&&Date.parse(flag.startsAt)>now)return{enabled:false,reason:'not-started'};if(flag.endsAt&&Date.parse(flag.endsAt)<=now)return{enabled:false,reason:'expired'};const enabled=flag.rolloutPercentage>=100||percentage(context.identity.userId,key)<flag.rolloutPercentage;return{enabled,reason:enabled?'enabled':'outside-canary',configuration:flag.configuration};}
}
function conditionsMatch(rule:OrbyGovernanceRule,context:OrbyGovernanceContext){const conditions=rule.conditions as Record<string,unknown>;if(conditions.action&&conditions.action!==context.action)return false;if(conditions.executionType&&conditions.executionType!==context.executionType)return false;if(conditions.riskLevel&&conditions.riskLevel!==context.riskLevel)return false;if(conditions.toolName&&conditions.toolName!==context.toolName)return false;if(conditions.pluginKey&&conditions.pluginKey!==context.pluginKey)return false;if(conditions.channelKey&&conditions.channelKey!==context.channelKey)return false;if(conditions.dataSensitivity&&conditions.dataSensitivity!==context.dataSensitivity)return false;const required=Array.isArray(conditions.requiredPermissions)?conditions.requiredPermissions.map(String):[];if(required.some(permission=>!context.permissions.includes(permission)))return false;return true;}
export class OrbyGovernanceEngine{
 private readonly rules:readonly OrbyGovernanceRule[];
 constructor(rules:readonly OrbyGovernanceRule[]=defaultGovernanceRules()){this.rules=[...rules].filter(item=>item.enabled).sort((a,b)=>b.priority-a.priority||a.key.localeCompare(b.key));}
 decide(context:OrbyGovernanceContext):OrbyGovernanceDecision{for(const rule of this.rules){if(!scopeMatches(rule.scope,context)||!conditionsMatch(rule,context))continue;if(rule.maxCost!==undefined&&context.estimatedCost!==undefined&&context.estimatedCost>rule.maxCost)return{effect:'deny',ruleId:rule.id,reason:'التكلفة المقدرة تتجاوز حد السياسة.',requireAudit:true,requireSandbox:false,limits:{maxCost:rule.maxCost,currency:rule.currency||'USD'}};return{effect:rule.effect,ruleId:rule.id,reason:rule.description,approvalScope:rule.approvalScope,requireAudit:true,requireSandbox:rule.effect==='require_sandbox'||context.riskLevel==='high'||context.riskLevel==='critical'};}return{effect:'deny',ruleId:'default-deny',reason:'لم تتطابق العملية مع سياسة سماح صريحة.',requireAudit:true,requireSandbox:false};}
}
const rule=(key:string,priority:number,effect:OrbyGovernanceRule['effect'],description:string,conditions:OrbyGovernanceRule['conditions'],extra:Partial<OrbyGovernanceRule>={}):OrbyGovernanceRule=>({id:key,key,name:key,description,priority,enabled:true,immutable:true,effect,scope:{},conditions,...extra});
export function defaultGovernanceRules():readonly OrbyGovernanceRule[]{return[
 rule('deny-secret-storage',2000,'deny','يُمنع تخزين كلمات المرور والمفاتيح والأسرار داخل ذاكرة أوربي أو سجلاته.',{action:'data.store.secret'}),
 rule('deny-cross-tenant',1990,'deny','يُمنع الوصول إلى مؤسسة أو مساحة عمل أخرى.',{action:'tenant.cross_access'}),
 rule('deny-external-channel',1900,'deny','القنوات الخارجية مؤجلة حتى الربط والمراجعة الأمنية.',{action:'channel.external.send'}),
 rule('deny-external-write',1800,'deny','الكتابة الخارجية مغلقة افتراضيًا.',{executionType:'external'}),
 rule('delete-manager-approval',1700,'require_approval','الحذف يحتاج موافقة مدير وسياسة تشغيل صريحة.',{executionType:'delete'},{approvalScope:'manager'}),
 rule('critical-manager-approval',1600,'require_approval','الإجراء الحرج يحتاج موافقة مدير وصندوق اختبار.',{riskLevel:'critical'},{approvalScope:'manager'}),
 rule('high-manager-approval',1500,'require_approval','الإجراء عالي الخطورة يحتاج موافقة مدير.',{riskLevel:'high'},{approvalScope:'manager'}),
 rule('write-user-approval',1400,'require_approval','الكتابة الداخلية المتوسطة تحتاج موافقة المستخدم.',{executionType:'write',riskLevel:'medium'},{approvalScope:'user'}),
 rule('read-analysis-allow',1000,'allow','القراءة والتحليل داخل المؤسسة مسموحان ضمن الصلاحيات.',{requiredPermissions:['data.read']}),
 ];}
