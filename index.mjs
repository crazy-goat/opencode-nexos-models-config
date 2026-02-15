#!/usr/bin/env node

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join, dirname } from "node:path";
import { execSync } from "node:child_process";
import { parseArgs } from "node:util";
import {
  getModelVariants,
  getModelOptions,
  isSkippedModel,
  getModelLimit,
  getModelCost,
  isModelSupported,
} from "./models.config.mjs";

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
      "supported-models": { type: "string", short: "m" },
      "custom-costs": { type: "boolean", short: "c", default: false },
      "output": { type: "string", short: "o" },
      "help": { type: "boolean", short: "h", default: false },
      "version": { type: "boolean", short: "v", default: false },
    },
    strict: false,
  });
  return values;
}

export function parseSupportedModelsFlag(value) {
  // Default to true when flag is not provided
  if (value === undefined) return true;
  // Parse string values
  const lower = String(value).toLowerCase();
  if (lower === "true" || lower === "1" || lower === "yes") return true;
  if (lower === "false" || lower === "0" || lower === "no") return false;
  // Default to true for any other value (including empty string)
  return true;
}

export function showHelp() {
  console.log(`Usage: opencode-nexos-models-config [options]

Fetch available models from Nexos AI API and generate opencode configuration.

Options:
  -h, --help              Show this help message
  -v, --version           Show version number
  -o, --output <path>     Write config to custom file path
  -s, --select-agents     Interactively select models for agents
  -m, --supported-models  Only include models with predefined costs (default: true)
  -c, --custom-costs      Interactively set custom costs for models

Environment variables:
  NEXOS_API_KEY        Your Nexos AI API key (required)
  NEXOS_BASE_URL       Custom API base URL (default: https://api.nexos.ai/v1)

Examples:
  opencode-nexos-models-config                    # Use supported models only (default)
  opencode-nexos-models-config -m false           # Include all models
  opencode-nexos-models-config --supported-models=false
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

export async function configureCustomCosts(config, modelNames, providerName, supportedModelsOnly = false, prompts = null) {
  const { search, input, confirm } = prompts || await import("@inquirer/prompts");

  const providerConfig = asObject(config.provider?.[providerName]);
  const modelsConfig = asObject(providerConfig?.models);

  if (!modelsConfig || Object.keys(modelsConfig).length === 0) {
    console.error("\nNo models configured yet. Run without --custom-costs first.");
    return false;
  }

  // Filter models based on supported-models flag
  let availableModels = Object.keys(modelsConfig);
  if (supportedModelsOnly) {
    const { isModelSupported } = await import("./models.config.mjs");
    availableModels = availableModels.filter(isModelSupported);
    if (availableModels.length === 0) {
      console.error("\nNo supported models found in configuration.");
      console.error("Run without -m flag to see all models.");
      return false;
    }
  }

  console.error("\n\x1b[1m--- Custom Cost Configuration ---\x1b[0m\n");
  console.error("Use \x1b[36m\u2191\u2193\x1b[0m to navigate, \x1b[36mtype\x1b[0m to filter, \x1b[36mEnter\x1b[0m to select");
  console.error("Select '\x1b[33m(Done - don't change more)\x1b[0m' when finished\n");

  let hasChanges = false;
  let continueEditing = true;

  while (continueEditing) {
    const choices = [
      { name: "(Done - don't change more)", value: null },
      ...availableModels.map((name) => {
        const currentCost = modelsConfig[name]?.cost;
        const costInfo = currentCost
          ? ` [in: ${currentCost.input || '-'}, out: ${currentCost.output || '-'}]`
          : ' [no cost set]';
        return {
          name: `${name}${costInfo}`,
          value: name,
        };
      }),
    ];

    const selectedModel = await search({
      message: "Select a model to set custom costs (or choose 'Done' to finish):",
      source: (term) => {
        const input = (term || "").toLowerCase();
        return choices.filter((c) => c.name.toLowerCase().includes(input));
      },
    });

    if (!selectedModel) {
      continueEditing = false;
      break;
    }

    const currentCost = modelsConfig[selectedModel]?.cost || {};

    console.error(`\n\x1b[1mSetting costs for: ${selectedModel}\x1b[0m`);
    console.error("Leave blank to keep current value. Prices are per 1M tokens.\n");

    const newInput = await input({
      message: `Input cost (current: ${currentCost.input ?? 'not set'}):`,
      default: currentCost.input?.toString() || '',
    });

    const newOutput = await input({
      message: `Output cost (current: ${currentCost.output ?? 'not set'}):`,
      default: currentCost.output?.toString() || '',
    });

    const newCacheRead = await input({
      message: `Cache read cost (current: ${currentCost.cache_read ?? 'not set'}):`,
      default: currentCost.cache_read?.toString() || '',
    });

    const newCacheWrite = await input({
      message: `Cache write cost (current: ${currentCost.cache_write ?? 'not set'}):`,
      default: currentCost.cache_write?.toString() || '',
    });

    const cost = {};
    if (newInput !== '' && !isNaN(parseFloat(newInput))) {
      cost.input = parseFloat(newInput);
    } else if (currentCost.input !== undefined) {
      cost.input = currentCost.input;
    }

    if (newOutput !== '' && !isNaN(parseFloat(newOutput))) {
      cost.output = parseFloat(newOutput);
    } else if (currentCost.output !== undefined) {
      cost.output = currentCost.output;
    }

    if (newCacheRead !== '' && !isNaN(parseFloat(newCacheRead))) {
      cost.cache_read = parseFloat(newCacheRead);
    } else if (currentCost.cache_read !== undefined) {
      cost.cache_read = currentCost.cache_read;
    }

    if (newCacheWrite !== '' && !isNaN(parseFloat(newCacheWrite))) {
      cost.cache_write = parseFloat(newCacheWrite);
    } else if (currentCost.cache_write !== undefined) {
      cost.cache_write = currentCost.cache_write;
    }

    if (Object.keys(cost).length > 0) {
      if (!modelsConfig[selectedModel]) {
        modelsConfig[selectedModel] = {};
      }
      modelsConfig[selectedModel].cost = cost;
      hasChanges = true;
      console.error(`\n\x1b[32m\u2713 Updated costs for ${selectedModel}\x1b[0m\n`);
    }

    continueEditing = await confirm({
      message: 'Set costs for another model?',
      default: true,
    });
  }

  return hasChanges;
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

export async function fetchModelsFromApi(apiKey, apiBaseURL) {
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
  return (data.data || []).sort((a, b) =>
    getDisplayName(a).toLowerCase().localeCompare(getDisplayName(b).toLowerCase())
  );
}

export function processModels(modelsList, existingCosts, supportedModelsOnly) {
  const models = {};
  const skippedModels = [];
  const unsupportedModels = [];

  for (const model of modelsList) {
    if ((model.name || "").includes("(No PII)")) continue;

    const displayName = getDisplayName(model);

    if (displayName.toLowerCase().includes("embedding")) continue;

    if (isSkippedModel(displayName)) {
      skippedModels.push(displayName);
      continue;
    }

    const limit = getModelLimit(displayName, model);
    const variants = getModelVariants(displayName);
    const options = getModelOptions(displayName);
    const cost = getModelCost(displayName, existingCosts);

    if (supportedModelsOnly) {
      const isSupported = isModelSupported(displayName);
      if (!isSupported) {
        unsupportedModels.push(displayName);
        continue;
      }
    }

    models[displayName] = {
      name: displayName,
      limit,
      ...(options ? { options } : {}),
      ...(variants ? { variants } : {}),
      ...(cost ? { cost } : {}),
    };
  }

  return { models, skippedModels, unsupportedModels };
}

export async function loadExistingConfig(configPath) {
  try {
    const raw = await readFile(configPath, "utf-8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function buildProviderConfig(existingConfig, models, apiBaseURL) {
  const existingProvider = asObject(existingConfig.provider?.["nexos-ai"]);
  const existingEnv = uniqueStrings(existingProvider?.env);

  return {
    npm: existingProvider?.npm || "@crazy-goat/nexos-provider",
    name: existingProvider?.name || "Nexos AI",
    env: uniqueStrings(["NEXOS_API_KEY", ...existingEnv]),
    options: {
      ...asObject(existingProvider?.options),
      baseURL: existingProvider?.options?.baseURL || `${apiBaseURL}/`,
      timeout: existingProvider?.options?.timeout ?? 300000,
    },
    models,
  };
}

export function buildConfig(existingConfig, providerConfig) {
  return {
    $schema: "https://opencode.ai/config.json",
    ...existingConfig,
    provider: {
      ...existingConfig.provider,
      "nexos-ai": providerConfig,
    },
  };
}

export function serializeConfig(config) {
  return JSON.stringify(config, null, 2) + "\n";
}

export async function saveConfig(config, configPath) {
  await mkdir(dirname(configPath), { recursive: true });
  await writeFile(configPath, serializeConfig(config), "utf-8");
}

export async function main() {
  const cliArgs = parseCliArgs(process.argv);
  
  const supportedModelsOnly = parseSupportedModelsFlag(cliArgs["supported-models"]);

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

  const modelsList = await fetchModelsFromApi(apiKey, apiBaseURL);

  if (modelsList.length === 0) {
    console.log("No models found.");
    process.exit(0);
  }

  // Load existing model costs
  const existingCosts = await getExistingModelCosts();

  const { models, skippedModels, unsupportedModels } = processModels(
    modelsList,
    existingCosts,
    supportedModelsOnly
  );

  if (skippedModels.length > 0) {
    console.error(
      `Skipped ${skippedModels.length} models (tool usage not supported): ${skippedModels.join(", ")}`
    );
  }

  if (unsupportedModels.length > 0) {
    console.error(
      `Filtered out ${unsupportedModels.length} unsupported models: ${unsupportedModels.join(", ")}`
    );
  }

  const modelNames = Object.keys(models);
  const listTitle = supportedModelsOnly 
    ? `\nSupported models to be added (${modelNames.length}):\n`
    : `\nModels to be added (${modelNames.length}):\n`;
  console.error(listTitle);
  for (const name of modelNames) {
    console.error(`  - ${name}`);
  }

  const configPath = cliArgs.output || join(homedir(), ".config", "opencode", "opencode.json");
  const existingConfig = await loadExistingConfig(configPath);
  
  const providerConfig = buildProviderConfig(existingConfig, models, apiBaseURL);
  const config = buildConfig(existingConfig, providerConfig);

  await saveConfig(config, configPath);

  console.error(`\nGenerated configuration for ${Object.keys(models).length} models`);
  console.error(`Config written to: ${configPath}`);

  if (cliArgs["select-agents"]) {
    const updated = await selectAgentModels(config, modelNames, "nexos-ai");
    if (updated) {
      await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
      console.error("Agent configuration updated.");
    }
  }

  if (cliArgs["custom-costs"]) {
    const updated = await configureCustomCosts(config, modelNames, "nexos-ai", supportedModelsOnly);
    if (updated) {
      await writeFile(configPath, JSON.stringify(config, null, 2) + "\n", "utf-8");
      console.error("Model costs configuration updated.");
    }
  }
}

if (process.env.NODE_ENV !== "test") {
  main();
}
