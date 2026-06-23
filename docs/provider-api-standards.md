# Provider API Standards

## Official References

Use these vendor docs as the primary API standard references when working on provider integration:

- OpenAI API Reference: https://platform.openai.com/docs/api-reference
- Cloudflare Workers AI OpenAI compatibility: https://developers.cloudflare.com/workers-ai/configuration/open-ai-compatibility/
- LM Studio Developer Docs: https://lmstudio.ai/docs/developer
- LM Studio OpenAI compatibility: https://lmstudio.ai/docs/developer/openai-compat
- Ollama API Introduction: https://docs.ollama.com/api/introduction
- Ollama OpenAI compatibility: https://docs.ollama.com/api/openai-compatibility

## Project Usage

Current provider integration should follow the closest matching vendor standard:

- `openai`: OpenAI API Reference
- `cloudflare`: OpenAI-compatible endpoints in Cloudflare Workers AI
- `lmstudio`: OpenAI-compatible local server API
- `ollama`: Ollama native API plus OpenAI-compatible endpoints
- `volcengine`: OpenAI-compatible request/response shape unless a route explicitly documents a different contract

When in doubt, prefer the official vendor docs above over implementation guesses.
