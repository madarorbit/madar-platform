import type {CreateOrbyFoundationOptions} from './index';
import {createOrbyFoundation} from './index';
import {providersFromEnvironment} from './providers';
import {SupabaseOrbyConfigurationStore,SupabaseOrbySessionStore,loadSupabaseOrbyModels} from './adapters/supabase';
import {IntegrationDatabase} from '@/src/lib/integration/platform';
import {createEmbeddingService} from './intelligence/embedding';
import {OrbyKnowledgeContextSource,OrbyKnowledgeEngine} from './intelligence/knowledge';
import {IntelligenceAwareSessionStore,OrbyMemoryContextSource,OrbyMemoryEngine} from './intelligence/memory';
import {SupabaseOrbyIntelligenceRepository} from './intelligence/adapters/supabase';

export * from './index';
export * from './adapters/supabase';

type CreateServerOrbyFoundationOptions=Omit<CreateOrbyFoundationOptions,'providers'|'models'|'sessionStore'|'configurationStore'>&{database?:IntegrationDatabase};
export async function createServerOrbyFoundation(options:CreateServerOrbyFoundationOptions={}){
 const{database,...foundationOptions}=options,providers=providersFromEnvironment(),models=await loadSupabaseOrbyModels(database),repositoryDatabase=database||new IntegrationDatabase(),repository=new SupabaseOrbyIntelligenceRepository(repositoryDatabase),baseSessions=new SupabaseOrbySessionStore(database);
 const memory=new OrbyMemoryEngine(repository),contextSources=[...(foundationOptions.contextSources||[]),new OrbyMemoryContextSource(memory)];
 const embeddings=createEmbeddingService(providers,models),knowledge=new OrbyKnowledgeEngine(repository,embeddings);contextSources.push(new OrbyKnowledgeContextSource(knowledge));
 return createOrbyFoundation({...foundationOptions,contextSources,providers,models,sessionStore:new IntelligenceAwareSessionStore(baseSessions,repository),configurationStore:new SupabaseOrbyConfigurationStore(database)});
}
