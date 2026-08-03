import { randomUUID, timingSafeEqual } from "node:crypto";
import { integrationWorkerConfig } from "@/src/lib/env";
import { publicError } from "@/src/lib/integration/errors";
import { createIntegrationRuntime } from "@/src/lib/integration/runtime";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function equal(left: string, right: string) {
  const a = Buffer.from(left),
    b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}
function authorized(request: Request) {
  const expected = integrationWorkerConfig().secret,
    authorization = request.headers.get("authorization") || "",
    provided = authorization.startsWith("Bearer ")
      ? authorization.slice(7)
      : request.headers.get("x-madar-worker-secret") || "";
  return Boolean(provided) && equal(provided, expected);
}

async function execute(request: Request) {
  try {
    if (!authorized(request))
      return Response.json(
        {
          ok: false,
          error: {
            code: "UNAUTHORIZED",
            message: "غير مصرح بتشغيل عامل محرك الربط.",
          },
        },
        { status: 401, headers: { "Cache-Control": "no-store" } },
      );
    const integration = createIntegrationRuntime(),
      scheduler = await integration.flags.resolve(
        "integration_scheduler_enabled",
      ),
      worker = await integration.flags.resolve("integration_worker_enabled");
    const scheduled = scheduler.enabled
      ? await integration.queue.enqueueDueSchedules(50)
      : 0;
    if (!worker.enabled)
      return Response.json(
        {
          ok: true,
          worker: "disabled",
          scheduler: scheduler.enabled ? "enabled" : "disabled",
          scheduled,
          processed: [],
        },
        { headers: { "Cache-Control": "no-store" } },
      );
    const workerId = `vercel:${request.headers.get("x-vercel-id") || randomUUID()}`,
      writeFlag = await integration.flags.resolve("integration_write_enabled"),
      [processed, writes, subscriptionChanges] = await Promise.all([
        integration.syncEngine.processNext(workerId, 5),
        writeFlag.enabled
          ? integration.writeEngine.processNext(workerId, 5)
          : Promise.resolve([]),
        integration.database.rpc<number>("apply_due_v2_subscription_changes", {
          batch_limit: 100,
        }),
      ]);
    return Response.json(
      {
        ok: true,
        worker: "enabled",
        scheduler: scheduler.enabled ? "enabled" : "disabled",
        writeWorker: writeFlag.enabled ? "enabled" : "disabled",
        scheduled,
        processed,
        writes,
        subscriptionChanges,
        timestamp: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    console.error("Integration worker execution failed", publicError(error));
    return Response.json(
      {
        ok: false,
        error: publicError(error),
        timestamp: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export const GET = execute;
export const POST = execute;
