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

### Agent model selection

If you have agents defined in your `opencode.json` (e.g. `build`, `build-fast`, `build-heavy`, `plan`), you can interactively assign models to them:

```bash
opencode-nexos-models-config --select-agents
```

This opens an interactive prompt for each agent where you can search and select a model using arrow keys and type-to-filter.

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
| `--output`, `-o` | Write config to a custom file path instead of default |

## License

MIT
