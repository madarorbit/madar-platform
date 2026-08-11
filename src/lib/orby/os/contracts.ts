import type {
  OrbyIdentity,
  OrbyJsonObject,
  OrbyJsonValue,
  OrbyModelDescriptor,
  OrbyProviderCapability,
} from "../core/contracts";
import type {
  OrbyApprovalScope,
  OrbyRiskLevel,
  OrbyToolExecutionType,
  OrbyWorkflowNode,
} from "../execution/contracts";

export type OrbyOsEnvironment = "development" | "preview" | "production";
export type OrbyOsLifecycle =
  | "draft"
  | "testing"
  | "canary"
  | "active"
  | "paused"
  | "deprecated"
  | "archived";
export type OrbyOsScope = {
  organizationId?: string;
  workspaceId?: string;
  userId?: string;
  environment?: OrbyOsEnvironment;
};

export type OrbyWorkflowDefinition = {
  id: string;
  key: string;
  name: string;
  description: string;
  domain: string;
  version: number;
  status: OrbyOsLifecycle;
  root: OrbyWorkflowNode;
  inputSchema: OrbyJsonObject;
  outputSchema: OrbyJsonObject;
  requiredPermissions: readonly string[];
  maxDurationSeconds: number;
  tags: readonly string[];
  createdAt: string;
  updatedAt: string;
  metadata?: OrbyJsonObject;
};
export type OrbyWorkflowTemplate = {
  key: string;
  name: string;
  description: string;
  domain: string;
  definition: OrbyWorkflowDefinition;
  enabled: boolean;
};

export type OrbyPluginKind =
  "core" | "domain" | "tool" | "workflow" | "knowledge" | "channel";
export type OrbyPluginManifest = {
  id: string;
  key: string;
  name: string;
  description: string;
  kind: OrbyPluginKind;
  version: string;
  compatibleCore: string;
  entrypoint: string;
  permissions: readonly string[];
  tools: readonly string[];
  events: readonly string[];
  workflows: readonly string[];
  knowledgeSources: readonly string[];
  dependencies: Readonly<Record<string, string>>;
  requirements: readonly string[];
  isolation: "process" | "module" | "data";
  enabledByDefault: boolean;
  metadata?: OrbyJsonObject;
};
export type OrbyPluginInstallation = {
  pluginKey: string;
  version: string;
  scope: OrbyOsScope;
  status: OrbyOsLifecycle;
  configuration: OrbyJsonObject;
  installedAt: string;
  updatedAt: string;
};
export type OrbyDomainPlugin = {
  key: "business" | "store" | "finance";
  name: string;
  description: string;
  permissions: readonly string[];
  tools: readonly string[];
  workflows: readonly string[];
  knowledgeNamespaces: readonly string[];
  policyKeys: readonly string[];
};

export type OrbyFeatureFlag = {
  key: string;
  enabled: boolean;
  scope: OrbyOsScope;
  rolloutPercentage: number;
  startsAt?: string;
  endsAt?: string;
  configuration: OrbyJsonObject;
};
export type OrbyGovernanceEffect =
  "allow" | "deny" | "require_approval" | "require_sandbox" | "throttle";
export type OrbyGovernanceRule = {
  id: string;
  key: string;
  name: string;
  description: string;
  priority: number;
  enabled: boolean;
  immutable: boolean;
  effect: OrbyGovernanceEffect;
  scope: OrbyOsScope;
  conditions: OrbyJsonObject;
  approvalScope?: OrbyApprovalScope;
  maxCost?: number;
  currency?: string;
  metadata?: OrbyJsonObject;
};
export type OrbyGovernanceContext = {
  identity: OrbyIdentity;
  environment: OrbyOsEnvironment;
  action: string;
  executionType?: OrbyToolExecutionType;
  riskLevel?: OrbyRiskLevel;
  toolName?: string;
  modelId?: string;
  providerId?: string;
  pluginKey?: string;
  channelKey?: string;
  estimatedCost?: number;
  dataSensitivity?: "public" | "internal" | "sensitive" | "restricted";
  permissions: readonly string[];
  metadata?: OrbyJsonObject;
};
export type OrbyGovernanceDecision = {
  effect: OrbyGovernanceEffect;
  ruleId: string;
  reason: string;
  approvalScope?: OrbyApprovalScope;
  requireAudit: true;
  requireSandbox: boolean;
  limits?: OrbyJsonObject;
};

