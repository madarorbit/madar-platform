import type {OrbyExecutionConfiguration,OrbyExecutionEventBus,OrbyExecutionRepository,OrbyWorkflowRun} from './contracts';
import {OrbyActionEngine} from './action-engine';

export class OrbyRollbackEngine {
 constructor(private readonly repository:OrbyExecutionRepository,private readonly actions:OrbyActionEngine,private readonly events:OrbyExecutionEventBus){}
 async rollback(run:OrbyWorkflowRun,configuration:OrbyExecutionConfiguration,signal?:AbortSignal){const completed=(await this.repository.actions(run.id)).filter(action=>action.status==='completed'&&action.compensation).reverse();if(!completed.length)return{compensated:0,failed:0};await this.events.emit('rollback.started',{runId:run.id,actions:completed.length});let compensated=0,failed=0;for(const action of completed)try{if(await this.actions.compensate({run,action,configuration,signal}))compensated++;}catch{failed++;}await this.repository.appendAudit({runId:run.id,organizationId:run.organizationId,actorId:run.userId,eventType:'rollback.completed',outcome:failed?'partial':'completed',metadata:{compensated,failed}});await this.events.emit('rollback.completed',{runId:run.id,compensated,failed});return{compensated,failed};}
}
