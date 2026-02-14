# Changelog

## [1.8.0] - 2026-02-13

### Added

- Model configuration for **Kimi K2.5**
  - Context limit: 256k tokens
  - Output limit: 64k tokens
  - Pricing: $0.6/M input tokens, $3.0/M output tokens, $0.1/M cache read tokens

## [1.7.0] - 2026-02-13

### Added

- Model cost configuration support with hardcoded defaults for Claude, GPT, and Gemini models
  - Supports input, output, cache_read, and cache_write pricing tiers
  - Automatically includes existing model costs from config file (user's custom values take priority)
- `getExistingModelCosts()` function to read and preserve existing model costs from opencode.json
- `getModelCost()` function to retrieve model costs with fallback to hardcoded defaults
- Cost information is now included in generated model configurations

## [1.6.0] - 2026-02-12

### Added

- `--help` / `-h` flag to show usage information
- `--version` / `-v` flag to show version number
- `-s` as short option for `--select-agents`

### Improved

- Documentation: Added installation instructions for global and per-user installations (Linux/macOS)
- Documentation: Added update instructions
- Help message includes all available options and environment variables

## [1.5.0] - 2026-02-11

### Added

- `--output` / `-o` flag to write config to a custom file path

## [1.4.0] - 2026-02-11

### Changed

- Default agents changed to `build`, `build-fast`, `build-heavy`, `plan` (removed `code`)
- When no agents are configured, all default agents are added automatically without prompting
- Existing agent models not in Nexos list are now included in selection choices

### Added

- `plan` agent with read-only permissions (edit denied, bash/read/glob/grep/task/webfetch allowed)
- Default description and permissions for `plan` agent

### Removed

- Embedding models are now filtered out (not usable with opencode)

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
