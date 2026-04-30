/**
 * shopify-theme-push.js
 *
 * Push local theme files directly to Shopify without re-uploading a zip.
 * Requires read_themes + write_themes scopes on your Dev Dashboard app.
 *
 * Usage:
 *   node scripts/shopify-theme-push.js                        # push all files
 *   node scripts/shopify-theme-push.js assets/theme.css       # push one file
 *   node scripts/shopify-theme-push.js --list                 # list Shopify themes
 *   node scripts/shopify-theme-push.js --set-theme <id>       # save theme ID to .env
 */

require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const shopify = require('../src/services/shopifyService');

const THEME_DIR = path.resolve(__dirname, '../shopify-theme');
const ENV_PATH  = path.resolve(__dirname, '../.env');

const args = process.argv.slice(2);

// ── Helpers ───────────────────────────────────────────────────
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function log(msg) { console.log(new Date().toISOString().slice(11,19), msg); }

// Recursively collect all files under a directory, returning paths relative to THEME_DIR
function collectFiles(dir, base = THEME_DIR) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectFiles(full, base));
    } else {
      // Shopify asset key uses forward slashes
      const key = path.relative(base, full).replace(/\\/g, '/');
      files.push({ key, fullPath: full });
    }
  }
  return files;
}

function readAsset(fullPath) {
  // Binary files (images, fonts) use attachment (base64); text files use value
  const ext = path.extname(fullPath).toLowerCase();
  const binaryExts = ['.png','.jpg','.jpeg','.gif','.webp','.svg','.ico','.woff','.woff2','.ttf','.eot'];
  if (binaryExts.includes(ext)) {
    return { attachment: fs.readFileSync(fullPath).toString('base64') };
  }
  return { value: fs.readFileSync(fullPath, 'utf8') };
}

async function getOrPickThemeId() {
  if (process.env.SHOPIFY_THEME_ID) return process.env.SHOPIFY_THEME_ID;

  // Auto-detect: find a theme named "Bloomsday Natives" or the most recent unpublished
  log('No SHOPIFY_THEME_ID set — fetching themes to auto-detect…');
  const { themes } = await shopify.getThemes();
  if (!themes?.length) throw new Error('No themes found on this store.');

  log('Available themes:');
  themes.forEach(t => log(`  ${t.id}  "${t.name}"  [${t.role}]`));

  const match = themes.find(t => t.name.toLowerCase().includes('bloomsday') || t.name.toLowerCase().includes('native'));
  const chosen = match || themes.find(t => t.role !== 'main') || themes[0];

  log(`Using theme: "${chosen.name}" (${chosen.id})`);

  // Save to .env for next time
  let env = fs.readFileSync(ENV_PATH, 'utf8');
  env = env.replace(/^SHOPIFY_THEME_ID=.*$/m, `SHOPIFY_THEME_ID=${chosen.id}`);
  fs.writeFileSync(ENV_PATH, env);
  process.env.SHOPIFY_THEME_ID = String(chosen.id);
  log(`Saved SHOPIFY_THEME_ID=${chosen.id} to .env`);

  return String(chosen.id);
}

// ── Commands ──────────────────────────────────────────────────

async function listThemes() {
  const { themes } = await shopify.getThemes();
  console.log('\nThemes on bloomsday-natives.myshopify.com:\n');
  themes.forEach(t => {
    console.log(`  ${t.role === 'main' ? '● LIVE' : '○     '}  ${t.id}  "${t.name}"`);
  });
  console.log('\nTo use a specific theme: node scripts/shopify-theme-push.js --set-theme <id>');
}

async function setTheme(id) {
  let env = fs.readFileSync(ENV_PATH, 'utf8');
  env = env.replace(/^SHOPIFY_THEME_ID=.*$/m, `SHOPIFY_THEME_ID=${id}`);
  fs.writeFileSync(ENV_PATH, env);
  log(`SHOPIFY_THEME_ID set to ${id}`);
}

async function pushFiles(filesToPush) {
  const themeId = await getOrPickThemeId();
  log(`Pushing ${filesToPush.length} file(s) to theme ${themeId}…`);

  let pushed = 0, errors = 0;

  for (const { key, fullPath } of filesToPush) {
    try {
      const assetData = readAsset(fullPath);
      await shopify.putThemeAsset(themeId, key, assetData);
      log(`  ✓  ${key}`);
      pushed++;
      // Shopify rate-limits theme API at ~2 req/s
      await sleep(550);
    } catch (err) {
      log(`  ✗  ${key}: ${err.message.slice(0, 120)}`);
      errors++;
    }
  }

  log(`\nDone. Pushed: ${pushed}  Errors: ${errors}`);
}

// ── Pull helper (mirrors shopify-theme-pull.js) ───────────────
async function pullFromShopify(themeId, keys) {
  log('Pulling latest from Shopify first to avoid overwriting editor changes…');
  let pulled = 0;
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
      pulled++;
      await sleep(400);
    } catch (_) { /* file may be new locally — skip pull */ }
  }
  log(`Pulled ${pulled} file(s) from Shopify.`);
}

// ── Main ──────────────────────────────────────────────────────
async function main() {
  if (args.includes('--list')) {
    return listThemes();
  }

  if (args.includes('--set-theme')) {
    const id = args[args.indexOf('--set-theme') + 1];
    if (!id) { console.error('Usage: --set-theme <theme_id>'); process.exit(1); }
    return setTheme(id);
  }

  // Single file push — push our local version directly (no pull, we intend to overwrite)
  const singleFile = args[0] && !args[0].startsWith('--') ? args[0] : null;
  if (singleFile) {
    const fullPath = path.resolve(THEME_DIR, singleFile);
    if (!fs.existsSync(fullPath)) {
      console.error(`File not found: ${fullPath}`);
      process.exit(1);
    }
    return pushFiles([{ key: singleFile, fullPath }]);
  }

  // Full push — pull ALL existing remote files first so editor changes are preserved
  if (!fs.existsSync(THEME_DIR)) {
    console.error(`Theme directory not found: ${THEME_DIR}`);
    process.exit(1);
  }
  const themeId = await getOrPickThemeId();
  const { assets } = await shopify.listThemeAssets(themeId)
    .then(d => d)
    .catch(() => ({ assets: [] }));
  const remoteKeys = (assets || []).map(a => a.key);
  if (remoteKeys.length) await pullFromShopify(themeId, remoteKeys);

  const all = collectFiles(THEME_DIR);
  return pushFiles(all);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
