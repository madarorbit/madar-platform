/**
 * Deployment-only backend secret placeholder.
 *
 * This file must remain empty in GitHub. The production release bootstrap may
 * replace the empty value inside the isolated Vercel build workspace. It is
 * imported only by the Node.js integration database adapter, never by client
 * components, and is not committed with a populated value.
 */
export const deploymentSupabaseServiceRoleKey='';
