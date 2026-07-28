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

- Vercel Cron calls `/api/orby/intelligence/worker` hourly.
- The worker requires `MADAR_ORBY_WORKER_SECRET`, `MADAR_INTEGRATION_WORKER_SECRET`, or `CRON_SECRET`.
- No external model or OCR key is required for the deferred operating mode.

## Release marker

This document update is the formal Stage 3 production release marker for the final `main` deployment.
