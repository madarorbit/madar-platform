import type {OrbyContextSource,OrbyIdentity,OrbyJsonObject,OrbyJsonValue,OrbyMessage} from '../core/contracts';

export type OrbyMemoryKind='conversation_summary'|'short_term'|'long_term'|'preference'|'workspace';
export type OrbyMemorySensitivity='public'|'internal'|'sensitive'|'restricted';
export type OrbyMemorySource='conversation'|'user'|'workspace'|'system'|'import';
export type OrbyMemoryRecord={
 id:string;organizationId:string;userId?:string;workspaceId?:string;sessionId?:string;
 kind:OrbyMemoryKind;key:string;content:string;summary?:string;source:OrbyMemorySource;
 sensitivity:OrbyMemorySensitivity;confidence:number;importance:number;metadata:OrbyJsonObject;
 createdAt:string;updatedAt:string;lastAccessedAt?:string;expiresAt?:string;deletedAt?:string;
};
export type OrbyMemoryPolicy={
 enabled:boolean;allowConversationHistory:boolean;allowSummaries:boolean;allowShortTerm:boolean;
 allowLongTerm:boolean;allowPreferences:boolean;allowWorkspaceMemory:boolean;requireExplicitLongTermConsent:boolean;
 maximumConversationMessages:number;summaryTriggerMessages:number;shortTermTtlSeconds:number;
 longTermTtlSeconds?:number;workspaceTtlSeconds?:number;maximumMemoriesPerScope:number;
 blockedKeys:readonly string[];blockedPatterns:readonly string[];allowedSensitivities:readonly OrbyMemorySensitivity[];
};
export type OrbyUserPreferences={
 locale?:string;timezone?:string;responseStyle?:'concise'|'balanced'|'detailed';
 notificationChannels?:readonly OrbyDeliveryChannel[];quietHours?:{start:string;end:string;timezone:string};
 digestFrequency?:'off'|'daily'|'weekly'|'daily_and_weekly';metadata?:OrbyJsonObject;
};
export type OrbyConversationWindow={messages:readonly OrbyMessage[];summary?:string;characterCount:number;truncated:boolean};

export type OrbyKnowledgeSourceType='upload'|'workspace_file'|'integration'|'manual'|'url'|'database';
export type OrbyKnowledgeSource={
 id:string;organizationId:string;workspaceId?:string;name:string;type:OrbyKnowledgeSourceType;
 status:'pending'|'processing'|'ready'|'failed'|'archived';citationLabel:string;
 trustLevel:'verified'|'internal'|'unverified';metadata:OrbyJsonObject;version:number;
 createdBy?:string;createdAt:string;updatedAt:string;lastIndexedAt?:string;lastError?:string;
};
export type OrbyKnowledgeDocument={
 id:string;sourceId:string;organizationId:string;workspaceId?:string;externalId?:string;
 title:string;mimeType:string;checksum:string;language?:string;status:'pending'|'extracting'|'chunking'|'embedding'|'ready'|'failed'|'archived';
 metadata:OrbyJsonObject;version:number;createdAt:string;updatedAt:string;extractedAt?:string;indexedAt?:string;lastError?:string;
};
export type OrbyKnowledgeChunk={
 id:string;documentId:string;sourceId:string;organizationId:string;workspaceId?:string;
 ordinal:number;content:string;tokenEstimate:number;checksum:string;heading?:string;
 metadata:OrbyJsonObject;embeddingModel?:string;embeddingDimensions?:number;createdAt:string;
};
export type OrbyCitation={
 id:string;sourceId:string;documentId:string;chunkId:string;label:string;title:string;
 excerpt:string;score:number;metadata:OrbyJsonObject;
};
export type OrbyRetrievedKnowledge={chunk:OrbyKnowledgeChunk;citation:OrbyCitation;score:number};
export type OrbyRagContext={query:string;text:string;citations:readonly OrbyCitation[];characterCount:number;truncated:boolean};

