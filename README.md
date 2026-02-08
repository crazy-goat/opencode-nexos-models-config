# opencode-nexos-models-config

CLI tool that fetches available models from the [Nexos AI](https://nexos.ai) API and generates an [opencode](https://opencode.ai) configuration file with all supported models.

## Requirements

- Node.js 18+
- [opencode](https://opencode.ai) installed globally (`npm install -g opencode`)
- `NEXOS_API_KEY` environment variable set with your Nexos AI API key

## Installation

```bash
npm install -g opencode-nexos-models-config
```

## Usage

```bash
export NEXOS_API_KEY="your-api-key"
opencode-nexos-models-config
```

The tool will:

1. Fetch the list of available models from the Nexos AI API
2. Generate an opencode configuration with the [nexos-provider](https://github.com/crazy-goat/nexos-provider) plugin
3. Write the config to `~/.config/opencode/opencode.json`

## Configuration

| Environment Variable | Description | Default |
|---|---|---|
| `NEXOS_API_KEY` | Your Nexos AI API key (required) | - |
| `NEXOS_BASE_URL` | Custom API base URL | `https://api.nexos.ai/v1` |

## License

MIT
