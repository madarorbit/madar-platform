import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

function retailSupabaseConfig() {
  const url = process.env.RETAIL_SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.RETAIL_SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!url || !serviceRoleKey) {
    throw new Error(
      "قاعدة MADAR Retail غير مضبوطة. يلزم RETAIL_SUPABASE_URL وRETAIL_SUPABASE_SERVICE_ROLE_KEY على الخادم.",
    );
  }

  try {
    new URL(url);
  } catch {
    throw new Error("RETAIL_SUPABASE_URL يجب أن يكون رابطًا صالحًا.");
  }

  return { url: url.replace(/\/$/, ""), serviceRoleKey };
}

/**
 * Server-only client for the isolated Retail database.
 *
 * This client bypasses Retail RLS, so every call site must first establish a
 * MADAR Platform principal and workspace scope. Financial RPCs additionally go
 * through retail_platform_execute, which restores the actor inside PostgreSQL.
 */
export function createClient() {
  const { url, serviceRoleKey } = retailSupabaseConfig();
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    global: { headers: { "x-client-info": "madar-platform-retail-bff/1" } },
  });
}
