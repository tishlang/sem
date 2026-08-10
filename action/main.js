const path = require("node:path")

function getInput(name, fallback = "") {
  const key = `INPUT_${name.replace(/ /g, "_").toUpperCase()}`
  const v = process.env[key]
  return v !== undefined && v !== null ? v : fallback
}

function asBool(value, defaultValue = false) {
  if (value === null || value === undefined || value === "") return defaultValue
  return ["true", "1", "yes", "y", "on"].includes(String(value).trim().toLowerCase())
}

function parseJson(raw, label) {
  if (raw === null || raw === undefined || String(raw).trim() === "") return null
  try {
    return JSON.parse(raw)
  } catch (e) {
    throw new Error(`Invalid JSON for ${label}: ${e.message || e}`)
  }
}

async function main() {
  // Dynamic import so the GitHub Actions CJS loader can run this file while
  // loading the ESM dist bundle.
  const { loadConfig, release, writeGitHubOutputs } = await import("../dist/sem.js")

  const workingDirectory = getInput("working_directory", ".") || "."
  const cwd = path.resolve(process.cwd(), workingDirectory)

  const dryRun = asBool(getInput("dry_run"), false)
  const ci = asBool(getInput("ci"), true)
  const debug = asBool(getInput("debug"), false)

  const configRaw = getInput("config", "")
  const branchesRaw = getInput("branches", "")
  const tagFormat = getInput("tag_format", "")

  const cliOverrides = {
    dryRun,
    noCi: !ci,
    debug,
  }

  if (configRaw && String(configRaw).trim() !== "") {
    cliOverrides.configJson = configRaw
  }

  let config = loadConfig(cwd, cliOverrides)

  const branches = parseJson(branchesRaw, "branches")
  if (branches !== null) {
    config.branches = branches
  }
  if (tagFormat && String(tagFormat).trim() !== "") {
    config.tagFormat = tagFormat
  }

  config.cwd = cwd
  config.dryRun = dryRun
  if (!ci) config.noCi = true
  if (debug) config.debug = true

  const result = release(config)
  writeGitHubOutputs(result)

  if (!result.success) {
    console.error(`semtac failed: ${result.error}`)
    process.exit(1)
  }

  // Soft success when no bump — matches cycjimmy / tish #86 behavior
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
