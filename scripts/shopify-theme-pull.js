/**
 * shopify-theme-pull.js
 *
 * Pull the live Shopify theme down into the local shopify-theme/ directory.
 * Run this BEFORE making local edits or before pushing, so you never
 * overwrite changes made directly in the Shopify theme editor.
 *
 * Usage:
 *   node scripts/shopify-theme-pull.js                  # pull all files
 *   node scripts/shopify-theme-pull.js templates/index.json  # pull one file
 */

require('dotenv').config();

const fs     = require('fs');
const path   = require('path');
const shopify = require('../src/services/shopifyService');

const THEME_DIR = path.resolve(__dirname, '../shopify-theme');
const args = process.argv.slice(2);

function log(msg) { console.log(new Date().toISOString().slice(11,19), msg); }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function getThemeId() {
  if (process.env.SHOPIFY_THEME_ID) return process.env.SHOPIFY_THEME_ID;
  const { themes } = await shopify.getThemes();
  const match = themes.find(t => t.name.toLowerCase().includes('bloomsday') || t.name.toLowerCase().includes('native'));
  return String((match || themes[0]).id);
}

async function pullFiles(keys) {
  const themeId = await getThemeId();
  log(`Pulling ${keys.length} file(s) from theme ${themeId}…`);
  let pulled = 0, errors = 0;

  for (const key of keys) {
    try {
      const { asset } = await shopify.getThemeAsset(themeId, key);
      const dest = path.join(THEME_DIR, key);
      fs.mkdirSync(path.dirname(dest), { recursive: true });

      if (asset.attachment) {
        fs.writeFileSync(dest, Buffer.from(asset.attachment, 'base64'));
      } else {
        fs.writeFileSync(dest, asset.value || '', 'utf8');
      }
      log(`  ✓  ${key}`);
      pulled++;
      await sleep(400);
    } catch (err) {
      log(`  ✗  ${key}: ${err.message.slice(0, 120)}`);
      errors++;
    }
  }

  log(`\nDone. Pulled: ${pulled}  Errors: ${errors}`);
}

async function listAssets(themeId) {
  // Shopify REST: GET /themes/:id/assets.json returns all asset keys
  const data = await shopify.listThemeAssets(themeId);
  return (data.assets || []).map(a => a.key);
}

async function main() {
  const singleFile = args[0] && !args[0].startsWith('--') ? args[0] : null;

  if (singleFile) {
    return pullFiles([singleFile]);
  }

  const themeId = await getThemeId();
  log('Fetching asset list…');
  const keys = await listAssets(themeId);
  log(`Found ${keys.length} assets.`);
  return pullFiles(keys);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
