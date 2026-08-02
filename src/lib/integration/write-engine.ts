import type {
  ConnectorConnection,
  ConnectorContext,
  ConnectorLogger,
  EncryptedSecret,
  JsonObject,
  StoredIntegrationConnection,
  StoredWriteCommand,
} from "./contracts";
import { asIntegrationError, IntegrationError } from "./errors";
import { ConnectorRegistry } from "./registry";
import {
  FeatureFlagService,
  IntegrationDatabase,
  SecretsManager,
} from "./platform";

type ConnectionWithSecret = StoredIntegrationConnection & {
  secret_id: string | null;
};
type SecretRow = {
  encrypted_payload: string;
  iv: string;
  auth_tag: string;
  algorithm: "aes-256-gcm";
  key_version: number;
};
const connectionFor = (row: ConnectionWithSecret): ConnectorConnection => ({
  id: row.id,
  organizationId: row.organization_id,
  connectorKey: row.connector_key,
  connectorVersion: row.connector_version,
  name: row.name,
  status: row.status,
  mode: row.connection_mode,
  config: row.config,
});
class WriteLogger implements ConnectorLogger {
  constructor(private commandId: string) {}
  debug(message: string, metadata?: JsonObject) {
    console.debug(message, { commandId: this.commandId, ...metadata });
  }
  info(message: string, metadata?: JsonObject) {
    console.info(message, { commandId: this.commandId, ...metadata });
  }
  warn(message: string, metadata?: JsonObject) {
    console.warn(message, { commandId: this.commandId, ...metadata });
  }
  error(message: string, metadata?: JsonObject) {
    console.error(message, { commandId: this.commandId, ...metadata });
  }
}

