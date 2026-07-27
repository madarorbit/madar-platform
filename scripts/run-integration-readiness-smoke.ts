import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import type {Connector,ConnectorBatch,ConnectorCheckpoint,ConnectorContext,ConnectorLogger,JsonObject} from '../src/lib/integration/contracts';
import {referenceApiKey,referenceCommerceConnector,referenceConnectorConfig} from '../src/lib/integration/connectors/reference-commerce';
import {assertReadOnlySql,csvExcelTestConnector,databaseReadOnlyTestConnector,localBridgeTestConnector,oauthTestConnector,readinessTechnicalConnectors,restTestConnector,webhookTestConnector} from '../src/lib/integration/connectors/readiness-technical';
import {historicalLabData,LAB_STREAMS} from '../src/lib/integration/lab/fixtures';
import {SecretsManager} from '../src/lib/integration/platform';
import {ConnectorRegistry} from '../src/lib/integration/registry';
import {identityParts,inferEntityType,validateAndNormalize} from '../src/lib/integration/udm';

const logger:ConnectorLogger={debug(){},info(){},warn(){},error(){}};
type CheckpointMap=Record<string,ConnectorCheckpoint|undefined>;
type Check={key:string;status:'passed';details:JsonObject};

function context(connector:Connector,input:{organizationId?:string;connectionId?:string;config?:JsonObject;secret?:JsonObject;authScheme?:ConnectorContext['authScheme'];checkpoints?:CheckpointMap}={}):ConnectorContext{
 const validation=connector.validateConfig(input.config||{});
 assert.equal(validation.valid,true,`${connector.manifest.key} config must validate`);
 if(!validation.valid)throw new Error('unreachable');
 return {connection:{id:input.connectionId||randomUUID(),organizationId:input.organizationId||randomUUID(),connectorKey:connector.manifest.key,connectorVersion:connector.manifest.version,name:`Smoke ${connector.manifest.displayName}`,status:'active',mode:'READ_ONLY',config:validation.normalizedConfig},authScheme:input.authScheme||connector.manifest.authSchemes[0]||'none',secret:input.secret||{},checkpoints:input.checkpoints||{},signal:new AbortController().signal,logger};
}

async function consume(connector:Connector,mode:'initial'|'incremental',ctx:ConnectorContext,streams?:string[]){
 const checkpoints={...(ctx.checkpoints as CheckpointMap)},batches:ConnectorBatch[]=[];let error:unknown=null,records=0;
 try{
  const iterator=mode==='initial'?connector.initialSync(ctx,{streams}):connector.incrementalSync(ctx,{streams});
  for await(const batch of iterator){batches.push(batch);records+=batch.records.length;const previous=checkpoints[batch.streamKey];checkpoints[batch.streamKey]={streamKey:batch.streamKey,cursor:batch.nextCursor,watermark:batch.watermark,version:(previous?.version||0)+1};}
 }catch(caught){error=caught;}
 return {checkpoints,batches,records,error};
}

