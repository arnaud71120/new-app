import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const code=await readFile(new URL('../dist/server/index.js',import.meta.url),'utf8');
JSON.parse(await readFile(new URL('../dist/.openai/hosting.json',import.meta.url),'utf8'));
const mod=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
assert.equal(typeof mod.default.fetch,'function');
console.log('Artefact Worker valide.');
