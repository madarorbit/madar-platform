export type Severity = 'critical'|'warning'|'info'|'success';
export type SourceOfTruth = 'MADAR'|'EXTERNAL';
export type VerticalExtension = 'commerce'|'food_service'|'hospitality';
export type PlanLevel = 'BASIC'|'PREMIUM'|'FULL';
export type MobileActionType = 'TASK_STATUS_UPDATE'|'KITCHEN_TICKET_STATUS'|'HOUSEKEEPING_STATUS';
export type MobileActionStatus = 'PREVIEWED'|'QUEUED'|'EXECUTED'|'REJECTED'|'EXPIRED'|'CONFLICT'|'FAILED'|string;

export type DashboardAlert={id:string;severity:Severity;title:string;body:string;generatedAt:string};
export type DashboardTask={id:string;title:string;priority:string;status:string;dueAt:string|null};
export type RecentSale={id:string;total:number;soldAt:string};
export type DailyPoint={date:string;label:string;revenue:number;expenses:number};
export type WorkspaceChoice={id:string;name:string;role:string};
export type ActionCapability={key:MobileActionType;label:string;statuses:string[];sourceOfTruth:SourceOfTruth};
export type ConnectionHealth={id:string;name:string;status:string;connection_mode:string;last_success_at:string|null;last_error_code:string|null;updated_at:string};

export type SectorOperation={
 id:string;status:string;ticket_number?:string;priority?:string;opened_at?:string;task_type?:string;service_date?:string;notes?:string|null;
 restaurant_orders?:{order_number?:string;service_mode?:string}|Array<{order_number?:string;service_mode?:string}>;
 hotel_rooms?:{room_number?:string}|Array<{room_number?:string}>;
};

export type MobileAction={
 id:string;action_type:MobileActionType;entity_type:string;entity_id:string;source_of_truth:SourceOfTruth;
 preview:{title?:string;before?:{status?:string};after?:{status?:string};requires_confirmation?:boolean};
 result?:Record<string,unknown>|null;status:MobileActionStatus;effective_status:MobileActionStatus;error_code?:string|null;external_error_code?:string|null;
 expires_at:string;confirmed_at?:string|null;completed_at?:string|null;created_at:string;updated_at:string;
};

export type DashboardSnapshot={
 profile:{id:string;fullName:string|null;email:string|null;avatarUrl:string|null};
 workspace:{id:string;name:string;type:string;status:string;currency:'YER'|'SAR'|'USD';role:string;operatingMode:'MADAR_NATIVE'|'CONNECTED_EXTERNAL';sourceOfTruth:SourceOfTruth;setupStatus:string};
 availableWorkspaces:WorkspaceChoice[];
 vertical:{code:string;name:string;extension:VerticalExtension};
 subscriptionStatus:'trialing'|'active'|'past_due'|'expired'|'cancelled'|'missing';
 subscription:{level:PlanLevel;termMonths:number;trialEndsAt:string|null;endsAt:string|null;entitlements:Record<string,unknown>};
 permissions:{canManage:boolean;canUseOrby:boolean;canUseWriteTools:boolean;canReverseWrite:boolean;actionCapabilities:ActionCapability[]};
 synchronization:{sourceOfTruth:SourceOfTruth;connections:ConnectionHealth[];writeGrants:Array<{connection_id:string;resource_key:string;constraints:Record<string,unknown>;granted_at:string}>;lastSuccessfulAt:string|null};
 status:'ok'|'attention';
 summary:{products:number;customers:number;revenue30d:number;expenses30d:number;profit30d:number;todayRevenue:number;openTasks:number;lowStock:number;sector:Record<string,unknown>};
 alerts:DashboardAlert[];tasks:DashboardTask[];recentSales:RecentSale[];dailySeries:DailyPoint[];sectorOperations:SectorOperation[];recentActions:MobileAction[];fetchedAt:string;
};

export type OrbyMode='ASK'|'ANALYZE'|'PLAN'|'REPORT'|'ACTION'|'MONITOR';
export type OrbyCitation={id:string;label:string;source:string;href:string;observedAt:string;freshness:'live'|'recent'|'stale'|'estimated';certainty:'confirmed'|'estimated'};
export type OrbyMessage={id:string;role:'system'|'user'|'assistant'|'tool';content:string;source:'ai'|'smart-fallback'|'tool'|'system';status:'sending'|'streaming'|'completed'|'failed'|'stopped';created_at:string;parent_message_id?:string|null;citations?:OrbyCitation[];operational_steps?:string[]};
export type OrbyConversation={id:string;organization_id?:string;title:string;status:'active'|'archived';last_message_at:string;created_at?:string};
export type OrbyStreamEvent=
 |{type:'stage';stage:string;label:string}
 |{type:'delta';text:string}
 |{type:'citations';citations:OrbyCitation[]}
 |{type:'intent';intent:string;operation:string;strategy:string;needsClarification:boolean;clarificationQuestion?:string}
 |{type:'end';conversationId:string;remaining:number;source:'ai'|'smart-fallback'}
 |{type:'error';code:string;message:string;recoverable:boolean};

export type Tab='home'|'reports'|'operations'|'orby'|'account';
