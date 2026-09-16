'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');

test('win and loss results have distinct effects, persistent board styling and reduced-motion support', async () => {
  const root = path.join(__dirname, '..');
  const [html, app, css] = await Promise.all([
    fs.readFile(path.join(root, 'public/index.html'), 'utf8'),
    fs.readFile(path.join(root, 'public/app.js'), 'utf8'),
    fs.readFile(path.join(root, 'public/styles.css'), 'utf8'),
  ]);
  assert.match(html, /id="resultEffect"/);
  assert.match(html, /id="resultParticles"/);
  assert.match(app, /const victoryMessages = \[/);
  assert.match(app, /const defeatMessages = \[/);
  assert.match(app, /showResultEffect\(outcome, g\)/);
  assert.match(app, /lastResultEffectKey !== effectKey/);
  assert.match(app, /fillVictoryParticles\(\)/);
  assert.match(app, /boardOverlay\.classList\.add\(win \? 'resultWin' : 'resultLoss'\)/);
  assert.match(css, /\.resultEffect\.win/);
  assert.match(css, /\.resultEffect\.loss/);
  assert.match(css, /@keyframes confettiFall/);
  assert.match(css, /body\.resultLossActive .*filter:saturate\(\.55\) brightness\(\.58\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});
