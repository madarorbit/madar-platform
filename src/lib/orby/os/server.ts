import 'server-only';
import {IntegrationDatabase} from '@/src/lib/integration/platform';
import {OrbyEvaluationEngine} from './operations';
import {orbyOsBenchmarkSuite} from './benchmark';
import {SupabaseOrbyOsRepository} from './repository';
import {OrbyOsWorkflowService} from './workflow-service';

let singleton:ReturnType<typeof build>|undefined;
async function build(){const database=new IntegrationDatabase(),repository=new SupabaseOrbyOsRepository(database),workflows=new OrbyOsWorkflowService(repository),evaluations=new OrbyEvaluationEngine();return{database,repository,workflows,evaluations,benchmark:orbyOsBenchmarkSuite()};}
export function createServerOrbyOs(){if(!singleton)singleton=build();return singleton;}
export * from './index';
export * from './repository';
export * from './workflow-service';
