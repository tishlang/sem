#!/usr/bin/env bash
# Build all Node/Action artifacts from Tish sources into dist/.
set -euo pipefail
mkdir -p dist
tish build src/index.tish -o dist/sem.js --target js
tish build src/main.tish -o dist/cli.js --target js
tish build src/action.tish -o dist/action.js --target js
# npm bin needs a shebang; keep it out of source by stamping at build time
{
  printf '%s\n' '#!/usr/bin/env node'
  cat dist/cli.js
} > dist/cli.js.tmp
mv dist/cli.js.tmp dist/cli.js
chmod +x dist/cli.js
