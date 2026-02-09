#!/usr/bin/env node

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";

const apiBaseURL = process.env.NEXOS_BASE_URL || "https://api.nexos.ai/v1";
const apiKey = process.env.NEXOS_API_KEY;

const modelLimitsOverrides = {
  "Claude Opus 4.5":          { context: 200000, output: 64000 },
  "Claude Opus 4.6":          { context: 200000, output: 128000 },
  "Claude Sonnet 4.5":        { context: 200000, output: 64000 },
  "claude-sonnet-4-20250514": { context: 200000, output: 64000 },
  "anthropic.claude-sonnet-4-5@20250929 (aoxy-analytics europe-west1)": { context: 200000, output: 64000 },
  "anthropic.claude-sonnet-4-5@20250929 (oxy-analytics us-east5)":      { context: 200000, output: 64000 },
  "GPT 5.2":                 { context: 400000, output: 128000 },
  "GPT 5.2 Chat":            { context: 400000, output: 128000 },
  "GPT 5":                   { context: 400000, output: 128000 },
  "gpt-5-mini-2025-08-07":   { context: 400000, output: 128000 },
  "gpt-5-nano-2025-08-07":   { context: 400000, output: 128000 },
  "GPT 4.1":                 { context: 1047576, output: 32768 },
  "gpt-4.1-mini-2025-04-14": { context: 1047576, output: 32768 },
  "GPT 4o":                  { context: 128000, output: 16384 },
  "gpt-oss-120b":            { context: 131072, output: 131072 },
  "Gemini 2.5 Pro":          { context: 1048576, output: 65536 },
  "Gemini 2.5 Flash":        { context: 1048576, output: 65536 },
};

const skippedModelPrefixes = ["Gemini 3"];

const claudeVariants = {
  low: {
    thinking: {
      type: "enabled",
      budgetTokens: 1024,
    },
  },
  high: {
    thinking: {
      type: "enabled",
      budgetTokens: 32000,
    },
  },
};

const geminiVariants = {
  low: {
    thinking: {
      type: "enabled",
      budgetTokens: 1024,
    },
  },
  high: {
    thinking: {
      type: "enabled",
      budgetTokens: 24576,
    },
  },
};

const geminiProVariants = {
  low: {
    thinking: {
      type: "enabled",
      budgetTokens: 1024,
    },
  },
  high: {
    thinking: {
      type: "enabled",
      budgetTokens: 32768,
    },
  },
};

const gptReasoningVariants = {
  low: {
    reasoningEffort: "low",
  },
  high: {
    reasoningEffort: "high",
  },
};

function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function getModelVariants(displayName) {
  if (
    displayName.startsWith("anthropic.claude-") ||
    displayName.startsWith("claude-") ||
    displayName.includes("Claude ")
  ) {
    return clone(claudeVariants);
  }

  if (displayName.includes("Gemini") && displayName.includes("Pro")) {
    return clone(geminiProVariants);
  }

  if (displayName.includes("Gemini")) {
    return clone(geminiVariants);
  }

  if (displayName === "GPT 5" || displayName === "GPT 5.2") {
    return clone(gptReasoningVariants);
  }
}

function getModelOptions(displayName) {
  if (displayName === "GPT 5" || displayName === "GPT 5.2") {
    return { reasoningEffort: "medium" };
  }
}

function asObject(value) {
  return value && typeof value === "object" ? value : undefined;
}

function uniqueStrings(values) {
  const out = [];
  for (const v of values || []) {
    if (typeof v !== "string") continue;
    if (out.includes(v)) continue;
    out.push(v);
  }
  return out;
}

function getDisplayName(model) {
  return model.name || model.id;
}

function getContextWindow(model) {
  return model.context_window || 128000;
}

function getMaxOutputTokens(model) {
  return model.max_output_tokens || 64000;
}

function isSkippedModel(displayName) {
  return skippedModelPrefixes.some((prefix) => displayName.startsWith(prefix));
}

function getModelLimit(model) {
  const displayName = getDisplayName(model);
  if (modelLimitsOverrides[displayName]) {
    return modelLimitsOverrides[displayName];
  }
  const ctx = getContextWindow(model);
  const out = getMaxOutputTokens(model);
  console.error(
    `Warning: no context window override for model "${displayName}", using defaults (context=${ctx}, output=${out})`
  );
  return { context: ctx, output: out };
}

