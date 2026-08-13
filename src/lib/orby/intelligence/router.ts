import type {
  OrbyJsonObject,
  OrbyKernelRequest,
  OrbyLogger,
  OrbyModelDescriptor,
  OrbyProviderCapability,
  OrbyRuntimeConfiguration,
} from "../core/contracts";

type ModelCatalog = {
  list(filter?: { enabledOnly?: boolean; providerId?: string }): OrbyModelDescriptor[];
};
type RouterConfig = OrbyRuntimeConfiguration & {
  modelSelectionMode?: string;
  intelligentRouting?: OrbyJsonObject;
};
type ModelProfile = {
  quality: number;
  speed: number;
  reasoning: number;
  cost: number;
  reliability: number;
  preferredFor: readonly string[];
  minComplexity: number;
  highComplexityBoost: number;
};
export type OrbyIntelligenceRoutingDecision = {
  mode: "manual" | "static" | "intelligent";
  preferredModelId?: string;
  intent: string;
  complexity: number;
  candidates: readonly { modelId: string; providerId: string; score: number }[];
};

const obj = (value: unknown) =>
  value && typeof value === "object" && !Array.isArray(value)
    ? (value as OrbyJsonObject)
    : undefined;
const num = (value: unknown, fallback: number) =>
  typeof value === "number" && Number.isFinite(value) ? value : fallback;
const list = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const clamp = (value: number, min = 0, max = 5) => Math.max(min, Math.min(max, value));

function costScore(model: OrbyModelDescriptor) {
  const blended = (model.inputCostPerMillion || 0) + (model.outputCostPerMillion || 0) * 0.3;
  if (blended <= 1) return 5;
  if (blended <= 3) return 4.5;
  if (blended <= 7) return 4;
  if (blended <= 14) return 3;
  if (blended <= 25) return 2;
  return 1;
}
function profile(model: OrbyModelDescriptor): ModelProfile {
  const routing = obj(model.metadata?.routing);
  const tags = new Set((model.tags || []).map((tag) => tag.toLowerCase()));
  return {
    quality: clamp(num(routing?.quality, tags.has("frontier") ? 4.6 : 3.5)),
    speed: clamp(num(routing?.speed, tags.has("low-latency") || tags.has("fast") ? 4.7 : 3.5)),
    reasoning: clamp(num(routing?.reasoning, tags.has("heavy-reasoning") || tags.has("reasoning") ? 4.7 : 3.5)),
    cost: clamp(num(routing?.costEfficiency, costScore(model))),
    reliability: clamp(num(routing?.reliability, tags.has("production") ? 4.6 : 4)),
    preferredFor: list(routing?.preferredFor),
    minComplexity: clamp(num(routing?.minComplexity, 0), 0, 1),
    highComplexityBoost: clamp(num(routing?.highComplexityBoost, 0), 0, 2),
  };
}
function intentOf(request: OrbyKernelRequest) {
  const value = request.metadata?.intent;
  if (typeof value === "string" && value.trim()) return value;
  return /[؟?]/.test(request.message) ? "information" : "conversation";
}
function complexityOf(request: OrbyKernelRequest, intent: string) {
  const base: Record<string, number> = {
    conversation: 0.16,
    information: 0.28,
    monitoring: 0.34,
    report: 0.62,
    task: 0.66,
    analysis: 0.72,
    execution: 0.7,
  };
  return Math.min(1, (base[intent] || 0.35) + Math.min(0.2, request.message.length / 15000));
}
function weights(intent: string) {
  if (["conversation", "information", "monitoring"].includes(intent))
    return { quality: 0.2, speed: 0.36, reasoning: 0.12, cost: 0.2, reliability: 0.12 };
  if (["analysis", "report", "task"].includes(intent))
    return { quality: 0.3, speed: 0.1, reasoning: 0.31, cost: 0.12, reliability: 0.17 };
  return { quality: 0.24, speed: 0.18, reasoning: 0.22, cost: 0.14, reliability: 0.22 };
}
function enabled(config: RouterConfig) {
  const routing = obj(config.intelligentRouting);
  if (routing?.enabled === false) return false;
  return routing?.enabled === true || (config.modelSelectionMode || "").startsWith("orby-intelligence-router");
}

export class OrbyIntelligenceRouter {
  constructor(private readonly models: ModelCatalog, private readonly logger?: OrbyLogger) {}

  decide(input: {
    request: OrbyKernelRequest;
    configuration: OrbyRuntimeConfiguration;
    requiredCapabilities?: readonly OrbyProviderCapability[];
  }): OrbyIntelligenceRoutingDecision {
    const config = input.configuration as RouterConfig;
    const intent = intentOf(input.request);
    const complexity = complexityOf(input.request, intent);
    if (input.request.preferredModelId)
      return { mode: "manual", preferredModelId: input.request.preferredModelId, intent, complexity, candidates: [] };
    const routing = obj(config.intelligentRouting);
    if (!enabled(config) || routing?.allowModelSwitching === false)
      return { mode: "static", preferredModelId: config.defaultModelId, intent, complexity, candidates: [] };

    const allowedModels = config.allowedModelIds ? new Set(config.allowedModelIds) : null;
    const allowedProviders = config.allowedProviderIds ? new Set(config.allowedProviderIds) : null;
    const required = input.requiredCapabilities || input.request.requiredCapabilities || ["text"];
    const w = weights(intent);
    const candidates = this.models.list({ enabledOnly: true }).filter((model) =>
      (!allowedModels || allowedModels.has(model.id)) &&
      (!allowedProviders || allowedProviders.has(model.providerId)) &&
      required.every((capability) => model.capabilities[capability] !== false),
    ).map((model) => {
      const p = profile(model);
      let score = p.quality*w.quality + p.speed*w.speed + p.reasoning*w.reasoning + p.cost*w.cost + p.reliability*w.reliability;
      if (p.preferredFor.includes(intent)) score += 0.55;
      if (p.minComplexity > complexity) score -= (p.minComplexity - complexity) * 4.5;
      score += Math.max(0, complexity - 0.72) * p.highComplexityBoost * 2.5;
      score += Math.min(0.2, Math.max(0, model.priority) / 2500);
      return { modelId: model.id, providerId: model.providerId, score: Number(score.toFixed(4)) };
    }).sort((a,b) => b.score-a.score || a.modelId.localeCompare(b.modelId));

    const decision = { mode: "intelligent" as const, preferredModelId: candidates[0]?.modelId || config.defaultModelId, intent, complexity, candidates };
    this.logger?.debug("ORBY Intelligence Router selected a model.", {
      intent,
      complexity,
      preferredModelId: decision.preferredModelId || null,
      candidateCount: candidates.length,
    });
    return decision;
  }
}
