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

Anthropic · OpenAI · Google · OpenRouter · Groq · xAI · Mistral · Cerebras · Hugging Face · GitHub Copilot · Amazon Bedrock · Google Vertex · Azure OpenAI · OpenCode-Zen · OpenCode-Go · MiniMax · Omniroute · llama.cpp (local) · Ollama (local)

### Local LLM (llama.cpp)
To use a local `llama.cpp` server (e.g. running on your host VM or network):
1. Select `llama-cpp` as the **Default Provider**.
2. Put your llama.cpp base URL (e.g., `http://192.168.68.50:8080/v1`) into the **openai_api_base** field.
3. Put your active model name (e.g., `Qwen3.6-35B-A3B-UD-Q5_K_M`) into the **Default Model** field.

### Local LLM (Ollama)
1. Set **Default Provider** to `ollama`.
2. Put your Ollama server into **ollama_host**, for example `192.168.68.50` (port `11434` is added automatically).
3. Optionally set **Default Model** (for example `qwen3:8b`). If it is empty, the first model on the server is used.

Run Ollama with `OLLAMA_HOST=0.0.0.0` so it is reachable over the network, and use a model that supports tool calling.

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
| OpenCode-Go | `OPENCODE_GO_API_KEY=...` |
| MiniMax | `MINIMAX_API_KEY=...` |
| Omniroute | `OMNIROUTE_API_KEY=...` |
| Amazon Bedrock | `AWS_ACCESS_KEY_ID=...` + `AWS_SECRET_ACCESS_KEY=...` + `AWS_REGION=us-east-1` |

### Model

Optionally set a **Default Model** — accepts any model ID or fuzzy pattern:

- `anthropic/claude-sonnet-4-20250514`
- `openai/gpt-4o`
- `Qwen3.6-35B-A3B-UD-Q5_K_M`
- `*sonnet*` (fuzzy match)

If left empty, the Default Provider is ignored and Pi uses the model last selected in Pi (`/model`). Pi requires a model whenever a provider is set.

### Additional Packages

Install extra Alpine Linux packages at startup (e.g., `jq`, `imagemagick`).

## Safety

The assistant can change your Home Assistant setup, so it has a few safety nets.

### Which folders the assistant can write to

The assistant's own file tools (writing and editing files, and shell commands such as `>`, `rm`, `sed -i`, `cp`, `mv`) are limited by the **write-guard**:

| Location | Can the assistant write? |
|---|---|
| `configuration.yaml` | ✅ Yes |
| Files that `configuration.yaml` `!include`s (`automations.yaml`, `scripts.yaml`, `scenes.yaml`, ...) | ✅ Yes |
| Folders loaded with `!include_dir_*` (for example `packages/`) | ✅ Yes |
| Anything outside `/homeassistant` (`/tmp`, `/share`, `/media`, ...) | ✅ Yes |
| `.storage/` (Home Assistant's internal database files) | ❌ Blocked |
| `secrets.yaml` | ❌ Blocked |
| `custom_components/`, `www/`, `blueprints/`, `themes/` and any other folder not included from `configuration.yaml` | ❌ Blocked, unless you allow it |

Changes made through the assistant's Home Assistant tools (entities, automations, dashboards, helpers, ...) go through the Home Assistant API and are **not** affected by the write-guard.

### What to do when the assistant is blocked

The assistant will tell you that the write-guard blocked a file and suggest a command, for example:

> The write-guard blocked `/homeassistant/www/card.js`. You can allow it with `/write-allow www/**`.

You have three options:

1. **Allow it from the chat (no restart needed).** Type the command in the assistant's terminal and then ask it to retry:
   ```
   /write-allow www/**
   ```
   - `/write-allow` with no arguments shows what is currently allowed
   - `/write-allow remove www/**` takes the permission back

   Only you can run this command. The assistant can't run slash commands, so it can't unblock itself.

2. **Allow it permanently in the add-on configuration.** Add the folder to **write_guard_allow** (for example `custom_components/**`), save, and restart the add-on.

3. **Change the mode** with the **write_guard** option:
   - `strict` (default): block and explain
   - `warn`: allow everything, but log what would have been blocked
   - `off`: disable the write-guard

Paths are relative to `/homeassistant`. `folder/**` means everything inside that folder. `*` matches one name, for example `packages/*.yaml`.

### Automatic backups before changes

Before the assistant's Home Assistant tools update or delete something (an entity, automation, script, dashboard, helper, area, ...), they save a snapshot of the old state to `/homeassistant/.pi-backups/mutations` and log the change. To see or undo a change:
- ask the assistant: *"show me the recent changes"* or *"restore the automation you changed before"*
- or type `/ha-log` (change log) or `/ha-backups` (snapshots) in the terminal

The newest 200 snapshots are kept.

### Command timeout

Shell commands the assistant runs stop after 60 seconds by default (it can ask for up to 10 minutes) so a hanging command can't freeze the assistant.

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
