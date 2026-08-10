# @tishlang/sem

**Automated semantic versioning and release pipeline** — a [semantic-release](https://github.com/semantic-release/semantic-release)-style tool written in [Tish](https://tishlang.com), with a **dual runtime**:

| Runtime | How |
|---------|-----|
| **Tish** | `tish run --feature full src/main.tish` (source via `tish.module`) |
| **Node** | `npx @tishlang/sem` / `node dist/cli.js` (built from `src/main.tish`) |
| **GitHub Actions** | `uses: tishlang/sem@v1` → `dist/action.js` (built from `src/action.tish`) |

## Features

- Full 9-step plugin pipeline: `verifyConditions` → `analyzeCommits` → … → `fail`
- Built-in plugins: `@sem/commit-analyzer`, `@sem/release-notes-generator`, `@sem/changelog`, `@sem/npm`, `@sem/github`, `@sem/git`
- Conventional Commits + semver
- Config via file, `package.json`, env `SEM_CONFIG`, or `--config-json` / Action `config` input

## Install

```bash
npm install -D @tishlang/sem
```

Requires Node ≥ 22 for the JS CLI. For Tish-native runs, install a `tish` CLI (`@tishlang/tish` or cargo build).

## Quick start

```bash
# Node
npx sem --dry-run --no-ci

# Tish
tish run --feature full src/main.tish --dry-run --no-ci

# Inline config (skip .semrc)
npx sem --dry-run --no-ci --config-json '{"branches":["main"],"plugins":["@sem/commit-analyzer","@sem/release-notes-generator"]}'
```

## GitHub Action

Zero consumer deps — the action ships the JS bundle on the release tag.

```yaml
- uses: actions/checkout@v4
  with:
    fetch-depth: 0

- uses: tishlang/sem@v1
  id: sem
  with:
    dry_run: true
    working_directory: .
    config: |
      {
        "branches": ["main"],
        "plugins": [
          "@sem/commit-analyzer",
          "@sem/release-notes-generator"
        ]
      }
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

- if: steps.sem.outputs.new_release_published == 'true'
  run: echo "Next version ${{ steps.sem.outputs.new_release_version }}"
```

### Action inputs

| Input | Description |
|-------|-------------|
| `config` | Full sem JSON config (skips file / package.json config when set) |
| `dry_run` | Preview only |
| `ci` | Default `true`; set `false` for `--no-ci` |
| `working_directory` | Package cwd (monorepos) |
| `branches` | Optional JSON array override |
| `tag_format` | Optional tag format override |
| `debug` | Verbose logging |

### Action outputs

Compatible with `cycjimmy/semantic-release-action`: `new_release_published`, `new_release_version`, major/minor/patch, `new_release_notes`, `new_release_git_tag` / `git_head`, `last_release_*`.

No bump → `new_release_published=false`, exit 0.

## Configuration

Priority when `config` / `--config-json` / `SEM_CONFIG` is **not** set:

1. `.semrc.json`
2. `.releaserc.json`
3. `package.json` `"sem"` or `"release"`
4. Built-in defaults

### Example `.semrc.json`

```json
{
  "branches": ["main"],
  "plugins": [
    "@sem/commit-analyzer",
    "@sem/release-notes-generator",
    "@sem/changelog",
    ["@sem/npm", { "npmPublish": true }],
    "@sem/github",
    ["@sem/git", {
      "assets": ["CHANGELOG.md", "package.json"],
      "message": "chore(release): ${nextRelease.version} [skip ci]"
    }]
  ]
}
```

## CLI options

| Flag | Description |
|------|-------------|
| `--dry-run` | No publish / tag |
| `--no-ci` | Allow non-CI |
| `--debug` | Verbose |
| `--branch <name>` | Branch override |
| `--cwd <path>` | Working directory |
| `--config-json <json>` | Inline config |
| `--github-output` | Write Action outputs to `$GITHUB_OUTPUT` |
| `--help` / `--version` | Help / version from `package.json` |

## Dual-runtime layout

All source is Tish. JS under `dist/` is **only** produced by `tish build` (never hand-authored).

```
sem/
├── src/                 # Tish source (also published)
│   ├── index.tish       # library API
│   ├── main.tish        # CLI entry
│   └── action.tish      # GitHub Action entry
├── dist/                # gitignored locally; built by npm run build
│   ├── sem.js           # library
│   ├── cli.js           # Node bin
│   └── action.js        # action.yml main
├── action.yml           # Action metadata
├── scripts/build.sh     # tish build → dist/
└── docs/TISH_SEM_MIGRATION.md
```

```bash
npm run build    # tish build → dist/{sem,cli,action}.js
```

## Development

```bash
npm test                 # unit tests (tish)
npm run test:integration
npm run test:node        # build + Node --help
npm run test:all
```

## License

MIT
