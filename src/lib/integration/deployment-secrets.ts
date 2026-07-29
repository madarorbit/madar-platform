import 'server-only';

/**
 * Deployment-only server secret placeholder.
 *
 * This file must remain empty in GitHub. The production release bootstrap may
 * replace the empty value inside the isolated Vercel build workspace. The
 * generated value is bundled only into server functions and is never shipped
 * to browser code or committed to source control.
 */
export const deploymentSupabaseServiceRoleKey='';
