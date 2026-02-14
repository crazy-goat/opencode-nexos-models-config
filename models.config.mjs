// Model configuration with limits, costs, variants and all metadata

export const SUPPORTED_MODELS = {
  // Anthropic Claude models - all share the same variants
  "Claude Opus 4.5": {
    limit: { context: 200000, output: 64000 },
    cost: { input: 5, output: 25, cache_read: 0.5, cache_write: 6.25 },
    variants: {
      low: { thinking: { type: "enabled", budgetTokens: 1024 } },
      high: { thinking: { type: "enabled", budgetTokens: 32000 } },
    },
  },
  "Claude Opus 4.6": {
    limit: { context: 200000, output: 128000 },
    cost: { input: 5, output: 25, cache_read: 0.5, cache_write: 6.25 },
    variants: {
      low: { thinking: { type: "enabled", budgetTokens: 1024 } },
      high: { thinking: { type: "enabled", budgetTokens: 32000 } },
    },
  },
  "Claude Sonnet 4.5": {
    limit: { context: 200000, output: 64000 },
    cost: { input: 3, output: 15, cache_read: 0.3, cache_write: 3.75 },
    variants: {
      low: { thinking: { type: "enabled", budgetTokens: 1024 } },
      high: { thinking: { type: "enabled", budgetTokens: 32000 } },
    },
  },
  
  // OpenAI GPT models with reasoning
  "GPT 5.2": {
    limit: { context: 400000, output: 128000 },
    cost: { input: 1.75, output: 14.0, cache_read: 0.175 },
    variants: {
      low: { reasoningEffort: "low" },
      high: { reasoningEffort: "high" },
    },
    options: { reasoningEffort: "none" },
  },
  "GPT 5": {
    limit: { context: 400000, output: 128000 },
    cost: { input: 1.25, output: 10.0, cache_read: 0.125 },
    variants: {
      low: { reasoningEffort: "low" },
      high: { reasoningEffort: "high" },
    },
    options: { reasoningEffort: "none" },
  },
  
  // Google Gemini models
  "Gemini 2.5 Pro": {
    limit: { context: 1048576, output: 65536 },
    cost: { input: 1.25, output: 10.0, cache_read: 0.125 },
    variants: {
      low: { thinking: { type: "enabled", budgetTokens: 1024 } },
      high: { thinking: { type: "enabled", budgetTokens: 32768 } },
    },
  },
  "Gemini 2.5 Flash": {
    limit: { context: 1048576, output: 65536 },
    cost: { input: 0.3, output: 2.5, cache_read: 0.03 },
    variants: {
      low: { thinking: { type: "enabled", budgetTokens: 1024 } },
      high: { thinking: { type: "enabled", budgetTokens: 24576 } },
    },
  },
  
  // Moonshot AI Kimi models
  "Kimi K2.5": {
    limit: { context: 256000, output: 64000 },
    cost: { input: 0.6, output: 3.0, cache_read: 0.1 },
  },
};

// Default fallback costs for models not in SUPPORTED_MODELS
// Uses Claude Opus 4.6 pricing as reference
export const DEFAULT_FALLBACK_COSTS = {
  input: 5,
  output: 25,
  cache_read: 0.5,
  cache_write: 6.25,
};

export const skippedModelPrefixes = ["Gemini 3"];

export function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

export function getModelConfig(displayName) {
  return SUPPORTED_MODELS[displayName] || null;
}

export function isModelSupported(displayName) {
  return displayName in SUPPORTED_MODELS;
}

export function getModelLimit(displayName, apiModel = null) {
  const config = getModelConfig(displayName);
  if (config?.limit) {
    return clone(config.limit);
  }
  
  // Fallback to API-provided values or defaults
  const ctx = apiModel?.context_window || 128000;
  const out = apiModel?.max_output_tokens || 64000;
  console.error(
    `Warning: no predefined limits for model "${displayName}", using defaults (context=${ctx}, output=${out})`
  );
  return { context: ctx, output: out };
}

export function getModelCost(displayName, existingCosts) {
  // Always prefer existing costs from config (user's custom values)
  if (existingCosts && existingCosts[displayName]) {
    return existingCosts[displayName];
  }
  
  // Fall back to hardcoded defaults if available
  const config = getModelConfig(displayName);
  if (config?.cost) {
    return clone(config.cost);
  }
  
  // Use fallback defaults for models not in SUPPORTED_MODELS
  return clone(DEFAULT_FALLBACK_COSTS);
}

export function getModelVariants(displayName) {
  const config = getModelConfig(displayName);
  if (config?.variants) {
    return clone(config.variants);
  }
  return undefined;
}

export function getModelOptions(displayName) {
  const config = getModelConfig(displayName);
  if (config?.options) {
    return clone(config.options);
  }
  return undefined;
}

export function isSkippedModel(displayName) {
  return skippedModelPrefixes.some((prefix) => displayName.startsWith(prefix));
}

// Legacy exports for backward compatibility (can be removed in v2.0)
export const modelLimitsOverrides = Object.fromEntries(
  Object.entries(SUPPORTED_MODELS)
    .filter(([_, config]) => config.limit)
    .map(([name, config]) => [name, config.limit])
);

export const modelCostsDefaults = Object.fromEntries(
  Object.entries(SUPPORTED_MODELS)
    .filter(([_, config]) => config.cost)
    .map(([name, config]) => [name, config.cost])
);

// Keep variantDefinitions for backward compatibility
export const modelVariants = {
  claude: {
    low: { thinking: { type: "enabled", budgetTokens: 1024 } },
    high: { thinking: { type: "enabled", budgetTokens: 32000 } },
  },
  gemini: {
    low: { thinking: { type: "enabled", budgetTokens: 1024 } },
    high: { thinking: { type: "enabled", budgetTokens: 24576 } },
  },
  geminiPro: {
    low: { thinking: { type: "enabled", budgetTokens: 1024 } },
    high: { thinking: { type: "enabled", budgetTokens: 32768 } },
  },
  gptReasoning: {
    low: { reasoningEffort: "low" },
    high: { reasoningEffort: "high" },
  },
};
