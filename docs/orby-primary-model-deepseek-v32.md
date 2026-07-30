# ORBY primary model: DeepSeek V3.2

ORBY uses OpenRouter as its external text-model gateway and Mistral OCR 3 for scanned images and PDFs.

The initial DeepSeek V4 Flash activation probe repeatedly returned reasoning-only output with an empty final content field. Its current OpenRouter catalog exposes only high and xhigh reasoning levels, which makes it unsuitable as the default low-latency path.

The governed runtime therefore uses:

- `deepseek/deepseek-v3.2` as the primary model;
- reasoning disabled by default for fast, deterministic operational requests;
- explicit reasoning opt-in for complex workflows;
- DeepSeek V4 Flash kept disabled as a future guarded heavy-reasoning option;
- Mistral OCR 3 unchanged;
- external channels unchanged and disabled.

Runtime activation still requires all of the following to pass atomically:

1. OpenRouter key and health check.
2. A real DeepSeek V3.2 generation probe.
3. Mistral OCR model availability.
4. Founder-guarded Supabase activation RPC.

No credential is stored in GitHub or Supabase.
