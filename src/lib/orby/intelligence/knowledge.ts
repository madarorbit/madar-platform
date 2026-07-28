import {createHash} from 'node:crypto';
import type {OrbyContextRequest,OrbyContextSegment,OrbyIdentity,OrbyJsonObject} from '../core/contracts';
import type {
 OrbyDocumentTextExtractor,OrbyEmbeddingService,OrbyIntelligenceRepository,OrbyKnowledgeChunk,OrbyKnowledgeDocument,OrbyKnowledgeSource,
 OrbyOcrService,OrbyRetrievedKnowledge,OrbyRagContext,
} from './contracts';

function sha(value:string|Uint8Array){return createHash('sha256').update(value).digest('hex');}
function now(){return new Date().toISOString();}
function tokenEstimate(value:string){return Math.max(1,Math.ceil(value.length/4));}
function normalizedText(value:string){return value.replace(/\u0000/g,'').replace(/\r\n/g,'\n').replace(/[ \t]+\n/g,'\n').replace(/\n{4,}/g,'\n\n\n').trim();}
function decode(bytes:Uint8Array){return new TextDecoder('utf-8',{fatal:false}).decode(bytes);}
function stripMarkup(value:string){return value.replace(/<script[\s\S]*?<\/script>/gi,' ').replace(/<style[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&nbsp;/gi,' ').replace(/&amp;/gi,'&').replace(/&lt;/gi,'<').replace(/&gt;/gi,'>').replace(/\s+/g,' ').trim();}

export class NativeTextExtractor implements OrbyDocumentTextExtractor {
 private readonly types=new Set(['text/plain','text/markdown','text/csv','application/json','application/xml','text/xml','text/html','application/xhtml+xml']);
 supports(mimeType:string){return this.types.has(mimeType.toLowerCase());}
 async extract(input:{bytes?:Uint8Array;text?:string;mimeType:string;fileName?:string}){
  const raw=input.text??(input.bytes?decode(input.bytes):'');if(!raw.trim())throw new Error('ORBY_DOCUMENT_EMPTY');
  let text=raw;if(input.mimeType.includes('html')||input.mimeType.includes('xml'))text=stripMarkup(raw);
  if(input.mimeType==='application/json'){try{text=JSON.stringify(JSON.parse(raw),null,2);}catch{throw new Error('ORBY_DOCUMENT_INVALID_JSON');}}
  return {text:normalizedText(text),metadata:{extractor:'native-text',fileName:input.fileName||null}};
 }
}

export class OcrTextExtractor implements OrbyDocumentTextExtractor {
 private readonly types=new Set(['application/pdf','image/png','image/jpeg','image/webp','image/tiff']);
 constructor(private readonly service:OrbyOcrService){}
 supports(mimeType:string){return this.types.has(mimeType.toLowerCase());}
 async extract(input:{bytes?:Uint8Array;mimeType:string;fileName?:string;signal?:AbortSignal}){
  if(!input.bytes?.length)throw new Error('ORBY_OCR_BYTES_REQUIRED');
  const result=await this.service.extract({bytes:input.bytes,mimeType:input.mimeType,fileName:input.fileName,signal:input.signal});
  const text=normalizedText(result.text);if(!text)throw new Error('ORBY_OCR_EMPTY');
  return {...result,text,metadata:{...(result.metadata||{}),extractor:'ocr'}};
 }
}

export class HttpOcrService implements OrbyOcrService {
 constructor(private readonly endpoint:string,private readonly apiKey?:string){}
 async extract(input:{bytes:Uint8Array;mimeType:string;fileName?:string;signal?:AbortSignal}){
  const response=await fetch(this.endpoint,{method:'POST',signal:input.signal,headers:{'Content-Type':'application/json',...(this.apiKey?{'Authorization':`Bearer ${this.apiKey}`}:{})},body:JSON.stringify({mimeType:input.mimeType,fileName:input.fileName||null,contentBase64:Buffer.from(input.bytes).toString('base64')})});
  if(!response.ok)throw new Error(`ORBY_OCR_FAILED:${response.status}`);
  const payload=await response.json() as {text?:string;language?:string;metadata?:OrbyJsonObject};
  if(!payload.text?.trim())throw new Error('ORBY_OCR_EMPTY');return{text:payload.text,language:payload.language,metadata:payload.metadata};
 }
}

export class ExtractorRegistry {
 private readonly extractors:OrbyDocumentTextExtractor[]=[];
 register(extractor:OrbyDocumentTextExtractor){this.extractors.push(extractor);return this;}
 resolve(mimeType:string){const extractor=this.extractors.find(item=>item.supports(mimeType));if(!extractor)throw new Error('ORBY_DOCUMENT_EXTRACTOR_UNAVAILABLE');return extractor;}
}

export class OrbyDocumentChunker {
 constructor(private readonly maxCharacters=3200,private readonly overlapCharacters=320){}
 chunk(input:{document:OrbyKnowledgeDocument;text:string}):Omit<OrbyKnowledgeChunk,'id'|'createdAt'>[]{
  const text=normalizedText(input.text);if(!text)return [];
  const paragraphs=text.split(/\n{2,}/).map(item=>item.trim()).filter(Boolean),pieces:string[]=[];let current='';
  const flush=()=>{if(current.trim())pieces.push(current.trim());current='';};
  for(const paragraph of paragraphs){
   if(paragraph.length>this.maxCharacters){flush();for(let offset=0;offset<paragraph.length;offset+=Math.max(1,this.maxCharacters-this.overlapCharacters))pieces.push(paragraph.slice(offset,offset+this.maxCharacters).trim());}
   else if(!current)current=paragraph;
   else if(current.length+2+paragraph.length<=this.maxCharacters)current+=`\n\n${paragraph}`;
   else{const overlap=current.slice(-this.overlapCharacters);flush();current=`${overlap}\n\n${paragraph}`.trim();}
  }
  flush();
  return pieces.filter(Boolean).map((content,ordinal)=>({documentId:input.document.id,sourceId:input.document.sourceId,organizationId:input.document.organizationId,workspaceId:input.document.workspaceId,ordinal,content,tokenEstimate:tokenEstimate(content),checksum:sha(content),heading:content.split('\n')[0]?.slice(0,180),metadata:{documentTitle:input.document.title,documentVersion:input.document.version}}));
 }
}

export class OrbyKnowledgeEngine {
 constructor(private readonly repository:OrbyIntelligenceRepository,private readonly embeddings:OrbyEmbeddingService,private readonly extractors=new ExtractorRegistry().register(new NativeTextExtractor()),private readonly chunker=new OrbyDocumentChunker()){}
 registerExtractor(extractor:OrbyDocumentTextExtractor){this.extractors.register(extractor);return this;}
 createSource(input:{identity:OrbyIdentity;name:string;type:OrbyKnowledgeSource['type'];citationLabel?:string;trustLevel?:OrbyKnowledgeSource['trustLevel'];metadata?:OrbyJsonObject}){
  const name=input.name.trim();if(!name)throw new Error('ORBY_KNOWLEDGE_SOURCE_NAME_REQUIRED');
  return this.repository.createKnowledgeSource({organizationId:input.identity.organizationId,workspaceId:input.identity.workspaceId,name,type:input.type,status:'pending',citationLabel:input.citationLabel?.trim()||name,trustLevel:input.trustLevel||'internal',metadata:input.metadata||{},version:1,createdBy:input.identity.userId});
 }
 async importDocument(input:{identity:OrbyIdentity;sourceId:string;title:string;mimeType:string;text?:string;bytes?:Uint8Array;externalId?:string;metadata?:OrbyJsonObject;signal?:AbortSignal}){
  const source=await this.repository.getKnowledgeSource(input.sourceId,input.identity);if(!source)throw new Error('ORBY_KNOWLEDGE_SOURCE_NOT_FOUND');
  await this.repository.updateKnowledgeSource(source.id,{status:'processing',lastError:undefined});
  try{
   const extractor=this.extractors.resolve(input.mimeType),extracted=await extractor.extract({bytes:input.bytes,text:input.text,mimeType:input.mimeType,fileName:input.title,signal:input.signal});
   const content=normalizedText(extracted.text),document=await this.repository.createKnowledgeDocument({sourceId:source.id,organizationId:input.identity.organizationId,workspaceId:input.identity.workspaceId,externalId:input.externalId,title:input.title.trim(),mimeType:input.mimeType,checksum:sha(input.bytes||content),language:extracted.language,status:'chunking',metadata:{...(input.metadata||{}),...(extracted.metadata||{})},version:1,extractedAt:now()},content);
   const chunks=await this.repository.replaceKnowledgeChunks(document.id,this.chunker.chunk({document,text:content}));if(!chunks.length)throw new Error('ORBY_DOCUMENT_NO_CHUNKS');
   await this.repository.updateKnowledgeDocument(document.id,{status:'embedding'});
   for(let index=0;index<chunks.length;index+=32){const batch=chunks.slice(index,index+32),vectors=await this.embeddings.embed(batch.map(chunk=>chunk.content),input.signal);if(vectors.length!==batch.length)throw new Error('ORBY_EMBEDDING_COUNT_MISMATCH');await this.repository.saveChunkEmbeddings({chunks:batch,vectors,model:this.embeddings.model});}
   const indexedAt=now();await Promise.all([this.repository.updateKnowledgeDocument(document.id,{status:'ready',indexedAt}),this.repository.updateKnowledgeSource(source.id,{status:'ready',lastIndexedAt:indexedAt,lastError:undefined})]);
   return {...document,status:'ready' as const,indexedAt};
  }catch(error){const message=error instanceof Error?error.message:'ORBY_KNOWLEDGE_IMPORT_FAILED';await this.repository.updateKnowledgeSource(source.id,{status:'failed',lastError:message});throw error;}
 }
 async reindex(input:{identity:OrbyIdentity;documentId:string;signal?:AbortSignal}){
  const document=await this.repository.getKnowledgeDocument(input.documentId,input.identity);if(!document)throw new Error('ORBY_KNOWLEDGE_DOCUMENT_NOT_FOUND');
  const text=await this.repository.getDocumentRawText(document.id);if(!text)throw new Error('ORBY_KNOWLEDGE_RAW_TEXT_MISSING');
  await this.repository.updateKnowledgeDocument(document.id,{status:'chunking',lastError:undefined});
  try{const chunks=await this.repository.replaceKnowledgeChunks(document.id,this.chunker.chunk({document,text}));if(!chunks.length)throw new Error('ORBY_DOCUMENT_NO_CHUNKS');await this.repository.updateKnowledgeDocument(document.id,{status:'embedding'});for(let index=0;index<chunks.length;index+=32){const batch=chunks.slice(index,index+32),vectors=await this.embeddings.embed(batch.map(chunk=>chunk.content),input.signal);await this.repository.saveChunkEmbeddings({chunks:batch,vectors,model:this.embeddings.model});}const indexedAt=now();await Promise.all([this.repository.updateKnowledgeDocument(document.id,{status:'ready',indexedAt}),this.repository.updateKnowledgeSource(document.sourceId,{status:'ready',lastIndexedAt:indexedAt,lastError:undefined})]);return chunks.length;}catch(error){const message=error instanceof Error?error.message:'ORBY_KNOWLEDGE_REINDEX_FAILED';await this.repository.updateKnowledgeDocument(document.id,{status:'failed',lastError:message});throw error;}
 }
 async search(input:{identity:OrbyIdentity;query:string;limit?:number;minimumScore?:number;sourceIds?:readonly string[];signal?:AbortSignal}):Promise<readonly OrbyRetrievedKnowledge[]>{const query=input.query.trim();if(!query)return [];const [vector]=await this.embeddings.embed([query],input.signal);if(!vector)throw new Error('ORBY_QUERY_EMBEDDING_MISSING');return this.repository.searchKnowledge({identity:input.identity,vector,limit:Math.min(20,Math.max(1,input.limit||8)),minimumScore:input.minimumScore??.55,sourceIds:input.sourceIds});}
}

export class OrbyKnowledgeContextBuilder {
 build(query:string,results:readonly OrbyRetrievedKnowledge[],maxCharacters=12000):OrbyRagContext{let used=0,truncated=false;const included:OrbyRetrievedKnowledge[]=[];for(const result of results){const addition=result.chunk.content.length+120;if(used+addition>maxCharacters){truncated=true;continue;}included.push(result);used+=addition;}const text=included.map((result,index)=>`[S${index+1}] ${result.citation.title}\n${result.chunk.content}`).join('\n\n');return {query,text,citations:included.map((result,index)=>({...result.citation,label:`S${index+1}`})),characterCount:text.length,truncated};}
}

export class OrbyKnowledgeContextSource {
 readonly key='orby.knowledge';readonly priority=92;
 constructor(private readonly knowledge:OrbyKnowledgeEngine,private readonly builder=new OrbyKnowledgeContextBuilder()){}
 async load(request:OrbyContextRequest):Promise<OrbyContextSegment|null>{const results=await this.knowledge.search({identity:request.identity,query:request.message,limit:8,minimumScore:.58,signal:request.signal});if(!results.length)return null;const context=this.builder.build(request.message,results,10000);return {key:this.key,title:'معرفة المؤسسة المسترجعة',priority:this.priority,trusted:false,sensitive:true,content:`استخدم المقاطع التالية فقط عند صلتها بالسؤال. كل معلومة مأخوذة منها يجب أن تحمل استشهادًا بصيغة [S1] أو [S2]. لا تخترع مصدرًا.\n\n${context.text}`,metadata:{citations:context.citations as unknown as OrbyJsonObject,requiresCitations:true,truncated:context.truncated}};}
}
