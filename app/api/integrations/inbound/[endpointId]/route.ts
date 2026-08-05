import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { after } from "next/server";
import {
  IntegrationDatabase,
  IntegrationQueue,
  SecretsManager,
} from "@/src/lib/integration/platform";
import { parseCsv } from "@/src/lib/csv";
import { dispatchDurableWorker, mirrorUsageEvent } from "@/src/lib/platform-integrations";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 30;
type Endpoint = {
  id: string;
  organization_id: string;
  connection_id: string;
  auth_mode: "TOKEN" | "HMAC_SHA256";
  token_hash: string;
  signing_secret_ciphertext: string | null;
  signing_secret_iv: string | null;
  signing_secret_auth_tag: string | null;
  signing_secret_key_version: number | null;
  is_active: boolean;
  revoked_at: string | null;
};
const equal = (left: string, right: string) => {
  const a = Buffer.from(left),
    b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
};
const records = (value: unknown) => {
  if (Array.isArray(value)) return value;
  if (
    value &&
    typeof value === "object" &&
    Array.isArray((value as { records?: unknown[] }).records)
  )
    return (value as { records: unknown[] }).records;
  return [];
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ endpointId: string }> },
) {
  const { endpointId } = await params,
    contentLength = Number(request.headers.get("content-length") || 0);
  if (contentLength > 1_048_576)
    return Response.json(
      { ok: false, error: "PAYLOAD_TOO_LARGE" },
      { status: 413 },
    );
  const database = new IntegrationDatabase(),
    endpoint = (
      await database.select<Endpoint>(
        "integration_inbound_endpoints",
        new URLSearchParams({
          select:
            "id,organization_id,connection_id,auth_mode,token_hash,signing_secret_ciphertext,signing_secret_iv,signing_secret_auth_tag,signing_secret_key_version,is_active,revoked_at",
          endpoint_key: `eq.${endpointId}`,
          limit: "1",
        }),
      )
    )[0];
  if (!endpoint?.is_active || endpoint.revoked_at)
    return Response.json(
      { ok: false, error: "ENDPOINT_NOT_FOUND" },
      { status: 404 },
    );
  const raw = await request.text();
  if (Buffer.byteLength(raw) > 1_048_576)
    return Response.json(
      { ok: false, error: "PAYLOAD_TOO_LARGE" },
      { status: 413 },
    );
  if (endpoint.auth_mode === "HMAC_SHA256") {
    const supplied = (request.headers.get("x-madar-signature") || "").replace(
        /^sha256=/i,
        "",
      ),
      encrypted = {
        ciphertext: endpoint.signing_secret_ciphertext || "",
        iv: endpoint.signing_secret_iv || "",
        authTag: endpoint.signing_secret_auth_tag || "",
        keyVersion: endpoint.signing_secret_key_version || 0,
        algorithm: "aes-256-gcm" as const,
      };
    if (
      !supplied ||
      !encrypted.ciphertext ||
      !encrypted.iv ||
      !encrypted.authTag
    )
      return Response.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 },
      );
    const decrypted = new SecretsManager().decrypt(encrypted),
      secret = typeof decrypted.secret === "string" ? decrypted.secret : "",
      expected = createHmac("sha256", secret).update(raw).digest("hex");
    if (!secret || !equal(expected, supplied))
      return Response.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 },
      );
  } else {
    const authorization = request.headers.get("authorization") || "",
      token = authorization.startsWith("Bearer ")
        ? authorization.slice(7)
        : request.headers.get("x-madar-endpoint-token") || "";
    if (
      !token ||
      !equal(
        createHash("sha256").update(token).digest("hex"),
        endpoint.token_hash,
      )
    )
      return Response.json(
        { ok: false, error: "UNAUTHORIZED" },
        { status: 401 },
      );
  }
  let payload: unknown;
  const contentType = request.headers.get("content-type") || "";
  if (
    contentType.includes("text/csv") ||
    contentType.includes("application/csv")
  ) {
    try {
      const parsed = parseCsv(raw, { maxRows: 1000, maxColumns: 200 });
      payload = {
        stream_key: request.headers.get("x-madar-stream-key") || "events",
        records: parsed.rows,
      };
    } catch {
      return Response.json(
        { ok: false, error: "INVALID_CSV" },
        { status: 400 },
      );
    }
  } else
    try {
      payload = JSON.parse(raw);
    } catch {
      return Response.json(
        { ok: false, error: "INVALID_JSON" },
        { status: 400 },
      );
    }
  const batchRecords = records(payload);
  if (!batchRecords.length || batchRecords.length > 1000)
    return Response.json(
      { ok: false, error: "RECORD_COUNT_INVALID" },
      { status: 422 },
    );
  const streamKey =
      payload &&
      typeof payload === "object" &&
      typeof (payload as { stream_key?: unknown }).stream_key === "string"
        ? String((payload as { stream_key: string }).stream_key)
        : "events",
    idempotency =
      request.headers.get("idempotency-key") ||
      createHash("sha256").update(raw).digest("hex");
  try {
    const [delivery] = await database.insert<{ id: string }>(
        "integration_inbound_deliveries",
        {
          organization_id: endpoint.organization_id,
          endpoint_id: endpoint.id,
          idempotency_key: idempotency,
          headers: {
            content_type: request.headers.get("content-type"),
            user_agent: request.headers.get("user-agent"),
          },
          payload: payload as never,
          status: "accepted",
        },
      ),
      [run] = await database.insert<{ id: string }>("integration_sync_runs", {
        organization_id: endpoint.organization_id,
        connection_id: endpoint.connection_id,
        sync_mode: "incremental",
        status: "succeeded",
        records_received: batchRecords.length,
        batches_received: 1,
        metadata: { channel: "inbound", endpoint_id: endpoint.id },
        finished_at: new Date().toISOString(),
      }),
      [batch] = await database.insert<{ id: string }>(
        "integration_raw_batches",
        {
          organization_id: endpoint.organization_id,
          connection_id: endpoint.connection_id,
          sync_run_id: run.id,
          stream_key: streamKey,
          records: batchRecords as never,
          record_count: batchRecords.length,
          idempotency_key: `inbound:${endpoint.id}:${idempotency}`,
          metadata: { delivery_id: delivery.id },
        },
      );
    const queue = new IntegrationQueue(database);
    const job = await queue.enqueue({
      organizationId: endpoint.organization_id,
      connectionId: endpoint.connection_id,
      jobType: "pipeline.process_batch",
      payload: { raw_batch_id: batch.id },
      idempotencyKey: `pipeline:${batch.id}`,
    });
    await database.update(
      "integration_inbound_deliveries",
      `id=eq.${delivery.id}`,
      { status: "queued" },
    );
    await database.update(
      "integration_inbound_endpoints",
      `id=eq.${endpoint.id}`,
      { last_received_at: new Date().toISOString() },
    );
    after(async () => {
      await Promise.allSettled([
        dispatchDurableWorker({ kind: "integration", correlationId: job.id, reason: "inbound-batch-queued" }),
        mirrorUsageEvent({
          id: `integration-inbound-${delivery.id}`,
          type: "integration.records.received",
          subject: endpoint.organization_id,
          data: {
            records: batchRecords.length,
            batches: 1,
            connection_id: endpoint.connection_id,
            stream_key: streamKey,
            channel: "inbound",
          },
        }),
      ]);
    });
    return Response.json(
      { ok: true, deliveryId: delivery.id, records: batchRecords.length },
      { status: 202, headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Inbound connector delivery failed", {
      endpointId,
      error: error instanceof Error ? error.name : "unknown",
    });
    return Response.json(
      { ok: false, error: "DELIVERY_REJECTED" },
      { status: 409, headers: { "Cache-Control": "no-store" } },
    );
  }
}