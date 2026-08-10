# sem

**Automated semantic versioning and release pipeline** — a full [semantic-release](https://github.com/semantic-release/semantic-release) clone written in [Tish](https://tishlang.com).

## Features

- 🔄 **Full lifecycle** — 9-step plugin pipeline: `verifyConditions` → `analyzeCommits` → `verifyRelease` → `generateNotes` → `prepare` → `publish` → `addChannel` → `success` → `fail`
- 📦 **6 built-in plugins** — commit-analyzer, release-notes-generator, changelog, npm, github, git
- 📝 **Conventional Commits** — Angular preset with customizable release rules
- 🏷️ **Semver** — full semver 2.0 parsing, comparison, and incrementing
- 🌿 **Multi-branch** — release branches, pre-release channels, maintenance branches
- 🔌 **Plugin system** — same plugin API as semantic-release
- ⚡ **Zero dependencies** — everything implemented in pure Tish

## Quick Start

```bash
# Run a release
tish run --fs --process --regex --http src/main.tish

# Dry run
tish run --fs --process --regex --http src/main.tish --dry-run

# With debug output
tish run --fs --process --regex --http src/main.tish --debug
```

## Configuration

sem looks for config in this order:

1. `.semrc.json` in the project root
2. `.releaserc.json`
3. `"sem"` or `"release"` key in `package.json`
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

## Plugins

### `@sem/commit-analyzer`

Analyzes commit messages to determine the release type.

| Commit | Release |
|:---|:---|
| `feat: ...` | minor |
| `fix: ...` | patch |
| `perf: ...` | patch |
| `feat!: ...` or `BREAKING CHANGE:` footer | major |

Supports custom `releaseRules`:

```json
["@sem/commit-analyzer", {
  "releaseRules": [
    { "type": "refactor", "release": "patch" },
    { "type": "docs", "scope": "README", "release": "patch" }
  ]
}]
```

### `@sem/release-notes-generator`

Generates markdown release notes grouped by commit type, with links to commits and issues.

### `@sem/changelog`

Creates or updates `CHANGELOG.md` with release notes.

```json
["@sem/changelog", { "changelogFile": "CHANGELOG.md" }]
```

### `@sem/npm`

Updates `package.json` version and publishes to npm.

Requires `NPM_TOKEN` environment variable.

```json
["@sem/npm", { "npmPublish": true, "pkgRoot": "." }]
```

### `@sem/github`

Creates GitHub Releases and comments on resolved issues.

Requires `GITHUB_TOKEN` or `GH_TOKEN` environment variable.

```json
["@sem/github", { "successComment": "Released in v${nextRelease.version}" }]
```

### `@sem/git`

Commits release artifacts (CHANGELOG.md, package.json) back to the repository.

```json
["@sem/git", {
  "assets": ["CHANGELOG.md", "package.json"],
  "message": "chore(release): ${nextRelease.version} [skip ci]"
}]
```

## Branch Configuration

```json
{
  "branches": [
    "main",
    "next",
    { "name": "beta", "prerelease": true },
    { "name": "1.x", "range": "1.x" }
  ]
}
```

## CLI Options

| Flag | Description |
|:---|:---|
| `--dry-run` | Run without making changes |
| `--no-ci` | Skip CI environment check |
| `--debug` | Enable verbose logging |
| `--branch <name>` | Override release branch |
| `--help` | Show help |
| `--version` | Show version |

## Running Tests

```bash
# Unit tests
tish run --fs --process --regex test/semver.test.tish
tish run --fs --process --regex test/commit-parser.test.tish
tish run --fs --process --regex test/commit-analyzer.test.tish
tish run --fs --process --regex test/release-notes.test.tish

# Integration test
tish run --fs --process --regex --http test/integration.test.tish
```

## Architecture

```
sem/
├── src/
│   ├── main.tish              — CLI entry point
│   ├── config.tish            — Config loader
│   ├── orchestrator.tish      — Release pipeline
│   ├── plugin-loader.tish     — Plugin system
│   ├── logger.tish            — ANSI logging
│   ├── git.tish               — Git operations
│   ├── semver.tish            — Semver 2.0
│   ├── commit-parser.tish     — Conventional Commits parser
│   ├── plugins/               — 6 built-in plugins
│   └── utils/                 — Template, glob, URL helpers
└── test/                      — Unit & integration tests
```

## License

MIT
