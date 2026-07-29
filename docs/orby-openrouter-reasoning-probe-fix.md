# ORBY OpenRouter reasoning probe fix

The external runtime activation probe previously allowed only 24 output tokens while DeepSeek V4 Flash enables reasoning by default. The model could spend the entire output budget on reasoning and return an empty final content field even though the API key, billing, and model routing were valid.

This fix:

- adds explicit reasoning controls to ORBY generation options;
- disables reasoning by default for fast and low-cost OpenRouter calls;
- disables reasoning explicitly for the activation probe;
- increases the probe output budget to 64 tokens;
- handles embedded OpenRouter errors returned inside HTTP 200 responses;
- accepts string and structured text response content;
- preserves the ability to enable high reasoning explicitly for complex workflows later.

Runtime gates remain closed until OpenRouter, DeepSeek, and Mistral OCR checks all succeed.