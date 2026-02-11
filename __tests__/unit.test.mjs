import {
  clone,
  uniqueStrings,
  getDisplayName,
  getContextWindow,
  getMaxOutputTokens,
  isSkippedModel,
  parseCliArgs,
} from "../index.mjs";

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

  describe("parseCliArgs", () => {
    test("should return select-agents as false by default", () => {
      const args = parseCliArgs(["node", "index.mjs"]);
      expect(args["select-agents"]).toBe(false);
    });

    test("should return select-agents as true when flag is passed", () => {
      const args = parseCliArgs(["node", "index.mjs", "--select-agents"]);
      expect(args["select-agents"]).toBe(true);
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