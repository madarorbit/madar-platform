import type {
  ConnectionMode,
  ConnectorAuthScheme,
  JsonObject,
  StoredIntegrationConnection,
} from "./contracts";
import { validateAuthPayload } from "./auth";
import { IntegrationError } from "./errors";
import { ConnectorRegistry } from "./registry";
import {
  FeatureFlagService,
  IntegrationDatabase,
  IntegrationQueue,
  SecretsManager,
} from "./platform";

type CreateConnectionInput = {
  organizationId: string;
  actorId: string;
  connectorKey: string;
  connectorVersion?: string;
  name: string;
  authScheme: ConnectorAuthScheme;
  auth: unknown;
  config: unknown;
  mode?: ConnectionMode;
};
type ScheduleInput = {
  connectionId: string;
  organizationId: string;
  actorId: string;
  intervalSeconds: number;
  enabled?: boolean;
};

const publicFields =
  "id,organization_id,connector_key,connector_version,name,status,connection_mode,auth_scheme,config,last_tested_at,last_success_at,last_error_code,last_error_message,created_by,created_at,updated_at,deleted_at";

export class ConnectionManager {
  constructor(
    private readonly database: IntegrationDatabase,
    private readonly registry: ConnectorRegistry,
    private readonly secrets: SecretsManager,
    private readonly queue: IntegrationQueue,
    private readonly flags: FeatureFlagService,
  ) {}
  private async assertCanManage(organizationId: string, actorId: string) {
    const params = new URLSearchParams({
      select: "role",
      organization_id: `eq.${organizationId}`,
      user_id: `eq.${actorId}`,
      role: "in.(OWNER,ADMIN)",
      limit: "1",
    });
    if (
      !(
        await this.database.select<{ role: string }>(
          "organization_members",
          params,
        )
      )[0]
    )
      throw new IntegrationError(
        "ليست لديك صلاحية إدارة اتصالات مساحة العمل.",
        "AUTHORIZATION_FAILED",
        false,
        { organizationId },
      );
  }
  private async connection(connectionId: string, organizationId: string) {
    const params = new URLSearchParams({
      select: publicFields,
      id: `eq.${connectionId}`,
      organization_id: `eq.${organizationId}`,
      deleted_at: "is.null",
      limit: "1",
    });
    const row = (
      await this.database.select<StoredIntegrationConnection>(
        "integration_connections",
        params,
      )
    )[0];
    if (!row)
      throw new IntegrationError(
        "اتصال النظام الخارجي غير موجود.",
        "CONNECTION_NOT_FOUND",
        false,
        { connectionId },
      );
    return row;
  }
  async list(organizationId: string, actorId: string) {
    await this.assertCanManage(organizationId, actorId);
    const params = new URLSearchParams({
      select: publicFields,
      organization_id: `eq.${organizationId}`,
      deleted_at: "is.null",
      order: "created_at.desc",
    });
    return this.database.select<StoredIntegrationConnection>(
      "integration_connections",
      params,
    );
  }
  async create(input: CreateConnectionInput) {
    await this.flags.require(
      "integration_engine_enabled",
      input.organizationId,
    );
    await this.assertCanManage(input.organizationId, input.actorId);
    const connector = this.registry.get(
        input.connectorKey,
        input.connectorVersion,
      ),
      manifest = connector.manifest;
    if (!manifest.authSchemes.includes(input.authScheme))
      throw new IntegrationError(
        "طريقة المصادقة المحددة غير مدعومة بواسطة هذا الموصل.",
        "VALIDATION_ERROR",
        false,
        { connectorKey: manifest.key, authScheme: input.authScheme },
      );
    if (input.mode === "WRITE_LIMITED" && !manifest.capabilities.write)
      throw new IntegrationError(
        "هذا الموصل معتمد للقراءة فقط.",
        "VALIDATION_ERROR",
        false,
        { connectorKey: manifest.key },
      );
    const subscription = (
        await this.database.select<{ locked_entitlements: JsonObject }>(
          "pricing_subscription_snapshots",
          new URLSearchParams({
            select: "locked_entitlements",
            organization_id: `eq.${input.organizationId}`,
            status: "in.(trialing,active,past_due)",
            order: "created_at.desc",
            limit: "1",
          }),
        )
      )[0],
      connectorLimit = Number(
        subscription?.locked_entitlements?.connectors ?? 0,
      );
    const currentConnections = await this.database.select<{ id: string }>(
      "integration_connections",
      new URLSearchParams({
        select: "id",
        organization_id: `eq.${input.organizationId}`,
        deleted_at: "is.null",
        limit: "100",
      }),
    );
    if (connectorLimit < 1 || currentConnections.length >= connectorLimit)
      throw new IntegrationError(
        "وصلت إلى حد الموصلات في باقتك.",
        "AUTHORIZATION_FAILED",
        false,
        { connectorLimit },
      );
    const validation = connector.validateConfig(input.config);
    if (!validation.valid)
      throw new IntegrationError(
        "إعدادات الموصل غير صالحة.",
        "VALIDATION_ERROR",
        false,
        { issues: validation.issues as unknown as JsonObject },
      );
    const secretPayload = validateAuthPayload(input.authScheme, input.auth),
      encrypted = this.secrets.encrypt(secretPayload),
      name = input.name.trim();
    if (name.length < 2 || name.length > 120)
      throw new IntegrationError(
        "اسم الاتصال يجب أن يكون بين حرفين و120 حرفًا.",
        "VALIDATION_ERROR",
        false,
      );
    const [created] = await this.database.insert<StoredIntegrationConnection>(
      "integration_connections",
      {
        organization_id: input.organizationId,
        connector_key: manifest.key,
        connector_version: manifest.version,
        name,
        status: "draft",
        connection_mode: input.mode || "READ_ONLY",
        auth_scheme: input.authScheme,
        config: validation.normalizedConfig,
        created_by: input.actorId,
        updated_by: input.actorId,
      },
    );
    try {
      const [storedSecret] = await this.database.insert<{ id: string }>(
        "integration_connection_secrets",
        {
          organization_id: input.organizationId,
          connection_id: created.id,
          encrypted_payload: encrypted.ciphertext,
          iv: encrypted.iv,
          auth_tag: encrypted.authTag,
          algorithm: encrypted.algorithm,
          key_version: encrypted.keyVersion,
          metadata: { auth_scheme: input.authScheme },
          created_by: input.actorId,
        },
      );
      await this.database.update(
        "integration_connections",
        `id=eq.${created.id}`,
        {
          secret_id: storedSecret.id,
          status: "verifying",
          updated_by: input.actorId,
        },
      );
      await this.queue.enqueue({
        organizationId: input.organizationId,
        connectionId: created.id,
        jobType: "connection.test",
        payload: { reason: "connection_created" },
        idempotencyKey: `connection-test:${created.id}:${storedSecret.id}`,
        createdBy: input.actorId,
      });
      return this.connection(created.id, input.organizationId);
    } catch (error) {
      await this.database
        .update("integration_connections", `id=eq.${created.id}`, {
          status: "archived",
          deleted_at: new Date().toISOString(),
          updated_by: input.actorId,
        })
        .catch(() => undefined);
      throw error;
    }
  }
  async rotateSecret(input: {
    connectionId: string;
    organizationId: string;
    actorId: string;
    auth: unknown;
  }) {
    await this.assertCanManage(input.organizationId, input.actorId);
    const connection = await this.connection(
        input.connectionId,
        input.organizationId,
      ),
      payload = validateAuthPayload(connection.auth_scheme, input.auth),
      encrypted = this.secrets.encrypt(payload);
    const secretId = await this.database.rpc<string>(
      "integration_rotate_connection_secret",
      {
        target_organization: input.organizationId,
        target_connection: connection.id,
        new_encrypted_payload: encrypted.ciphertext,
        new_secret_iv: encrypted.iv,
        new_secret_auth_tag: encrypted.authTag,
        new_secret_algorithm: encrypted.algorithm,
        new_secret_key_version: encrypted.keyVersion,
        new_secret_metadata: {
          auth_scheme: connection.auth_scheme,
          rotation: true,
        },
        actor_id: input.actorId,
      },
    );
    await this.queue.enqueue({
      organizationId: input.organizationId,
      connectionId: connection.id,
      jobType: "connection.test",
      payload: { reason: "secret_rotated" },
      idempotencyKey: `connection-test:${connection.id}:${secretId}`,
      createdBy: input.actorId,
    });
    return this.connection(connection.id, input.organizationId);
  }
  async enqueueSync(input: {
    connectionId: string;
    organizationId: string;
    actorId: string;
    mode: "initial" | "incremental";
    streams?: string[];
  }) {
    await this.flags.require(
      "integration_engine_enabled",
      input.organizationId,
    );
    await this.assertCanManage(input.organizationId, input.actorId);
    const connection = await this.connection(
      input.connectionId,
      input.organizationId,
    );
    if (connection.status !== "active")
      throw new IntegrationError(
        "يجب أن يكون الاتصال نشطًا قبل بدء المزامنة.",
        "VALIDATION_ERROR",
        false,
        { status: connection.status },
      );
    if (input.mode === "initial") {
      const approved = await this.database.select<{ id: string }>(
        "integration_sync_previews",
        new URLSearchParams({
          select: "id",
          connection_id: `eq.${connection.id}`,
          status: "eq.approved",
          expires_at: `gt.${new Date().toISOString()}`,
          limit: "1",
        }),
      );
      if (!approved[0])
        throw new IntegrationError(
          "اعتمد جميع معاينات المطابقة قبل المزامنة الأولى.",
          "VALIDATION_ERROR",
          false,
          { connectionId: connection.id },
        );
    }
    const bucket = new Date().toISOString().slice(0, 16),
      jobType = input.mode === "initial" ? "sync.initial" : "sync.incremental";
    return this.queue.enqueue({
      organizationId: input.organizationId,
      connectionId: connection.id,
      jobType,
      payload: { streams: input.streams || [] },
      idempotencyKey: `manual:${jobType}:${connection.id}:${bucket}`,
      createdBy: input.actorId,
    });
  }
  async setPaused(input: {
    connectionId: string;
    organizationId: string;
    actorId: string;
    paused: boolean;
  }) {
    await this.assertCanManage(input.organizationId, input.actorId);
    await this.connection(input.connectionId, input.organizationId);
    const [updated] = await this.database.update<StoredIntegrationConnection>(
      "integration_connections",
      `id=eq.${input.connectionId}&organization_id=eq.${input.organizationId}`,
      { status: input.paused ? "paused" : "active", updated_by: input.actorId },
    );
    return updated;
  }
  async setSchedule(input: ScheduleInput) {
    await this.assertCanManage(input.organizationId, input.actorId);
    await this.connection(input.connectionId, input.organizationId);
    const interval = Math.max(
      300,
      Math.min(86_400, Math.floor(input.intervalSeconds)),
    );
    const [schedule] = await this.database.upsert<{ id: string }>(
      "integration_schedules",
      {
        organization_id: input.organizationId,
        connection_id: input.connectionId,
        sync_mode: "incremental",
        interval_seconds: interval,
        enabled: input.enabled !== false,
        next_run_at: new Date(Date.now() + interval * 1000).toISOString(),
        updated_by: input.actorId,
        created_by: input.actorId,
      },
      "connection_id",
    );
    return schedule;
  }
  async disconnect(input: {
    connectionId: string;
    organizationId: string;
    actorId: string;
  }) {
    await this.assertCanManage(input.organizationId, input.actorId);
    await this.connection(input.connectionId, input.organizationId);
    const now = new Date().toISOString();
    await this.database.update(
      "integration_connection_secrets",
      `connection_id=eq.${input.connectionId}&revoked_at=is.null`,
      { revoked_at: now, revoked_by: input.actorId },
    );
    await this.database.update(
      "integration_schedules",
      `connection_id=eq.${input.connectionId}`,
      { enabled: false, updated_by: input.actorId },
    );
    const [updated] = await this.database.update<StoredIntegrationConnection>(
      "integration_connections",
      `id=eq.${input.connectionId}`,
      { status: "disconnected", deleted_at: now, updated_by: input.actorId },
    );
    return updated;
  }
}
