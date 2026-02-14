import {
  uniqueStrings,
  getDisplayName,
  getContextWindow,
  getMaxOutputTokens,
  parseCliArgs,
} from "../index.mjs";
import { isSkippedModel, clone, getModelConfig, getModelLimit, getModelCost, getModelVariants, getModelOptions, isModelSupported, SUPPORTED_MODELS } from "../models.config.mjs";

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

      test("should return undefined for unsupported models", () => {
        const cost = getModelCost("Unknown Model");
        expect(cost).toBeUndefined();
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

    test("should return supported-models as false by default", () => {
      const args = parseCliArgs(["node", "index.mjs"]);
      expect(args["supported-models"]).toBe(false);
    });

    test("should return supported-models as true when flag is passed", () => {
      const args = parseCliArgs(["node", "index.mjs", "--supported-models"]);
      expect(args["supported-models"]).toBe(true);
    });

    test("should return supported-models as true when -m flag is passed", () => {
      const args = parseCliArgs(["node", "index.mjs", "-m"]);
      expect(args["supported-models"]).toBe(true);
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
  });
});