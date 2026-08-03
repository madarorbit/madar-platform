import { createHash } from "node:crypto";
import type {
  ConnectorBatch,
  ConnectorConnection,
  ConnectorContext,
  ConnectorLogger,
  ConnectorSyncRequest,
  EncryptedSecret,
  JsonObject,
  JsonValue,
  StoredIntegrationConnection,
  StoredIntegrationJob,
} from "./contracts";
import { asIntegrationError, IntegrationError, retryAt } from "./errors";
import { DataPipelineEngine } from "./pipeline";
import { ConnectorRegistry } from "./registry";
import {
  CheckpointStore,
  FeatureFlagService,
  IntegrationDatabase,
  IntegrationQueue,
  RawBatchStore,
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
  revoked_at: string | null;
};
type SyncRunRow = { id: string };

function streamsFromPayload(payload: JsonObject) {
  const value = payload.streams;
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : undefined;
}
function batchHash(connectionId: string, batch: ConnectorBatch) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        connectionId,
        batch.streamKey,
        batch.nextCursor,
        batch.watermark,
        batch.records,
      ]),
    )
    .digest("hex");
}
function connectionForConnector(
  row: ConnectionWithSecret,
): ConnectorConnection {
  return {
    id: row.id,
    organizationId: row.organization_id,
    connectorKey: row.connector_key,
    connectorVersion: row.connector_version,
    name: row.name,
    status: row.status,
    mode: row.connection_mode,
    config: row.config,
  };
}
const ENTITY_BY_STREAM: Record<string, string> = {
  products: "product",
  customers: "customer",
  suppliers: "supplier",
  inventory: "inventory",
  sales: "sale",
  orders: "order",
  payments: "payment",
  expenses: "expense",
  purchase_orders: "purchase_order",
  goods_receipts: "goods_receipt",
  sales_returns: "sales_return",
  recipes: "recipe",
  restaurant_orders: "restaurant_order",
  kitchen_tickets: "kitchen_ticket",
  hotel_properties: "hotel_property",
  hotel_rooms: "hotel_room",
  hotel_rates: "hotel_rate",
  hotel_reservations: "hotel_reservation",
  hotel_stays: "hotel_stay",
  hotel_folios: "hotel_folio",
};

class SafeConnectorLogger implements ConnectorLogger {
  constructor(
    private readonly connectionId: string,
    private readonly jobId: string,
  ) {}
  private write(level: string, message: string, metadata: JsonObject = {}) {
    const safe = {
      connectionId: this.connectionId,
      jobId: this.jobId,
      ...metadata,
    };
    if (level === "error") console.error(message, safe);
    else if (level === "warn") console.warn(message, safe);
    else if (level === "debug") console.debug(message, safe);
    else console.info(message, safe);
  }
  debug(message: string, metadata?: JsonObject) {
    this.write("debug", message, metadata);
  }
  info(message: string, metadata?: JsonObject) {
    this.write("info", message, metadata);
  }
  warn(message: string, metadata?: JsonObject) {
    this.write("warn", message, metadata);
  }
  error(message: string, metadata?: JsonObject) {
    this.write("error", message, metadata);
  }
}

