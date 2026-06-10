# HASS AI Assistant

[![Build](https://github.com/Ito-69/hass-pi-agent/actions/workflows/build.yaml/badge.svg)](https://github.com/Ito-69/hass-pi-agent/actions/workflows/build.yaml)

Local and Cloud AI Assistant with full Home Assistant access — manage automations, entities, dashboards, and more via natural language.

Powered by [Pi](https://github.com/earendil-works/pi) coding agent with pre-loaded extensions for advanced context management (`context-mode`) and web navigation (`pi-web-access`).

## Installation

### 1. Add the repository

1. Open Home Assistant
2. Go to **Settings → Add-ons → Add-on Store**
3. Click the **⋮** menu (top right) → **Repositories**
4. Add this URL:
   ```
   https://github.com/Ito-69/hass-pi-agent
   ```
5. Click **Add → Close**

### 2. Install the add-on

1. Find **HASS AI Assistant** in the add-on store (refresh if needed)
2. Click **Install**
3. Go to the **Configuration** tab
4. Add your AI provider API key under **Environment**, or fill in your local LLM address.
5. Click **Save**
6. Go to the **Info** tab and click **Start**

### 3. Open the assistant

Click **AI Assistant** in the sidebar, or go to the **Info** tab and click **Open Web UI**.

## Configuration

### Provider

Select your AI provider from the **Default Provider** dropdown:

Anthropic · OpenAI · Google · OpenRouter · Groq · xAI · Mistral · Cerebras · Hugging Face · GitHub Copilot · Amazon Bedrock · Google Vertex · Azure OpenAI · OpenCode-Zen · MiniMax · Omniroute

### Local LLM (llama.cpp)
To use a local `llama.cpp` server (e.g. running on your host VM or network):
1. Select `openai` as the **Default Provider**.
2. Put your llama.cpp base URL (e.g., `http://192.168.68.50:8080/v1`) into the **openai_api_base** field.
3. Put your active model name (e.g., `Qwen3.6-35B-A3B-UD-Q5_K_M`) into the **Default Model** field.

### API Keys

Add your provider's API key as an environment variable in the **Environment** list:

| Provider | Environment variable |
|----------|---------------------|
| Anthropic | `ANTHROPIC_API_KEY=sk-ant-...` |
| OpenAI | `OPENAI_API_KEY=sk-...` |
| Google | `GEMINI_API_KEY=AI...` |
| OpenRouter | `OPENROUTER_API_KEY=sk-or-...` |
| Groq | `GROQ_API_KEY=gsk_...` |
| xAI | `XAI_API_KEY=xai-...` |
| Mistral | `MISTRAL_API_KEY=...` |
| Cerebras | `CEREBRAS_API_KEY=...` |
| Hugging Face | `HF_TOKEN=hf_...` |
| GitHub Copilot | `GITHUB_TOKEN=gho_...` |
| OpenCode-Zen | `OPENCODE_ZEN_API_KEY=...` |
| MiniMax | `MINIMAX_API_KEY=...` |
| Omniroute | `OMNIROUTE_API_KEY=...` |
| Amazon Bedrock | `AWS_ACCESS_KEY_ID=...` + `AWS_SECRET_ACCESS_KEY=...` + `AWS_REGION=us-east-1` |

### Model

Optionally set a **Default Model** — accepts any model ID or fuzzy pattern:

- `anthropic/claude-sonnet-4-20250514`
- `openai/gpt-4o`
- `Qwen3.6-35B-A3B-UD-Q5_K_M`
- `*sonnet*` (fuzzy match)

Leave empty to use the provider's default.

### Additional Packages

Install extra Alpine Linux packages at startup (e.g., `jq`, `imagemagick`).

## What can it do?

HASS AI Assistant has full access to your Home Assistant instance:

- **Automations** — create, edit, debug, and manage automations
- **Entities & Devices** — inspect states, rename, organize into areas
- **Dashboards** — build and modify Lovelace dashboards and cards
- **Services** — discover and call any Home Assistant service
- **Helpers** — create input booleans, counters, timers, templates, and more
- **Areas & Labels** — organize your smart home
- **Add-ons** — manage installed add-ons
- **Templates** — render and test Jinja2 templates
- **Backups** — create and manage backups
- **System** — view system info, restart, and reload configuration
- **Web Navigation** — access the web, clone Git repos, fetch docs (powered by `pi-web-access`)

## Supported architectures

- `amd64`
- `aarch64`

## License

MIT
