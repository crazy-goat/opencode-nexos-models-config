import { jest } from '@jest/globals';
import { getModelVariants, getModelOptions, getModelLimit } from "../models.config.mjs";

const mockExecSync = jest.fn();
const mockReadFile = jest.fn();
const mockWriteFile = jest.fn();
const mockMkdir = jest.fn();
const mockHomedir = jest.fn(() => "/home/testuser");
const mockJoin = jest.fn((...args) => args.join("/"));
const mockDirname = jest.fn((path) => path.split("/").slice(0, -1).join("/"));

jest.unstable_mockModule("node:child_process", () => ({
  execSync: mockExecSync,
}));

jest.unstable_mockModule("node:fs/promises", () => ({
  readFile: mockReadFile,
  writeFile: mockWriteFile,
  mkdir: mockMkdir,
}));

jest.unstable_mockModule("node:os", () => ({
  homedir: mockHomedir,
}));

jest.unstable_mockModule("node:path", () => ({
  join: mockJoin,
  dirname: mockDirname,
}));

const mockFetch = jest.fn();
global.fetch = mockFetch;

const originalProcessExit = process.exit;
const originalConsoleError = console.error;
const originalConsoleLog = console.log;

describe("Integration Tests", () => {
  let mockConsoleError;
  let mockConsoleLog;
  let checkDependencies;
  let main;
  let asObject;
  let selectAgentModels;
  let fetchModelsFromApi;
  let processModels;
  let loadExistingConfig;
  let buildProviderConfig;
  let buildConfig;
  let saveConfig;

  beforeAll(async () => {
    // Import functions from index.mjs after mocks are set up
    const indexModule = await import("../index.mjs");
    checkDependencies = indexModule.checkDependencies;
    main = indexModule.main;
    asObject = indexModule.asObject;
    selectAgentModels = indexModule.selectAgentModels;
    fetchModelsFromApi = indexModule.fetchModelsFromApi;
    processModels = indexModule.processModels;
    loadExistingConfig = indexModule.loadExistingConfig;
    buildProviderConfig = indexModule.buildProviderConfig;
    buildConfig = indexModule.buildConfig;
    saveConfig = indexModule.saveConfig;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock process.exit to prevent actual exit during tests
    process.exit = jest.fn((code) => { throw new Error(`EXIT_${code}`); });
    // Capture console.error output
    mockConsoleError = jest.fn();
    console.error = mockConsoleError;
    mockConsoleLog = jest.fn();
    console.log = mockConsoleLog;

    process.env.NEXOS_API_KEY = "nexos-test-key";
    process.env.NEXOS_BASE_URL = "https://mock.api.nexos.ai/v1";
  });

  afterEach(() => {
    process.exit = originalProcessExit;
    console.error = originalConsoleError;
    console.log = originalConsoleLog;
    delete process.env.NEXOS_API_KEY;
    delete process.env.NEXOS_BASE_URL;
  });

  describe("checkDependencies", () => {
    test("should exit with error if opencode is not installed", () => {
      mockExecSync.mockImplementation(() => {
        throw new Error("opencode not found");
      });
      expect(() => checkDependencies()).toThrow("EXIT_1");
      expect(mockConsoleError).toHaveBeenCalledWith("Error: opencode is not installed");
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    test("should not exit if opencode is installed", () => {
      mockExecSync.mockReturnValueOnce("some/path/to/opencode");
      checkDependencies();
      expect(mockConsoleError).not.toHaveBeenCalled();
      expect(process.exit).not.toHaveBeenCalled();
    });
  });

  describe("fetchModelsFromApi", () => {
    test("should fetch and sort models", async () => {
      const mockModelsData = [
        { id: "gpt-5", name: "GPT 5" },
        { id: "claude-opus", name: "Claude Opus" },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockModelsData }),
      });

      const result = await fetchModelsFromApi("nexos-test-key", "https://api.nexos.ai/v1");

      expect(mockFetch).toHaveBeenCalledWith("https://api.nexos.ai/v1/models", {
        headers: {
          Authorization: "Bearer nexos-test-key",
          "Content-Type": "application/json",
        },
      });
      expect(result).toEqual([
        { id: "claude-opus", name: "Claude Opus" },
        { id: "gpt-5", name: "GPT 5" },
      ]);
    });

    test("should exit on API error", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve("Error details"),
      });

      await expect(fetchModelsFromApi("nexos-test-key", "https://api.nexos.ai/v1")).rejects.toThrow("EXIT_1");
      expect(mockConsoleError).toHaveBeenCalledWith("Error: 500 Internal Server Error");
      expect(mockConsoleError).toHaveBeenCalledWith("Error details");
    });
  });

  describe("processModels", () => {
    test("should process models and apply configuration", () => {
      const modelsList = [
        { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4.5", context_window: 200000, max_output_tokens: 64000 },
        { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", context_window: 1048576, max_output_tokens: 65536 },
        { id: "gemini-3-pro", name: "Gemini 3 Pro", context_window: 1048576, max_output_tokens: 65536 },
        { id: "text-embedding-3-large", name: "text-embedding-3-large", context_window: 128000, max_output_tokens: 64000 },
      ];

      const { models, skippedModels, unsupportedModels } = processModels(modelsList, {}, false);

      expect(models["Claude Sonnet 4.5"]).toBeDefined();
      expect(models["Claude Sonnet 4.5"].limit).toEqual({ context: 200000, output: 64000 });
      expect(models["Gemini 2.5 Flash"]).toBeDefined();
      expect(models["text-embedding-3-large"]).toBeUndefined();
      expect(skippedModels).toContain("Gemini 3 Pro");
    });

    test("should filter unsupported models when supportedModelsOnly is true", () => {
      const modelsList = [
        { id: "claude-opus-45", name: "Claude Opus 4.5" },
        { id: "unknown-model", name: "Unknown Model" },
      ];

      const { models, unsupportedModels } = processModels(modelsList, {}, true);

      expect(models["Claude Opus 4.5"]).toBeDefined();
      expect(models["Unknown Model"]).toBeUndefined();
      expect(unsupportedModels).toContain("Unknown Model");
    });
  });

  describe("loadExistingConfig", () => {
    test("should load existing config", async () => {
      const existingConfig = { provider: { "nexos-ai": { name: "Test" } } };
      mockReadFile.mockResolvedValueOnce(JSON.stringify(existingConfig));

      const result = await loadExistingConfig("/path/to/config.json");

      expect(result).toEqual(existingConfig);
    });

    test("should return empty object on error", async () => {
      mockReadFile.mockRejectedValueOnce(new Error("File not found"));

      const result = await loadExistingConfig("/path/to/config.json");

      expect(result).toEqual({});
    });
  });

  describe("buildProviderConfig", () => {
    test("should build provider config with defaults", () => {
      const models = { "Test Model": { name: "Test Model" } };
      const existingConfig = {};

      const result = buildProviderConfig(existingConfig, models, "https://api.nexos.ai/v1");

      expect(result).toEqual({
        npm: "@crazy-goat/nexos-provider",
        name: "Nexos AI",
        env: ["NEXOS_API_KEY"],
        options: {
          baseURL: "https://api.nexos.ai/v1/",
          timeout: 300000,
        },
        models,
      });
    });

    test("should preserve existing values", () => {
      const models = { "Test Model": { name: "Test Model" } };
      const existingConfig = {
        provider: {
          "nexos-ai": {
            npm: "custom-provider",
            name: "Custom Name",
            env: ["EXISTING_VAR"],
            options: { baseURL: "https://existing.api.com/", timeout: 60000 },
          },
        },
      };

      const result = buildProviderConfig(existingConfig, models, "https://api.nexos.ai/v1");

      expect(result.npm).toBe("custom-provider");
      expect(result.name).toBe("Custom Name");
      expect(result.env).toContain("EXISTING_VAR");
      expect(result.env).toContain("NEXOS_API_KEY");
      expect(result.options.baseURL).toBe("https://existing.api.com/");
      expect(result.options.timeout).toBe(60000);
    });
  });

  describe("buildConfig", () => {
    test("should build config with schema", () => {
      const existingConfig = { agent: { test: {} } };
      const providerConfig = { name: "Test Provider", models: {} };

      const result = buildConfig(existingConfig, providerConfig);

      expect(result.$schema).toBe("https://opencode.ai/config.json");
      expect(result.agent).toEqual({ test: {} });
      expect(result.provider["nexos-ai"]).toEqual(providerConfig);
    });
  });

  describe("saveConfig", () => {
    test("should save config to file", async () => {
      mockMkdir.mockResolvedValueOnce(undefined);
      mockWriteFile.mockResolvedValueOnce(undefined);

      const config = { test: "value" };
      await saveConfig(config, "/path/to/config.json");

      expect(mockMkdir).toHaveBeenCalledWith("/path/to", { recursive: true });
      expect(mockWriteFile).toHaveBeenCalledWith(
        "/path/to/config.json",
        JSON.stringify(config, null, 2) + "\n",
        "utf-8"
      );
    });
  });

  describe("main function", () => {
    test("should exit if NEXOS_API_KEY is not set", async () => {
      delete process.env.NEXOS_API_KEY;
      await expect(main()).rejects.toThrow("EXIT_1");
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("NEXOS_API_KEY environment variable is not set"));
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test("should exit if NEXOS_API_KEY is invalid", async () => {
      process.env.NEXOS_API_KEY = "invalid-key";
      await expect(main()).rejects.toThrow("EXIT_1");
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining('NEXOS_API_KEY is invalid'));
      expect(process.exit).toHaveBeenCalledWith(1);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    test("should exit if API call fails", async () => {
      mockExecSync.mockReturnValueOnce("some/path/to/opencode");
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
        text: () => Promise.resolve("Error details"),
        json: () => Promise.resolve({}),
      });

      await expect(main()).rejects.toThrow("EXIT_1");
      expect(mockConsoleError).toHaveBeenCalledWith("Fetching models from Nexos AI API...");
      expect(mockConsoleError).toHaveBeenCalledWith("Error: 500 Internal Server Error");
      expect(mockConsoleError).toHaveBeenCalledWith("Error details");
      expect(process.exit).toHaveBeenCalledWith(1);
    });

    test("should exit if no models are found", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [] }),
      });
      mockExecSync.mockReturnValueOnce("some/path/to/opencode");
      await expect(main()).rejects.toThrow("EXIT_0");
      expect(mockConsoleLog).toHaveBeenCalledWith("No models found.");
      expect(process.exit).toHaveBeenCalledWith(0);
    });

    test("should handle initial empty config file", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: [
          { id: "gpt-5-mini-2025-08-07", name: "GPT 5.2", context_window: 400000, max_output_tokens: 128000 },
        ] }),
      });
      mockExecSync.mockReturnValueOnce("some/path/to/opencode");
      mockReadFile.mockRejectedValueOnce(new Error("File not found"));
      mockMkdir.mockResolvedValueOnce(undefined);
      mockWriteFile.mockResolvedValueOnce(undefined);

      await main();

      const expectedConfigPath = "/home/testuser/.config/opencode/opencode.json";
      expect(mockMkdir).toHaveBeenCalledWith("/home/testuser/.config/opencode", { recursive: true });
      const expectedConfig = {
        "$schema": "https://opencode.ai/config.json",
        "provider": {
          "nexos-ai": {
            "npm": "@crazy-goat/nexos-provider",
            "name": "Nexos AI",
            "env": ["NEXOS_API_KEY"],
            "options": {
              "baseURL": "https://mock.api.nexos.ai/v1/",
              "timeout": 300000,
            },
            "models": {
              "GPT 5.2": {
                "name": "GPT 5.2",
                "limit": { "context": 400000, "output": 128000 },
                "options": { "reasoningEffort": "none" },
                "variants": { "low": { "reasoningEffort": "low" }, "high": { "reasoningEffort": "high" } },
                "cost": { "input": 1.75, "output": 14, "cache_read": 0.175 },
              },
            },
          },
        },
      };
      expect(mockWriteFile).toHaveBeenCalledWith(expectedConfigPath, JSON.stringify(expectedConfig, null, 2) + "\n", "utf-8");
      expect(process.exit).not.toHaveBeenCalled();
    });

    test("should process models and write config", async () => {
      const mockModelsData = [
        { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4.5", context_window: 200000, max_output_tokens: 64000 },
        { id: "gemini-2.5-flash", name: "Gemini 2.5 Flash", context_window: 1048576, max_output_tokens: 65536 },
        { id: "gemini-3-pro", name: "Gemini 3 Pro", context_window: 1048576, max_output_tokens: 65536 },
        { id: "gpt-5-mini-2025-08-07", name: "GPT 5.2", context_window: 400000, max_output_tokens: 128000 },
      ];
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ data: mockModelsData }),
      });
      mockExecSync.mockReturnValueOnce("some/path/to/opencode");
      mockReadFile.mockRejectedValueOnce(new Error("File not found"));
      mockReadFile.mockResolvedValueOnce(
        JSON.stringify({
          $schema: "https://opencode.ai/config.json",
          provider: {
            "nexos-ai": {
              npm: "@crazy-goat/nexos-provider",
              name: "Nexos AI",
              env: ["EXISTING_ENV_VAR"],
              options: { baseURL: "https://existing.api.nexos.ai/v1/" },
              models: { "Existing Model": { name: "Existing Model" } },
            },
          },
        })
      );
      mockMkdir.mockResolvedValueOnce(undefined);
      mockWriteFile.mockResolvedValueOnce(undefined);

      await main();

      expect(mockConsoleError).toHaveBeenCalledWith("Fetching models from Nexos AI API...");
      expect(mockExecSync).toHaveBeenCalledWith("which opencode", { stdio: "ignore" });
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("Skipped 1 models (tool usage not supported): Gemini 3 Pro"));
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("Supported models to be added (3):"));
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("  - Claude Sonnet 4.5"));
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("  - Gemini 2.5 Flash"));
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("  - GPT 5.2"));

      const expectedConfigPath = "/home/testuser/.config/opencode/opencode.json";
      expect(mockMkdir).toHaveBeenCalledWith("/home/testuser/.config/opencode", { recursive: true });

      const expectedConfig = {
        "$schema": "https://opencode.ai/config.json",
        "provider": {
          "nexos-ai": {
            "npm": "@crazy-goat/nexos-provider",
            "name": "Nexos AI",
            "env": ["NEXOS_API_KEY", "EXISTING_ENV_VAR"],
            "options": {
              "baseURL": "https://existing.api.nexos.ai/v1/",
              "timeout": 300000,
            },
            "models": {
              "Claude Sonnet 4.5": {
                "name": "Claude Sonnet 4.5",
                "limit": { "context": 200000, "output": 64000 },
                "variants": {
                  "low": { "thinking": { "type": "enabled", "budgetTokens": 1024 } },
                  "high": { "thinking": { "type": "enabled", "budgetTokens": 32000 } },
                },
                "cost": { "input": 3.3, "output": 16.5, "cache_read": 0.33, "cache_write": 4.13 },
              },
              "Gemini 2.5 Flash": {
                "name": "Gemini 2.5 Flash",
                "limit": { "context": 1048576, "output": 65536 },
                "variants": {
                  "low": { "thinking": { "type": "enabled", "budgetTokens": 1024 } },
                  "high": { "thinking": { "type": "enabled", "budgetTokens": 24576 } },
                },
                "cost": { "input": 0.3, "output": 2.5, "cache_read": 0.03 },
              },
              "GPT 5.2": {
                "name": "GPT 5.2",
                "limit": { "context": 400000, "output": 128000 },
                "options": { "reasoningEffort": "none" },
                "variants": { "low": { "reasoningEffort": "low" }, "high": { "reasoningEffort": "high" } },
                "cost": { "input": 1.75, "output": 14, "cache_read": 0.175 },
              },
            },
          },
        },
      };
      expect(mockWriteFile).toHaveBeenCalledWith(expectedConfigPath, JSON.stringify(expectedConfig, null, 2) + "\n", "utf-8");
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("Generated configuration for 3 models"));
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining(`Config written to: ${expectedConfigPath}`));
      expect(process.exit).not.toHaveBeenCalled();
    });
  });

  describe("selectAgentModels", () => {
    test("should skip when no agents selected from checkbox", async () => {
      const mockPrompts = {
        checkbox: jest.fn(async () => []),
        search: jest.fn(),
      };

      const config = { agent: { build: { model: "nexos-ai/Old Model" } } };
      const result = await selectAgentModels(config, ["Model A"], "nexos-ai", mockPrompts);
      expect(result).toBe(false);
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining("No agents selected")
      );
    });

    test("should update agent models via inquirer search", async () => {
      const mockSearchCounter = { count: 0 };
      const mockPrompts = {
        checkbox: jest.fn(async () => ["build", "plan"]),
        search: jest.fn(async () => {
          mockSearchCounter.count++;
          return mockSearchCounter.count === 1 ? "nexos-ai/Claude Opus 4.6" : "nexos-ai/Gemini 2.5 Flash";
        }),
      };

      const config = {
        agent: {
          build: { mode: "primary", model: "nexos-ai/Old Model", description: "Build agent" },
          plan: { mode: "primary", model: "nexos-ai/Old Plan Model" },
        },
      };

      const result = await selectAgentModels(config, ["Claude Opus 4.6", "Gemini 2.5 Flash"], "nexos-ai", mockPrompts);

      expect(result).toBe(true);
      expect(config.agent.build.model).toBe("nexos-ai/Claude Opus 4.6");
      expect(config.agent.plan.model).toBe("nexos-ai/Gemini 2.5 Flash");
    });

    test("should create new agents if not existing", async () => {
      const mockPrompts = {
        checkbox: jest.fn(async () => ["build"]),
        search: jest.fn(async () => "nexos-ai/GPT 5"),
      };

      const config = {};
      const result = await selectAgentModels(config, ["GPT 5"], "nexos-ai", mockPrompts);

      expect(result).toBe(true);
      expect(config.agent.build.model).toBe("nexos-ai/GPT 5");
    });

    test("should add all default agents when no agents exist", async () => {
      const mockPrompts = {
        checkbox: jest.fn(),
        search: jest.fn(async () => "nexos-ai/Claude Opus 4.5"),
      };

      const config = { agent: {} };
      const result = await selectAgentModels(config, ["Claude Opus 4.5"], "nexos-ai", mockPrompts);

      expect(result).toBe(true);
      expect(mockPrompts.checkbox).not.toHaveBeenCalled();
      expect(config.agent.build).toBeDefined();
      expect(config.agent["build-fast"]).toBeDefined();
      expect(config.agent["build-heavy"]).toBeDefined();
      expect(config.agent.plan).toBeDefined();
      expect(mockConsoleError).toHaveBeenCalledWith(expect.stringContaining("No agents configured, adding all defaults"));
    });

    test("should apply default permissions for plan agent", async () => {
      const mockPrompts = {
        checkbox: jest.fn(),
        search: jest.fn(async () => "nexos-ai/Claude Sonnet 4.5"),
      };

      const config = { agent: {} };
      await selectAgentModels(config, ["Claude Sonnet 4.5"], "nexos-ai", mockPrompts);

      expect(config.agent.plan.permission).toBeDefined();
      expect(config.agent.plan.permission.edit).toBe("deny");
      expect(config.agent.plan.permission.bash).toBe("allow");
      expect(config.agent.plan.permission.read).toBe("allow");
      expect(config.agent.plan.description).toBe("Read-only planning agent with bash access");
    });

    test("should not overwrite existing agent permissions", async () => {
      const mockPrompts = {
        checkbox: jest.fn(async () => ["plan"]),
        search: jest.fn(async () => "nexos-ai/Claude Sonnet 4.5"),
      };

      const config = {
        agent: {
          plan: {
            model: "nexos-ai/Old Model",
            permission: { edit: "allow", bash: "deny" },
            description: "Custom description",
          },
        },
      };
      await selectAgentModels(config, ["Claude Sonnet 4.5"], "nexos-ai", mockPrompts);

      expect(config.agent.plan.permission.edit).toBe("allow");
      expect(config.agent.plan.permission.bash).toBe("deny");
      expect(config.agent.plan.description).toBe("Custom description");
    });

    test("should include existing model in choices even if not in nexos list", async () => {
      const mockPrompts = {
        checkbox: jest.fn(async () => ["build"]),
        search: jest.fn(async ({ source }) => {
          const choices = source("");
          return choices[0].value;
        }),
      };

      const config = {
        agent: {
          build: { model: "other-provider/Custom Model" },
        },
      };
      await selectAgentModels(config, ["Claude Opus 4.5"], "nexos-ai", mockPrompts);

      expect(mockPrompts.search).toHaveBeenCalled();
      const searchCall = mockPrompts.search.mock.calls[0][0];
      const choices = searchCall.source("");
      expect(choices.some((c) => c.value === "other-provider/Custom Model")).toBe(true);
    });
  });

  describe("embedding models filtering", () => {
    test("should skip embedding models via processModels", () => {
      const modelsList = [
        { id: "gpt-5-mini-2025-08-07", name: "GPT 5.2", context_window: 400000, max_output_tokens: 128000 },
        { id: "text-embedding-3-large", name: "text-embedding-3-large", context_window: 128000, max_output_tokens: 64000 },
        { id: "text-embedding-3-small", name: "text-embedding-3-small", context_window: 128000, max_output_tokens: 64000 },
      ];

      const { models } = processModels(modelsList, {}, false);
      const modelNames = Object.keys(models);

      expect(modelNames).toContain("GPT 5.2");
      expect(modelNames).not.toContain("text-embedding-3-large");
      expect(modelNames).not.toContain("text-embedding-3-small");
    });
  });
});