export type OrbyIntelligenceEvent={
 id:string;organizationId:string;workspaceId?:string;type:string;priority:number;
 payload:OrbyJsonObject;deduplicationKey?:string;occurredAt:string;availableAt:string;processedAt?:string;
};
export type OrbyJobType='knowledge.extract'|'knowledge.embed'|'memory.summarize'|'detector.run'|'report.generate'|'notification.deliver'|'retention.cleanup';
export type OrbyJobStatus='queued'|'running'|'retry'|'succeeded'|'dead'|'cancelled';
export type OrbyIntelligenceJob={
 id:string;organizationId:string;workspaceId?:string;type:OrbyJobType;status:OrbyJobStatus;
 payload:OrbyJsonObject;priority:number;availableAt:string;attempts:number;maxAttempts:number;
 idempotencyKey?:string;lockedBy?:string;leaseExpiresAt?:string;lastErrorCode?:string;lastErrorMessage?:string;
 createdAt:string;updatedAt:string;
};
export type OrbySchedule={
 id:string;organizationId:string;workspaceId?:string;jobType:OrbyJobType;cronExpression?:string;
 intervalSeconds?:number;payload:OrbyJsonObject;enabled:boolean;nextRunAt:string;lastRunAt?:string;
 timezone:string;createdAt:string;updatedAt:string;
};

export type OrbyDetectorKey='sales_drop'|'revenue'|'customer_churn'|'inventory'|'payment'|'support'|'traffic'|'system_health';
export type OrbyDetectorInput={identity:OrbyIdentity;windowStart:string;windowEnd:string;now:string;configuration:OrbyJsonObject};
export type OrbyDetectorSignal={
 detector:OrbyDetectorKey;organizationId:string;workspaceId?:string;fingerprint:string;
 title:string;description:string;category:'anomaly'|'opportunity'|'risk'|'trend';
 severity:'info'|'low'|'medium'|'high'|'critical';metrics:OrbyJsonObject;evidence:readonly OrbyCitation[];
 confidence:number;riskScore:number;opportunityScore:number;rootCauses:readonly string[];
 recommendations:readonly string[];suggestedActions:readonly OrbySuggestedAction[];detectedAt:string;
};
export type OrbySuggestedAction={
 id:string;title:string;description:string;toolName?:string;input?:OrbyJsonObject;
 riskLevel:'low'|'medium'|'high'|'critical';requiresApproval:true;
};
export type OrbyInsight={
 id:string;organizationId:string;workspaceId?:string;detector:OrbyDetectorKey;fingerprint:string;
 status:'open'|'acknowledged'|'dismissed'|'resolved';title:string;description:string;
 category:OrbyDetectorSignal['category'];severity:OrbyDetectorSignal['severity'];
 confidence:number;riskScore:number;opportunityScore:number;metrics:OrbyJsonObject;
 evidence:readonly OrbyCitation[];rootCauses:readonly string[];recommendations:readonly string[];
 suggestedActions:readonly OrbySuggestedAction[];draftWorkflow?:OrbyJsonObject;cooldownUntil?:string;
 firstDetectedAt:string;lastDetectedAt:string;occurrences:number;createdAt:string;updatedAt:string;
};
export type OrbyDeliveryChannel='in_app'|'email'|'push'|'webhook';
export type OrbyNotificationPreference={
 organizationId:string;userId:string;workspaceId?:string;enabled:boolean;
 channels:readonly OrbyDeliveryChannel[];minimumSeverity:OrbyDetectorSignal['severity'];
 quietHours?:{start:string;end:string;timezone:string};digestMode:'immediate'|'daily'|'weekly';
 detectorSettings:Partial<Record<OrbyDetectorKey,boolean>>;cooldownMinutes:number;metadata:OrbyJsonObject;
};
export type OrbyProactiveNotification={
 id:string;organizationId:string;userId?:string;workspaceId?:string;insightId?:string;
 channel:OrbyDeliveryChannel;title:string;body:string;severity:OrbyDetectorSignal['severity'];
 status:'queued'|'sent'|'failed'|'suppressed';deduplicationKey:string;availableAt:string;
 sentAt?:string;metadata:OrbyJsonObject;createdAt:string;
};
export type OrbyReportType='daily'|'weekly'|'monthly'|'executive'|'workspace';
export type OrbyPeriodicReport={
 id:string;organizationId:string;workspaceId?:string;type:OrbyReportType;periodStart:string;periodEnd:string;
 title:string;summary:string;sections:readonly {title:string;content:string;insightIds:readonly string[]}[];
 citations:readonly OrbyCitation[];status:'draft'|'ready'|'delivered'|'failed';createdAt:string;updatedAt:string;
};

