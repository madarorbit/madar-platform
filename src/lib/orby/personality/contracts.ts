import type {OrbyJsonObject} from '../core/contracts';

export type OrbySector='commerce'|'food_service'|'hospitality'|'student'|'personal'|'general';
export type OrbyIntent='information'|'analysis'|'report'|'task'|'execution'|'monitoring'|'conversation';
export type OrbyOperationKind='read'|'write'|'monitor';
export type OrbySensitivity='normal'|'sensitive'|'restricted';
export type OrbyResponseStrategy='direct'|'analysis'|'report'|'plan'|'approval_preview'|'insight';
export type OrbyDetailLevel='concise'|'balanced'|'detailed';

export type OrbyUserDialoguePreferences={
 locale?:string;
 currency?:string;
 detailLevel?:OrbyDetailLevel;
 responseLength?:OrbyDetailLevel;
 reportStyle?:'executive'|'operational'|'analytical';
 terminology?:Record<string,string>;
 alertTimes?:readonly string[];
 allowedChannels?:readonly ('in_app'|'push'|'email'|'whatsapp')[];
};

export type OrbyIntentClassification={
 intent:OrbyIntent;
 operation:OrbyOperationKind;
 sector:OrbySector;
 sensitivity:OrbySensitivity;
 confidence:number;
 entities:readonly string[];
 reasons:readonly string[];
};

export type OrbyDialogueInput={
 message:string;
 sector?:OrbySector;
 preferences?:OrbyUserDialoguePreferences;
 hasWorkspaceContext?:boolean;
 hasTargetEntity?:boolean;
 requestedExecution?:boolean;
 metadata?:OrbyJsonObject;
};

export type OrbyDialogueDecision={
 classification:OrbyIntentClassification;
 strategy:OrbyResponseStrategy;
 requiresClarification:boolean;
 clarificationQuestion?:string;
 terminology:Readonly<Record<string,string>>;
 systemPolicies:readonly string[];
 promptVersion:string;
 metadata:OrbyJsonObject;
};

export type OrbyCharacterConstitution={
 version:string;
 productIdentity:string;
 founder:string;
 mission:string;
 shortDefinition:string;
 principles:readonly string[];
 knowledgeBoundaries:readonly string[];
 executionBoundaries:readonly string[];
 warningPattern:readonly string[];
 opportunityPattern:readonly string[];
 recommendationPattern:readonly string[];
};
