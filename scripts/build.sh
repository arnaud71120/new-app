#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p dist/server dist/.openai
node --input-type=module <<'BUILD'
import {readFileSync,writeFileSync} from 'node:fs';
const source=readFileSync('worker/index.js','utf8').replace("import {ACCESS_JWKS_FALLBACK} from './access-jwks.js';",readFileSync('worker/access-jwks.js','utf8').replace('export const ACCESS_JWKS_FALLBACK=', 'const ACCESS_JWKS_FALLBACK='));
writeFileSync('dist/server/index.js',source);
BUILD
cp .openai/hosting.json dist/.openai/hosting.json