export interface OrbyEmbeddingService { readonly model:string;embed(inputs:readonly string[],signal?:AbortSignal):Promise<readonly number[][]>; }
export interface OrbyConversationSummarizer { summarize(input:{messages:readonly OrbyMessage[];previousSummary?:string;maxCharacters:number;signal?:AbortSignal}):Promise<string>; }
export interface OrbyDocumentTextExtractor { supports(mimeType:string):boolean;extract(input:{bytes?:Uint8Array;text?:string;mimeType:string;fileName?:string;signal?:AbortSignal}):Promise<{text:string;language?:string;metadata?:OrbyJsonObject}>; }
export interface OrbyOcrService { extract(input:{bytes:Uint8Array;mimeType:string;fileName?:string;signal?:AbortSignal}):Promise<{text:string;language?:string;metadata?:OrbyJsonObject}>; }
export interface OrbyNotificationDeliveryAdapter { readonly channel:OrbyDeliveryChannel;deliver(notification:OrbyProactiveNotification,signal?:AbortSignal):Promise<{providerMessageId?:string;metadata?:OrbyJsonObject}>; }
export interface OrbyProactiveDetector { readonly key:OrbyDetectorKey;detect(input:OrbyDetectorInput):Promise<readonly OrbyDetectorSignal[]>; }
export type OrbyIntelligenceContextSource=OrbyContextSource;

export interface OrbyIntelligenceRepository {
 resolveMemoryPolicy(organizationId:string):Promise<OrbyMemoryPolicy>;
 setMemoryPolicy(organizationId:string,actorId:string,policy:OrbyMemoryPolicy):Promise<OrbyMemoryPolicy>;
 saveMemory(memory:OrbyMemoryRecord):Promise<OrbyMemoryRecord>;
 findMemories(input:{identity:OrbyIdentity;kinds?:readonly OrbyMemoryKind[];query?:string;limit:number;now:string}):Promise<readonly OrbyMemoryRecord[]>;
 expireMemories(now:string,limit:number):Promise<number>;
 getPreferences(identity:OrbyIdentity):Promise<OrbyUserPreferences|null>;
 setPreferences(identity:OrbyIdentity,preferences:OrbyUserPreferences):Promise<void>;
 getConversationSummary(sessionId:string):Promise<OrbyMemoryRecord|null>;
 listConversationMessages(sessionId:string,limit:number):Promise<readonly OrbyMessage[]>;

