import {ConnectionManager} from './connection-manager';
import {diagnosticConnector} from './connectors/diagnostic';
import {CheckpointStore,FeatureFlagService,IntegrationDatabase,IntegrationQueue,RawBatchStore,SecretsManager} from './platform';
import {ConnectorRegistry} from './registry';
import {SyncEngine} from './sync-engine';

export function createIntegrationRuntime(){
 const database=new IntegrationDatabase();
 const registry=new ConnectorRegistry([diagnosticConnector]);
 const secrets=new SecretsManager();
 const flags=new FeatureFlagService(database);
 const queue=new IntegrationQueue(database);
 const checkpoints=new CheckpointStore(database);
 const rawBatches=new RawBatchStore(database);
 const connections=new ConnectionManager(database,registry,secrets,queue,flags);
 const syncEngine=new SyncEngine(database,registry,secrets,queue,checkpoints,rawBatches,flags);
 return {database,registry,secrets,flags,queue,checkpoints,rawBatches,connections,syncEngine};
}

export type IntegrationRuntime=ReturnType<typeof createIntegrationRuntime>;
export * from './contracts';
export * from './errors';
export * from './auth';
export * from './registry';
