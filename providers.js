// ============================================================
//  providers.js
//  All provider definitions, API call logic, and response
//  parsing. Each provider has its own auth and request format.
// ============================================================

const PROVIDERS = {
  openai: {
    id:           "openai",
    name:         "OpenAI",
    icon:         "⬡",
    color:        "#10a37f",
    models:       ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"],
    defaultModel: "gpt-4o",
    placeholder:  "sk-...",
    docsUrl:      "https://platform.openai.com/api-keys",
  },
  anthropic: {
    id:           "anthropic",
    name:         "Anthropic",
    icon:         "◈",
    color:        "#d97757",
    models:       ["claude-opus-4-5", "claude-sonnet-4-5", "claude-haiku-4-5-20251001"],
    defaultModel: "claude-sonnet-4-5",
    placeholder:  "sk-ant-...",
    docsUrl:      "https://console.anthropic.com/account/keys",
  },
  gemini: {
    id:           "gemini",
    name:         "Google Gemini",
    icon:         "✧",
    color:        "#4285f4",
    models:       ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash"],
    defaultModel: "gemini-2.0-flash",
    placeholder:  "AIza...",
    docsUrl:      "https://aistudio.google.com/app/apikey",
  },
  deepseek: {
    id:           "deepseek",
    name:         "DeepSeek",
    icon:         "◎",
    color:        "#6366f1",
    models:       ["deepseek-chat", "deepseek-reasoner"],
    defaultModel: "deepseek-chat",
    placeholder:  "sk-...",
    docsUrl:      "https://platform.deepseek.com/api_keys",
  },
  grok: {
    id:           "grok",
    name:         "Grok (xAI)",
    icon:         "✕",
    color:        "#ffffff",
    models:       ["grok-2-latest", "grok-2-vision-latest"],
    defaultModel: "grok-2-latest",
    placeholder:  "xai-...",
    docsUrl:      "https://console.x.ai/",
  },
};

// ── Unified API call ──────────────────────────────────────────
// Routes to the correct provider implementation.
// Returns { text, outputTokens }
async function callProvider(providerId, apiKey, model, systemPrompt, userMessage, maxTokens = 1024) {
  switch (providerId) {
    case "openai":
    case "deepseek":
    case "grok":
      return callOpenAICompatible(providerId, apiKey, model, systemPrompt, userMessage, maxTokens);
    case "anthropic":
      return callAnthropic(apiKey, model, systemPrompt, userMessage, maxTokens);
    case "gemini":
      return callGemini(apiKey, model, systemPrompt, userMessage, maxTokens);
    default:
      throw new Error(`Unknown provider: ${providerId}`);
  }
}

// ── OpenAI-compatible (OpenAI, DeepSeek, Grok) ───────────────
async function callOpenAICompatible(providerId, apiKey, model, systemPrompt, userMessage, maxTokens) {
  const endpoints = {
    openai:   "https://api.openai.com/v1/chat/completions",
    deepseek: "https://api.deepseek.com/v1/chat/completions",
    grok:     "https://api.x.ai/v1/chat/completions",
  };

  const response = await fetch(endpoints[providerId], {
    method: "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userMessage  },
      ],
    }),
  });

  await checkErrors(response, providerId);
  const data         = await response.json();
  const text         = data.choices?.[0]?.message?.content?.trim() || "";
  const outputTokens = data.usage?.completion_tokens || 0;
  return { text, outputTokens };
}

// ── Anthropic ─────────────────────────────────────────────────
async function callAnthropic(apiKey, model, systemPrompt, userMessage, maxTokens) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type":      "application/json",
      "x-api-key":         apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system:   systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  await checkErrors(response, "anthropic");
  const data         = await response.json();
  const text         = data.content?.[0]?.text?.trim() || "";
  const outputTokens = data.usage?.output_tokens || 0;
  return { text, outputTokens };
}

// ── Google Gemini ─────────────────────────────────────────────
async function callGemini(apiKey, model, systemPrompt, userMessage, maxTokens) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: [{ role: "user", parts: [{ text: userMessage }] }],
      generationConfig: { maxOutputTokens: maxTokens },
    }),
  });

  await checkErrors(response, "gemini");
  const data         = await response.json();
  const text         = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
  const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;
  return { text, outputTokens };
}

// ── Error handler ─────────────────────────────────────────────
async function checkErrors(response, providerId) {
  if (response.ok) return;

  const providerName = PROVIDERS[providerId]?.name || providerId;
  let message;

  try {
    const err = await response.json();
    // Each provider has a different error structure
    message = err?.error?.message        // OpenAI, DeepSeek, Grok
           || err?.error?.errors?.[0]?.message  // Gemini
           || (err?.type ? `${err.type}: ${err.message}` : null) // Anthropic
           || `HTTP ${response.status}`;
  } catch {
    message = `HTTP ${response.status}`;
  }

  if (response.status === 401) throw new Error(`Invalid ${providerName} API key. Please check your key.`);
  if (response.status === 429) throw new Error(`${providerName} rate limit reached. Please wait and try again.`);
  if (response.status === 402 || response.status === 403) throw new Error(`${providerName} billing or permissions issue. Check your account.`);
  throw new Error(`${providerName} error: ${message}`);
}