async function main(){
 const checks:Check[]=[];
 async function check(key:string,operation:()=>Promise<JsonObject>|JsonObject){const details=await operation();checks.push({key,status:'passed',details});}

 await check('workspace-isolation',async()=>{
  const first=context(referenceCommerceConnector,{organizationId:'00000000-0000-0000-0000-000000000101',connectionId:'00000000-0000-0000-0000-000000000201',authScheme:'api_key',secret:referenceApiKey(),config:referenceConnectorConfig({includeDuplicates:false,includeInvalid:false,includeMissing:false})});
  const second=context(referenceCommerceConnector,{organizationId:'00000000-0000-0000-0000-000000000102',connectionId:'00000000-0000-0000-0000-000000000202',authScheme:'api_key',secret:referenceApiKey(),config:referenceConnectorConfig({includeDuplicates:false,includeInvalid:false,includeMissing:false})});
  const [a,b]=await Promise.all([consume(referenceCommerceConnector,'initial',first,['products']),consume(referenceCommerceConnector,'initial',second,['products'])]);
  assert.notEqual(first.connection.organizationId,second.connection.organizationId);assert.notEqual(first.connection.id,second.connection.id);assert.equal(a.records,b.records);
  return {firstConnection:first.connection.id,secondConnection:second.connection.id,recordsPerWorkspace:a.records};
 });

 await check('secret-encryption',()=>{
  const manager=new SecretsManager({masterKey:`base64:${Buffer.alloc(32,7).toString('base64')}`,keyVersion:9}),secret=referenceApiKey(3),encrypted=manager.encrypt(secret),serialized=JSON.stringify(encrypted),decrypted=manager.decrypt(encrypted);
  assert.equal(serialized.includes(String(secret.value)),false);assert.equal(decrypted.value,secret.value);
  return {algorithm:encrypted.algorithm,keyVersion:encrypted.keyVersion,plaintextExposed:false};
 });

 await check('historical-sync',async()=>{
  const result=await consume(referenceCommerceConnector,'initial',context(referenceCommerceConnector,{authScheme:'api_key',secret:referenceApiKey(),config:referenceConnectorConfig()}));
  assert.equal(result.error,null);assert.ok(result.records>20);assert.equal(new Set(result.batches.map(batch=>batch.streamKey)).size,LAB_STREAMS.length);
  return {records:result.records,batches:result.batches.length,streams:LAB_STREAMS.length};
 });

 await check('incremental-only',async()=>{
  const base=context(referenceCommerceConnector,{authScheme:'api_key',secret:referenceApiKey(),config:referenceConnectorConfig({includeDuplicates:false,includeInvalid:false,includeMissing:false})}),first=await consume(referenceCommerceConnector,'incremental',base),second=await consume(referenceCommerceConnector,'incremental',context(referenceCommerceConnector,{authScheme:'api_key',secret:referenceApiKey(),config:base.connection.config,checkpoints:first.checkpoints}));
  assert.equal(first.error,null);assert.ok(first.records>0);assert.equal(second.error,null);assert.equal(second.records,0);
  return {firstIncrement:first.records,secondIncrement:second.records,checkpointStreams:Object.keys(first.checkpoints).length};
 });

 await check('resume-after-failure',async()=>{
  const brokenConfig=referenceConnectorConfig({pageSize:2,failureStream:'products',failAfterBatch:1,includeDuplicates:false,includeInvalid:false,includeMissing:false}),first=await consume(referenceCommerceConnector,'initial',context(referenceCommerceConnector,{authScheme:'api_key',secret:referenceApiKey(),config:brokenConfig}),['products']);
  assert.ok(first.error);assert.equal(first.records,2);
  const healthyConfig=referenceConnectorConfig({pageSize:2,includeDuplicates:false,includeInvalid:false,includeMissing:false}),second=await consume(referenceCommerceConnector,'initial',context(referenceCommerceConnector,{authScheme:'api_key',secret:referenceApiKey(),config:healthyConfig,checkpoints:first.checkpoints}),['products']),ids=[...first.batches,...second.batches].flatMap(batch=>batch.records.map(record=>String(record.external_id))),expected=historicalLabData({includeDuplicates:false,includeInvalid:false,includeMissing:false}).products.length;
  assert.equal(second.error,null);assert.equal(ids.length,expected);assert.equal(new Set(ids).size,expected);
  return {firstRecords:first.records,resumedRecords:second.records,totalUnique:new Set(ids).size};
 });

 await check('deduplication',()=>{
  const keys=historicalLabData({includeDuplicates:true,includeInvalid:false,includeMissing:false}).products.map(record=>identityParts('product',validateAndNormalize('product',record).canonical)?.naturalKey).filter((value):value is string=>Boolean(value)),duplicates=keys.length-new Set(keys).size;
  assert.ok(duplicates>=1);return {records:keys.length,duplicateIdentities:duplicates};
 });

 await check('udm-quality-isolation',()=>{
  const data=historicalLabData(),accepted:JsonObject[]=[],rejected:JsonObject[]=[];
  for(const stream of LAB_STREAMS)for(const record of data[stream]){const entity=inferEntityType(stream,record);if(!entity){rejected.push(record);continue;}const normalized=validateAndNormalize(entity,record);(normalized.errors.length?rejected:accepted).push(normalized.canonical);}
  assert.ok(accepted.length>0);assert.ok(rejected.length>=2);return {accepted:accepted.length,rejected:rejected.length,total:accepted.length+rejected.length};
 });

 await check('technical-rest-webhook',async()=>{
  const rest=context(restTestConnector,{authScheme:'api_key',secret:{name:'x-api-key',value:'rest-lab',placement:'header'},config:{baseUrl:'mock://madar-commerce'}}),webhook=context(webhookTestConnector,{authScheme:'custom',secret:{signingSecret:'webhook-secret'}}),[restTest,webhookTest]=await Promise.all([restTestConnector.testConnection(rest),webhookTestConnector.testConnection(webhook)]),[restSync,webhookSync]=await Promise.all([consume(restTestConnector,'initial',rest,['rest.products']),consume(webhookTestConnector,'initial',webhook,['webhook.events'])]);
  assert.equal(restTest.ok,true);assert.equal(webhookTest.ok,true);assert.ok(restSync.records>0);assert.ok(webhookSync.records>0);
  return {restRecords:restSync.records,webhookEvents:webhookSync.records};
 });

 await check('technical-csv-excel',async()=>{
  const csv=context(csvExcelTestConnector,{authScheme:'none',config:{format:'csv',entityType:'product'}}),excel=context(csvExcelTestConnector,{authScheme:'none',config:{format:'excel_xml',entityType:'product'}}),[csvTest,excelTest]=await Promise.all([csvExcelTestConnector.testConnection(csv),csvExcelTestConnector.testConnection(excel)]),[csvSync,excelSync]=await Promise.all([consume(csvExcelTestConnector,'initial',csv,['file.rows']),consume(csvExcelTestConnector,'initial',excel,['file.rows'])]);
  assert.equal(csvTest.ok,true);assert.equal(excelTest.ok,true);assert.ok(csvSync.records>=2);assert.ok(excelSync.records>=1);
  return {csvRows:csvSync.records,excelRows:excelSync.records,formulasExecuted:false};
 });

 await check('technical-database-readonly',async()=>{
  let rejected=false;try{assertReadOnlySql('update customers set name=\'x\'');}catch{rejected=true;}assert.equal(rejected,true);assert.match(assertReadOnlySql('select * from customers'),/^select/i);
  const database=context(databaseReadOnlyTestConnector,{authScheme:'database',secret:{engine:'postgres',host:'localhost',port:5432,database:'lab',username:'readonly',password:'hidden',ssl:true},config:{query:'select * from madar_lab_products'}}),test=await databaseReadOnlyTestConnector.testConnection(database),sync=await consume(databaseReadOnlyTestConnector,'initial',database,['database.rows']);
  assert.equal(test.ok,true);assert.ok(sync.records>0);return {selectScope:test.grantedScopes?.[0]||null,records:sync.records,mutationRejected:rejected};
 });

 await check('technical-local-bridge-resume',async()=>{
  const broken=context(localBridgeTestConnector,{authScheme:'custom',secret:{bridgeToken:'bridge-token'},config:{pageSize:1,disconnectAfterBatch:1}}),first=await consume(localBridgeTestConnector,'initial',broken,['bridge.events']);assert.ok(first.error);assert.equal(first.records,1);
  const healthy=context(localBridgeTestConnector,{authScheme:'custom',secret:{bridgeToken:'bridge-token'},config:{pageSize:1,disconnectAfterBatch:null},checkpoints:first.checkpoints}),second=await consume(localBridgeTestConnector,'initial',healthy,['bridge.events']);assert.equal(second.error,null);assert.ok(second.records>=1);
  return {beforeDisconnect:first.records,afterResume:second.records};
 });

 await check('key-and-oauth-expiry',async()=>{
  let oldKeyRejected=false;try{await referenceCommerceConnector.testConnection(context(referenceCommerceConnector,{authScheme:'api_key',secret:referenceApiKey(1),config:referenceConnectorConfig({expectedKeyVersion:2})}));}catch{oldKeyRejected=true;}
  const rotated=await referenceCommerceConnector.testConnection(context(referenceCommerceConnector,{authScheme:'api_key',secret:referenceApiKey(2),config:referenceConnectorConfig({expectedKeyVersion:2})}));
  const oauthRefresh=await oauthTestConnector.testConnection(context(oauthTestConnector,{authScheme:'oauth2',secret:{accessToken:'expired',refreshToken:'refresh-token',expiresAt:'2020-01-01T00:00:00.000Z'}}));
  let oauthWithoutRefreshRejected=false;try{await oauthTestConnector.testConnection(context(oauthTestConnector,{authScheme:'oauth2',secret:{accessToken:'expired',expiresAt:'2020-01-01T00:00:00.000Z'}}));}catch{oauthWithoutRefreshRejected=true;}
  assert.equal(oldKeyRejected,true);assert.equal(rotated.ok,true);assert.equal(oauthRefresh.ok,true);assert.equal(oauthWithoutRefreshRejected,true);
  return {oldKeyRejected,rotatedKeyAccepted:rotated.ok,oauthRefreshAccepted:oauthRefresh.ok,oauthWithoutRefreshRejected};
 });

 await check('connection-observability',async()=>{
  const result=await referenceCommerceConnector.testConnection(context(referenceCommerceConnector,{authScheme:'api_key',secret:referenceApiKey(),config:referenceConnectorConfig({latencyMs:1})}));assert.equal(result.ok,true);assert.ok(result.accountLabel);
  return {status:'active',lastSyncAt:new Date().toISOString(),latencyMs:result.latencyMs,accountLabel:result.accountLabel||null};
 });

 await check('read-only-and-extensibility',()=>{
  const connectors=[referenceCommerceConnector,...readinessTechnicalConnectors],registry=new ConnectorRegistry();for(const connector of connectors){assert.equal(connector.manifest.capabilities.read,true);assert.equal(connector.manifest.capabilities.write,false);registry.register(connector);}assert.equal(registry.list({includeInternal:true}).length,connectors.length);assert.equal(registry.has('madar-reference-commerce','1.0.0'),true);
  return {connectors:connectors.length,allReadOnly:true,registeredWithoutCoreChange:true};
 });

 const report={suite:'MRL-SMOKE-1.0.0',status:'passed',total:checks.length,passed:checks.length,failed:0,checks};
 console.log(JSON.stringify(report,null,2));
}

main().catch(error=>{console.error(error);process.exitCode=1;});
