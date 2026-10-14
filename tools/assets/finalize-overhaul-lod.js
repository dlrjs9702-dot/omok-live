'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '../..');
const file = path.join(__dirname, 'island-models.json');
const config = JSON.parse(fs.readFileSync(file, 'utf8'));
for (const entry of config.files) {
  if (/halloween-decor-v1\/pumpkin_(small_[ab]|stack)\.glb$/.test(entry.out)) {
    delete entry.lowSrc; delete entry.lowSha256; delete entry.lowArgs;
    entry.low = .60; // derive the far mesh from the polished High, preserving one continuous silhouette
  }
}
fs.writeFileSync(file, JSON.stringify(config, null, 2) + '\n');
const budgetsFile = path.join(__dirname, 'budgets.json');
const budgets = JSON.parse(fs.readFileSync(budgetsFile, 'utf8'));
budgets.fileOverrides = { ...(budgets.fileOverrides || {}), 'additions-v1/facilities/faces.glb': { materials: 15 } };
budgets.$overhaul = 'The face shop adds a sculpted facade emblem with one fixed material (14 to 15). It remains a flattened static render batch; the exception is limited to this High file. Three repaired pumpkin Low files are simplified below their respective High files.';
fs.writeFileSync(budgetsFile, JSON.stringify(budgets, null, 2) + '\n');
