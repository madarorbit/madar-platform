import {createHash,randomUUID} from 'node:crypto';
import type {OrbyModelDescriptor,OrbyProvider} from '../core/contracts';
import type {OrbyEmbeddingService} from './contracts';

export class ProviderEmbeddingService implements OrbyEmbeddingService {
 readonly model:string;private readonly provider:OrbyProvider;private readonly providerModel:string;
 constructor(providers:readonly OrbyProvider[],models:readonly OrbyModelDescriptor[]){const candidates=models.filter(model=>model.enabled&&model.capabilities.embeddings!==false).sort((a,b)=>b.priority-a.priority),selected=candidates.find(model=>providers.some(provider=>provider.id===model.providerId&&provider.capabilities.embeddings));if(!selected)throw new Error('ORBY_EMBEDDING_MODEL_UNAVAILABLE');const provider=providers.find(item=>item.id===selected.providerId);if(!provider)throw new Error('ORBY_EMBEDDING_PROVIDER_UNAVAILABLE');this.model=selected.id;this.provider=provider;this.providerModel=selected.providerModel;}
 async embed(inputs:readonly string[],signal?:AbortSignal){if(!inputs.length)return[];const response=await this.provider.embeddings({requestId:randomUUID(),model:this.providerModel,inputs,signal});return response.vectors;}
}

export class HashEmbeddingService implements OrbyEmbeddingService {
 readonly model='orby-local-hash-embedding-v1';
 constructor(private readonly dimensions=384){}
 async embed(inputs:readonly string[],signal?:AbortSignal){return inputs.map(text=>{if(signal?.aborted)throw new DOMException('Aborted','AbortError');const vector=Array.from({length:this.dimensions},()=>0),tokens=text.toLocaleLowerCase('ar').match(/[\p{L}\p{N}]+/gu)||[];for(const token of tokens){const hash=createHash('sha256').update(token).digest(),index=hash.readUInt32BE(0)%this.dimensions,sign=(hash[4]&1)===0?1:-1;vector[index]+=sign*(1+Math.log1p(token.length));}const norm=Math.sqrt(vector.reduce((sum,value)=>sum+value*value,0))||1;return vector.map(value=>value/norm);});}
}

export function createEmbeddingService(providers:readonly OrbyProvider[],models:readonly OrbyModelDescriptor[]):OrbyEmbeddingService{try{return new ProviderEmbeddingService(providers,models);}catch{return new HashEmbeddingService();}}
