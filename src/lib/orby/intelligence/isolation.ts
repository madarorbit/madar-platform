import type { OrbyIdentity } from "../core/contracts";
import type { OrbyMemoryRecord } from "./contracts";

export type OrbyAccountBoundary = "PERSONAL" | "BUSINESS";
export type OrbyMemoryScope = {
  organizationId: string;
  workspaceId?: string;
  userId?: string;
  accountBoundary: OrbyAccountBoundary;
};

const SECRET_PATTERNS = [
  /\b(?:api[_-]?key|access[_-]?token|refresh[_-]?token|password|secret|private[_-]?key)\b/i,
  /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
  /\bBearer\s+[A-Za-z0-9._~+/=-]+/i,
  /\bsk-[A-Za-z0-9_-]{12,}/i,
];
const PAYMENT_PATTERNS = [
  /\b(?:cvv|cvc|pin)\b/i,
  /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))[- ]?\d{4}[- ]?\d{4}[- ]?\d{3,4}\b/,
];

export class OrbyMemoryIsolationGuard {
  scopeKey(scope: OrbyMemoryScope) {
    return `${scope.accountBoundary}:${scope.organizationId}:${scope.workspaceId || "*"}:${scope.userId || "*"}`;
  }
  assertIdentity(identity: OrbyIdentity, scope: OrbyMemoryScope) {
    if (identity.organizationId !== scope.organizationId)
      throw new Error("ORBY_MEMORY_CROSS_ORGANIZATION_DENIED");
    if (scope.workspaceId && identity.workspaceId !== scope.workspaceId)
      throw new Error("ORBY_MEMORY_CROSS_WORKSPACE_DENIED");
    if (scope.userId && identity.userId !== scope.userId)
      throw new Error("ORBY_MEMORY_CROSS_USER_DENIED");
    return true;
  }
  assertRecord(
    identity: OrbyIdentity,
    record: Pick<OrbyMemoryRecord, "organizationId" | "workspaceId" | "userId">,
  ) {
    if (record.organizationId !== identity.organizationId)
      throw new Error("ORBY_MEMORY_CROSS_ORGANIZATION_DENIED");
    if (record.workspaceId && record.workspaceId !== identity.workspaceId)
      throw new Error("ORBY_MEMORY_CROSS_WORKSPACE_DENIED");
    if (record.userId && record.userId !== identity.userId)
      throw new Error("ORBY_MEMORY_CROSS_USER_DENIED");
    return true;
  }
  assertBoundary(source: OrbyAccountBoundary, target: OrbyAccountBoundary) {
    if (source !== target)
      throw new Error("ORBY_MEMORY_ACCOUNT_BOUNDARY_DENIED");
    return true;
  }
  assertSafeContent(content: string) {
    if (SECRET_PATTERNS.some((pattern) => pattern.test(content)))
      throw new Error("ORBY_MEMORY_SECRET_BLOCKED");
    if (PAYMENT_PATTERNS.some((pattern) => pattern.test(content)))
      throw new Error("ORBY_MEMORY_PAYMENT_DATA_BLOCKED");
    return content;
  }
  filterRecords(identity: OrbyIdentity, records: readonly OrbyMemoryRecord[]) {
    return records.filter((record) => {
      try {
        return this.assertRecord(identity, record);
      } catch {
        return false;
      }
    });
  }
}

export class OrbyMemoryConsentLedger {
  private readonly decisions = new Map<
    string,
    {
      enabled: boolean;
      longTerm: boolean;
      updatedAt: string;
      updatedBy: string;
    }
  >();
  set(
    scope: OrbyMemoryScope,
    actorId: string,
    input: { enabled: boolean; longTerm: boolean },
  ) {
    if (input.longTerm && !input.enabled)
      throw new Error("ORBY_MEMORY_CONSENT_INVALID");
    const value = {
      ...input,
      updatedAt: new Date().toISOString(),
      updatedBy: actorId,
    };
    this.decisions.set(new OrbyMemoryIsolationGuard().scopeKey(scope), value);
    return value;
  }
  get(scope: OrbyMemoryScope) {
    return (
      this.decisions.get(new OrbyMemoryIsolationGuard().scopeKey(scope)) || {
        enabled: false,
        longTerm: false,
        updatedAt: "",
        updatedBy: "",
      }
    );
  }
  revoke(scope: OrbyMemoryScope, actorId: string) {
    return this.set(scope, actorId, { enabled: false, longTerm: false });
  }
}
