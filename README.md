# @tishlang/sem

**Automated semantic versioning and release pipeline** — a [semantic-release](https://github.com/semantic-release/semantic-release)-style tool written in [Tish](https://tishlang.com), with a **dual runtime**:

| Runtime | How |
|---------|-----|
| **Tish** | `tish run --feature full src/main.tish` (source via `tish.module`) |
| **Node** | `npx @tishlang/sem` / `node dist/cli.js` (built from `src/main.tish`) |
| **GitHub Actions** | `uses: tishlang/sem@v1` → `dist/action.js` (built from `src/action.tish`) |

> First npm publish of this package was driven by **sem** itself (`node dist/cli.js` with `@sem/npm` `npmPublish: true`).

## Features

- Full 9-step plugin pipeline: `verifyConditions` → `analyzeCommits` → … → `fail`
- Built-in plugins: `@sem/commit-analyzer`, `@sem/release-notes-generator`, `@sem/changelog`, `@sem/npm`, `@sem/github`, `@sem/git`
- Conventional Commits + semver
- Config via file, `package.json`, env `SEM_CONFIG`, or `--config-json` / Action `config` input

## Install

```bash
npm install -D @tishlang/sem
```

First publish is `npm run release` (requires npm login).

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
    # JSON or YAML — both work
    config: |
      branches:
        - main
      plugins:
        - "@sem/commit-analyzer"
        - "@sem/release-notes-generator"
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}

- if: steps.sem.outputs.new_release_published == 'true'
  run: echo "Next version ${{ steps.sem.outputs.new_release_version }}"
```

JSON still works if you prefer it:

```yaml
config: |
  { "branches": ["main"], "plugins": ["@sem/commit-analyzer"] }
```

### Action inputs

| Input | Description |
|-------|-------------|
| `config` | Full sem config as **JSON or YAML** (skips file / package.json config when set) |
| `dry_run` | Preview only |
| `ci` | Default `true`; set `false` for `--no-ci` |
| `working_directory` | Package cwd (monorepos) |
| `branches` | Release branches (JSON/YAML array; supports `*` globs) |
| `ignore_branches` | Soft-skip globs (JSON/YAML array or comma-separated) |
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

### Promote-style releases (`@sem/github`)

Same model as the tish repo: merge to `main` drafts a **prerelease** (with assets); promoting the GitHub Release (uncheck “Set as a pre-release”) triggers publish workflows.

```json
[
  "@sem/github",
  {
    "prerelease": true,
    "targetCommitish": "main",
    "assets": [
      "dist/*.tgz",
      { "path": "bin/my-tool", "name": "my-tool-linux-x64", "label": "Linux (x64)" }
    ],
    "successComment": "Shipped in ${nextRelease.version}: ${releases.url}",
    "releasedLabels": ["released"],
    "failTitle": "The automated release is failing 🚨",
    "failComment": false
  }
]
```

| Option | Purpose |
|--------|---------|
| `prerelease` | `true` / `false` / omit (auto from release channel) |
| `draftRelease` | Create as draft instead of published prerelease |
| `assets` | Glob or `{path,name,label}` list — uploaded to the release (replaces same name) |
| `targetCommitish` | Branch or SHA the release points at |
| `successComment` | Issue/PR comment template, or `false` to disable |
| `failComment` / `failTitle` | Failure issue body/title, or `false` to disable |
| `releasedLabels` / `labels` / `assignees` | Labels on success targets / fail issue |

On success, sem comments on commit-referenced issues **and** PRs linked via the commits API. `addChannel` flips `prerelease` when a version is added to the latest channel (programmatic promote).

This repo’s CI dogfoods that path: dry-run → pack tarball → `@sem/github` prerelease + asset → promote → `npm-release.yml`.

## CLI options

| Flag | Description |
|------|-------------|
| `--dry-run` | No publish / tag |
| `--no-ci` | Allow non-CI (local runs enable this automatically) |
| `--force <type\|version>` | Force a release (see below) |
| `--debug` | Verbose |
| `--branch <name>` | Branch override |
| `--cwd <path>` | Working directory |
| `--config-json <json>` | Inline config |
| `--github-output` | Write Action outputs to `$GITHUB_OUTPUT` |
| `--help` / `--version` | Help / version from `package.json` |

## Branches and ignores

Release branches are an allowlist (`branches`). Anything else is a **soft skip** (exit 0, `new_release_published=false`) — same idea as workflow `on.push.branches` filters, so Actions jobs stay green.

```json
{
  "branches": ["main", "next"],
  "ignoreBranches": ["dependabot/**", "renovate/**", "chore/**"]
}
```

```bash
npm run release -- --ignore-branches 'dependabot/**,renovate/**'
```

```yaml
- uses: tishlang/sem@v1
  with:
    branches: '["main"]'
    ignore_branches: '["dependabot/**"]'
```

On a non-release or ignored branch, sem logs a skip and exits 0 (it does **not** fail the job).

## Forcing a release

Like other semver CLIs, you can force a bump when conventional commits would not (or when you need an exact version):

```bash
# Bump type (ignores commit analyzer)
npm run release -- --force patch
npm run release -- --force minor
npm run release -- --force major

# Exact version
npm run release -- --force 1.4.0

# Dry-run first
npm run release:dry -- --force patch

# Env form (useful in CI)
SEM_FORCE=patch npm run release
```

GitHub Action:

```yaml
- uses: tishlang/sem@v1
  with:
    force: patch
```

`--force` skips commit analysis and always produces a release. Prefer conventional commits for day-to-day; use force for recoveries, empty bumps, or intentional version jumps.

If a git tag exists but that version was never published to npm, `npm run release` will republish it automatically (no `--force` needed).

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
