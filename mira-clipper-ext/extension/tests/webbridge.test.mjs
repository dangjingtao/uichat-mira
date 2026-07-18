/**
 * WebBridge extension-side contract tests.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const extensionRoot = join(__dirname, '..');

async function readExtensionFile(relativePath) {
  return readFile(join(extensionRoot, relativePath), 'utf8');
}

describe('WebBridge tool surface', () => {
  it('exposes four intent-level tools', async () => {
    const source = await readExtensionFile('background.js');
    for (const tool of ['look', 'browse', 'act', 'transfer']) {
      assert.match(source, new RegExp(`['"]${tool}['"]`));
    }
  });

  it('declares the request/response envelope and actionable errors', async () => {
    const source = await readExtensionFile('background.js');
    assert.match(source, /request\.type !== 'request'/);
    assert.match(source, /type: 'response'/);
    assert.match(source, /suggestedAction/);
    assert.match(source, /retryable/);
    assert.match(source, /WEBBRIDGE_TOOL_DEFINITIONS/);
    assert.match(source, /STALE_ELEMENT_REF|USER_ACTIVATION_REQUIRED/);
    assert.match(source, /AUTH_REQUIRED/);
    assert.match(source, /storage\.local\.remove\(\['accessToken'\]\)/);
    assert.match(source, /auth_required/);
    assert.match(source, /ensurePageBridge/);
    assert.match(source, /PAGE_BRIDGE_UNAVAILABLE/);
    assert.match(source, /browse\.switch/);
    assert.match(source, /chrome\.tabs\.create/);
    assert.match(source, /chrome\.tabs\.remove/);
    assert.match(source, /'tabs'\]/);
    assert.match(source, /tabGroups\.update/);
    assert.match(source, /setBadgeText/);
    assert.match(source, /publishWebBridgeEvent/);
    assert.match(source, /extensionVersion/);
    assert.match(source, /protocolVersion/);
  });

  it('lets the extension own connection startup instead of exposing an activation page', async () => {
    const source = await readExtensionFile('background.js');
    assert.match(source, /chrome\.runtime\.onInstalled/);
    assert.match(source, /chrome\.runtime\.onStartup/);
    assert.match(source, /connectWebBridge\(\);/);
    assert.match(source, /openAuthorizationPageIfNeeded/);
    assert.match(source, /auth\/authorize\.html/);
    assert.match(source, /chrome\.tabs\.query\(\{\}\)/);
    assert.match(source, /reconnectRequested/);
    assert.match(source, /requestWebBridgeReconnect/);
    assert.doesNotMatch(source, /type === ['"]WEBBRIDGE_ACTIVATE['"]/);
    assert.doesNotMatch(source, /chrome-extension:\/\//);
  });

  it('supports the page-side execution messages', async () => {
    const source = await readExtensionFile('content/content.js');
    for (const message of [
      'WEBBRIDGE_PING',
      'WEBBRIDGE_STATUS',
      'WEBBRIDGE_SNAPSHOT',
      'WEBBRIDGE_ACT',
      'WEBBRIDGE_BROWSE',
      'WEBBRIDGE_UPLOAD',
      'WEBBRIDGE_TRIGGER_DOWNLOAD',
    ]) {
      assert.match(source, new RegExp(message));
    }
  });

  it('exposes connection transport selection in the popup', async () => {
    const html = await readExtensionFile('popup/popup.html');
    const source = await readExtensionFile('popup/popup.js');
    assert.match(html, /id="transport"/);
    assert.match(source, /WEBBRIDGE_RECONNECT/);
    assert.match(source, /storage\.sync\.set\(\{ transport \}\)/);
  });
});

describe('WebBridge permission boundary', () => {
  it('allows downloads without enabling debugger access', async () => {
    const manifests = await Promise.all([
      readFile(join(extensionRoot, '../manifest.json'), 'utf8'),
      readFile(join(extensionRoot, 'manifest.json'), 'utf8'),
    ]);

    for (const raw of manifests) {
      const manifest = JSON.parse(raw);
      assert.ok(manifest.permissions.includes('downloads'));
      assert.ok(manifest.permissions.includes('nativeMessaging'));
      assert.ok(!manifest.permissions.includes('debugger'));
    }
  });
});

describe('WebBridge authorization entry', () => {
  it('defaults the standalone authorization page to Native Messaging', async () => {
    const source = await readExtensionFile('auth/authorize.js');
    assert.match(source, /stored\.transport === 'websocket' \? 'websocket' : 'native'/);
    const html = await readExtensionFile('auth/authorize.html');
    assert.match(html, /<option value="native">/);
    assert.match(html, /<option value="websocket">/);
  });
});
