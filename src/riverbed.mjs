export async function enrichRiverbeds(findings, catalog, options = {}) {
  const actions = [];
  const errors = [];
  let calls = 0;
  let tokens = 0;
  let fallback = null;

  if (options.includeRiverbed === false) {
    actions.push("riverbed_layer_skipped_by_option");
    return { findings, actions, errors, calls, tokens, fallback, provider_used: "none" };
  }

  if (typeof options.riverbedProvider === "function") {
    const enriched = [];
    for (const finding of findings) {
      try {
        calls += 1;
        const response = await options.riverbedProvider(finding, catalog);
        enriched.push({
          ...finding,
          riverbed: response?.riverbed || finding.riverbed,
          heal_shape: response?.heal_shape || finding.heal_shape
        });
      } catch (error) {
        errors.push({ name: "riverbed_provider_failed", message: error.message, file: finding.file });
        enriched.push(finding);
      }
    }
    actions.push(`riverbed_provider_called_${calls}_time(s)`);
    return { findings: enriched, actions, errors, calls, tokens, fallback, provider_used: "custom" };
  }

  const fetchImpl = options.fetch || globalThis.fetch;
  const explicitProvider = String(options.llmProvider || getEnv("HEAL_SENTINEL_LLM_PROVIDER") || "auto").toLowerCase();
  const openrouterKey = options.openrouterApiKey || getEnv("OPENROUTER_API_KEY");
  const anthropicKey = options.llmApiKey || getEnv("ANTHROPIC_API_KEY");

  const chosenProvider = pickProvider(explicitProvider, openrouterKey, anthropicKey);
  if (!chosenProvider || typeof fetchImpl !== "function") {
    fallback = "riverbed_llm_unavailable_catalog_fallback";
    actions.push("riverbed_catalog_fallback_used");
    return { findings, actions, errors, calls, tokens, fallback, provider_used: "none" };
  }

  const enriched = [];
  let providerSucceededAtLeastOnce = false;
  for (const finding of findings) {
    const doctrine = catalog.find((entry) => entry.id === finding.doctrine);
    try {
      calls += 1;
      const prompt = buildRiverbedPrompt(finding, doctrine);
      tokens += Math.ceil(prompt.length / 4);
      const parsed = chosenProvider === "openrouter"
        ? await callOpenRouter({ fetchImpl, apiKey: openrouterKey, prompt, options })
        : await callAnthropic({ fetchImpl, apiKey: anthropicKey, prompt, options });
      enriched.push({
        ...finding,
        riverbed: parsed.riverbed || finding.riverbed,
        heal_shape: parsed.heal_shape || finding.heal_shape
      });
      providerSucceededAtLeastOnce = true;
    } catch (error) {
      fallback = `riverbed_${chosenProvider}_failed_catalog_fallback`;
      errors.push({ name: `riverbed_${chosenProvider}_failed`, message: error.message, file: finding.file });
      enriched.push(finding);
    }
  }
  actions.push(`riverbed_${chosenProvider}_called_${calls}_time(s)`);
  return {
    findings: enriched,
    actions,
    errors,
    calls,
    tokens,
    fallback,
    provider_used: providerSucceededAtLeastOnce ? chosenProvider : "none"
  };
}

function pickProvider(explicit, openrouterKey, anthropicKey) {
  if (explicit === "openrouter") return openrouterKey ? "openrouter" : null;
  if (explicit === "anthropic") return anthropicKey ? "anthropic" : null;
  if (openrouterKey) return "openrouter";
  if (anthropicKey) return "anthropic";
  return null;
}

async function callOpenRouter({ fetchImpl, apiKey, prompt, options }) {
  const model = options.model
    || getEnv("HEAL_SENTINEL_OPENROUTER_MODEL")
    || "deepseek/deepseek-v4-pro";
  const response = await fetchImpl("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": "https://github.com/CREATEDCHARACTR/tfb-heal-sentinel",
      "X-Title": "tfb-heal-sentinel"
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" }
    })
  });
  if (!response.ok) {
    throw new Error(`openrouter_status_${response.status}`);
  }
  const body = await response.json();
  const text = body?.choices?.[0]?.message?.content || "{}";
  return safeParseJson(text);
}

async function callAnthropic({ fetchImpl, apiKey, prompt, options }) {
  const model = options.model
    || getEnv("HEAL_SENTINEL_ANTHROPIC_MODEL")
    || "claude-sonnet-4-20250514";
  const response = await fetchImpl("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model,
      max_tokens: 500,
      messages: [{ role: "user", content: prompt }]
    })
  });
  if (!response.ok) {
    throw new Error(`anthropic_status_${response.status}`);
  }
  const body = await response.json();
  const text = body?.content?.[0]?.text || "{}";
  return safeParseJson(text);
}

function safeParseJson(text) {
  const trimmed = String(text || "").trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidate = fenced ? fenced[1] : trimmed;
  try {
    return JSON.parse(candidate);
  } catch {
    return {};
  }
}

export function buildRiverbedPrompt(finding, doctrine) {
  return `You are Heal Sentinel. A code reviewer that refuses to praise.

A diff has these signals at file ${finding.file}, line ${finding.line}:
Rule: ${finding.rule}
Snippet: ${finding.snippet}
Doctrine: ${finding.doctrine}
Doctrine excerpt: ${doctrine?.doctrine_text || finding.doctrine}

Your job: write the RIVERBED, the wound UPSTREAM of this symptom.
And the HEAL_SHAPE, a concrete structural rewrite, not a surface suggestion.

Refuse to praise. Refuse to call this a nitpick. Name the deeper wound.

Output JSON only:
{
  "riverbed": "<2-4 sentences naming the upstream wound>",
  "heal_shape": "<2-4 sentences naming the concrete structural rewrite>"
}`;
}

function getEnv(name) {
  if (typeof process === "undefined" || !process.env) return "";
  return process.env[name] || "";
}
