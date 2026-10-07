'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { verifyBrandCacheReferences, WEB_BRAND_ASSETS } = require('../scripts/rc/verify-runtime.cjs');
const urls = require('../dashboard/src/lib/brand-assets.json');

const htmlBrandFiles = ['icon.svg', 'favicon.ico', 'favicon-32.png', 'favicon-16.png', 'apple-touch-icon.png'];

function getHashes() {
  return Object.fromEntries(WEB_BRAND_ASSETS.map((file) => {
    const prefix = `/${file}?sha256=`;
    const url = urls[file];
    assert.ok(url?.startsWith(prefix), `${file} must have a generated content-hash URL`);
    const digest = url.slice(prefix.length);
    assert.match(digest, /^[a-f0-9]{64}$/, `${file} must use a full SHA-256 digest`);
    return [file, digest];
  }));
}

function createDistFixture() {
  const dist = fs.mkdtempSync(path.join(os.tmpdir(), 'brand-cache-package-'));
  const linkTags = htmlBrandFiles.map((file) => `<link rel="icon" href="${urls[file]}">`).join('\n');
  const schemaLogo = `https://www.tokentracker.cc${urls['icon-512.png']}`;
  fs.writeFileSync(path.join(dist, 'index.html'), `${linkTags}\n<meta itemprop="logo" content="${schemaLogo}">`);
  fs.writeFileSync(path.join(dist, 'share.html'), linkTags);
  fs.writeFileSync(path.join(dist, 'app.js'), `const appIcon = ${JSON.stringify(urls['app-icon.png'])};`);

  return {
    dist,
    cleanup: () => fs.rmSync(dist, { recursive: true, force: true }),
  };
}

function verifyQuietly(dist, hashes) {
  const log = console.log;
  console.log = () => {};
  try {
    return verifyBrandCacheReferences(dist, hashes);
  } finally {
    console.log = log;
  }
}

test('RC package verifier accepts hash-keyed index, share, and application bundle references', () => {
  const fixture = createDistFixture();
  try {
    assert.doesNotThrow(() => verifyQuietly(fixture.dist, getHashes()));
  } finally {
    fixture.cleanup();
  }
});

test('RC package verifier rejects an old unkeyed HTML icon URL', () => {
  const fixture = createDistFixture();
  try {
    const indexPath = path.join(fixture.dist, 'index.html');
    const html = fs.readFileSync(indexPath, 'utf8');
    fs.writeFileSync(indexPath, html.replace(urls['favicon.ico'], '/favicon.ico'));
    assert.throws(() => verifyQuietly(fixture.dist, getHashes()),
      /Packaged index\.html has an unkeyed or stale brand link: favicon\.ico/);
  } finally {
    fixture.cleanup();
  }
});

test('RC package verifier rejects a wrong SHA query in packaged HTML', () => {
  const fixture = createDistFixture();
  try {
    const sharePath = path.join(fixture.dist, 'share.html');
    const html = fs.readFileSync(sharePath, 'utf8');
    const hashes = getHashes();
    const badDigest = `${hashes['icon.svg'][0] === '0' ? '1' : '0'}${hashes['icon.svg'].slice(1)}`;
    const wrongUrl = `/icon.svg?sha256=${badDigest}`;
    fs.writeFileSync(sharePath, html.replace(urls['icon.svg'], wrongUrl));
    assert.throws(() => verifyQuietly(fixture.dist, hashes),
      /Packaged share\.html has an unkeyed or stale brand link: icon\.svg/);
  } finally {
    fixture.cleanup();
  }
});

test('RC package verifier rejects an application bundle with the old unkeyed icon URL', () => {
  const fixture = createDistFixture();
  try {
    fs.writeFileSync(path.join(fixture.dist, 'app.js'), 'const appIcon = "/app-icon.png";');
    assert.throws(() => verifyQuietly(fixture.dist, getHashes()),
      /Packaged application brand URL is not content-keyed/);
  } finally {
    fixture.cleanup();
  }
});

test('RC package verifier rejects a stale schema logo in actual index HTML', () => {
  const fixture = createDistFixture();
  try {
    const file = path.join(fixture.dist, 'index.html');
    const original = fs.readFileSync(file, 'utf8');
    for (const stale of ['/icon-512.png', '/icon-512.png?sha256=' + '0'.repeat(64)]) {
      fs.writeFileSync(file, original.replace(urls['icon-512.png'], stale));
      assert.throws(() => verifyQuietly(fixture.dist, getHashes()), /stale schema logo/);
    }
  } finally { fixture.cleanup(); }
});
