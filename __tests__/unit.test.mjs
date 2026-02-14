import {
  uniqueStrings,
  getDisplayName,
  getContextWindow,
  getMaxOutputTokens,
  parseCliArgs,
  configureCustomCosts,
  parseSupportedModelsFlag,
} from "../index.mjs";
import { isSkippedModel, clone, getModelConfig, getModelLimit, getModelCost, getModelVariants, getModelOptions, isModelSupported, SUPPORTED_MODELS, DEFAULT_FALLBACK_COSTS } from "../models.config.mjs";

describe("Helper Functions", () => {
  describe("clone", () => {
    test("should clone a simple object", () => {
      const obj = { a: 1, b: "test" };
      const clonedObj = clone(obj);
      expect(clonedObj).toEqual(obj);
      expect(clonedObj).not.toBe(obj);
    });

    test("should clone an array", () => {
      const arr = [1, 2, { a: 3 }];
      const clonedArr = clone(arr);
      expect(clonedArr).toEqual(arr);
      expect(clonedArr).not.toBe(arr);
      expect(clonedArr[2]).not.toBe(arr[2]);
    });

    test("should return undefined for undefined input", () => {
      expect(clone(undefined)).toBeUndefined();
    });

    test("should clone nested objects", () => {
      const obj = { a: 1, b: { c: 2 } };
      const clonedObj = clone(obj);
      expect(clonedObj).toEqual(obj);
      expect(clonedObj.b).not.toBe(obj.b);
    });
  });

  describe("uniqueStrings", () => {
    test("should return unique strings from an array", () => {
      const arr = ["a", "b", "a", "c", "b"];
      expect(uniqueStrings(arr)).toEqual(["a", "b", "c"]);
    });

    test("should handle empty array", () => {
      expect(uniqueStrings([])).toEqual([]);
    });

    test("should filter out non-string values", () => {
      const arr = ["a", 1, "b", null, "c", undefined];
      expect(uniqueStrings(arr)).toEqual(["a", "b", "c"]);
    });

    test("should return an empty array if input is null or undefined", () => {
      expect(uniqueStrings(null)).toEqual([]);
      expect(uniqueStrings(undefined)).toEqual([]);
    });
  });

  describe("getDisplayName", () => {
    test("should return name if available", () => {
      const model = { name: "Test Model", id: "test-model-id" };
      expect(getDisplayName(model)).toBe("Test Model");
    });

    test("should return id if name is not available", () => {
      const model = { id: "test-model-id" };
      expect(getDisplayName(model)).toBe("test-model-id");
    });
  });

  describe("getContextWindow", () => {
    test("should return context_window if available", () => {
      const model = { context_window: 200000 };
      expect(getContextWindow(model)).toBe(200000);
    });

    test("should return default value if context_window is not available", () => {
      const model = {};
      expect(getContextWindow(model)).toBe(128000);
    });
  });

  describe("getMaxOutputTokens", () => {
    test("should return max_output_tokens if available", () => {
      const model = { max_output_tokens: 64000 };
      expect(getMaxOutputTokens(model)).toBe(64000);
    });

    test("should return default value if max_output_tokens is not available", () => {
      const model = {};
      expect(getMaxOutputTokens(model)).toBe(64000);
    });
  });

  describe("isSkippedModel", () => {
    test("should return true if model display name starts with a skipped prefix", () => {
      expect(isSkippedModel("Gemini 3 Pro")).toBe(true);
      expect(isSkippedModel("Gemini 3.1 Flash")).toBe(true);
    });

    test("should return false if model display name does not start with a skipped prefix", () => {
      expect(isSkippedModel("Gemini 2.5 Pro")).toBe(false);
      expect(isSkippedModel("Claude Opus")).toBe(false);
    });
  });

  describe("Model Configuration", () => {
    describe("getModelConfig", () => {
      test("should return config for supported models", () => {
        const config = getModelConfig("Claude Opus 4.5");
        expect(config).toBeDefined();
        expect(config.limit).toBeDefined();
        expect(config.cost).toBeDefined();
      });

      test("should return null for unsupported models", () => {
        const config = getModelConfig("Unknown Model");
        expect(config).toBeNull();
      });
    });

    describe("isModelSupported", () => {
      test("should return true for supported models", () => {
        expect(isModelSupported("Claude Opus 4.5")).toBe(true);
        expect(isModelSupported("GPT 5.2")).toBe(true);
        expect(isModelSupported("Gemini 2.5 Pro")).toBe(true);
      });

      test("should return false for unsupported models", () => {
        expect(isModelSupported("Unknown Model")).toBe(false);
      });
    });

    describe("getModelLimit", () => {
      test("should return limits from config for supported models", () => {
        const limit = getModelLimit("Claude Opus 4.5");
        expect(limit).toEqual({ context: 200000, output: 64000 });
      });

      test("should return limits from API model when provided", () => {
        const apiModel = { context_window: 500000, max_output_tokens: 100000 };
        const limit = getModelLimit("Unknown Model", apiModel);
        expect(limit).toEqual({ context: 500000, output: 100000 });
      });

      test("should return defaults for unknown models without API data", () => {
        const limit = getModelLimit("Unknown Model");
        expect(limit).toEqual({ context: 128000, output: 64000 });
      });
    });

    describe("getModelCost", () => {
      test("should return cost from config for supported models", () => {
        const cost = getModelCost("Claude Opus 4.5");
        expect(cost).toEqual({ input: 5, output: 25, cache_read: 0.5, cache_write: 6.25 });
      });

      test("should prefer existing costs over defaults", () => {
        const existingCosts = { "Claude Opus 4.5": { input: 10, output: 50 } };
        const cost = getModelCost("Claude Opus 4.5", existingCosts);
        expect(cost).toEqual({ input: 10, output: 50 });
      });

      test("should return fallback costs for unsupported models", () => {
        const cost = getModelCost("Unknown Model");
        expect(cost).toEqual({ input: 5, output: 25, cache_read: 0.5, cache_write: 6.25 });
      });

      test("should prefer user costs over fallback for unsupported models", () => {
        const existingCosts = { "Unknown Model": { input: 15, output: 40 } };
        const cost = getModelCost("Unknown Model", existingCosts);
        expect(cost).toEqual({ input: 15, output: 40 });
      });
    });

    describe("getModelVariants", () => {
      test("should return Claude variants for Claude models", () => {
        const variants = getModelVariants("Claude Opus 4.5");
        expect(variants).toBeDefined();
        expect(variants.low).toBeDefined();
        expect(variants.high).toBeDefined();
      });

      test("should return Gemini variants for Gemini models", () => {
        const variants = getModelVariants("Gemini 2.5 Pro");
        expect(variants).toBeDefined();
        expect(variants.low).toBeDefined();
        expect(variants.high).toBeDefined();
      });

      test("should return GPT reasoning variants for GPT models", () => {
        const variants = getModelVariants("GPT 5.2");
        expect(variants).toBeDefined();
        expect(variants.low).toEqual({ reasoningEffort: "low" });
        expect(variants.high).toEqual({ reasoningEffort: "high" });
      });

      test("should return undefined for models without variants", () => {
        const variants = getModelVariants("Kimi K2.5");
        expect(variants).toBeUndefined();
      });
    });

    describe("getModelOptions", () => {
      test("should return options for GPT 5 models", () => {
        const options = getModelOptions("GPT 5");
        expect(options).toEqual({ reasoningEffort: "none" });
      });

      test("should return options for GPT 5.2 models", () => {
        const options = getModelOptions("GPT 5.2");
        expect(options).toEqual({ reasoningEffort: "none" });
      });

      test("should return undefined for models without specific options", () => {
        const options = getModelOptions("Kimi K2.5");
        expect(options).toBeUndefined();
      });
    });

    describe("DEFAULT_FALLBACK_COSTS", () => {
      test("should be defined with expected values", () => {
        expect(DEFAULT_FALLBACK_COSTS).toBeDefined();
        expect(DEFAULT_FALLBACK_COSTS).toEqual({
          input: 5,
          output: 25,
          cache_read: 0.5,
          cache_write: 6.25,
        });
      });

      test("should match Claude Opus 4.6 pricing", () => {
        const claudeOpusCosts = getModelCost("Claude Opus 4.6");
        expect(DEFAULT_FALLBACK_COSTS).toEqual(claudeOpusCosts);
      });
    });

    describe("SUPPORTED_MODELS", () => {
      test("should contain expected models", () => {
        expect("Claude Opus 4.5" in SUPPORTED_MODELS).toBe(true);
        expect("GPT 5.2" in SUPPORTED_MODELS).toBe(true);
        expect("Gemini 2.5 Pro" in SUPPORTED_MODELS).toBe(true);
        expect("Kimi K2.5" in SUPPORTED_MODELS).toBe(true);
      });
    });
  });

  describe("parseCliArgs", () => {
    test("should return select-agents as false by default", () => {
      const args = parseCliArgs(["node", "index.mjs"]);
      expect(args["select-agents"]).toBe(false);
    });

    test("should return select-agents as true when flag is passed", () => {
      const args = parseCliArgs(["node", "index.mjs", "--select-agents"]);
      expect(args["select-agents"]).toBe(true);
    });

    test("should return supported-models as undefined by default", () => {
      const args = parseCliArgs(["node", "index.mjs"]);
      expect(args["supported-models"]).toBeUndefined();
    });

    test("should return supported-models as true when flag is passed without value", () => {
      const args = parseCliArgs(["node", "index.mjs", "--supported-models"]);
      // parseArgs returns true for string type flags when passed without value
      expect(args["supported-models"]).toBe(true);
    });

    test("should return supported-models value when flag is passed with value", () => {
      const args = parseCliArgs(["node", "index.mjs", "--supported-models", "false"]);
      expect(args["supported-models"]).toBe("false");
    });

    test("should return supported-models value when -m flag is passed with value", () => {
      const args = parseCliArgs(["node", "index.mjs", "-m", "true"]);
      expect(args["supported-models"]).toBe("true");
    });

    test("should ignore unknown flags without error", () => {
      const args = parseCliArgs(["node", "index.mjs", "--unknown-flag"]);
      expect(args["select-agents"]).toBe(false);
    });

    test("should return output as undefined by default", () => {
      const args = parseCliArgs(["node", "index.mjs"]);
      expect(args.output).toBeUndefined();
    });

    test("should return output path when --output flag is passed", () => {
      const args = parseCliArgs(["node", "index.mjs", "--output", "/custom/path.json"]);
      expect(args.output).toBe("/custom/path.json");
    });

    test("should return output path when -o flag is passed", () => {
      const args = parseCliArgs(["node", "index.mjs", "-o", "/custom/path.json"]);
      expect(args.output).toBe("/custom/path.json");
    });

    test("should return custom-costs as false by default", () => {
      const args = parseCliArgs(["node", "index.mjs"]);
      expect(args["custom-costs"]).toBe(false);
    });

    test("should return custom-costs as true when flag is passed", () => {
      const args = parseCliArgs(["node", "index.mjs", "--custom-costs"]);
      expect(args["custom-costs"]).toBe(true);
    });

    test("should return custom-costs as true when -c flag is passed", () => {
      const args = parseCliArgs(["node", "index.mjs", "-c"]);
      expect(args["custom-costs"]).toBe(true);
    });
  });

  describe("parseSupportedModelsFlag", () => {
    test("should return true when value is undefined (default behavior)", () => {
      expect(parseSupportedModelsFlag(undefined)).toBe(true);
    });

    test("should return true when value is empty string", () => {
      expect(parseSupportedModelsFlag("")).toBe(true);
    });

    test("should return true when value is 'true'", () => {
      expect(parseSupportedModelsFlag("true")).toBe(true);
      expect(parseSupportedModelsFlag("TRUE")).toBe(true);
      expect(parseSupportedModelsFlag("True")).toBe(true);
    });

    test("should return true when value is '1'", () => {
      expect(parseSupportedModelsFlag("1")).toBe(true);
    });

    test("should return true when value is 'yes'", () => {
      expect(parseSupportedModelsFlag("yes")).toBe(true);
      expect(parseSupportedModelsFlag("YES")).toBe(true);
    });

    test("should return false when value is 'false'", () => {
      expect(parseSupportedModelsFlag("false")).toBe(false);
      expect(parseSupportedModelsFlag("FALSE")).toBe(false);
      expect(parseSupportedModelsFlag("False")).toBe(false);
    });

    test("should return false when value is '0'", () => {
      expect(parseSupportedModelsFlag("0")).toBe(false);
    });

    test("should return false when value is 'no'", () => {
      expect(parseSupportedModelsFlag("no")).toBe(false);
      expect(parseSupportedModelsFlag("NO")).toBe(false);
    });

    test("should return true for any other string value", () => {
      expect(parseSupportedModelsFlag("random")).toBe(true);
      expect(parseSupportedModelsFlag("abc")).toBe(true);
    });

    test("should handle boolean true as input", () => {
      expect(parseSupportedModelsFlag(true)).toBe(true);
    });

    test("should handle boolean false as input", () => {
      expect(parseSupportedModelsFlag(false)).toBe(false);
    });
  });

  describe("configureCustomCosts", () => {
    test("should return false when no models configured", async () => {
      const config = { provider: { "nexos-ai": { models: {} } } };
      const result = await configureCustomCosts(config, [], "nexos-ai");
      expect(result).toBe(false);
    });

    test("should return false when provider not configured", async () => {
      const config = { provider: {} };
      const result = await configureCustomCosts(config, [], "nexos-ai");
      expect(result).toBe(false);
    });

    test("should return false when supportedModelsOnly is true but no supported models exist", async () => {
      const config = {
        provider: {
          "nexos-ai": {
            models: {
              "Unknown Model 1": { name: "Unknown Model 1" },
              "Unknown Model 2": { name: "Unknown Model 2" },
            }
          }
        }
      };

      const result = await configureCustomCosts(config, [], "nexos-ai", true);
      
      expect(result).toBe(false);
    });

    test("should update costs when user provides new values", async () => {
      const config = {
        provider: {
          "nexos-ai": {
            models: {
              "Test Model": { name: "Test Model" }
            }
          }
        }
      };

      // Create mock prompts using plain functions
      const searchCalls = [];
      const inputCalls = [];
      let confirmCalls = 0;

      const mockPrompts = {
        search: async ({ message, source }) => {
          searchCalls.push({ message, hasSource: !!source });
          // Return Test Model first, then null (done)
          if (searchCalls.length === 1) return "Test Model";
          return null;
        },
        input: async ({ message, default: defaultValue }) => {
          inputCalls.push({ message, defaultValue });
          // Return: input=10, output=20, cache_read=5, cache_write=8
          const responses = ["10", "20", "5", "8"];
          return responses[inputCalls.length - 1] || "";
        },
        confirm: async () => {
          confirmCalls++;
          // Continue once, then stop
          return confirmCalls <= 1;
        },
      };

      const result = await configureCustomCosts(config, ["Test Model"], "nexos-ai", false, mockPrompts);
      
      expect(result).toBe(true);
      expect(config.provider["nexos-ai"].models["Test Model"].cost).toEqual({
        input: 10,
        output: 20,
        cache_read: 5,
        cache_write: 8,
      });
    });

    test("should preserve existing costs when inputs are blank", async () => {
      const config = {
        provider: {
          "nexos-ai": {
            models: {
              "Test Model": { 
                name: "Test Model",
                cost: { input: 5, output: 15, cache_read: 0.5 }
              }
            }
          }
        }
      };

      let searchCallCount = 0;
      let inputCallCount = 0;

      const mockPrompts = {
        search: async () => {
          searchCallCount++;
          // Return Test Model first, then null (done)
          if (searchCallCount === 1) return "Test Model";
          return null;
        },
        input: async () => {
          inputCallCount++;
          // Return: "" (keep input), "25" (update output), "" (keep cache_read), "" (no cache_write)
          const responses = ["", "25", "", ""];
          return responses[inputCallCount - 1] || "";
        },
        confirm: async () => false, // Stop after first model
      };

      const result = await configureCustomCosts(config, ["Test Model"], "nexos-ai", false, mockPrompts);
      
      expect(result).toBe(true);
      expect(config.provider["nexos-ai"].models["Test Model"].cost).toEqual({
        input: 5,
        output: 25,
        cache_read: 0.5,
      });
    });

    test("should filter to supported models only when supportedModelsOnly is true", async () => {
      const config = {
        provider: {
          "nexos-ai": {
            models: {
              "Claude Opus 4.5": { name: "Claude Opus 4.5" },
              "Unknown Model": { name: "Unknown Model" },
              "GPT 5": { name: "GPT 5" },
            }
          }
        }
      };

      let searchCallCount = 0;

      const mockPrompts = {
        search: async ({ source }) => {
          searchCallCount++;
          // Check that only supported models are in choices when source is called
          if (source) {
            const allChoices = source("");
            // Should only contain Claude Opus 4.5, GPT 5, and Done option
            const modelNames = allChoices
              .filter(c => c.value !== null)
              .map(c => c.value);
            expect(modelNames).toContain("Claude Opus 4.5");
            expect(modelNames).toContain("GPT 5");
            expect(modelNames).not.toContain("Unknown Model");
          }
          // Return Claude Opus 4.5 first, then null (done)
          if (searchCallCount === 1) return "Claude Opus 4.5";
          return null;
        },
        input: async () => "10",
        confirm: async () => false,
      };

      const result = await configureCustomCosts(
        config, 
        Object.keys(config.provider["nexos-ai"].models), 
        "nexos-ai", 
        true, 
        mockPrompts
      );
      
      expect(result).toBe(true);
      expect(searchCallCount).toBeGreaterThan(0);
    });
  });
});