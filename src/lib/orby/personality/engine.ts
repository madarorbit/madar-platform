import type { OrbyJsonObject } from "../core/contracts";
import {
  ORBY_CHARACTER_CONSTITUTION_VERSION,
  orbyCharacterSystemPolicies,
} from "./constitution";
import type {
  OrbyDialogueDecision,
  OrbyDialogueInput,
  OrbyIntent,
  OrbyIntentClassification,
  OrbyOperationKind,
  OrbyResponseStrategy,
  OrbySector,
  OrbySensitivity,
} from "./contracts";

const normalize = (value: string) =>
  value
    .toLowerCase()
    .replace(/[إأآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim();
const includesAny = (value: string, terms: readonly string[]) =>
  terms.some((term) => value.includes(normalize(term)));

const sectorTerms: Record<OrbySector, readonly string[]> = {
  commerce: [
    "منتج",
    "مخزون",
    "مبيعات",
    "بيع",
    "مرتجع",
    "عميل",
    "مورد",
    "شراء",
    "طلبية",
    "متجر",
  ],
  food_service: [
    "مطعم",
    "وصفة",
    "مكونات",
    "مطبخ",
    "وجبة",
    "هدر",
    "طاولة",
    "نادل",
    "طلب مطعم",
  ],
  hospitality: [
    "فندق",
    "غرفة",
    "حجز",
    "اقامة",
    "نزيل",
    "folio",
    "اشغال",
    "دخول",
    "مغادرة",
    "تنظيف",
    "صيانة",
  ],
  personal: ["شخصي", "موعد شخصي", "روتيني", "عاداتي"],
  general: [],
};

const executionTerms = [
  "نفذ",
  "انشئ",
  "اضف",
  "عدل",
  "غيّر",
  "غير",
  "احذف",
  "ارسل",
  "اعتمد",
  "فعّل",
  "فعل",
  "اطلب",
  "حدث السجل",
  "سجل",
];
const monitoringTerms = [
  "راقب",
  "تابع",
  "نبهني",
  "ذكرني",
  "اشعرني",
  "عندما",
  "اذا انخفض",
  "اذا ارتفع",
  "تقرير يومي",
  "تقرير اسبوعي",
  "تقرير شهري",
];
const reportTerms = ["تقرير", "ملخص تنفيذي", "كشف", "اعطني ملخص", "جهز تقرير"];
const analysisTerms = [
  "حلل",
  "لماذا",
  "سبب",
  "قارن",
  "اداء",
  "ربحيه",
  "هامش",
  "مؤشر",
  "توقع",
  "فرصه",
  "خطر",
];
const taskTerms = [
  "خطه",
  "خطوات",
  "مهمه",
  "رتب",
  "جدول",
  "ماذا افعل",
  "اقترح اجراء",
];
const restrictedTerms = [
  "كلمه مرور",
  "password",
  "api key",
  "token",
  "بطاقه ائتمان",
  "cvv",
  "رقم سري",
  "مفتاح خاص",
];
const sensitiveTerms = [
  "احذف",
  "دفع",
  "تحويل",
  "استرداد",
  "راتب",
  "سعر",
  "خصم",
  "فاتوره",
  "حساب بنكي",
  "ارسال جماعي",
];

const terminology: Record<
  OrbySector,
  Readonly<Record<string, string>>
> = Object.freeze({
  commerce: Object.freeze({
    item: "منتج",
    inventory: "مخزون",
    transaction: "بيع",
    return: "مرتجع",
    customer: "عميل",
    supplier: "مورد",
  }),
  food_service: Object.freeze({
    item: "وصفة",
    inventory: "مكونات",
    transaction: "طلب",
    operations: "مطبخ",
    loss: "هدر",
    profit: "ربحية الوجبة",
  }),
  hospitality: Object.freeze({
    item: "غرفة",
    transaction: "حجز",
    customer: "نزيل",
    stay: "إقامة",
    ledger: "Folio",
    operations: "تنظيف وصيانة",
  }),
  personal: Object.freeze({
    item: "عنصر",
    transaction: "مهمة",
    customer: "مستخدم",
    operations: "تنظيم شخصي",
  }),
  general: Object.freeze({
    item: "عنصر",
    transaction: "عملية",
    customer: "مستخدم",
    operations: "إجراء",
  }),
});

function resolveSector(message: string, explicit?: OrbySector): OrbySector {
  if (explicit && explicit !== "general") return explicit;
  const normalized = normalize(message),
    scores = (Object.keys(sectorTerms) as OrbySector[])
      .map((sector) => ({
        sector,
        score: sectorTerms[sector].filter((term) =>
          normalized.includes(normalize(term)),
        ).length,
      }))
      .sort((a, b) => b.score - a.score);
  return scores[0]?.score ? scores[0].sector : "general";
}
function resolveIntent(
  message: string,
  requestedExecution = false,
): { intent: OrbyIntent; operation: OrbyOperationKind; reasons: string[] } {
  const value = normalize(message),
    reasons: string[] = [];
  if (requestedExecution || includesAny(value, executionTerms)) {
    reasons.push("execution-language");
    return { intent: "execution", operation: "write", reasons };
  }
  if (includesAny(value, monitoringTerms)) {
    reasons.push("future-monitoring-language");
    return { intent: "monitoring", operation: "monitor", reasons };
  }
  if (includesAny(value, reportTerms)) {
    reasons.push("report-language");
    return { intent: "report", operation: "read", reasons };
  }
  if (includesAny(value, analysisTerms)) {
    reasons.push("analysis-language");
    return { intent: "analysis", operation: "read", reasons };
  }
  if (includesAny(value, taskTerms)) {
    reasons.push("planning-language");
    return { intent: "task", operation: "read", reasons };
  }
  if (
    /[؟?]$/.test(message.trim()) ||
    /^(ما|ماذا|هل|كيف|كم|متى|اين|ليش|ايش)\b/.test(value)
  ) {
    reasons.push("question-language");
    return { intent: "information", operation: "read", reasons };
  }
  reasons.push("general-conversation");
  return { intent: "conversation", operation: "read", reasons };
}
function resolveSensitivity(message: string): OrbySensitivity {
  const value = normalize(message);
  if (includesAny(value, restrictedTerms)) return "restricted";
  if (includesAny(value, sensitiveTerms)) return "sensitive";
  return "normal";
}
function entities(message: string) {
  const quoted = [...message.matchAll(/["“”']([^"“”']{2,80})["“”']/g)].map(
    (match) => match[1].trim(),
  );
  return [...new Set(quoted)].slice(0, 8);
}
function strategyFor(
  classification: OrbyIntentClassification,
): OrbyResponseStrategy {
  if (classification.intent === "execution") return "approval_preview";
  if (classification.intent === "monitoring") return "insight";
  if (classification.intent === "report") return "report";
  if (classification.intent === "analysis") return "analysis";
  if (classification.intent === "task") return "plan";
  return "direct";
}

export class OrbyIntentEngine {
  classify(input: {
    message: string;
    sector?: OrbySector;
    requestedExecution?: boolean;
  }): OrbyIntentClassification {
    const message = input.message.trim(),
      resolved = resolveIntent(message, input.requestedExecution),
      sector = resolveSector(message, input.sector),
      sensitivity = resolveSensitivity(message),
      detectedEntities = entities(message);
    const confidence = Math.min(
      0.99,
      0.72 +
        (input.sector && input.sector !== "general" ? 0.12 : 0) +
        (resolved.reasons[0] !== "general-conversation" ? 0.1 : 0) +
        (detectedEntities.length ? 0.04 : 0),
    );
    return {
      intent: resolved.intent,
      operation: resolved.operation,
      sector,
      sensitivity,
      confidence,
      entities: detectedEntities,
      reasons: resolved.reasons,
    };
  }
}

export class OrbyPersonalityEngine {
  policies(input: {
    sector: OrbySector;
    preferences?: OrbyDialogueInput["preferences"];
  }) {
    return orbyCharacterSystemPolicies(input);
  }
  terminology(sector: OrbySector) {
    return terminology[sector];
  }
}

export class OrbyDialogueManager {
  constructor(
    private readonly intents = new OrbyIntentEngine(),
    private readonly personality = new OrbyPersonalityEngine(),
  ) {}
  decide(input: OrbyDialogueInput): OrbyDialogueDecision {
    const classification = this.intents.classify({
        message: input.message,
        sector: input.sector,
        requestedExecution: input.requestedExecution,
      }),
      strategy = strategyFor(classification);
    const lacksTarget =
      classification.operation === "write" &&
      !input.hasTargetEntity &&
      !classification.entities.length;
    const lacksContext =
      (classification.intent === "analysis" ||
        classification.intent === "report") &&
      input.hasWorkspaceContext === false;
    const requiresClarification = lacksTarget || lacksContext;
    const clarificationQuestion = lacksTarget
      ? "ما السجل أو العنصر المحدد الذي تريد تطبيق الإجراء عليه؟"
      : lacksContext
        ? "ما مساحة العمل أو مصدر البيانات الذي تريد أن يعتمد عليه التحليل؟"
        : undefined;
    const metadata: OrbyJsonObject = {
      intent: classification.intent,
      operation: classification.operation,
      sector: classification.sector,
      sensitivity: classification.sensitivity,
      confidence: classification.confidence,
      strategy,
      constitutionVersion: ORBY_CHARACTER_CONSTITUTION_VERSION,
    };
    return {
      classification,
      strategy,
      requiresClarification,
      clarificationQuestion,
      terminology: this.personality.terminology(classification.sector),
      systemPolicies: this.personality.policies({
        sector: classification.sector,
        preferences: input.preferences,
      }),
      promptVersion: `orby-dialogue-${ORBY_CHARACTER_CONSTITUTION_VERSION}`,
      metadata,
    };
  }
}

export function mapBusinessSector(value?: string): OrbySector {
  const normalized = normalize(value || "");
  if (includesAny(normalized, ["restaurant", "food", "مطعم", "مقهى", "كافيه"]))
    return "food_service";
  if (includesAny(normalized, ["hotel", "hospitality", "فندق", "ضيافه"]))
    return "hospitality";
  if (includesAny(normalized, ["personal", "شخصي"])) return "personal";
  return value ? "commerce" : "general";
}
