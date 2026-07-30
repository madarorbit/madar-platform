# ORBY external runtime automatic selection

ORBY validates the OpenRouter credential before opening runtime gates. The activation flow reads `/api/v1/key` to distinguish a normal completion key from management or provisioning keys, checks the remaining key limit, reads the live model catalog, and probes a governed low-cost candidate set.

Candidate order:

1. `google/gemini-2.5-flash-lite`
2. `openai/gpt-4.1-nano`
3. `deepseek/deepseek-v3.2`

The first candidate that returns the activation marker using the production privacy routing policy becomes the single enabled runtime model. The process then validates Mistral OCR before atomically opening both feature gates through the founder-guarded Supabase RPC.

The production OpenRouter adapter no longer forces unsupported parameters globally. It retains automatic provider fallback and `data_collection: deny`. DeepSeek V4 Flash remains registered but excluded from automatic activation because of its reasoning-only response behavior during the initial production probes.

No API key, generated text, or document data is persisted by the activation diagnostics. Logs contain only safe model IDs, HTTP statuses, and outcome labels.
