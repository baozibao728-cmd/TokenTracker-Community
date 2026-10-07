'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const webFiles = [
  'app-icon.png',
  'icon.svg',
  'favicon.ico',
  'favicon-16.png',
  'favicon-32.png',
  'apple-touch-icon.png',
  'icon-192.png',
  'icon-512.png',
];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(target) : [target];
  });
}

test('web brand URLs use content hashes so old canonical cache entries cannot match', () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'dashboard/src/lib/brand-assets.json'), 'utf8'));
  const packageVersion = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;

  for (const filename of webFiles) {
    const bytes = fs.readFileSync(path.join(root, 'dashboard/public', filename));
    const digest = crypto.createHash('sha256').update(bytes).digest('hex');
    const url = manifest[filename];

    assert.equal(url, `/${filename}?sha256=${digest}`, `${filename} URL must be keyed by its full content digest`);
    assert.notEqual(url, `/${filename}`, `${filename} must not reuse the stale unkeyed cache URL`);
    assert.notEqual(url, `/${filename}?v=${packageVersion}`, `${filename} must not use the package version as its cache key`);
  }
});

test('every React app-icon consumer resolves the generated hash URL', () => {
  const sourceFiles = walk(path.join(root, 'dashboard/src')).filter((file) => /\.(?:js|jsx|ts|tsx)$/.test(file));
  const consumers = sourceFiles.filter((file) => fs.readFileSync(file, 'utf8').includes('app-icon.png'));

  assert.equal(consumers.length, 8, 'the known app-icon consumers should remain discoverable');
  for (const file of consumers) {
    const source = fs.readFileSync(file, 'utf8');
    assert.match(source, /import\s+\{\s*brandAssetUrl\s*\}\s+from\s+["'][^"']*brand-assets\.js["']/,
      `${path.relative(root, file)} must import the brand asset URL helper`);
    assert.match(source, /brandAssetUrl\(["']app-icon\.png["']\)/,
      `${path.relative(root, file)} must resolve app-icon.png through the generated mapping`);
    assert.doesNotMatch(source, /["']\/app-icon\.png(?:[?#][^"']*)?["']/,
      `${path.relative(root, file)} must not request the unkeyed app-icon URL`);
  }
});

test('HTML brand links and schema logo use the generated hash URLs', () => {
  const htmlFiles = ['dashboard/index.html', 'dashboard/share.html'];
  const linkFiles = ['icon.svg', 'favicon.ico', 'favicon-32.png', 'favicon-16.png', 'apple-touch-icon.png'];

  for (const htmlFile of htmlFiles) {
    const html = fs.readFileSync(path.join(root, htmlFile), 'utf8');
    for (const filename of linkFiles) {
      const digest = crypto.createHash('sha256')
        .update(fs.readFileSync(path.join(root, 'dashboard/public', filename)))
        .digest('hex');
      assert.ok(html.includes(`href="/${filename}?sha256=${digest}"`),
        `${htmlFile} must link ${filename} by content hash`);
      assert.doesNotMatch(html, new RegExp(`href="/${filename.replaceAll('.', '\\.')}"`),
        `${htmlFile} must not retain the unkeyed ${filename} URL`);
    }
  }

  const iconDigest = crypto.createHash('sha256')
    .update(fs.readFileSync(path.join(root, 'dashboard/public/icon-512.png')))
    .digest('hex');
  const indexHtml = fs.readFileSync(path.join(root, 'dashboard/index.html'), 'utf8');
  assert.ok(indexHtml.includes(`https://www.tokentracker.cc/icon-512.png?sha256=${iconDigest}`),
    'the schema.org logo must use the content-hashed icon-512 URL');
});