export type OrbyRoutingTask = {
  purpose: string;
  requiredCapabilities: readonly OrbyProviderCapability[];
  preferredModelId?: string;
  allowedModelIds?: readonly string[];
  allowedProviderIds?: readonly string[];
  language?: string;
  contextCharacters?: number;
  latencyTargetMs?: number;
  maxEstimatedCost?: number;
  dataSensitivity?: "public" | "internal" | "sensitive" | "restricted";
  requiresTools?: boolean;
  requiresLongReasoning?: boolean;
};
export type OrbyProviderCircuit = {
  providerId: string;
  state: "closed" | "open" | "half_open";
  failureCount: number;
  successCount: number;
  openedAt?: string;
  retryAt?: string;
  lastErrorCode?: string;
};
export type OrbyModelHealth = {
  providerId: string;
  modelId: string;
  ok: boolean;
  latencyMs: number;
  successRate: number;
  checkedAt: string;
};
export type OrbyRoutingCandidate = {
  model: OrbyModelDescriptor;
  score: number;
  estimatedCost: number;
  reasons: readonly string[];
};

export type OrbyTraceStatus = "running" | "succeeded" | "failed" | "cancelled";
export type OrbyTrace = {
  id: string;
  requestId: string;
  identity: OrbyIdentity;
  operation: string;
  status: OrbyTraceStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  providerId?: string;
  modelId?: string;
  workflowKey?: string;
  pluginKey?: string;
  totalCost: number;
  currency: string;
  metadata: OrbyJsonObject;
};
export type OrbyTraceSpan = {
  id: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  kind:
    | "kernel"
    | "model"
    | "tool"
    | "workflow"
    | "memory"
    | "knowledge"
    | "approval"
    | "plugin"
    | "channel";
  status: OrbyTraceStatus;
  startedAt: string;
  completedAt?: string;
  durationMs?: number;
  input?: OrbyJsonObject;
  output?: OrbyJsonValue;
  errorCode?: string;
  metadata: OrbyJsonObject;
};
export type OrbyCostEvent = {
  traceId: string;
  identity: OrbyIdentity;
  providerId?: string;
  modelId?: string;
  toolName?: string;
  workflowKey?: string;
  pluginKey?: string;
  taskType: string;
  amount: number;
  currency: string;
  inputUnits?: number;
  outputUnits?: number;
  occurredAt: string;
  metadata: OrbyJsonObject;
};
export type OrbyBudget = {
  scope: OrbyOsScope;
  period: "day" | "month";
  limit: number;
  currency: string;
  warningPercentage: number;
  hardStop: boolean;
  enabled: boolean;
};

export type OrbyEvaluationDimension =
  | "accuracy"
  | "relevance"
  | "grounding"
  | "citations"
  | "planning"
  | "tool_selection"
  | "authorization"
  | "approval"
  | "memory"
  | "execution"
  | "proactivity"
  | "latency"
  | "cost"
  | "security";
export type OrbyEvaluationCase = {
  id: string;
  suiteKey: string;
  name: string;
  category: string;
  input: OrbyJsonObject;
  expected: OrbyJsonObject;
  dimensions: readonly OrbyEvaluationDimension[];
  minimumScore: number;
  timeoutMs: number;
  tags: readonly string[];
};
export type OrbyEvaluationResult = {
  caseId: string;
  passed: boolean;
  score: number;
  dimensionScores: Partial<Record<OrbyEvaluationDimension, number>>;
  durationMs: number;
  cost: number;
  findings: readonly string[];
  metadata: OrbyJsonObject;
};

export type OrbyRelease = {
  id: string;
  component:
    | "core"
    | "plugin"
    | "workflow"
    | "prompt"
    | "tool"
    | "model_config"
    | "knowledge_schema";
  componentKey: string;
  version: string;
  status: OrbyOsLifecycle;
  rolloutPercentage: number;
  previousVersion?: string;
  createdAt: string;
  activatedAt?: string;
  metadata: OrbyJsonObject;
};
export type OrbyChannelManifest = {
  key: "in_app" | "email" | "whatsapp" | "push" | "mobile" | "webhook";
  name: string;
  status: OrbyOsLifecycle;
  requiresIdentity: true;
  permissions: readonly string[];
  supportsInbound: boolean;
  supportsOutbound: boolean;
  metadata: OrbyJsonObject;
};