export class IntegrationWriteEngine {
  constructor(
    private database: IntegrationDatabase,
    private registry: ConnectorRegistry,
    private secrets: SecretsManager,
    private flags: FeatureFlagService,
  ) {}
  private async load(command: StoredWriteCommand) {
    const params = new URLSearchParams({
        select:
          "id,organization_id,connector_key,connector_version,name,status,connection_mode,auth_scheme,config,secret_id,last_tested_at,last_success_at,last_error_code,last_error_message,created_by,created_at,updated_at,deleted_at",
        id: `eq.${command.connection_id}`,
        organization_id: `eq.${command.organization_id}`,
        deleted_at: "is.null",
        limit: "1",
      }),
      connection = (
        await this.database.select<ConnectionWithSecret>(
          "integration_connections",
          params,
        )
      )[0];
    if (
      !connection ||
      connection.status !== "active" ||
      connection.connection_mode !== "WRITE_LIMITED"
    )
      throw new IntegrationError(
        "الاتصال غير نشط للكتابة المحدودة.",
        "WRITE_NOT_AVAILABLE",
        false,
      );
    if (!connection.secret_id)
      throw new IntegrationError(
        "سر الاتصال غير متاح.",
        "AUTHENTICATION_FAILED",
        false,
      );
    const secretParams = new URLSearchParams({
        select: "encrypted_payload,iv,auth_tag,algorithm,key_version",
        id: `eq.${connection.secret_id}`,
        revoked_at: "is.null",
        limit: "1",
      }),
      stored = (
        await this.database.select<SecretRow>(
          "integration_connection_secrets",
          secretParams,
        )
      )[0];
    if (!stored)
      throw new IntegrationError(
        "سر الاتصال ملغى أو مفقود.",
        "AUTHENTICATION_FAILED",
        false,
      );
    const encrypted: EncryptedSecret = {
      ciphertext: stored.encrypted_payload,
      iv: stored.iv,
      authTag: stored.auth_tag,
      keyVersion: stored.key_version,
      algorithm: stored.algorithm,
    };
    return { connection, secret: this.secrets.decrypt(encrypted) };
  }
  private context(
    connection: ConnectionWithSecret,
    secret: JsonObject,
    command: StoredWriteCommand,
    signal: AbortSignal,
  ): ConnectorContext {
    return {
      connection: connectionFor(connection),
      authScheme: connection.auth_scheme,
      secret,
      checkpoints: {},
      signal,
      logger: new WriteLogger(command.id),
    };
  }
  async process(command: StoredWriteCommand, workerId: string) {
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 45_000);
    let attemptId: string | null = null;
    try {
      await this.flags.require(
        "integration_write_enabled",
        command.organization_id,
      );
      const { connection, secret } = await this.load(command),
        connector = this.registry.get(
          connection.connector_key,
          connection.connector_version,
        );
      if (!connector.write)
        throw new IntegrationError(
          "الموصل لا يطبق عقد الكتابة.",
          "WRITE_NOT_SUPPORTED",
          false,
        );
      const input = {
          id: command.id,
          resourceKey: command.resource_key,
          commandType: command.command_type,
          entityType: command.entity_type,
          entityId: command.entity_id,
          desiredChange: command.desired_change,
          expectedSourceVersion: command.expected_source_version,
          idempotencyKey: command.idempotency_key,
        },
        context = this.context(connection, secret, command, controller.signal);
      const previousAttempts = await this.database.select<{ id: string }>(
          "integration_write_attempts",
          new URLSearchParams({
            select: "id",
            command_id: `eq.${command.id}`,
            limit: "100",
          }),
        ),
        [attempt] = await this.database.insert<{ id: string }>(
          "integration_write_attempts",
          {
            command_id: command.id,
            attempt_number: previousAttempts.length + 1,
            request_snapshot: {
              command_type: command.command_type,
              resource_key: command.resource_key,
              entity_type: command.entity_type,
              entity_id: command.entity_id,
              desired_change: command.desired_change,
              expected_source_version: command.expected_source_version,
              idempotency_key: command.idempotency_key,
            },
            status: "STARTED",
          },
        );
      attemptId = attempt?.id || null;
      const result = await connector.write(context, input);
      if (result.conflict) {
        if (attemptId)
          await this.database.update(
            "integration_write_attempts",
            `id=eq.${attemptId}`,
            {
              status: "FAILED",
              response_snapshot: {
                conflict: true,
                source_version: result.sourceVersion || null,
              },
              completed_at: new Date().toISOString(),
            },
            "return=minimal",
          );
        await this.database.rpc("integration_conflict_write_command", {
          target_command: command.id,
          worker_id: workerId,
          actual_version: result.sourceVersion || null,
          source_snapshot: result.sourceSnapshot || {},
        });
        return { commandId: command.id, status: "conflict" as const };
      }
      if (!result.ok)
        throw new IntegrationError(
          "لم يؤكد الموصل تنفيذ الكتابة.",
          "SOURCE_WRITE_FAILED",
          false,
        );
      const verification = connector.verifyWrite
        ? await connector.verifyWrite(context, input, result)
        : {
            verified: true,
            sourceVersion: result.sourceVersion,
            sourceSnapshot: result.sourceSnapshot,
            canonicalAfter: result.canonicalAfter,
          };
      if (!verification.verified)
        throw new IntegrationError(
          "نُفذت الكتابة لكن التحقق اللاحق لم يطابق الطلب.",
          "SOURCE_VERIFICATION_FAILED",
          false,
          { reason: verification.reason || null },
          result.compensationPayload,
        );
      await this.database.rpc("integration_complete_write_command", {
        target_command: command.id,
        worker_id: workerId,
        source_request_id: result.sourceRequestId || null,
        source_version_after:
          verification.sourceVersion || result.sourceVersion || null,
        source_snapshot:
          verification.sourceSnapshot || result.sourceSnapshot || {},
        canonical_after:
          verification.canonicalAfter ||
          result.canonicalAfter ||
          command.desired_change,
      });
      if (attemptId)
        await this.database.update(
          "integration_write_attempts",
          `id=eq.${attemptId}`,
          {
            status: "SUCCEEDED",
            response_snapshot: {
              source_request_id: result.sourceRequestId || null,
              source_version:
                verification.sourceVersion || result.sourceVersion || null,
              verified: true,
            },
            completed_at: new Date().toISOString(),
          },
          "return=minimal",
        );
      return { commandId: command.id, status: "succeeded" as const };
    } catch (error) {
      const normalized = asIntegrationError(error),
        compensation =
          error instanceof IntegrationError &&
          error.cause &&
          typeof error.cause === "object"
            ? (error.cause as JsonObject)
            : null;
      await this.database
        .rpc("integration_fail_write_command", {
          target_command: command.id,
          worker_id: workerId,
          error_code: normalized.code,
          error_message: normalized.message,
          compensation_payload: compensation,
        })
        .catch(() => undefined);
      if (attemptId)
        await this.database
          .update(
            "integration_write_attempts",
            `id=eq.${attemptId}`,
            {
              status: "FAILED",
              response_snapshot: {
                error_code: normalized.code,
                error_message: normalized.message,
              },
              completed_at: new Date().toISOString(),
            },
            "return=minimal",
          )
          .catch(() => undefined);
      if (compensation) await this.runCompensation(command, compensation);
      return {
        commandId: command.id,
        status: "failed" as const,
        error: { code: normalized.code, message: normalized.message },
      };
    } finally {
      clearTimeout(timeout);
    }
  }
  private async runCompensation(command: StoredWriteCommand, payload: JsonObject) {
    const rows = await this.database.select<{ id: string }>(
        "integration_compensations",
        new URLSearchParams({
          select: "id",
          command_id: `eq.${command.id}`,
          status: "eq.PENDING",
          order: "created_at.desc",
          limit: "1",
        }),
      ),
      compensation = rows[0];
    if (!compensation) return;
    try {
      await this.database.update(
        "integration_compensations",
        `id=eq.${compensation.id}`,
        { status: "RUNNING" },
        "return=minimal",
      );
      const { connection, secret } = await this.load(command),
        connector = this.registry.get(
          connection.connector_key,
          connection.connector_version,
        );
      if (!connector.compensate)
        throw new IntegrationError(
          "الموصل لا يوفر عقد تعويض آلي.",
          "COMPENSATION_REQUIRED",
          false,
        );
      const controller = new AbortController(),
        input = {
          id: command.id,
          resourceKey: command.resource_key,
          commandType: command.command_type,
          entityType: command.entity_type,
          entityId: command.entity_id,
          desiredChange: command.desired_change,
          expectedSourceVersion: command.expected_source_version,
          idempotencyKey: command.idempotency_key,
        },
        result = await connector.compensate(
          this.context(connection, secret, command, controller.signal),
          input,
          payload,
        );
      if (!result.ok)
        throw new IntegrationError(
          "لم يؤكد المصدر نجاح التعويض.",
          "COMPENSATION_REQUIRED",
          false,
        );
      const completedAt = new Date().toISOString();
      await this.database.update(
        "integration_compensations",
        `id=eq.${compensation.id}`,
        { status: "SUCCEEDED", completed_at: completedAt },
        "return=minimal",
      );
      await this.database.update(
        "integration_write_commands",
        `id=eq.${command.id}`,
        { status: "COMPENSATED", completed_at: completedAt },
        "return=minimal",
      );
      await this.database.insert(
        "integration_audit_events",
        {
          organization_id: command.organization_id,
          connection_id: command.connection_id,
          event_type: "reverse_write.compensated",
          severity: "warning",
          metadata: { command_id: command.id },
        },
        "return=minimal",
      );
    } catch {
      await this.database.update(
        "integration_compensations",
        `id=eq.${compensation.id}`,
        { status: "MANUAL_REQUIRED" },
        "return=minimal",
      );
    }
  }
  async processNext(workerId: string, limit = 5) {
    await this.flags.require("integration_write_enabled");
    const commands = await this.database.rpc<StoredWriteCommand[]>(
      "integration_claim_write_commands",
      {
        worker_id: workerId,
        claim_limit: Math.max(1, Math.min(limit, 20)),
        lease_seconds: 120,
      },
    );
    const results = [];
    for (const command of commands)
      results.push(await this.process(command, workerId));
    return results;
  }
}
