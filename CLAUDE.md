# CLAUDE.md - Project Context

## Project Overview

This is a CLI tool that generates opencode configuration for Nexos AI models. It fetches available models from the Nexos AI API and creates an opencode configuration file with proper model limits, costs, and variants.

## Key Commands

```bash
# Run the tool
npx opencode-nexos-models-config

# With specific flags
npx opencode-nexos-models-config --supported-models=false  # Show all models
npx opencode-nexos-models-config --select-agents           # Interactive agent selection
npx opencode-nexos-models-config --custom-costs            # Set custom prices

# Run tests
npm test
```

## Documentation

- **Nexos AI Models**: https://docs.nexos.ai/models
- **Nexos AI API**: https://docs.nexos.ai/gateway-api

## How to Update Supported Models

1. Check current models in API:
   ```bash
   NEXOS_API_KEY=your_key npx opencode-nexos-models-config --supported-models=false
   ```

2. Find model specifications - check documentation:
   - https://docs.nexos.ai/models
   - https://docs.nexos.ai/gateway-api
   - If not available, check OpenRouter: https://openrouter.ai/api/frontend/models

3. Add new model to `SUPPORTED_MODELS` in `models.config.mjs`:
   ```javascript
   "Model Name": {
     limit: { context: X, output: Y },
     cost: { input: X, output: Y, cache_read: Z },
     variants: { low: {...}, high: {...} },
     options: {...},
   },
   ```

## Skipped Models

Gemini 3 models are skipped (tool usage not supported):
- Gemini 3 Flash Preview
- Gemini 3 Pro Preview
- Gemini 3.1 Flash Lite Preview
- Gemini 3.1 Pro Preview

## Environment Variables

- `NEXOS_API_KEY` - Required for API access
- `NEXOS_BASE_URL` - Optional, defaults to https://api.nexos.ai/v1

## Working Guidelines

**Before updating CHANGELOG or version:**
1. ALWAYS run `git diff` or `git diff HEAD~1 --name-only` to see what actually changed
2. Check the actual code changes in modified files (especially `models.config.mjs`)
3. Don't assume a "patch bump" is empty - there might be uncommitted changes
4. CLAUDE.md is for MY instructions, NOT for project documentation (no changelogs here!)
5. README.md tables need updating when adding new models to SUPPORTED_MODELS

**What to update when adding a new model:**
1. `models.config.mjs` - add to SUPPORTED_MODELS
2. `CHANGELOG.md` - add entry with model specs
3. `README.md` - add to the supported models table
4. `package.json` - bump version