 createKnowledgeSource(source:Omit<OrbyKnowledgeSource,'id'|'createdAt'|'updatedAt'>):Promise<OrbyKnowledgeSource>;
 listKnowledgeSources(identity:OrbyIdentity,limit:number):Promise<readonly OrbyKnowledgeSource[]>;
 updateKnowledgeSource(sourceId:string,patch:Partial<Pick<OrbyKnowledgeSource,'status'|'lastError'|'lastIndexedAt'|'metadata'|'version'>>):Promise<void>;
 getKnowledgeSource(sourceId:string,identity:OrbyIdentity):Promise<OrbyKnowledgeSource|null>;
 createKnowledgeDocument(document:Omit<OrbyKnowledgeDocument,'id'|'createdAt'|'updatedAt'>,rawText?:string):Promise<OrbyKnowledgeDocument>;
 getKnowledgeDocument(documentId:string,identity:OrbyIdentity):Promise<OrbyKnowledgeDocument|null>;
 listKnowledgeDocuments(input:{identity:OrbyIdentity;sourceId?:string;limit:number}):Promise<readonly OrbyKnowledgeDocument[]>;
 getDocumentRawText(documentId:string):Promise<string|null>;
 replaceKnowledgeChunks(documentId:string,chunks:readonly Omit<OrbyKnowledgeChunk,'id'|'createdAt'>[]):Promise<readonly OrbyKnowledgeChunk[]>;
 saveChunkEmbeddings(input:{chunks:readonly OrbyKnowledgeChunk[];vectors:readonly number[][];model:string}):Promise<void>;
 searchKnowledge(input:{identity:OrbyIdentity;vector:readonly number[];limit:number;minimumScore:number;sourceIds?:readonly string[]}):Promise<readonly OrbyRetrievedKnowledge[]>;
 updateKnowledgeDocument(documentId:string,patch:Partial<Pick<OrbyKnowledgeDocument,'status'|'lastError'|'extractedAt'|'indexedAt'|'metadata'>>):Promise<void>;

 publishEvent(event:OrbyIntelligenceEvent):Promise<void>;
 enqueue(job:Omit<OrbyIntelligenceJob,'id'|'status'|'attempts'|'createdAt'|'updatedAt'>):Promise<OrbyIntelligenceJob>;
 claimJobs(workerId:string,limit:number,leaseSeconds:number):Promise<readonly OrbyIntelligenceJob[]>;
 completeJob(jobId:string,workerId:string,result?:OrbyJsonObject):Promise<void>;
 failJob(jobId:string,workerId:string,errorCode:string,errorMessage:string,nextAttemptAt?:string):Promise<void>;
 enqueueDueSchedules(limit:number):Promise<number>;
 saveSchedule(schedule:Omit<OrbySchedule,'id'|'createdAt'|'updatedAt'> & {createdBy?:string}):Promise<OrbySchedule>;
 listSchedules(identity:OrbyIdentity,limit:number):Promise<readonly OrbySchedule[]>;
 listDueEvents(limit:number):Promise<readonly OrbyIntelligenceEvent[]>;
 markEventProcessed(eventId:string):Promise<void>;

 upsertInsight(signal:OrbyDetectorSignal,cooldownMinutes:number):Promise<{insight:OrbyInsight;created:boolean;suppressed:boolean}>;
 getInsight(insightId:string,identity:OrbyIdentity):Promise<OrbyInsight|null>;
 saveInsightWorkflow(insightId:string,workflow:OrbyJsonObject):Promise<void>;
 listInsights(input:{identity:OrbyIdentity;status?:OrbyInsight['status'];limit:number}):Promise<readonly OrbyInsight[]>;
 saveNotification(notification:OrbyProactiveNotification):Promise<OrbyProactiveNotification>;
 getNotification(notificationId:string):Promise<OrbyProactiveNotification|null>;
 updateNotification(notificationId:string,patch:Partial<Pick<OrbyProactiveNotification,'status'|'sentAt'|'metadata'>>):Promise<void>;
 getNotificationPreferences(identity:OrbyIdentity):Promise<OrbyNotificationPreference|null>;
 setNotificationPreferences(identity:OrbyIdentity,preference:OrbyNotificationPreference):Promise<void>;
 saveReport(report:Omit<OrbyPeriodicReport,'id'|'createdAt'|'updatedAt'>):Promise<OrbyPeriodicReport>;
 listReports(input:{identity:OrbyIdentity;type?:OrbyReportType;limit:number}):Promise<readonly OrbyPeriodicReport[]>;
}

export function asJsonObject(value:unknown):OrbyJsonObject{return value&&typeof value==='object'&&!Array.isArray(value)?value as OrbyJsonObject:{};}
export function asJsonValue(value:unknown):OrbyJsonValue{return value as OrbyJsonValue;}