function checkDependencies() {
  try {
    execSync("which opencode", { stdio: "ignore" });
  } catch {
    console.error("Error: opencode is not installed");
    console.error("");
    console.error("To install opencode:");
    console.error("  npm install -g opencode");
    console.error("");
    console.error("For more information visit: https://opencode.ai");
    process.exit(1);
  }
}

if (!apiKey) {
  console.error("Error: NEXOS_API_KEY environment variable is not set\n");
  console.error("You can get your API key at: https://nexos.ai\n");
  console.error("Run with the API key inline:");
  console.error("  NEXOS_API_KEY=\"your-api-key\" npx opencode-nexos-models-config\n");
  console.error("Or set it permanently:\n");
  console.error("  Linux/macOS (bash/zsh):");
  console.error("    echo 'export NEXOS_API_KEY=\"your-api-key\"' >> ~/.bashrc   # bash");
  console.error("    echo 'export NEXOS_API_KEY=\"your-api-key\"' >> ~/.zshrc    # zsh (macOS default)");
  console.error("    source ~/.bashrc  # or source ~/.zshrc\n");
  process.exit(1);
}

if (!apiKey.startsWith("nexos-")) {
  console.error(
    'Error: NEXOS_API_KEY is invalid. The key must start with "nexos-".\n'
  );
  console.error("You can get your API key at: https://nexos.ai");
  process.exit(1);
}

checkDependencies();

console.error("Fetching models from Nexos AI API...");

const res = await fetch(`${apiBaseURL}/models`, {
  headers: {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  },
});

if (!res.ok) {
  console.error(`Error: ${res.status} ${res.statusText}`);
  const body = await res.text();
  if (body) console.error(body);
  process.exit(1);
}

const data = await res.json();
const modelsList = (data.data || []).sort((a, b) =>
  getDisplayName(a).toLowerCase().localeCompare(getDisplayName(b).toLowerCase())
);

if (modelsList.length === 0) {
  console.log("No models found.");
  process.exit(0);
}

const models = {};
const skippedModels = [];

for (const model of modelsList) {
  if ((model.name || "").includes("(No PII)")) continue;

  const displayName = getDisplayName(model);

  if (isSkippedModel(displayName)) {
    skippedModels.push(displayName);
    continue;
  }

  const limit = getModelLimit(model);
  const variants = getModelVariants(displayName);
  const options = getModelOptions(displayName);

  models[displayName] = {
    name: displayName,
    limit,
    ...(options ? { options } : {}),
    ...(variants ? { variants } : {}),
  };
}

if (skippedModels.length > 0) {
  console.error(
    `Skipped ${skippedModels.length} models (tool use not supported): ${skippedModels.join(", ")}`
  );
}

const modelNames = Object.keys(models);
console.error(`\nModels to be added (${modelNames.length}):\n`);
for (const name of modelNames) {
  console.error(`  - ${name}`);
}

const configPath = join(homedir(), ".config", "opencode", "opencode.json");

let config = {};
try {
  const raw = await readFile(configPath, "utf-8");
  config = JSON.parse(raw);
} catch {
  config = {};
}

config.$schema = "https://opencode.ai/config.json";
if (!config.provider) config.provider = {};

const existingProvider = asObject(config.provider["nexos-ai"]);
const existingModels = asObject(existingProvider?.models);
const existingEnv = uniqueStrings(existingProvider?.env);

config.provider["nexos-ai"] = {
  ...existingProvider,
  npm: existingProvider?.npm || "@crazy-goat/nexos-provider",
  name: existingProvider?.name || "Nexos AI",
  env: uniqueStrings(["NEXOS_API_KEY", ...existingEnv]),
  options: {
    baseURL: existingProvider?.options?.baseURL || "https://api.nexos.ai/v1/",
    timeout: existingProvider?.options?.timeout ?? 300000,
    ...asObject(existingProvider?.options),
  },
  models: {
    ...existingModels,
    ...models,
  },
};

await mkdir(dirname(configPath), { recursive: true });
await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");

console.error(`\nGenerated configuration for ${Object.keys(models).length} models`);
console.error(`Config written to: ${configPath}`);
