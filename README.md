# Promptly — Standalone Edition

A Chrome extension that transforms raw AI prompts into structured, high-quality prompts using proven prompt engineering frameworks. Supports **OpenAI, Anthropic, Google Gemini, DeepSeek, and Grok**. No backend, no accounts — just your own API key stored locally.

---

## What It Does

Paste a raw prompt, choose a framework, and Promptly rewrites it into a structured prompt that gets better results from any AI tool. After optimizing, it runs both prompts through your chosen AI and shows you the **real output token difference**.

**Three frameworks:**
| Framework | Best for |
|---|---|
| **TCRTE** (Role, Context, Task, Constraints, Output Format) | Work, school, planning, email |
| **Chain-of-Thought** | Math, decisions, debugging, reasoning |
| **Few-Shot** | Copying a style, format, tone, or pattern |

---

## Supported Providers

| Provider | Models | Key format |
|---|---|---|
| **OpenAI** | gpt-4o, gpt-4o-mini, gpt-4-turbo | `sk-...` |
| **Anthropic** | claude-opus-4-5, claude-sonnet-4-5, claude-haiku | `sk-ant-...` |
| **Google Gemini** | gemini-2.0-flash, gemini-1.5-pro, gemini-1.5-flash | `AIza...` |
| **DeepSeek** | deepseek-chat, deepseek-reasoner | `sk-...` |
| **Grok (xAI)** | grok-2-latest, grok-2-vision-latest | `xai-...` |

You can save API keys for multiple providers and switch between them at any time using the provider chip in the header.

---

## Installation

### Step 1 — Get an API Key

Get a key from whichever provider you want to use:

| Provider | Where to get a key |
|---|---|
| OpenAI | [platform.openai.com/api-keys](https://platform.openai.com/api-keys) |
| Anthropic | [console.anthropic.com/account/keys](https://console.anthropic.com/account/keys) |
| Google Gemini | [aistudio.google.com/app/apikey](https://aistudio.google.com/app/apikey) |
| DeepSeek | [platform.deepseek.com/api_keys](https://platform.deepseek.com/api_keys) |
| Grok (xAI) | [console.x.ai](https://console.x.ai/) |

### Step 2 — Download Promptly

```bash
git clone https://github.com/YOUR_USERNAME/promptly-standalone.git
```

Or download the ZIP from GitHub and extract it.

### Step 3 — Load into Chrome

1. Open Chrome → navigate to `chrome://extensions`
2. Enable **Developer mode** (top-right toggle)
3. Click **Load unpacked**
4. Select the `promptly-standalone` folder
5. The Promptly ✦ icon will appear in your toolbar

### Step 4 — Set Up Your Provider

1. Click the Promptly icon
2. Select your provider from the 5 cards
3. Choose a model
4. Enter your API key
5. Click **Save & Start** — Promptly verifies the key with a test call then opens the main interface

---

## Switching Providers

Click the **provider chip** in the top-right of the extension (e.g. "OpenAI") to open the setup screen. Select any provider — if you've previously saved a key for it, it will be pre-filled. Each provider's key is stored separately so you can switch freely.

---

## Privacy

- API keys are stored in `chrome.storage.local` — never sent anywhere except directly to the selected provider's API
- Prompt history is stored in `chrome.storage.local` — never sent to any server
- No analytics, no tracking, no external services beyond the selected AI provider

---

## Cost

Each optimization fires **two API calls** in parallel:
1. **Optimization call** — generates the structured prompt (up to 1024 output tokens)
2. **Comparison call** — runs your raw prompt to measure baseline output tokens (up to 512 tokens)

Approximate output token pricing per provider (as of 2025):

| Provider | Per 1M output tokens |
|---|---|
| OpenAI gpt-4o | $10.00 |
| Anthropic claude-sonnet | $15.00 |
| Google gemini-2.0-flash | $0.60 |
| DeepSeek deepseek-chat | $1.10 |
| Grok grok-2 | $15.00 |

A typical optimization costs less than $0.003. Update `costPer1M` in `providers.js` if pricing changes.

---

## File Structure

```
promptly-standalone/
├── manifest.json    — Extension config, host permissions for all providers
├── popup.html       — Full UI (setup, optimize, history views)
├── popup.js         — UI logic, optimization flow, token comparison
├── providers.js     — All provider definitions, API call implementations
├── storage.js       — chrome.storage.local helpers (multi-provider key storage)
├── icons/           — Extension icons
└── README.md
```

---

## Customization

**Add a new provider** — add an entry to `PROVIDERS` in `providers.js`, implement a `callXxx()` function, add a case in `callProvider()`, add the host to `manifest.json` host_permissions, and add a card in `popup.html`.

**Change pricing** — update `costPer1M` in the relevant provider entry in `providers.js`.

**Change default model** — update `defaultModel` in the provider entry in `providers.js`.

---

## License

MIT — free to use, modify, and distribute.