export class SyncEngine {
  constructor(
    private readonly database: IntegrationDatabase,
    private readonly registry: ConnectorRegistry,
    private readonly secrets: SecretsManager,
    private readonly queue: IntegrationQueue,
    private readonly checkpoints: CheckpointStore,
    private readonly rawBatches: RawBatchStore,
    private readonly flags: FeatureFlagService,
    private readonly pipeline: DataPipelineEngine,
  ) {}
  private async loadConnection(job: StoredIntegrationJob) {
    if (!job.connection_id)
      throw new IntegrationError(
        "مهمة الربط لا تحتوي على اتصال محدد.",
        "CONFIGURATION_ERROR",
        false,
        { jobId: job.id },
      );
    const params = new URLSearchParams({
      select:
        "id,organization_id,connector_key,connector_version,name,status,connection_mode,auth_scheme,config,secret_id,last_tested_at,last_success_at,last_error_code,last_error_message,created_by,created_at,updated_at,deleted_at",
      id: `eq.${job.connection_id}`,
      organization_id: `eq.${job.organization_id}`,
      deleted_at: "is.null",
      limit: "1",
    });
    const connection = (
      await this.database.select<ConnectionWithSecret>(
        "integration_connections",
        params,
      )
    )[0];
    if (!connection)
      throw new IntegrationError(
        "اتصال مهمة المزامنة غير موجود.",
        "CONNECTION_NOT_FOUND",
        false,
        { connectionId: job.connection_id },
      );
    if (!connection.secret_id)
      throw new IntegrationError(
        "لا توجد بيانات مصادقة مرتبطة بالاتصال.",
        "AUTHENTICATION_FAILED",
        false,
        { connectionId: connection.id },
      );
    const secretParams = new URLSearchParams({
      select: "encrypted_payload,iv,auth_tag,algorithm,key_version,revoked_at",
      id: `eq.${connection.secret_id}`,
      connection_id: `eq.${connection.id}`,
      revoked_at: "is.null",
      limit: "1",
    });
    const stored = (
      await this.database.select<SecretRow>(
        "integration_connection_secrets",
        secretParams,
      )
    )[0];
    if (!stored)
      throw new IntegrationError(
        "بيانات مصادقة الاتصال مفقودة أو ملغاة.",
        "AUTHENTICATION_FAILED",
        false,
        { connectionId: connection.id },
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
  private async audit(
    action: string,
    connection: ConnectionWithSecret,
    job: StoredIntegrationJob,
    metadata: JsonObject = {},
  ) {
    await this.database
      .insert(
        "audit_logs",
        {
          actor_id: job.created_by,
          action,
          entity_type: "integration_connection",
          entity_id: connection.id,
          metadata: {
            organization_id: connection.organization_id,
            job_id: job.id,
            ...metadata,
          },
        },
        "return=minimal",
      )
      .catch(() => undefined);
  }
  private context(
    connection: ConnectionWithSecret,
    secret: JsonObject,
    job: StoredIntegrationJob,
    signal: AbortSignal,
    checkpointMap: Record<
      string,
      import("./contracts").ConnectorCheckpoint | undefined
    >,
  ): ConnectorContext {
    return {
      connection: connectionForConnector(connection),
      authScheme: connection.auth_scheme,
      secret,
      checkpoints: checkpointMap,
      signal,
      logger: new SafeConnectorLogger(connection.id, job.id),
    };
  }
  private async prepareDiscovery(
    connection: ConnectionWithSecret,
    connector: ReturnType<ConnectorRegistry["get"]>,
  ) {
    const streams = connector.manifest.streams.map((stream) => ({
      key: stream.key,
      label: stream.label,
      supports_initial: stream.supportsInitial,
      supports_incremental: stream.supportsIncremental,
      entity_key: ENTITY_BY_STREAM[stream.key] || null,
    }));
    const discoveredSchema = {
      connector_key: connector.manifest.key,
      connector_version: connector.manifest.version,
      streams,
    } as unknown as JsonObject;
    const schemaVersion = createHash("sha256")
      .update(JSON.stringify(discoveredSchema))
      .digest("hex");
    const snapshots = await this.database.upsert<{ id: string }>(
      "integration_schema_snapshots",
      {
        organization_id: connection.organization_id,
        connection_id: connection.id,
        schema_version: schemaVersion,
        discovered_schema: discoveredSchema,
        status: "ready",
      },
      "connection_id,schema_version",
    );
    const snapshotId = snapshots[0]?.id;
    await this.database.update(
      "integration_mapping_previews",
      `connection_id=eq.${connection.id}&status=eq.preview`,
      { status: "superseded" },
      "return=minimal",
    );
    const mappings = streams.flatMap((stream) =>
      stream.entity_key
        ? [
            {
              organization_id: connection.organization_id,
              connection_id: connection.id,
              schema_snapshot_id: snapshotId || null,
              entity_key: stream.entity_key,
              proposed_mapping: {
                stream_key: stream.key,
                entity_key: stream.entity_key,
                strategy: "AUTO_IDENTITY_V2",
              },
              confidence: 0.85,
              sample_input: [],
              sample_output: [],
              status: "preview",
            },
          ]
        : [],
    );
    if (mappings.length)
      await this.database.insert(
        "integration_mapping_previews",
        mappings as unknown as JsonObject[],
        "return=minimal",
      );
    await this.database.update(
      "integration_sync_previews",
      `connection_id=eq.${connection.id}&status=in.(building,ready)`,
      { status: "expired" },
      "return=minimal",
    );
    await this.database.insert(
      "integration_sync_previews",
      {
        organization_id: connection.organization_id,
        connection_id: connection.id,
        entity_counts: Object.fromEntries(
          streams
            .filter((stream) => stream.entity_key)
            .map((stream) => [stream.entity_key, 0]),
        ),
        warnings: streams.some((stream) => !stream.entity_key)
          ? ["بعض مسارات البيانات تحتاج مطابقة يدوية."]
          : [],
        estimated_duration_seconds: Math.max(5, streams.length * 3),
        status: "ready",
      },
      "return=minimal",
    );
  }
  private async test(job: StoredIntegrationJob, workerId: string) {
    const { connection, secret } = await this.loadConnection(job),
      connector = this.registry.get(
        connection.connector_key,
        connection.connector_version,
      ),
      controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 30_000),
      started = Date.now();
    try {
      const result = await connector.testConnection(
        this.context(connection, secret, job, controller.signal, {}),
      );
      if (!result.ok)
        throw new IntegrationError(
          "فشل اختبار الاتصال بالنظام الخارجي.",
          "AUTHENTICATION_FAILED",
          false,
          {
            connectionId: connection.id,
            warnings: (result.warnings || []) as unknown as JsonValue,
          },
        );
      await this.database.update(
        "integration_connections",
        `id=eq.${connection.id}`,
        {
          status: "active",
          last_tested_at: new Date().toISOString(),
          last_error_code: null,
          last_error_message: null,
        },
      );
      await this.prepareDiscovery(connection, connector);
      await this.audit(
        "integration.connection.test_succeeded",
        connection,
        job,
        {
          latency_ms: result.latencyMs || Date.now() - started,
          account_label: result.accountLabel || null,
        },
      );
      await this.queue.complete(job.id, workerId, {
        ok: true,
        latency_ms: result.latencyMs || Date.now() - started,
      });
    } finally {
      clearTimeout(timeout);
    }
  }
  private async sync(
    job: StoredIntegrationJob,
    workerId: string,
    mode: "initial" | "incremental",
  ) {
    const { connection, secret } = await this.loadConnection(job);
    if (connection.status !== "active")
      throw new IntegrationError(
        "الاتصال غير نشط ولا يمكن مزامنته.",
        "VALIDATION_ERROR",
        false,
        { connectionId: connection.id, status: connection.status },
      );
    const connector = this.registry.get(
        connection.connector_key,
        connection.connector_version,
      ),
      available = new Set(
        connector.manifest.streams
          .filter((stream) =>
            mode === "initial"
              ? stream.supportsInitial
              : stream.supportsIncremental,
          )
          .map((stream) => stream.key),
      ),
      requested = streamsFromPayload(job.payload),
      selected = requested?.length ? requested : [...available];
    for (const stream of selected)
      if (!available.has(stream))
        throw new IntegrationError(
          "طلبت المهمة Stream غير مدعوم من الموصل.",
          "VALIDATION_ERROR",
          false,
          { connectionId: connection.id, stream },
        );
    const checkpointMap = await this.checkpoints.list(connection.id),
      [run] = await this.database.insert<SyncRunRow>("integration_sync_runs", {
        organization_id: connection.organization_id,
        connection_id: connection.id,
        job_id: job.id,
        sync_mode: mode,
        status: "running",
        checkpoint_before: checkpointMap as unknown as JsonValue,
        started_at: new Date().toISOString(),
      });
    const controller = new AbortController(),
      timeout = setTimeout(() => controller.abort(), 50_000),
      context = this.context(
        connection,
        secret,
        job,
        controller.signal,
        checkpointMap,
      ),
      request: ConnectorSyncRequest = { streams: selected };
    let records = 0,
      batches = 0;
    const entityCounts: Record<string, number> = {};
    try {
      const iterator =
        mode === "initial"
          ? connector.initialSync(context, request)
          : connector.incrementalSync(context, request);
      for await (const batch of iterator) {
        if (!selected.includes(batch.streamKey))
          throw new IntegrationError(
            "أعاد الموصل Stream خارج نطاق المهمة.",
            "VALIDATION_ERROR",
            false,
            { stream: batch.streamKey },
          );
        const previous = checkpointMap[batch.streamKey],
          checkpoint = {
            streamKey: batch.streamKey,
            cursor: batch.nextCursor,
            watermark: batch.watermark,
            version: (previous?.version || 0) + 1,
          };
        const [rawBatch] = await this.rawBatches.persist({
          organizationId: connection.organization_id,
          connectionId: connection.id,
          syncRunId: run.id,
          streamKey: batch.streamKey,
          records: batch.records,
          cursor: batch.nextCursor,
          watermark: batch.watermark,
          idempotencyKey: batchHash(connection.id, batch),
          metadata: batch.metadata,
        });
        if (
          rawBatch &&
          (
            await this.flags.resolve(
              "integration_pipeline_enabled",
              connection.organization_id,
            )
          ).enabled
        )
          await this.queue.enqueue({
            organizationId: connection.organization_id,
            connectionId: connection.id,
            jobType: "pipeline.process_batch",
            payload: { raw_batch_id: rawBatch.id },
            idempotencyKey: `pipeline:${rawBatch.id}`,
            createdBy: job.created_by || undefined,
          });
        await this.checkpoints.save(
          connection.organization_id,
          connection.id,
          checkpoint,
        );
        checkpointMap[batch.streamKey] = checkpoint;
        records += batch.records.length;
        batches += 1;
        const entity = ENTITY_BY_STREAM[batch.streamKey] || batch.streamKey;
        entityCounts[entity] =
          (entityCounts[entity] || 0) + batch.records.length;
        await this.database.update("integration_sync_runs", `id=eq.${run.id}`, {
          records_received: records,
          batches_received: batches,
          checkpoint_after: checkpointMap as unknown as JsonValue,
        });
        await this.queue.heartbeat(job.id, workerId, 120);
      }
      const finishedAt = new Date().toISOString();
      await this.database.update("integration_sync_runs", `id=eq.${run.id}`, {
        status: "succeeded",
        records_received: records,
        batches_received: batches,
        checkpoint_after: checkpointMap as unknown as JsonValue,
        finished_at: finishedAt,
      });
      await this.database.update(
        "integration_connections",
        `id=eq.${connection.id}`,
        {
          status: "active",
          last_success_at: finishedAt,
          last_error_code: null,
          last_error_message: null,
        },
      );
      if (mode === "initial")
        await this.database.update(
          "integration_sync_previews",
          `connection_id=eq.${connection.id}&status=eq.approved`,
          { entity_counts: entityCounts, status: "approved" },
          "return=minimal",
        );
      await this.audit("integration.sync.succeeded", connection, job, {
        sync_run_id: run.id,
        sync_mode: mode,
        records,
        batches,
      });
      await this.queue.complete(job.id, workerId, {
        sync_run_id: run.id,
        records,
        batches,
      });
    } catch (error) {
      const normalized = asIntegrationError(error);
      await this.database
        .update("integration_sync_runs", `id=eq.${run.id}`, {
          status: "failed",
          error_code: normalized.code,
          error_message: normalized.message,
          records_received: records,
          batches_received: batches,
          finished_at: new Date().toISOString(),
        })
        .catch(() => undefined);
      throw normalized;
    } finally {
      clearTimeout(timeout);
    }
  }
  private async execute(job: StoredIntegrationJob, workerId: string) {
    await this.flags.require("integration_engine_enabled", job.organization_id);
    if (job.job_type === "connection.test") return this.test(job, workerId);
    if (job.job_type === "sync.initial")
      return this.sync(job, workerId, "initial");
    if (job.job_type === "sync.incremental")
      return this.sync(job, workerId, "incremental");
    if (job.job_type === "pipeline.process_batch")
      return this.pipeline.processBatch(job, workerId);
    throw new IntegrationError(
      "نوع مهمة الربط غير مدعوم.",
      "CONFIGURATION_ERROR",
      false,
      { jobType: job.job_type },
    );
  }
  async processClaimedJob(job: StoredIntegrationJob, workerId: string) {
    try {
      await this.execute(job, workerId);
      return { jobId: job.id, status: "succeeded" as const };
    } catch (error) {
      const normalized = asIntegrationError(error),
        canRetry = normalized.retryable && job.attempts < job.max_attempts,
        next = canRetry ? retryAt(job.attempts) : null;
      await this.queue
        .fail(job.id, workerId, normalized.code, normalized.message, next)
        .catch(() => undefined);
      if (job.connection_id && job.job_type !== "pipeline.process_batch")
        await this.database
          .update("integration_connections", `id=eq.${job.connection_id}`, {
            status: canRetry ? "verifying" : "error",
            last_error_code: normalized.code,
            last_error_message: normalized.message,
          })
          .catch(() => undefined);
      return {
        jobId: job.id,
        status: canRetry ? ("retrying" as const) : ("dead" as const),
        error: { code: normalized.code, message: normalized.message },
      };
    }
  }
  async processNext(workerId: string, limit = 5) {
    await this.flags.require("integration_worker_enabled");
    const jobs = await this.queue.claim(workerId, limit);
    const results = [];
    for (const job of jobs)
      results.push(await this.processClaimedJob(job, workerId));
    return results;
  }
}
