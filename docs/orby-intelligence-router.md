# ORBY Intelligence Router v1

This document records the additive router design for ORBY. ORBY Core remains the owner of identity, memory, context, personality, tools, and policies. The new intelligence router selects the best registered model for each request, while the existing routing engine remains responsible for provider execution, retries, and fallback.

The router is provider-neutral: model names and model-specific scores live in the model registry rather than in ORBY Core. This allows the model to change between messages in the same conversation without changing ORBY identity or memory.
