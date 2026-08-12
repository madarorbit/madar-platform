import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { supabaseServiceConfig } from "@/src/lib/supabase/service";

/**
 * Server-only client for Retail tables in the primary MADAR database.
 *
 * This client bypasses Retail RLS, so every call site must first establish a
 * MADAR Platform principal and workspace scope. Financial RPCs additionally go
 * through retail_platform_execute, which restores the actor inside PostgreSQL.
 */
export function createClient() {
  const { url, key } = supabaseServiceConfig();
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "x-client-info": "madar-platform-retail-bff/1" } },
  });
}
