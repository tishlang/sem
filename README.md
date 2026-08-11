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
- Conventional Commits + semver (`feat` / `fix` / `perf` / breaking → bump; `chore` / `docs` / `ci` → no release)
- Config via file, `package.json`, `SEM_CONFIG`, `--config-json`, or Action `config` (**JSON or YAML**)
- Soft-skip on non-release / ignored branches (exit 0 — CI stays green)
- `--force` / `SEM_FORCE` for recoveries; auto-republish when a git tag exists but the version is missing from npm
- Promote-style GitHub releases (prerelease + assets → uncheck prerelease → publish workflows)

## Install

```bash
# As a CLI / library in your repo
npm install -D @tishlang/sem

# Or from GitHub Packages
npm install -D @tishlang/sem --registry=https://npm.pkg.github.com
```

Requires Node ≥ 22 for the JS CLI. For Tish-native runs, install a `tish` CLI (`@tishlang/tish` or cargo build).

**GitHub Action** needs no install — pin the tag:

```yaml
uses: tishlang/sem@v1   # Marketplace listing name is tishlang-sem; uses path is the repo
```

## Quick start

```bash
# Preview (local; --no-ci is auto-enabled outside CI)
npx sem --dry-run
# or: npm run release:dry

# Real release (needs git remotes + auth — see Auth below)
npx sem
# or: npm run release / npm start

# Tish runtime
tish run --feature full src/main.tish --dry-run

# Inline config (JSON or YAML; skips .semrc)
npx sem --dry-run --config-json '{"branches":["main"],"plugins":["@sem/commit-analyzer","@sem/release-notes-generator"]}'
npx sem --dry-run --config-json $'branches:\n  - main\nplugins:\n  - "@sem/commit-analyzer"'
```

## GitHub Action

Zero consumer deps — the action ships the JS bundle on the release tag (`dist/` is committed to release tags / `v1`).

**CI tips**

- `actions/checkout` with `fetch-depth: 0` (full history + tags for the version oracle)
- Job permissions: at least `contents: read` for dry-run; `contents: write` to create tags/releases; `pull-requests: write` / `issues: write` if you enable success/fail comments
- Set `GITHUB_TOKEN` (or rely on the default token with those permissions)

```yaml
- uses: actions/checkout@v7
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

Version-oracle + promote pattern (what this repo dogfoods):

```yaml
# 1) Dry-run for the next version
- uses: tishlang/sem@v1
  id: sem
  with:
    dry_run: true
    config: |
      branches: [main]
      plugins:
        - "@sem/commit-analyzer"
        - "@sem/release-notes-generator"

# 2) Build/pack assets, then force that version with @sem/github prerelease:true
# 3) Human unchecks "Set as a pre-release" → a workflow on release: [published, edited]
#    with if: draft == false && prerelease == false publishes to npm / GitHub Packages
```

### Action inputs

| Input | Default | Description |
|-------|---------|-------------|
| `config` | _(empty)_ | Full sem config as **JSON or YAML** (skips file / package.json config when set) |
| `dry_run` | `false` | Preview only — no tag / publish |
| `ci` | `true` | Set `false` for `--no-ci` |
| `working_directory` | `.` | Package cwd (monorepo package root) |
| `branches` | _(from config)_ | Release branches (JSON/YAML array; supports `*` globs); overrides `config.branches` |
| `ignore_branches` | _(from config)_ | Soft-skip globs (JSON/YAML array or comma-separated) |
| `tag_format` | `v${version}` | Tag format override |
| `force` | _(empty)_ | Force a release: `major` / `minor` / `patch` / exact `x.y.z` |
| `debug` | `false` | Verbose logging |

### Action outputs

Same shape as `cycjimmy/semantic-release-action`, plus soft-skip fields. Use `id:` on the step, then `steps.<id>.outputs.*` to post, notify, or kick other jobs.

| Output | When set | Description |
|--------|----------|-------------|
| `new_release_published` | Always | `"true"` if a release was (or would be, in dry-run) published; else `"false"` |
| `skipped` | Always | `"true"` if the run soft-skipped (non-release / ignored branch) |
| `skip_reason` | When skipped | `ignored-branch` or `non-release-branch` |
| `new_release_version` | On publish / dry-run bump | Full version, e.g. `1.4.0` |
| `new_release_major_version` | On publish / dry-run bump | Major segment |
| `new_release_minor_version` | On publish / dry-run bump | Minor segment |
| `new_release_patch_version` | On publish / dry-run bump | Patch segment |
| `new_release_channel` | When non-latest | Dist-tag / channel name |
| `new_release_notes` | On publish / dry-run bump | Changelog body (multiline-safe) |
| `new_release_git_head` | On publish / dry-run bump | Commit SHA for the release |
| `new_release_git_tag` | On publish / dry-run bump | Tag, e.g. `v1.4.0` |
| `last_release_version` | When a prior release exists | Previous version |
| `last_release_git_head` | When a prior release exists | Previous release SHA |
| `last_release_git_tag` | When a prior release exists | Previous tag |

No bump → `new_release_published=false`, exit 0 (job stays green). Soft-skip on a non-release branch → `skipped=true` with the same exit 0.

```yaml
- uses: tishlang/sem@v1
  id: sem
  # ...

