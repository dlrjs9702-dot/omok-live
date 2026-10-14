'use strict';
const fs = require('node:fs');
const path = require('node:path');
const input = process.argv[process.argv.indexOf('--input') + 1];
if (!process.argv.includes('--input') || !input) throw new Error('--input required');
const root = path.resolve(__dirname, '../..');
const manifest = JSON.parse(fs.readFileSync(path.join(input, 'ip-characters/game-svg-manifest.json')));
const pairs = JSON.parse(fs.readFileSync(path.join(input, 'ip-characters/game-pairs.json'))).pairs;
const key = file => path.basename(file, '.svg');
const svg = Object.fromEntries(manifest.map(r => [key(r.file), fs.readFileSync(path.join(input, r.file), 'utf8')]));
const old = fs.readFileSync(path.join(root, 'public/skin-art-ip.js'), 'utf8');
const parserStart = old.indexOf('  const parsed = new Map();');
const parserEnd = Math.min(...[old.indexOf('  // each game\'s sides:', parserStart), old.indexOf('  const familyOf =', parserStart)].filter(i => i > parserStart));
if (parserStart < 0 || !Number.isFinite(parserEnd)) throw new Error('SVG parser boundary missing');
const parser = old.slice(parserStart, parserEnd).trimEnd() + '\n';
const canonicalParser = parser
  .replace("const fill = el.id === 'side' && side ? side : el.getAttribute('fill') ?? '#000';", "const fill = el.getAttribute('fill') ?? '#000';");
const data = pairs.map(p => ({ ...p, black: key(p.logicalBlack), white: key(p.logicalWhite) }));
const template = fs.readFileSync(path.join(__dirname, 'overhaul-game-art.template.txt'), 'utf8');
const generated = template.replace('/* SVG_DATA */', JSON.stringify(svg)).replace('/* PAIRS_DATA */', JSON.stringify(data))
  .replace('/* THEMES_DATA */', JSON.stringify(manifest.filter(r => r.role === 'room_theme').map(r => ({ ...r, key: key(r.file) }))))
  .replace('/* SVG_PARSER */', canonicalParser);
fs.writeFileSync(path.join(root, 'public/skin-art-ip.js'), generated);
const x2Path = path.join(root, 'public/plaza/skins-x2.js');
const x2 = require(x2Path);
const alias = f => f === 'halli' ? 'halligalli' : f;
const previous = new Map(x2.IP_GAME.map(r => [r[0] + ':' + r[1] + ':' + (r[2] === 'theme' ? 'theme' : 'piece'), r[2]]));
const owners = new Map(x2.IP_ITEMS.map(r => [r[0], r[2]]));
const gameRows = [...pairs.map(p => { const c = p.id.split('.')[0], f = alias(p.game); return [f, c, previous.get(f+':'+c+':piece') || (c === 'kuromi' ? 'legend' : ['mymelody','cinnamoroll','pompompurin'].includes(c) ? 'premium' : 'rare'), owners.get(c)]; }),
  ...manifest.filter(r => r.role === 'room_theme').map(r => [alias(r.game), r.character, 'theme', owners.get(r.character)])];
const source = fs.readFileSync(x2Path, 'utf8');
fs.writeFileSync(x2Path, source.replace(/const IP_GAME = Object\.freeze\(\[[\s\S]*?\n\s*\]\);/, 'const IP_GAME = Object.freeze('+JSON.stringify(gameRows,null,2)+');'));
console.log({ svg: manifest.length, piecePairs: pairs.length, catalogGameSkins: gameRows.length });
