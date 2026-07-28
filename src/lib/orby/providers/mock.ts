import type {OrbyEmbeddingRequest,OrbyModerationRequest,OrbyProvider,OrbyProviderCapabilities,OrbyProviderRequest,OrbyProviderResponse,OrbyProviderStreamEvent} from '../core/contracts';
import {OrbyError} from '../core/errors';
import {providerCapabilities,providerNow} from './common';

export type MockOrbyProviderOptions={id?:string;displayName?:string;responseText?:string;failuresBeforeSuccess?:number;latencyMs?:number;capabilities?:Partial<OrbyProviderCapabilities>;generate?:(request:OrbyProviderRequest)=>Promise<OrbyProviderResponse>|OrbyProviderResponse};

export class MockOrbyProvider implements OrbyProvider {
 readonly id:string;readonly displayName:string;readonly capabilities:OrbyProviderCapabilities;private remainingFailures:number;
 constructor(private readonly options:MockOrbyProviderOptions={}){this.id=options.id||'mock';this.displayName=options.displayName||'Mock ORBY Provider';this.capabilities=providerCapabilities({text:true,streaming:true,embeddings:true,moderation:true,json:true,...options.capabilities});this.remainingFailures=options.failuresBeforeSuccess||0;}
 async generate(request:OrbyProviderRequest){if(this.options.latencyMs)await new Promise(resolve=>setTimeout(resolve,this.options.latencyMs));if(this.remainingFailures>0){this.remainingFailures--;throw new OrbyError('Synthetic retryable provider failure.','PROVIDER_UNAVAILABLE',true,{providerId:this.id});}return this.options.generate?this.options.generate(request):{text:this.options.responseText||`ORBY:${request.messages.at(-1)?.content||''}`,finishReason:'stop',usage:{inputTokens:10,outputTokens:5,totalTokens:15}};}
 async *stream(request:OrbyProviderRequest):AsyncIterable<OrbyProviderStreamEvent>{const response=await this.generate(request);yield {type:'start'};yield {type:'delta',text:response.text};if(response.usage)yield {type:'usage',usage:response.usage};yield {type:'end',finishReason:response.finishReason};}
 async embeddings(request:OrbyEmbeddingRequest){return {vectors:request.inputs.map(input=>[input.length,1,0]),usage:{inputTokens:request.inputs.join('').length}};}
 async moderation(request:OrbyModerationRequest){return request.inputs.map(()=>({flagged:false,categories:{}}));}
 async models(){return [{id:'mock-model',displayName:'Mock Model',capabilities:this.capabilities}];}
 async health(){return {providerId:this.id,ok:true,latencyMs:0,checkedAt:providerNow()};}
}
