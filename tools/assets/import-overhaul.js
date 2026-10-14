#!/usr/bin/env node
'use strict';
// Import verified production outputs while retaining the public catalog and runtime paths.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '../..');
const folder = process.argv[process.argv.indexOf('--input') + 1];
if (!process.argv.includes('--input') || !folder) throw new Error('--input <verified asset package> required');
const input = path.resolve(folder);
const read = name => JSON.parse(fs.readFileSync(path.join(input, name), 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const inv = read('inventory.json');
const verified = read('package-verification.json');
if (verified.failures.length || inv.assets.some(a => !a.status.startsWith('verified_'))) throw new Error('Unverified production package');
const rows = new Map(inv.assets.map(a => [a.id, a]));
const configFile = path.join(__dirname, 'island-models.json');
const config = JSON.parse(fs.readFileSync(configFile, 'utf8'));
const baselineSources = { ...config.sources };
const reportFile = path.join(__dirname, 'overhaul-import.json');
const prior = fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, 'utf8')) : null;
if (prior && prior.package !== path.basename(input)) throw new Error('Import provenance belongs to another package');
const changes = prior ? prior.changes.slice() : []; const kept = [];
const sourceId = ref => {
  const colon = ref.indexOf(':');
  return `${baselineSources[ref.slice(0, colon)]}/${ref.slice(colon + 1)}`;
};
const source = row => {
  const output = row.preferredOutput || row.output;
  const sha256 = hash(path.join(input, output));
  if (!row.preferredOutput && sha256 !== row.outputSHA256) throw new Error(`Output changed: ${output}`);
  return { ref: `overhaul:${output}`, sha256 };
};
for (const file of config.files) {
  if (file.src.startsWith('overhaul:')) {
    if (hash(path.join(input, file.src.slice(9))) !== file.sha256) throw new Error(`Imported source changed: ${file.out}`);
    if (file.lowSrc && hash(path.join(input, file.lowSrc.slice(9))) !== file.lowSha256) throw new Error(`Imported Low changed: ${file.out}`);
    continue;
  }
  const row = rows.get(sourceId(file.src));
  if (!row) throw new Error(`No source mapping: ${file.src}`);
  if (row.group === '02' || ['animation', 'rig', 'reference'].includes(row.group)) {
    kept.push({ out: file.out, reason: row.group === '02' ? 'ordinary partial rig; native exterior selected for complete set' : 'preserve reference or motion' });
    continue;
  }
  const oldSource = file.src;
  const high = source(row); file.src = high.ref; file.sha256 = high.sha256;
  if (file.lowSrc) {
    const lowRow = rows.get(sourceId(file.lowSrc));
    if (!lowRow) throw new Error(`No Low source mapping: ${file.lowSrc}`);
    const low = source(lowRow); file.lowSrc = low.ref; file.lowSha256 = low.sha256;
  }
  if (!changes.some(c => c.out === file.out)) changes.push({ out: file.out, baselineSource: oldSource, source: file.src, lowSource: file.lowSrc, generatedLow: Boolean(file.low), category: row.group });
}
const catalog = read('transformation-catalog.json');
const contract = { commonRig: read('source/common-motion-rig.json'), characters: [] };
for (const c of catalog.characters) {
  const animal = c.id.startsWith('animal-');
  const base = animal ? `characters/native/${c.id}` : `characters/ip-characters/${c.id}`;
  const out = base + '.glb';
  if (!config.files.some(f => f.out === out)) config.files.push({ out, src: `overhaul:${c.high}`, sha256: hash(path.join(input, c.high)), lowSrc: `overhaul:${c.low}`, lowSha256: hash(path.join(input, c.low)), precompressed: true });
  const name = animal ? c.id.slice(7) : c.id;
  contract.characters.push({ id: c.id, label: c.label, ip: !animal,
    items: Object.fromEntries(c.requiredSlots.map(slot => [slot, animal ? `avatar_animal_${name}_${slot}` : `avatar_ip_${name}_${slot}`])),
    url: `/assets/island/${out}`, lowUrl: `/assets/island/${base}_low.glb`, rig: read(c.rig) });
}
config.sources.overhaul = path.basename(input);
fs.writeFileSync(configFile, JSON.stringify(config, null, 2) + '\n');
const motion = fs.readFileSync(path.join(input, 'source/motion-retarget.mjs'), 'utf8').replace('export function retargetClip(clip,rig,common)', 'function retargetClip(clip,rig,common=DATA.commonRig)');
const moduleSource = `// v1.10.75: complete sets select their own exterior and rest pose. Partial cosmetics keep their ordinary fit.\n(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.CharacterTransformations=api;})(typeof globalThis!=='undefined'?globalThis:this,()=>{\n'use strict';\nconst DATA=${JSON.stringify(contract)};\n${motion}\nfunction match(look={}){return DATA.characters.find(c=>Object.entries(c.items).every(([slot,id])=>look[slot]===id))||null;}\nreturn {characters:DATA.characters,commonRig:DATA.commonRig,match,retargetClip};\n});\n`;
fs.writeFileSync(path.join(root, 'public/plaza/character-transformations.js'), moduleSource);
fs.writeFileSync(reportFile, JSON.stringify({ package: path.basename(input), sourceFiles: inv.assets.length, sourceHashVerification: verified.checksumsVerified, changedExistingHighFiles: changes.length, nativeCharacters: contract.characters.length, nativeModels: contract.characters.length * 2, changes, kept, note: 'No price, item ID, ownership, gameplay or server look changes. Native partial GLBs are intentionally not rebound to ordinary bones.' }, null, 2) + '\n');
console.log({ changedHighFiles: changes.length, nativeCharacters: contract.characters.length, preservedHighFiles: kept.length });
