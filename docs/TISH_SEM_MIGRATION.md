# Plan: migrate tish CI from cycjimmy/semantic-release-action to sem (@tishlang/sem)
#
# Status: PLAN ONLY — do not edit tish in this workstream.
# Target repo: tishlang/tish (see ~/Projects/tish/tish)

## Goal

Replace `cycjimmy/semantic-release-action@v4` dry-runs used as a **version oracle** in
`.github/workflows/build-npm-binaries.yml` with `tishlang/sem@v1`, passing config
inline so tish no longer needs `extra_plugins` installs into the consumer workspace or
`TISH_SEMANTIC_RELEASE_CI` strip-down of `release.config.cjs`.

Non-goals: changing the prerelease → promote → npm / crates.io / Homebrew publish
orchestration. Only the semantic-release dry-run steps change.

## Current tish pattern

```yaml
- uses: cycjimmy/semantic-release-action@v4
  with:
    dry_run: true
    semantic_version: 25
    working_directory: npm/tish
    extra_plugins: |
      @semantic-release/commit-analyzer@^13.0.0
      @semantic-release/release-notes-generator@^14.1.0
  env:
    TISH_SEMANTIC_RELEASE_CI: "1"
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Soft-skip when `new_release_published != true` / empty `new_release_version` (issue #86).

CI read-only config keeps analyzer + notes only (`file://` repo URL, no npm/github publish plugins).

## Target pattern

```yaml
- uses: tishlang/sem@v1
  id: semantic
  with:
    dry_run: true
    working_directory: npm/tish
    config: |
      {
        "branches": ["main"],
        "plugins": [
          ["@sem/commit-analyzer", {
            "parserOpts": {
              "noteKeywords": ["BREAKING CHANGE", "BREAKING CHANGES"]
            }
          }],
          "@sem/release-notes-generator"
        ]
      }
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

Outputs are intentionally aligned with cycjimmy:

| Output | Use in tish |
|--------|-------------|
| `new_release_published` | Soft-skip gate |
| `new_release_version` | Cargo / npm version bump + `release/vX.Y.Z` |
| `new_release_notes` | Optional release body |
| `last_release_*` | Diagnostics |

## Rollout steps

1. **Prerequisite:** Publish `@tishlang/sem` and tag `v1` so `uses: tishlang/sem@v1` resolves with `dist/` present on the tag.
2. **Shadow job:** In `build-npm-binaries.yml`, add a parallel dry-run step using `tishlang/sem@v1`; compare `new_release_version` to cycjimmy for N main pushes. Fail the shadow on mismatch only (do not gate release).
3. **Cutover:** Point the real `id: semantic` / `id: next_version_semantic` steps at sem; keep soft-skip `exit 0` behavior.
4. **Cleanup:**
   - Remove `extra_plugins` / `semantic_version` inputs.
   - Optionally delete `TISH_SEMANTIC_RELEASE_CI` branch in `release.config.cjs` and thin `npm/tish/release.config.cjs` once nothing else reads them.
   - Drop semantic-release npm packages from any CI-only install paths if they exist solely for dry-run.
5. **Docs:** Update `docs/RELEASE.md` / `CONTRIBUTING.md` to mention `@tishlang/sem` + `@sem/*` plugin names.

## Parser / feat! parity checklist

- [ ] `feat!:` / `fix!:` → major (commit-analyzer)
- [ ] `BREAKING CHANGE:` footer → major
- [ ] `feat:` → minor, `fix:`/`perf:` → patch
- [ ] `chore:` / `docs:` → no release
- [ ] Empty bump → soft-skip, job green
- [ ] `working_directory: npm/tish` resolves tags from monorepo root git history (confirm; if tags are repo-root scoped, cwd must still see `.git`)

## Risks

- **Git cwd:** sem uses `cwd` for git commands via `cd "$cwd" && git …`. Tags live at the repo root; `npm/tish` is inside the same work tree, so `git` should still see root tags. Verify in shadow.
- **Plugin option names:** Map any tish `parserOpts` from `@semantic-release/commit-analyzer` onto `@sem/commit-analyzer` options (extend `@sem` if a needed option is missing before cutover).
- **Action pin:** Prefer `tishlang/sem@v1` (rolling major) or a full SHA for reproducibility.

## Done when

- All cycjimmy dry-run invocations in tish workflows are gone.
- Soft-skip and version outputs behave identically on a week of main traffic.
- No semantic-release install is required in the release-check path.
