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
  privacy: number;
  preferredFor: readonly string[];
  minComplexity: number;
  highComplexityBoost: number;
};
export type OrbyIntelligenceRoutingDecision = {
  mode: "manual" | "static" | "intelligent";
  preferredModelId?: string;
  intent: string;
  sensitivity: "normal" | "sensitive" | "restricted";
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
const normalize = (value: string) =>
  value.toLowerCase().replace(/[إأآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " ").trim();
const includesAny = (value: string, terms: readonly string[]) => terms.some((term) => value.includes(normalize(term)));

function costScore(model: OrbyModelDescriptor) {
  if (model.inputCostPerMillion === undefined && model.outputCostPerMillion === undefined) return 3.2;
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
  const privacyDefault = model.metadata?.storesSecrets === false || tags.has("privacy") || tags.has("zero-data-retention") ? 4.5 : 4;
  return {
    quality: clamp(num(routing?.quality, tags.has("frontier") ? 4.6 : 3.5)),
    speed: clamp(num(routing?.speed, tags.has("low-latency") || tags.has("fast") ? 4.7 : 3.5)),
    reasoning: clamp(num(routing?.reasoning, tags.has("heavy-reasoning") || tags.has("reasoning") ? 4.7 : 3.5)),
    cost: clamp(num(routing?.costEfficiency, costScore(model))),
    reliability: clamp(num(routing?.reliability, tags.has("production") ? 4.6 : 4)),
    privacy: clamp(num(routing?.privacy, privacyDefault)),
    preferredFor: list(routing?.preferredFor),
    minComplexity: clamp(num(routing?.minComplexity, 0), 0, 1),
    highComplexityBoost: clamp(num(routing?.highComplexityBoost, 0), 0, 2),
  };
}
function intentOf(request: OrbyKernelRequest) {
  const explicit = request.metadata?.intent;
  if (typeof explicit === "string" && explicit.trim()) return explicit;
  const value = normalize(request.message);
  if (includesAny(value, ["حلل", "قارن", "لماذا", "ليش", "سبب", "توقع", "ربحيه", "هامش"])) return "analysis";
  if (includesAny(value, ["تقرير", "ملخص تنفيذي", "كشف"])) return "report";
  if (includesAny(value, ["خطه", "خطوات", "رتب", "ماذا افعل", "اقترح اجراء"])) return "task";
  if (includesAny(value, ["نفذ", "انشئ", "اضف", "عدل", "احذف", "ارسل", "اعتمد", "فعل"])) return "execution";
  if (includesAny(value, ["راقب", "تابع", "نبهني", "ذكرني", "عندما", "اذا انخفض", "اذا ارتفع"])) return "monitoring";
  return /[؟?]/.test(request.message) ? "information" : "conversation";
}
function sensitivityOf(request: OrbyKernelRequest): "normal" | "sensitive" | "restricted" {
  const explicit = request.metadata?.sensitivity;
  if (explicit === "normal" || explicit === "sensitive" || explicit === "restricted") return explicit;
  const value = normalize(request.message);
  if (includesAny(value, ["password", "كلمه مرور", "api key", "token", "cvv", "رقم سري", "مفتاح خاص"])) return "restricted";
  if (includesAny(value, ["دفع", "تحويل", "استرداد", "راتب", "فاتوره", "حساب بنكي", "ديون", "ارباح", "مبيعات"])) return "sensitive";
  return "normal";
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
function weights(intent: string, sensitivity: "normal" | "sensitive" | "restricted") {
  if (sensitivity === "restricted")
    return { quality: 0.2, speed: 0.05, reasoning: 0.15, cost: 0.05, reliability: 0.25, privacy: 0.3 };
  if (sensitivity === "sensitive")
    return { quality: 0.25, speed: 0.1, reasoning: 0.2, cost: 0.08, reliability: 0.2, privacy: 0.17 };
  if (["conversation", "information", "monitoring"].includes(intent))
    return { quality: 0.19, speed: 0.32, reasoning: 0.11, cost: 0.18, reliability: 0.12, privacy: 0.08 };
  if (["analysis", "report", "task"].includes(intent))
    return { quality: 0.28, speed: 0.09, reasoning: 0.29, cost: 0.11, reliability: 0.15, privacy: 0.08 };
  return { quality: 0.22, speed: 0.16, reasoning: 0.2, cost: 0.12, reliability: 0.2, privacy: 0.1 };
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
    const sensitivity = sensitivityOf(input.request);
    const complexity = complexityOf(input.request, intent);
    if (input.request.preferredModelId)
      return { mode: "manual", preferredModelId: input.request.preferredModelId, intent, sensitivity, complexity, candidates: [] };
    const routing = obj(config.intelligentRouting);
    if (!enabled(config) || routing?.allowModelSwitching === false)
      return { mode: "static", preferredModelId: config.defaultModelId, intent, sensitivity, complexity, candidates: [] };

    const allowedModels = config.allowedModelIds ? new Set(config.allowedModelIds) : null;
    const allowedProviders = config.allowedProviderIds ? new Set(config.allowedProviderIds) : null;
    const required = input.requiredCapabilities || input.request.requiredCapabilities || ["text"];
    const w = weights(intent, sensitivity);
    const restrictedPrivacyFloor = clamp(num(routing?.restrictedPrivacyFloor, 4), 0, 5);
    const candidates = this.models.list({ enabledOnly: true }).filter((model) =>
      (!allowedModels || allowedModels.has(model.id)) &&
      (!allowedProviders || allowedProviders.has(model.providerId)) &&
      required.every((capability) => model.capabilities[capability] !== false),
    ).map((model) => {
      const p = profile(model);
      let score = p.quality*w.quality + p.speed*w.speed + p.reasoning*w.reasoning + p.cost*w.cost + p.reliability*w.reliability + p.privacy*w.privacy;
      if (p.preferredFor.includes(intent)) score += 0.55;
      if (p.preferredFor.includes(`${intent}:${sensitivity}`)) score += 0.35;
      if (p.minComplexity > complexity) score -= (p.minComplexity - complexity) * 4.5;
      if (sensitivity === "restricted" && p.privacy < restrictedPrivacyFloor) score -= (restrictedPrivacyFloor - p.privacy) * 3;
      score += Math.max(0, complexity - 0.72) * p.highComplexityBoost * 2.5;
      score += Math.min(0.2, Math.max(0, model.priority) / 2500);
      return { modelId: model.id, providerId: model.providerId, score: Number(score.toFixed(4)) };
    }).sort((a,b) => b.score-a.score || a.modelId.localeCompare(b.modelId));

    const decision = { mode: "intelligent" as const, preferredModelId: candidates[0]?.modelId || config.defaultModelId, intent, sensitivity, complexity, candidates };
    this.logger?.debug("ORBY Intelligence Router selected a model.", {
      intent,
      sensitivity,
      complexity,
      preferredModelId: decision.preferredModelId || null,
      candidateCount: candidates.length,
    });
    return decision;
  }
}
