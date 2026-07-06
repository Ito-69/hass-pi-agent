# HASS AI Assistant

Local and Cloud AI Assistant with full Home Assistant access — manage automations, entities, dashboards, and more via natural language.

## Configuration

### Default Provider

Select the AI provider to use by default.

Supported providers:
- `anthropic` (Claude)
- `openai` (GPT models, or local servers like `llama.cpp`)
- `google` (Gemini)
- `openrouter` (OpenRouter API)
- `groq` (Groq API)
- `xai` (Grok)
- `mistral` (Mistral API)
- `cerebras` (Cerebras API)
- `huggingface` (Hugging Face API)
- `github-copilot` (Copilot API)
- `amazon-bedrock` (AWS Bedrock)
- `azure-openai-responses` (Azure OpenAI)
- `opencode-zen` (OpenCode Zen API)
- `opencode-go` (OpenCode Go API)
- `minimax` (MiniMax API)
- `omniroute` (Omniroute API)

### Default Model

Optionally set a default model. Accepts any model pattern or ID supported by Pi, for example:

- `anthropic/claude-sonnet-4-20250514`
- `openai/gpt-4o`
- `Qwen3.6-35B-A3B-UD-Q5_K_M`
- `google/gemini-2.5-pro`
- `*sonnet*` (fuzzy match)

Leave empty to use the provider's default model.

### Local LLM (llama.cpp)
To use a local `llama.cpp` server (e.g. running on your network or host):
1. Select `openai` as the **Default Provider**.
2. Put your llama.cpp base URL (e.g., `http://192.168.68.50:8080/v1`) into the **openai_api_base** field.
3. Put your active model name (e.g., `Qwen3.6-35B-A3B-UD-Q5_K_M`) into the **Default Model** field.

### Environment

Set environment variables as `KEY=VALUE` pairs — one per entry. Use this for **API keys** and any other configuration.

#### API Keys

Add your provider's API key as an environment variable:

| Provider | Environment entry |
|----------|-------------------|
| Anthropic (Claude) | `ANTHROPIC_API_KEY=sk-ant-...` |
| OpenAI | `OPENAI_API_KEY=sk-...` |
| Google (Gemini) | `GEMINI_API_KEY=AI...` |
| OpenRouter | `OPENROUTER_API_KEY=sk-or-...` |
| Groq | `GROQ_API_KEY=gsk_...` |
| xAI (Grok) | `XAI_API_KEY=xai-...` |
| Mistral | `MISTRAL_API_KEY=...` |
| Cerebras | `CEREBRAS_API_KEY=...` |
| Hugging Face | `HF_TOKEN=hf_...` |
| Azure OpenAI | `AZURE_OPENAI_API_KEY=...` |
| GitHub Copilot | `GITHUB_TOKEN=gho_...` |
| OpenCode-Zen | `OPENCODE_ZEN_API_KEY=...` |
| OpenCode-Go | `OPENCODE_GO_API_KEY=...` |
| MiniMax | `MINIMAX_API_KEY=...` |
| Omniroute | `OMNIROUTE_API_KEY=...` |
| Amazon Bedrock | `AWS_ACCESS_KEY_ID=...` |
| | `AWS_SECRET_ACCESS_KEY=...` |
| | `AWS_REGION=us-east-1` |

You can add multiple entries to configure multiple providers or additional settings.

### Additional Packages

Alpine Linux packages to install at startup. Useful for tools your workflows need (e.g., `jq`, `yq`, `imagemagick`).
