#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist/server dist/.openai
node --input-type=module <<'BUILD'
import {readFileSync,writeFileSync} from 'node:fs';
let source=readFileSync('worker/index.js','utf8').replace("import {ACCESS_JWKS_FALLBACK} from './access-jwks.js';",readFileSync('worker/access-jwks.js','utf8').replace('export const ACCESS_JWKS_FALLBACK=', 'const ACCESS_JWKS_FALLBACK='));
source=source.replace("import {adminURL,mergedCatalog,validateAdminSource,adminOperation} from './admin.js';",readFileSync('worker/admin.js','utf8').replaceAll('export ',''));
source=source.replace("import {ADMIN_STYLE,ADMIN_HTML,ADMIN_SCRIPT} from './admin-ui.js';",readFileSync('worker/admin-ui.js','utf8').replaceAll('export ',''));
writeFileSync('dist/server/index.js',source);
BUILD
cp .openai/hosting.json dist/.openai/hosting.json
