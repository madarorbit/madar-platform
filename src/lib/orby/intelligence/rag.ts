import type {OrbyIdentity,OrbyJsonObject} from '../core/contracts';
import type {OrbyCitation,OrbyRagContext} from './contracts';
import {OrbyKnowledgeContextBuilder,OrbyKnowledgeEngine} from './knowledge';

export interface OrbyRagAnswerModel {
 answer(input:{identity:OrbyIdentity;question:string;context:OrbyRagContext;signal?:AbortSignal}):Promise<{text:string;metadata?:OrbyJsonObject}>;
}

export class OrbyCitationEngine {
 format(citations:readonly OrbyCitation[]){return citations.map(citation=>`[${citation.label}] ${citation.title} — ${citation.excerpt}`).join('\n');}
 referenced(text:string){return new Set([...text.matchAll(/\[S(\d+)\]/g)].map(match=>`S${match[1]}`));}
 validate(text:string,citations:readonly OrbyCitation[]){
  if(!citations.length)return {valid:true,missing:[] as string[],unknown:[] as string[]};
  const referenced=this.referenced(text),available=new Set(citations.map(citation=>citation.label));
  const unknown=[...referenced].filter(label=>!available.has(label)),missing=referenced.size?[...available].filter(label=>!referenced.has(label)):[...available];
  return {valid:referenced.size>0&&!unknown.length,missing,unknown};
 }
}

export class OrbyHallucinationGuard {
 constructor(private readonly citations=new OrbyCitationEngine()){}
 verify(text:string,context:OrbyRagContext){
  const result=this.citations.validate(text,context.citations);
  if(context.citations.length&&!result.valid)throw new Error('ORBY_RAG_CITATION_REQUIRED');
  const normalized=text.toLowerCase();if(/\b(source unavailable|مصدر غير متاح)\b/i.test(normalized))throw new Error('ORBY_RAG_UNSUPPORTED_SOURCE');
  return result;
 }
}

export class OrbyRagEngine {
 private readonly builder=new OrbyKnowledgeContextBuilder();
 constructor(private readonly knowledge:OrbyKnowledgeEngine,private readonly model:OrbyRagAnswerModel,private readonly guard=new OrbyHallucinationGuard()){}
 async answer(input:{identity:OrbyIdentity;question:string;sourceIds?:readonly string[];maximumContextCharacters?:number;signal?:AbortSignal}){
  const results=await this.knowledge.search({identity:input.identity,query:input.question,sourceIds:input.sourceIds,limit:12,minimumScore:.5,signal:input.signal});
  const context=this.builder.build(input.question,results,Math.min(24000,Math.max(2000,input.maximumContextCharacters||12000)));
  if(!context.citations.length)return {text:'لا توجد في مصادر مساحة العمل معلومات موثقة كافية للإجابة عن هذا السؤال.',citations:[],grounded:false,context};
  const response=await this.model.answer({identity:input.identity,question:input.question,context,signal:input.signal});
  this.guard.verify(response.text,context);
  return {text:response.text,citations:context.citations,grounded:true,context,metadata:response.metadata||{}};
 }
}