- if: steps.sem.outputs.new_release_published == 'true'
  run: |
    gh workflow run deploy.yml -f version="${{ steps.sem.outputs.new_release_version }}"
    # or post notes: steps.sem.outputs.new_release_notes
```

CLI equivalent: `--github-output` writes the same keys to `$GITHUB_OUTPUT`.

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

This repo’s CI dogfoods that path: dry-run → pack tarball → `@sem/github` prerelease + asset → promote → `npm-release.yml` (npmjs + GitHub Packages).

## CLI options

| Flag | Description |
|------|-------------|
| `--dry-run` / `-d` | No publish / tag |
| `--no-ci` | Skip CI env check (auto outside CI) |
| `--force <type\|version>` / `-f` | Force release: `major`\|`minor`\|`patch` or exact `x.y.z` (`--force=patch` also works) |
| `--ignore-branches <list>` | Comma-separated branch globs to soft-skip |
| `--branch <name>` / `-b` | Ensure this branch is treated as a release branch |
| `--cwd <path>` | Working directory (monorepo package root) |
| `--config-json <doc>` | Inline config **JSON or YAML** (skips file / package.json config) |
| `--github-output` | Write Action-compatible keys to `$GITHUB_OUTPUT` |
| `--debug` | Verbose logging |
| `--help` / `-h` | Help |
| `--version` / `-v` | Version from `package.json` |

### Environment

| Variable | Description |
|----------|-------------|
| `SEM_CONFIG` | Inline config JSON or YAML (same as `--config-json`) |
| `SEM_FORCE` | Same as `--force` |
| `GITHUB_OUTPUT` | Path for outputs (set automatically in Actions; enable with `--github-output` locally) |
| `GITHUB_TOKEN` / `GH_TOKEN` | GitHub API auth for `@sem/github` (falls back to `gh auth token`) |
| `NPM_TOKEN` | npm auth for `@sem/npm` when not using `npm login` / OIDC |
| `NPM_OTP` | One-time password for npm 2FA publish |
| `SEM_PACKAGE_ROOT` | Override package root used for version lookup (advanced) |

### Exit codes

| Code | Meaning |
|------|---------|
| `0` | Success, no bump, or soft-skip (`skipped` / `new_release_published=false`) |
| `1` | Hard failure (auth, plugin error, invalid `--force`, etc.) |

### Conventional Commits → bump

| Commit | Release |
|--------|---------|
| `feat:` | minor |
| `fix:` / `perf:` | patch |
| `feat!:` / `fix!:` / `BREAKING CHANGE:` footer | major |
| `chore:` / `docs:` / `ci:` / `style:` / … | none (soft no-op) |

## Auth

| Target | How |
|--------|-----|
| GitHub Releases / comments | `GITHUB_TOKEN` or `GH_TOKEN`, or authenticated `gh` CLI |
| npmjs (`@sem/npm`) | `npm login`, `NPM_TOKEN`, or OIDC trusted publishing in CI (`id-token: write`) |
| npm 2FA | `NPM_OTP` |
| GitHub Packages | `NODE_AUTH_TOKEN=${{ secrets.GITHUB_TOKEN }}` + `@scope:registry=https://npm.pkg.github.com` |

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

### Republish (tag without npm)

If a git tag exists but that version was never published to npm, and `@sem/npm` is enabled with publish on (package not `private`), `npm run release` will republish that version automatically (no `--force` needed). Skipped when npm publish is disabled or the package is private.

### Useful `@sem/npm` options

| Option | Description |
|--------|-------------|
| `npmPublish` | `false` to bump `package.json` only (no registry publish) |
| `pkgRoot` | Subdirectory containing `package.json` |

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
└── scripts/build.sh     # tish build → dist/
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
