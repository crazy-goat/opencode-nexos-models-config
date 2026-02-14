#!/usr/bin/env node

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";
import { parseArgs } from "node:util";


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
  "codestral-2508":           { context: 256000, output: 16384 },
  "Kimi K2.5":                { context: 256000, output: 64000 },
};

const modelCostsDefaults = {
  "anthropic.claude-haiku-4-5@20251001": {
    input: 1,
    output: 5,
    cache_read: 0.1,
    cache_write: 1.25,
  },
  "anthropic.claude-sonnet-4-5@20250929 (aoxy-analytics europe-west1)": {
    input: 3,
    output: 15,
    cache_read: 0.3,
    cache_write: 3.75,
  },
  "anthropic.claude-sonnet-4-5@20250929 (oxy-analytics us-east5)": {
    input: 3,
    output: 15,
    cache_read: 0.3,
    cache_write: 3.75,
  },
  "Claude Opus 4.5": {
    input: 5,
    output: 25,
    cache_read: 0.5,
    cache_write: 6.25,
  },
  "Claude Opus 4.6": {
    input: 5,
    output: 25,
    cache_read: 0.5,
    cache_write: 6.25,
  },
  "Claude Sonnet 4.5": {
    input: 3,
    output: 15,
    cache_read: 0.3,
    cache_write: 3.75,
  },
  "claude-sonnet-4-20250514": {
    input: 3,
    output: 15,
    cache_read: 0.3,
    cache_write: 3.75,
  },
  // OpenAI models
  "GPT 5.2": {
    input: 1.75,
    output: 14.0,
    cache_read: 0.175,
  },
  "GPT 5": {
    input: 1.25,
    output: 10.0,
    cache_read: 0.125,
  },
  "gpt-5-mini-2025-08-07": {
    input: 0.25,
    output: 2.0,
    cache_read: 0.025,
  },
  "gpt-5-nano-2025-08-07": {
    input: 0.05,
    output: 0.4,
    cache_read: 0.005,
  },
  "GPT 5.2 Chat": {
    input: 1.75,
    output: 14.0,
    cache_read: 0.175,
  },
  "GPT 4.1": {
    input: 2.0,
    output: 8.0,
    cache_read: 0.5,
  },
  "gpt-4.1-mini-2025-04-14": {
    input: 0.4,
    output: 1.6,
    cache_read: 0.1,
  },
  "GPT 4o": {
    input: 2.5,
    output: 10.0,
    cache_read: 1.25,
  },
  // Google Gemini models
  "Gemini 2.5 Pro": {
    input: 1.25,
    output: 10.0,
    cache_read: 0.125,
  },
  "Gemini 2.5 Flash": {
    input: 0.3,
    output: 2.5,
    cache_read: 0.03,
  },
  "Kimi K2.5": {
    input: 0.6,
    output: 3.0,
    cache_read: 0.1,
  },
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

export function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

export function getModelVariants(displayName) {
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

export function getModelOptions(displayName) {
  if (displayName === "GPT 5" || displayName === "GPT 5.2") {
    return { reasoningEffort: "medium" };
  }
}

export function asObject(value) {
  return value && typeof value === "object" ? value : undefined;
}

export function uniqueStrings(values) {
  const out = [];
  for (const v of values || []) {
    if (typeof v !== "string") continue;
    if (out.includes(v)) continue;
    out.push(v);
  }
  return out;
}

export function getDisplayName(model) {
  return model.name || model.id;
}

export function getContextWindow(model) {
  return model.context_window || 128000;
}

export function getMaxOutputTokens(model) {
  return model.max_output_tokens || 64000;
}

export function isSkippedModel(displayName) {
  return skippedModelPrefixes.some((prefix) => displayName.startsWith(prefix));
}

export function getModelLimit(model) {
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

export function checkDependencies() {
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

export function parseCliArgs(argv) {
  const { values } = parseArgs({
    args: argv.slice(2),
    options: {
      "select-agents": { type: "boolean", short: "s", default: false },
      "output": { type: "string", short: "o" },
      "help": { type: "boolean", short: "h", default: false },
      "version": { type: "boolean", short: "v", default: false },
    },
    strict: false,
  });
  return values;
}

export function showHelp() {
  console.log(`Usage: opencode-nexos-models-config [options]

Fetch available models from Nexos AI API and generate opencode configuration.

Options:
  -h, --help           Show this help message
  -v, --version        Show version number
  -o, --output <path>  Write config to custom file path
  -s, --select-agents  Interactively select models for agents

Environment variables:
  NEXOS_API_KEY        Your Nexos AI API key (required)
  NEXOS_BASE_URL       Custom API base URL (default: https://api.nexos.ai/v1)
`);
}

export async function showVersion() {
  const packageJson = JSON.parse(
    await readFile(new URL("./package.json", import.meta.url), "utf-8")
  );
  console.log(packageJson.version);
}

const DEFAULT_AGENTS = ["build", "build-fast", "build-heavy", "plan"];

const AGENT_DEFAULTS = {
  plan: {
    description: "Read-only planning agent with bash access",
    permission: {
      edit: "deny",
      bash: "allow",
      read: "allow",
      glob: "allow",
      grep: "allow",
      task: "allow",
      webfetch: "allow",
    },
  },
};

export async function selectAgentModels(config, modelNames, providerName, prompts = null) {
  const { search, checkbox } = prompts || await import("@inquirer/prompts");

  if (!config.agent || typeof config.agent !== "object") {
    config.agent = {};
  }

  const existingAgents = Object.keys(config.agent);
  const allAgentNames = [...new Set([...DEFAULT_AGENTS, ...existingAgents])];

  let selectedAgents;
  if (existingAgents.length === 0) {
    selectedAgents = [...DEFAULT_AGENTS];
    console.error(`\nNo agents configured, adding all defaults: ${selectedAgents.join(", ")}`);
  } else {
    selectedAgents = await checkbox({
      message: "Select agents to configure:",
      choices: allAgentNames.map((name) => ({
        name: name,
        value: name,
        checked: existingAgents.includes(name),
      })),
    });

    if (selectedAgents.length === 0) {
      console.error("\nNo agents selected, skipping agent model selection.");
      return false;
    }
  }

  const allChoices = modelNames.map((name) => ({
    name: name,
    value: `${providerName}/${name}`,
  }));

  for (const agentName of selectedAgents) {
    const agentConfig = config.agent[agentName];
    if (agentConfig?.model && !allChoices.some((c) => c.value === agentConfig.model)) {
      allChoices.unshift({
        name: agentConfig.model,
        value: agentConfig.model,
      });
    }
  }

  console.error("\n\x1b[1m--- Agent Model Selection ---\x1b[0m\n");
  console.error("Use \x1b[36m\u2191\u2193\x1b[0m to navigate, \x1b[36mtype\x1b[0m to filter, \x1b[36mEnter\x1b[0m to select\n");

  for (const agentName of selectedAgents) {
    if (!config.agent[agentName]) {
      config.agent[agentName] = {};
    }
    const agentConfig = config.agent[agentName];
    if (AGENT_DEFAULTS[agentName]) {
      const defaults = AGENT_DEFAULTS[agentName];
      if (defaults.description && !agentConfig.description) {
        agentConfig.description = defaults.description;
      }
      if (defaults.permission && !agentConfig.permission) {
        agentConfig.permission = defaults.permission;
      }
    }
    const currentModel = agentConfig.model || "(not set)";
    const desc = agentConfig.description ? ` - ${agentConfig.description}` : "";

    const defaultIdx = allChoices.findIndex((c) => c.value === currentModel);

    const selected = await search({
      message: `\x1b[1m${agentName}\x1b[0m${desc}\n  current: \x1b[33m${currentModel}\x1b[0m`,
      source: (input) => {
        const term = (input || "").toLowerCase();
        return allChoices.filter((c) => c.name.toLowerCase().includes(term));
      },
      default: defaultIdx >= 0 ? allChoices[defaultIdx].value : undefined,
    });

    config.agent[agentName].model = selected;
  }
  return true;
}

export async function getExistingModelCosts() {
  const configPath = join(homedir(), ".config", "opencode", "opencode.json");
  try {
    const raw = await readFile(configPath, "utf-8");
    const config = JSON.parse(raw);
    const existingProvider = asObject(config.provider?.["nexos-ai"]);
    const existingModels = asObject(existingProvider?.models);
    
    if (!existingModels) return {};
    
    const costs = {};
    for (const [modelName, modelConfig] of Object.entries(existingModels)) {
      if (modelConfig?.cost) {
        costs[modelName] = modelConfig.cost;
      }
    }
    return costs;
  } catch {
    return {};
  }
}

export function getModelCost(displayName, existingCosts) {
  // Always prefer existing costs from config (user's custom values)
  if (existingCosts[displayName]) {
    return existingCosts[displayName];
  }
  // Fall back to hardcoded defaults if available
  if (modelCostsDefaults[displayName]) {
    return modelCostsDefaults[displayName];
  }
  return undefined;
}

export async function main() {
  const cliArgs = parseCliArgs(process.argv);

  if (cliArgs.help) {
    showHelp();
    process.exit(0);
  }

  if (cliArgs.version) {
    await showVersion();
    process.exit(0);
  }

  const apiBaseURL = process.env.NEXOS_BASE_URL || "https://api.nexos.ai/v1";
  const apiKey = process.env.NEXOS_API_KEY;

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

  // Load existing model costs
  const existingCosts = await getExistingModelCosts();

  const models = {};
  const skippedModels = [];

  for (const model of modelsList) {
    if ((model.name || "").includes("(No PII)")) continue;

    const displayName = getDisplayName(model);

    if (displayName.toLowerCase().includes("embedding")) continue;

    if (isSkippedModel(displayName)) {
      skippedModels.push(displayName);
      continue;
    }

    const limit = getModelLimit(model);
    const variants = getModelVariants(displayName);
    const options = getModelOptions(displayName);
    const cost = getModelCost(displayName, existingCosts);

    models[displayName] = {
      name: displayName,
      limit,
      ...(options ? { options } : {}),
      ...(variants ? { variants } : {}),
      ...(cost ? { cost } : {}),
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

  const configPath = cliArgs.output || join(homedir(), ".config", "opencode", "opencode.json");

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
      ...asObject(existingProvider?.options),
      baseURL: existingProvider?.options?.baseURL || `${apiBaseURL}/`,
      timeout: existingProvider?.options?.timeout ?? 300000,
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

  if (cliArgs["select-agents"]) {
    const updated = await selectAgentModels(config, modelNames, "nexos-ai");
    if (updated) {
      await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
      console.error("Agent configuration updated.");
    }
  }
}

if (process.env.NODE_ENV !== "test") {
  main();
}

