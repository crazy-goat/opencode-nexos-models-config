# Changelog

## [1.3.0] - 2026-02-11

### Added

- `--select-agents` flag — interactive model selection for agents defined in `opencode.json`
  - Uses `@inquirer/prompts` search component with arrow-key navigation and type-to-filter
  - Shows current model and description for each agent
  - Only runs when explicitly passed; default behavior is unchanged
- Model limit override for `codestral-2508` (context: 256k, output: 16k)

### Changed

- Replaced readline-based agent model prompt with interactive `@inquirer/prompts` UI

## [1.2.0] - 2026-02-09

### Improved

- Better error message when `NEXOS_API_KEY` is not set — now includes inline usage example and instructions for setting it permanently on Linux/macOS

### Added

- Validation that `NEXOS_API_KEY` starts with `nexos-` prefix

## [1.1.2] - 2026-02-09

### Fixed

- Preserve existing `provider.nexos-ai.npm` value instead of overwriting it on each run
- Preserve existing provider settings (name, env, options) when regenerating config

### Added

- Thinking variants (low/high) for Gemini models
  - Gemini Flash: low (1024 tokens), high (24576 tokens)
  - Gemini Pro: low (1024 tokens), high (32768 tokens)
- Thinking variants (low/high) for Claude models
- Reasoning variants (low/high) for GPT 5 and GPT 5.2
- Model limit override for Gemini 2.5 Flash
- Existing models in config are now preserved (merged) instead of replaced

### Removed

- `no-reasoning` variant from GPT models — only `low` and `high` variants are supported

## [1.1.0] - Initial v2

- Basic model config generation from Nexos AI API
- Support for model limit overrides
- Skip Gemini 3 models (tool use not supported)
