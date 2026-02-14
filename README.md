# opencode-nexos-models-config

Simple CLI companion tool for the [nexos-provider](https://github.com/crazy-goat/nexos-provider) [opencode](https://opencode.ai) plugin. It fetches available models from the [Nexos AI](https://nexos.ai) API and generates an opencode configuration file.

## Requirements

- Node.js 18+
- [opencode](https://opencode.ai) installed globally (`npm install -g opencode`)
- `NEXOS_API_KEY` environment variable set with your Nexos AI API key

## Installation

### Global installation (recommended)

```bash
npm install -g opencode-nexos-models-config
```

### Per-user installation (without root/sudo)

#### Linux

Add to `~/.npmrc`:

```
prefix=~/.npm-global
```

Add to `~/.bashrc`:

```bash
export PATH="$HOME/.npm-global/bin:$PATH"
```

Then reload shell and install:

```bash
source ~/.bashrc
npm install -g opencode-nexos-models-config
```

#### macOS

Add to `~/.npmrc`:

```
prefix=~/.npm-global
```

Add to `~/.zshrc`:

```bash
export PATH="$HOME/.npm-global/bin:$PATH"
```

Then reload shell and install:

```bash
source ~/.zshrc
npm install -g opencode-nexos-models-config
```

### Updating

```bash
npm update -g opencode-nexos-models-config
```

Or to force the latest version:

```bash
npm install -g opencode-nexos-models-config@latest
```

## Usage

After global installation:

```bash
opencode-nexos-models-config
```

Or without installation (using npx):

```bash
npx opencode-nexos-models-config
```

The tool will:

1. Fetch the list of available models from the Nexos AI API
2. Generate an opencode configuration with the [nexos-provider](https://github.com/crazy-goat/nexos-provider) plugin
3. Write the config to `~/.config/opencode/opencode.json`

### Supported models only

To include only models with predefined configuration (costs, limits, variants):

```bash
opencode-nexos-models-config --supported-models
```

Or use the short flag:

```bash
opencode-nexos-models-config -m
```

This filters the list to only include models from the curated `SUPPORTED_MODELS` list (see below).

### Agent model selection

If you have agents defined in your `opencode.json` (e.g. `build`, `build-fast`, `build-heavy`, `plan`), you can interactively assign models to them:

```bash
opencode-nexos-models-config --select-agents
```

This opens an interactive prompt for each agent where you can search and select a model using arrow keys and type-to-filter.

### Custom model costs

To interactively set custom prices for models in your config:

```bash
opencode-nexos-models-config --custom-costs
```

Or use the short flag:

```bash
opencode-nexos-models-config -c
```

This allows you to:
- Set custom input/output/cache prices per model
- See current costs while selecting
- Update prices for multiple models in one session
- Leave fields blank to keep existing values

When used with `--supported-models`, only supported models will be shown:

```bash
opencode-nexos-models-config -m -c
```

### Model pricing information

The tool automatically includes pricing information for all models in the generated configuration. Pricing includes:

- **Input cost**: Price per million input tokens
- **Output cost**: Price per million output tokens
- **Cache read**: Price per million cached tokens read (if supported)
- **Cache write**: Price per million tokens written to cache (if supported)

**Default pricing**:
- Supported models have predefined costs (see table below)
- Unknown models use fallback costs based on Claude Opus 4.6 pricing:
  - Input: $5/M tokens
  - Output: $25/M tokens
  - Cache read: $0.5/M tokens
  - Cache write: $6.25/M tokens

**Custom pricing**:
- Your existing custom costs are always preserved
- Use `--custom-costs` flag to set new custom prices interactively
- Custom costs take priority over default pricing

**Note**: The app always overwrites the entire model list with fresh data from the API on each run.

## Configuration

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `NEXOS_API_KEY` | Your Nexos AI API key (required) | - |
| `NEXOS_BASE_URL` | Custom API base URL | `https://api.nexos.ai/v1` |

### CLI Flags

| Flag | Description |
|---|---|
| `--help`, `-h` | Show help message |
| `--version`, `-v` | Show version number |
| `--select-agents`, `-s` | Interactively select models for agents defined in config |
| `--supported-models`, `-m` | Only include models with predefined configuration |
| `--custom-costs`, `-c` | Interactively set custom costs for models |
| `--output`, `-o` | Write config to a custom file path instead of default |

## Supported Models

When using `--supported-models` flag, only these curated models are included:

| Model | Provider | Context | Output | Variants |
|---|---|---|---|---|
| **Claude Opus 4.5** | Anthropic | 200k | 64k | low, high |
| **Claude Opus 4.6** | Anthropic | 200k | 128k | low, high |
| **Claude Sonnet 4.5** | Anthropic | 200k | 64k | low, high |
| **GPT 5.2** | OpenAI | 400k | 128k | low, high |
| **GPT 5** | OpenAI | 400k | 128k | low, high |
| **Gemini 2.5 Pro** | Google | 1M | 65k | low, high |
| **Gemini 2.5 Flash** | Google | 1M | 65k | low, high |
| **Kimi K2.5** | Moonshot AI | 256k | 64k | - |

All models come with pre-configured context limits, output limits, and pricing information.

### Variants

- **low**: Minimal thinking/reasoning (faster, cheaper)
- **high**: Extended thinking/reasoning (more accurate for complex tasks)

### Default mode

Without `--supported-models`, the tool will include **all** available models from the Nexos AI API. The entire model list is replaced on each run to ensure you have the latest models and pricing.

**Important**: Your custom costs set via `--custom-costs` are preserved and take priority, but the model list itself is always refreshed from the API.

## Model Configuration

Model metadata is stored in `models.config.mjs` and includes:

- **limits**: Context window and max output tokens
- **cost**: Input/output pricing per 1M tokens, plus cache read/write if supported
- **variants**: Model-specific thinking/reasoning variants (low, high)
- **options**: Default model options (e.g., reasoningEffort)

## License

MIT
