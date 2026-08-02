import {ConnectionManager} from './connection-manager';
import {diagnosticConnector} from './connectors/diagnostic';
import {referenceCommerceConnector} from './connectors/reference-commerce';
import {readinessTechnicalConnectors} from './connectors/readiness-technical';
import {genericRestConnector} from './connectors/generic-rest';
import {publicChannelConnectors} from './connectors/inbound-channels';
import {DataPipelineEngine} from './pipeline';
import {CheckpointStore,FeatureFlagService,IntegrationDatabase,IntegrationQueue,RawBatchStore,SecretsManager} from './platform';
import {ConnectorRegistry} from './registry';
import {SyncEngine} from './sync-engine';
import {IntegrationWriteEngine} from './write-engine';

export function createIntegrationRuntime(){
 const database=new IntegrationDatabase();
 const registry=new ConnectorRegistry([diagnosticConnector]);
 registry.register(referenceCommerceConnector);for(const connector of readinessTechnicalConnectors)registry.register(connector);
 registry.register(genericRestConnector);for(const connector of publicChannelConnectors)registry.register(connector);
 const secrets=new SecretsManager();
 const flags=new FeatureFlagService(database);
 const queue=new IntegrationQueue(database);
 const checkpoints=new CheckpointStore(database);
 const rawBatches=new RawBatchStore(database);
 const pipeline=new DataPipelineEngine(database,queue,flags);
 const connections=new ConnectionManager(database,registry,secrets,queue,flags);
 const syncEngine=new SyncEngine(database,registry,secrets,queue,checkpoints,rawBatches,flags,pipeline);
 const writeEngine=new IntegrationWriteEngine(database,registry,secrets,flags);
 return {database,registry,secrets,flags,queue,checkpoints,rawBatches,pipeline,connections,syncEngine,writeEngine};
}

export type IntegrationRuntime=ReturnType<typeof createIntegrationRuntime>;
export * from './contracts';
export * from './errors';
export * from './auth';
export * from './registry';
export * from './udm';
export * from './lab/readiness-runner';
