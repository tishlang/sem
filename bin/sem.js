#!/usr/bin/env node
import { createRequire } from "node:module"
import { fileURLToPath } from "node:url"
import path from "node:path"
import { runCli } from "../dist/sem.js"

const require = createRequire(import.meta.url)
const pkg = require("../package.json")
process.env.SEM_PACKAGE_VERSION = pkg.version

// Ensure we can resolve package.json beside the installed module when cwd differs
const root = path.dirname(fileURLToPath(import.meta.url))
process.env.SEM_PACKAGE_ROOT = path.resolve(root, "..")

runCli(process.argv.slice(2))
