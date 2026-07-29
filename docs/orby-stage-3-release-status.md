# ORBY Stage 3 — Release Status

Date: 2026-07-29

## Production scope

ORBY Stage 3 memory, knowledge, RAG, proactive intelligence, approval-gated actions, schedules, reports, protected worker, database migrations, RLS, RPC permissions, tests, and production hardening are complete.

## Deferred integrations

The following provider-dependent integrations are intentionally deferred until all ORBY build stages are complete:

- External generative AI provider credentials and model activation.
- External OCR endpoint and API credentials for scanned PDFs and images.

Until then, Stage 3 uses its provider-independent local embedding fallback and grounded extractive RAG behavior. Native text-based document formats remain supported. Scanned PDF/image OCR remains disabled by design.

## Runtime activation

- The protected worker remains hosted on Vercel at `/api/orby/intelligence/worker`.
- Supabase Cron invokes the worker hourly at minute 7, independently from Vercel Hobby Cron limits.
- The private invocation token is encrypted in Supabase Vault and sent in a protected request header; GitHub stores only its SHA-256 digest.
- Each invocation drains jobs in batches, up to 100 jobs or a 45-second execution budget, instead of stopping after five jobs.
- Vercel production builds receive backend database access through a short-lived signed Vercel OIDC identity. The privileged database key remains absent from GitHub and client bundles.
- No external model or OCR key is required for the deferred operating mode.

## Release marker

This document update is the formal Stage 3 production release marker for the final `main` deployment.
