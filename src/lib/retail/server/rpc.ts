import "server-only";

import { createClient } from "@/src/lib/retail/supabase/server";

export class RetailDatabaseError extends Error {
  constructor(
    message: string,
    readonly code?: string,
  ) {
    super(message);
    this.name = "RetailDatabaseError";
  }
}

export async function executeRetailRpc<T = unknown>(
  actorId: string,
  operation: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const client = createClient();
  const { data, error } = await client.rpc("retail_platform_execute", {
    actor_user: actorId,
    operation_name: operation,
    operation_args: args,
  });

  if (error) {
    console.error("Retail database operation failed", {
      operation,
      code: error.code,
    });
    throw new RetailDatabaseError(error.message, error.code);
  }

  return data as T;
}
