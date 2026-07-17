/**
 * Model pricing for Nomon Cost coach.
 * Prices are API list rates ($/1M tokens). ChatGPT Plus is subscription-billed;
 * we still use API rates so Spend is comparable across models/hosts.
 *
 * Refresh: `node scripts/refresh-cost-models.mjs` (or edit this file) and
 * bump UPDATED_AT + SOURCE. Keep UI "prices as of {date}" honest.
 */
const LumenCostModels = (() => {
  const UPDATED_AT = "2026-07-17";
  const SOURCE =
    "OpenAI + Anthropic + Gemini API pricing (docs Jul 2026) · exact ChatGPT/Claude.ai/Gemini.app picker labels";

  /**
   * @typedef {{
   *   id: string,
   *   name: string,
   *   provider: string,
   *   inputPerMillion: number,
   *   outputPerMillion: number,
   *   cachedInputPerMillion: number|null,
   *   supportsCaching: boolean,
   *   tier: "flagship"|"mid"|"economy"|"reasoning",
   *   downgradeTo: string|null,
   *   aliases?: string[],
   * }} Model
   */

  /** @type {Record<string, Model>} */
  const MODELS = {
    // —— ChatGPT / OpenAI (current chat picker, Jul 2026) ——
    "gpt-5.6-sol": {
      id: "gpt-5.6-sol",
      name: "GPT-5.6 Sol",
      provider: "OpenAI",
      inputPerMillion: 5,
      outputPerMillion: 30,
      cachedInputPerMillion: 0.5,
      supportsCaching: true,
      tier: "flagship",
      downgradeTo: "gpt-5.6-terra",
      aliases: ["gpt-5.6 sol", "5.6 sol", "sol", "gpt 5.6 sol"],
    },
    "gpt-5.6-terra": {
      id: "gpt-5.6-terra",
      name: "GPT-5.6 Terra",
      provider: "OpenAI",
      inputPerMillion: 2.5,
      outputPerMillion: 15,
      cachedInputPerMillion: 0.25,
      supportsCaching: true,
      tier: "mid",
      downgradeTo: "gpt-5.6-luna",
      aliases: ["gpt-5.6 terra", "5.6 terra", "terra"],
    },
    "gpt-5.6-luna": {
      id: "gpt-5.6-luna",
      name: "GPT-5.6 Luna",
      provider: "OpenAI",
      inputPerMillion: 1,
      outputPerMillion: 6,
      cachedInputPerMillion: 0.1,
      supportsCaching: true,
      tier: "economy",
      downgradeTo: "gpt-5-nano",
      aliases: ["gpt-5.6 luna", "5.6 luna", "luna"],
    },
    "gpt-5.5": {
      id: "gpt-5.5",
      name: "GPT-5.5",
      provider: "OpenAI",
      inputPerMillion: 5,
      outputPerMillion: 30,
      cachedInputPerMillion: 0.5,
      supportsCaching: true,
      tier: "flagship",
      downgradeTo: "gpt-5.5-instant",
      aliases: ["gpt-5.5", "gpt 5.5", "5.5"],
    },
    "gpt-5.5-instant": {
      id: "gpt-5.5-instant",
      name: "Instant 5.5",
      provider: "OpenAI",
      // Instant tier ≈ GPT-5.x Instant pricing ladder
      inputPerMillion: 1.75,
      outputPerMillion: 14,
      cachedInputPerMillion: 0.175,
      supportsCaching: true,
      tier: "economy",
      downgradeTo: "gpt-5-mini",
      aliases: ["instant 5.5", "instant", "gpt-5.5 instant", "5.5 instant"],
    },
    "gpt-5.4": {
      id: "gpt-5.4",
      name: "GPT-5.4",
      provider: "OpenAI",
      inputPerMillion: 2.5,
      outputPerMillion: 15,
      cachedInputPerMillion: 0.25,
      supportsCaching: true,
      tier: "mid",
      downgradeTo: "gpt-5.4-mini",
      aliases: ["gpt-5.4", "gpt 5.4", "5.4"],
    },
    "gpt-5.4-mini": {
      id: "gpt-5.4-mini",
      name: "GPT-5.4 mini",
      provider: "OpenAI",
      inputPerMillion: 0.75,
      outputPerMillion: 4.5,
      cachedInputPerMillion: 0.075,
      supportsCaching: true,
      tier: "economy",
      downgradeTo: "gpt-5-nano",
      aliases: ["gpt-5.4 mini", "5.4 mini"],
    },
    "gpt-5.3": {
      id: "gpt-5.3",
      name: "GPT-5.3",
      provider: "OpenAI",
      inputPerMillion: 1.75,
      outputPerMillion: 14,
      cachedInputPerMillion: 0.175,
      supportsCaching: true,
      tier: "mid",
      downgradeTo: "gpt-5-mini",
      aliases: ["gpt-5.3", "gpt 5.3", "5.3"],
    },
    "gpt-5-mini": {
      id: "gpt-5-mini",
      name: "GPT-5 mini",
      provider: "OpenAI",
      inputPerMillion: 0.25,
      outputPerMillion: 2,
      cachedInputPerMillion: 0.025,
      supportsCaching: true,
      tier: "economy",
      downgradeTo: "gpt-5-nano",
      aliases: ["gpt-5 mini", "5 mini"],
    },
    "gpt-5-nano": {
      id: "gpt-5-nano",
      name: "GPT-5 nano",
      provider: "OpenAI",
      inputPerMillion: 0.05,
      outputPerMillion: 0.4,
      cachedInputPerMillion: 0.005,
      supportsCaching: true,
      tier: "economy",
      downgradeTo: null,
      aliases: ["gpt-5 nano", "5 nano"],
    },
    o3: {
      id: "o3",
      name: "o3",
      provider: "OpenAI",
      inputPerMillion: 2,
      outputPerMillion: 8,
      cachedInputPerMillion: 0.5,
      supportsCaching: true,
      tier: "reasoning",
      downgradeTo: "gpt-5.6-terra",
      aliases: ["o3"],
    },
    "gpt-4o": {
      id: "gpt-4o",
      name: "GPT-4o",
      provider: "OpenAI",
      inputPerMillion: 2.5,
      outputPerMillion: 10,
      cachedInputPerMillion: 1.25,
      supportsCaching: true,
      tier: "mid",
      downgradeTo: "gpt-4o-mini",
      aliases: ["gpt-4o", "4o"],
    },
    "gpt-4o-mini": {
      id: "gpt-4o-mini",
      name: "GPT-4o mini",
      provider: "OpenAI",
      inputPerMillion: 0.15,
      outputPerMillion: 0.6,
      cachedInputPerMillion: 0.075,
      supportsCaching: true,
      tier: "economy",
      downgradeTo: null,
      aliases: ["gpt-4o mini", "4o mini"],
    },

    // —— Anthropic / Claude.ai picker (Jul 2026) ——
    // Exact picker labels: Fable 5 · Opus 4.8 · Sonnet 5 · Haiku 4.5
    // More models: Opus 4.7 · Opus 4.6 · Opus 3 · Sonnet 4.6
    // Prices: Anthropic API list rates (docs Jul 2026). Sonnet 5 intro $2/$10 through 2026-08-31.
    "claude-fable-5": {
      id: "claude-fable-5",
      name: "Fable 5",
      provider: "Anthropic",
      inputPerMillion: 10,
      outputPerMillion: 50,
      cachedInputPerMillion: 1,
      supportsCaching: true,
      tier: "flagship",
      downgradeTo: "claude-opus-4.8",
      aliases: ["fable 5", "claude fable 5", "claude-fable-5", "fable"],
    },
    "claude-opus-4.8": {
      id: "claude-opus-4.8",
      name: "Opus 4.8",
      provider: "Anthropic",
      inputPerMillion: 5,
      outputPerMillion: 25,
      cachedInputPerMillion: 0.5,
      supportsCaching: true,
      tier: "flagship",
      downgradeTo: "claude-sonnet-5",
      aliases: ["opus 4.8", "claude opus 4.8", "claude-opus-4.8", "opus"],
    },
    "claude-opus-4.7": {
      id: "claude-opus-4.7",
      name: "Opus 4.7",
      provider: "Anthropic",
      inputPerMillion: 5,
      outputPerMillion: 25,
      cachedInputPerMillion: 0.5,
      supportsCaching: true,
      tier: "flagship",
      downgradeTo: "claude-sonnet-5",
      aliases: ["opus 4.7", "claude opus 4.7", "claude-opus-4.7"],
    },
    "claude-opus-4.6": {
      id: "claude-opus-4.6",
      name: "Opus 4.6",
      provider: "Anthropic",
      inputPerMillion: 5,
      outputPerMillion: 25,
      cachedInputPerMillion: 0.5,
      supportsCaching: true,
      tier: "flagship",
      downgradeTo: "claude-sonnet-5",
      aliases: ["opus 4.6", "claude opus 4.6", "claude-opus-4.6"],
    },
    "claude-opus-3": {
      id: "claude-opus-3",
      name: "Opus 3",
      provider: "Anthropic",
      inputPerMillion: 15,
      outputPerMillion: 75,
      cachedInputPerMillion: 1.5,
      supportsCaching: true,
      tier: "flagship",
      downgradeTo: "claude-sonnet-5",
      aliases: ["opus 3", "claude opus 3", "claude-opus-3"],
    },
    "claude-sonnet-5": {
      id: "claude-sonnet-5",
      name: "Sonnet 5",
      provider: "Anthropic",
      inputPerMillion: 2,
      outputPerMillion: 10,
      cachedInputPerMillion: 0.2,
      supportsCaching: true,
      tier: "mid",
      downgradeTo: "claude-haiku-4.5",
      aliases: ["sonnet 5", "claude sonnet 5", "claude-sonnet-5", "sonnet"],
    },
    "claude-sonnet-4.6": {
      id: "claude-sonnet-4.6",
      name: "Sonnet 4.6",
      provider: "Anthropic",
      inputPerMillion: 3,
      outputPerMillion: 15,
      cachedInputPerMillion: 0.3,
      supportsCaching: true,
      tier: "mid",
      downgradeTo: "claude-haiku-4.5",
      aliases: ["sonnet 4.6", "claude sonnet 4.6", "claude-sonnet-4.6"],
    },
    "claude-haiku-4.5": {
      id: "claude-haiku-4.5",
      name: "Haiku 4.5",
      provider: "Anthropic",
      inputPerMillion: 1,
      outputPerMillion: 5,
      cachedInputPerMillion: 0.1,
      supportsCaching: true,
      tier: "economy",
      downgradeTo: null,
      aliases: ["haiku 4.5", "claude haiku 4.5", "claude-haiku-4.5", "haiku"],
    },
    // Legacy ids (not in current Claude.ai picker) — kept for older tips only
    "claude-sonnet-4": {
      id: "claude-sonnet-4",
      name: "Sonnet 4",
      provider: "Anthropic",
      inputPerMillion: 3,
      outputPerMillion: 15,
      cachedInputPerMillion: 0.3,
      supportsCaching: true,
      tier: "mid",
      downgradeTo: "claude-haiku-4.5",
      aliases: ["sonnet 4", "claude sonnet 4"],
    },
    "claude-opus-4": {
      id: "claude-opus-4",
      name: "Opus 4",
      provider: "Anthropic",
      inputPerMillion: 15,
      outputPerMillion: 75,
      cachedInputPerMillion: 1.5,
      supportsCaching: true,
      tier: "flagship",
      downgradeTo: "claude-sonnet-5",
      aliases: ["opus 4", "claude opus 4"],
    },
    "claude-haiku-3.5": {
      id: "claude-haiku-3.5",
      name: "Haiku 3.5",
      provider: "Anthropic",
      inputPerMillion: 0.8,
      outputPerMillion: 4,
      cachedInputPerMillion: 0.08,
      supportsCaching: true,
      tier: "economy",
      downgradeTo: null,
      aliases: ["haiku 3.5", "claude haiku 3.5"],
    },

    // —— Google / Gemini.app picker (Jul 2026) ——
    // Exact picker labels: 3.1 Flash-Lite · 3.5 Flash · 3.1 Pro · Extended thinking (toggle)
    // Prices: Gemini Developer API (docs Jul 2026).
    "gemini-3.1-pro": {
      id: "gemini-3.1-pro",
      name: "3.1 Pro",
      provider: "Google",
      inputPerMillion: 2,
      outputPerMillion: 12,
      cachedInputPerMillion: 0.2,
      supportsCaching: true,
      tier: "flagship",
      downgradeTo: "gemini-3.5-flash",
      aliases: ["gemini 3.1 pro", "3.1 pro", "gemini-3.1-pro"],
    },
    "gemini-3.5-flash": {
      id: "gemini-3.5-flash",
      name: "3.5 Flash",
      provider: "Google",
      inputPerMillion: 1.5,
      outputPerMillion: 9,
      cachedInputPerMillion: 0.15,
      supportsCaching: true,
      tier: "mid",
      downgradeTo: "gemini-3.1-flash-lite",
      aliases: [
        "gemini 3.5 flash",
        "3.5 flash",
        "flash extended",
        "gemini-3.5-flash",
      ],
    },
    "gemini-3.1-flash-lite": {
      id: "gemini-3.1-flash-lite",
      name: "3.1 Flash-Lite",
      provider: "Google",
      inputPerMillion: 0.25,
      outputPerMillion: 1.5,
      cachedInputPerMillion: 0.025,
      supportsCaching: true,
      tier: "economy",
      downgradeTo: null,
      aliases: [
        "gemini 3.1 flash-lite",
        "gemini 3.1 flash lite",
        "3.1 flash-lite",
        "3.1 flash lite",
        "flash-lite",
        "flash lite",
        "gemini-3.1-flash-lite",
      ],
    },
    // Legacy Gemini (not in current gemini.google.com picker)
    "gemini-2.5-pro": {
      id: "gemini-2.5-pro",
      name: "Gemini 2.5 Pro",
      provider: "Google",
      inputPerMillion: 1.25,
      outputPerMillion: 10,
      cachedInputPerMillion: 0.315,
      supportsCaching: true,
      tier: "flagship",
      downgradeTo: "gemini-3.5-flash",
      aliases: ["gemini 2.5 pro", "2.5 pro"],
    },
    "gemini-2.5-flash": {
      id: "gemini-2.5-flash",
      name: "Gemini 2.5 Flash",
      provider: "Google",
      inputPerMillion: 0.3,
      outputPerMillion: 2.5,
      cachedInputPerMillion: 0.075,
      supportsCaching: true,
      tier: "economy",
      downgradeTo: "gemini-3.1-flash-lite",
      aliases: ["gemini 2.5 flash", "2.5 flash"],
    },
    "gemini-2.0-flash": {
      id: "gemini-2.0-flash",
      name: "Gemini 2.0 Flash",
      provider: "Google",
      inputPerMillion: 0.1,
      outputPerMillion: 0.4,
      cachedInputPerMillion: 0.025,
      supportsCaching: true,
      tier: "economy",
      downgradeTo: null,
      aliases: ["gemini 2.0 flash", "2.0 flash"],
    },
  };

  /** ChatGPT composer intelligence → relative tier within a family. */
  const INTEL_ALIASES = {
    instant: "instant",
    "instant 5.5": "instant",
    medium: "medium",
    high: "high",
  };

  /** Claude Effort → assumed-output multiplier (limits burn faster at Extra/Max). */
  const CLAUDE_EFFORT_OUTPUT_MULT = {
    low: 0.65,
    medium: 0.85,
    high: 1,
    extra: 1.45,
    max: 2,
  };

  /** Gemini "Extended thinking" → assumed-output multiplier (thinking tokens bill as output). */
  const GEMINI_EXTENDED_OUTPUT_MULT = 1.6;

  function normalizeLabel(raw) {
    return String(raw || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .replace(/[·•|]/g, " ")
      .trim();
  }

  function get(id) {
    return MODELS[id] || null;
  }

  function list() {
    return Object.values(MODELS);
  }

  /** Resolve UI / slug text to a model record. */
  function resolveLabel(raw) {
    const label = normalizeLabel(raw);
    if (!label) return null;

    if (MODELS[label]) return MODELS[label];

    // Exact name / alias first (avoids "Instant 5.5" matching alias "5.5")
    for (const model of Object.values(MODELS)) {
      if (normalizeLabel(model.name) === label) return model;
      for (const alias of model.aliases || []) {
        if (label === normalizeLabel(alias)) return model;
      }
    }

    // Longest partial alias match (prefer "gpt-5.6 sol" over "sol")
    let best = null;
    let bestLen = 0;
    for (const model of Object.values(MODELS)) {
      const candidates = [model.name, ...(model.aliases || [])];
      for (const alias of candidates) {
        const a = normalizeLabel(alias);
        if (a.length < 4) continue; // skip tiny aliases like "o3" handled exactly above
        if ((label.includes(a) || a.includes(label)) && a.length > bestLen) {
          best = model;
          bestLen = a.length;
        }
      }
    }
    if (best) return best;

    // Loose slug match: "gpt-5-6-sol" / "gpt5.6sol"
    const slug = label.replace(/\s+/g, "-").replace(/_/g, "-");
    if (MODELS[slug]) return MODELS[slug];

    return null;
  }

  /**
   * Map ChatGPT picker selection → model.
   * @param {{ modelLabel?: string|null, intelligence?: string|null }} sel
   */
  function resolveChatGPTSelection(sel = {}) {
    const intelRaw = normalizeLabel(sel.intelligence);
    const intel = INTEL_ALIASES[intelRaw] || null;
    const modelLabel = sel.modelLabel || null;
    let base = resolveLabel(modelLabel);

    // Instant alone (pill shows "Instant" / "Instant 5.5")
    if (!base && intel === "instant") {
      return {
        model: MODELS["gpt-5.5-instant"],
        confidence: "mapped",
        label: "Instant 5.5",
      };
    }

    // Model family without intelligence
    if (base && !intel) {
      return {
        model: base,
        confidence: "exact",
        label: base.name,
      };
    }

    // Family + intelligence: Medium ≈ Terra-class for Sol; High = flagship; Instant = Instant/Luna
    if (base && intel) {
      if (intel === "instant") {
        const instant =
          resolveLabel("instant 5.5") ||
          MODELS["gpt-5.6-luna"] ||
          MODELS["gpt-5.5-instant"];
        return {
          model: instant,
          confidence: "mapped",
          label: `Instant · ${base.name}`,
        };
      }
      if (intel === "medium") {
        // Medium effort on Sol family → Terra rate; else keep family mid-tier
        if (base.id.startsWith("gpt-5.6")) {
          return {
            model: MODELS["gpt-5.6-terra"],
            confidence: "mapped",
            label: `Medium · ${base.name}`,
          };
        }
        if (base.id === "gpt-5.5") {
          return {
            model: MODELS["gpt-5.4"],
            confidence: "mapped",
            label: `Medium · ${base.name}`,
          };
        }
        return {
          model: base,
          confidence: "mapped",
          label: `Medium · ${base.name}`,
        };
      }
      // high
      return {
        model: base,
        confidence: "exact",
        label: `High · ${base.name}`,
      };
    }

    // Intelligence-only Medium/High with no family → current ChatGPT default family
    if (intel === "medium") {
      return {
        model: MODELS["gpt-5.6-terra"],
        confidence: "mapped",
        label: "Medium",
      };
    }
    if (intel === "high") {
      return {
        model: MODELS["gpt-5.6-sol"],
        confidence: "mapped",
        label: "High",
      };
    }

    return null;
  }

  /**
   * Map Claude.ai picker selection → model (+ effort metadata).
   * @param {{ modelLabel?: string|null, effort?: string|null, label?: string|null }} sel
   */
  function resolveClaudeSelection(sel = {}) {
    let modelLabel = sel.modelLabel || null;
    let effort = normalizeLabel(sel.effort);

    // Parse combined "Fable 5 High"
    if (!modelLabel && sel.label) {
      const combo = String(sel.label).match(
        /((?:claude\s+)?(?:fable|opus|sonnet|haiku|mythos)\s*\d+(?:\.\d+)?)\s+(low|medium|high|extra|max)\b/i
      );
      if (combo) {
        modelLabel = combo[1];
        effort = normalizeLabel(combo[2]);
      } else {
        modelLabel = sel.label;
      }
    }

    const base = resolveLabel(modelLabel);
    if (!base) return null;

    const effortKey = CLAUDE_EFFORT_OUTPUT_MULT[effort] != null ? effort : null;
    const label = effortKey
      ? `${base.name.replace(/^Claude\s+/i, "")} · ${effortKey[0].toUpperCase()}${effortKey.slice(1)}`
      : base.name;

    return {
      model: base,
      confidence: "exact",
      label,
      effort: effortKey,
      outputMult: effortKey ? CLAUDE_EFFORT_OUTPUT_MULT[effortKey] : 1,
    };
  }

  /**
   * Map Gemini.app picker selection → model (+ extended-thinking metadata).
   * @param {{ modelLabel?: string|null, label?: string|null, extended?: boolean }} sel
   */
  function resolveGeminiSelection(sel = {}) {
    let modelLabel = sel.modelLabel || null;
    let extended = Boolean(sel.extended);
    const rawLabel = String(sel.label || modelLabel || "");

    // Composer pill: "Flash Extended" = 3.5 Flash + Extended thinking
    if (/flash\s*extended/i.test(rawLabel)) {
      extended = true;
      modelLabel = modelLabel || "3.5 Flash";
    }

    if (!modelLabel && sel.label) {
      modelLabel = sel.label.replace(/\s*extended\s*$/i, "").trim();
    }

    // Normalize UI labels like "3.1 Flash-Lite" / "3.5 Flash" / "3.1 Pro"
    const cleaned = normalizeLabel(modelLabel || rawLabel)
      .replace(/\s*extended\s*$/i, "")
      .trim();

    let base =
      resolveLabel(cleaned) ||
      resolveLabel(`gemini ${cleaned}`) ||
      resolveLabel(modelLabel);

    // Bare "flash" / "pro" from truncated pill text
    if (!base && /\bflash-?lite\b/i.test(cleaned)) {
      base = MODELS["gemini-3.1-flash-lite"];
    } else if (!base && /\bflash\b/i.test(cleaned)) {
      base = MODELS["gemini-3.5-flash"];
    } else if (!base && /\bpro\b/i.test(cleaned)) {
      base = MODELS["gemini-3.1-pro"];
    }

    if (!base) return null;

    const shortName = base.name.replace(/^Gemini\s+/i, "");
    const label = extended ? `${shortName} · Extended` : shortName;

    return {
      model: base,
      confidence: "exact",
      label,
      effort: extended ? "extended" : null,
      outputMult: extended ? GEMINI_EXTENDED_OUTPUT_MULT : 1,
    };
  }

  /** Map current host to a sensible default flagship model. */
  function modelForHost(hostname = location.hostname) {
    const h = String(hostname || "").toLowerCase();
    if (h.includes("claude")) return MODELS["claude-sonnet-5"];
    if (h.includes("chatgpt") || h.includes("openai") || h.includes("chat.openai")) {
      return MODELS["gpt-5.6-sol"];
    }
    if (h.includes("gemini") || h.includes("google")) return MODELS["gemini-3.5-flash"];
    if (h.includes("grok") || h.includes("x.com")) return MODELS["gpt-5.6-terra"];
    if (h.includes("perplexity")) return MODELS["gpt-5-mini"];
    if (h.includes("copilot") || h.includes("microsoft")) return MODELS["gpt-5.6-terra"];
    if (h.includes("mistral")) return MODELS["gpt-5-mini"];
    if (h.includes("deepseek")) return MODELS["gpt-5-mini"];
    if (h.includes("qwen") || h.includes("kimi") || h.includes("minimax") || h.includes("doubao")) {
      return MODELS["gpt-5-mini"];
    }
    return MODELS["gpt-5.6-sol"];
  }

  /**
   * Pick model for Cost: UI selection → goals override → host default.
   * @returns {{ model: Model, confidence: string, label: string, source: string }}
   */
  function resolveForAnalysis(opts = {}, goals = {}) {
    if (goals.costPreferredModel && MODELS[goals.costPreferredModel]) {
      const m = MODELS[goals.costPreferredModel];
      return { model: m, confidence: "override", label: m.name, source: "goals" };
    }

    const selected = opts.selectedModel;
    if (selected?.id && MODELS[selected.id]) {
      return {
        model: MODELS[selected.id],
        confidence: selected.confidence || "exact",
        label: selected.label || MODELS[selected.id].name,
        source: "ui",
      };
    }

    const hostName = String(opts.hostname || location.hostname || "").toLowerCase();
    const isClaude = hostName.includes("claude") || selected?.host === "claude";
    const isChatGPT =
      hostName.includes("chatgpt") ||
      hostName.includes("openai") ||
      selected?.host === "chatgpt";
    const isGemini =
      hostName.includes("gemini") ||
      hostName.includes("google") ||
      selected?.host === "gemini";

    if (isClaude && (selected?.modelLabel || selected?.effort || selected?.label)) {
      const mapped = resolveClaudeSelection(selected);
      if (mapped?.model) {
        return {
          model: mapped.model,
          confidence: mapped.confidence,
          label: mapped.label,
          source: "ui",
          effort: mapped.effort || null,
          outputMult: mapped.outputMult || 1,
        };
      }
    }

    if (isChatGPT && (selected?.modelLabel || selected?.intelligence)) {
      const mapped = resolveChatGPTSelection(selected);
      if (mapped?.model) {
        return {
          model: mapped.model,
          confidence: mapped.confidence,
          label: mapped.label,
          source: "ui",
          effort: null,
          outputMult: 1,
        };
      }
    }

    if (
      isGemini &&
      (selected?.modelLabel || selected?.label || selected?.extended != null)
    ) {
      const mapped = resolveGeminiSelection(selected);
      if (mapped?.model) {
        return {
          model: mapped.model,
          confidence: mapped.confidence,
          label: mapped.label,
          source: "ui",
          effort: mapped.effort || null,
          outputMult: mapped.outputMult || 1,
        };
      }
    }

    if (selected?.label) {
      const byLabel = resolveLabel(selected.label);
      if (byLabel) {
        return {
          model: byLabel,
          confidence: "mapped",
          label: byLabel.name,
          source: "ui",
          effort: null,
          outputMult: 1,
        };
      }
    }

    const host = modelForHost(opts.hostname || location.hostname);
    return {
      model: host,
      confidence: "host-default",
      label: host.name,
      source: "host",
      effort: null,
      outputMult: 1,
    };
  }

  /**
   * Build a host-aware Switch action for a cheaper catalog model.
   * ChatGPT Instant/Medium/High map to our Luna/Terra/Sol price ladder.
   */
  function switchActionFor(targetModelId, hostname = "") {
    const model = MODELS[targetModelId];
    if (!model) return null;
    const h = String(hostname || "").toLowerCase();
    const short = model.name
      .replace(/^GPT[-\s]*/i, "")
      .replace(/^Claude\s+/i, "")
      .replace(/^Gemini\s+/i, "")
      .trim();

    if (h.includes("chatgpt") || h.includes("openai") || h.includes("chat.openai")) {
      const INTEL = {
        "gpt-5.6-luna": "instant",
        "gpt-5.5-instant": "instant",
        "gpt-5-nano": "instant",
        "gpt-5-mini": "instant",
        "gpt-5.4-mini": "instant",
        "gpt-4o-mini": "instant",
        "gpt-5.6-terra": "medium",
        "gpt-5.4": "medium",
        "gpt-5.3": "medium",
        "gpt-4o": "medium",
        "gpt-5.6-sol": "high",
        "gpt-5.5": "high",
        o3: "high",
      };
      const intel = INTEL[targetModelId];
      if (intel) {
        const label =
          intel === "instant" ? "Instant" : intel === "medium" ? "Medium" : "High";
        // Prefer the picker label Instant 5.5 when that’s what ChatGPT shows.
        const uiLabel = intel === "instant" ? "Instant" : label;
        return {
          kind: "intelligence",
          value: intel,
          uiLabel,
          buttonLabel: `Switch to ${uiLabel}`,
          targetModelId,
          hint: `Pick ${uiLabel} in ChatGPT’s Intelligence menu`,
        };
      }
      return {
        kind: "model",
        value: model.name,
        uiLabel: model.name,
        buttonLabel: `Switch to ${short}`,
        targetModelId,
        hint: `Pick ${model.name} under More models`,
      };
    }

    if (h.includes("claude")) {
      return {
        kind: "model",
        value: short,
        uiLabel: short,
        buttonLabel: `Switch to ${short}`,
        targetModelId,
        hint: `Pick ${short} in Claude’s model menu`,
      };
    }

    if (h.includes("gemini") || h.includes("google")) {
      return {
        kind: "model",
        value: short,
        uiLabel: short,
        buttonLabel: `Switch to ${short}`,
        targetModelId,
        hint: `Pick ${short} in Gemini’s model menu`,
      };
    }

    return {
      kind: "model",
      value: model.name,
      uiLabel: model.name,
      buttonLabel: `Switch to ${short}`,
      targetModelId,
      hint: `Switch the host model to ${model.name}`,
    };
  }

  return {
    UPDATED_AT,
    SOURCE,
    get,
    list,
    resolveLabel,
    resolveChatGPTSelection,
    resolveClaudeSelection,
    resolveGeminiSelection,
    resolveForAnalysis,
    modelForHost,
    switchActionFor,
    CLAUDE_EFFORT_OUTPUT_MULT,
    GEMINI_EXTENDED_OUTPUT_MULT,
  };
})();

globalThis.LumenCostModels = LumenCostModels;
