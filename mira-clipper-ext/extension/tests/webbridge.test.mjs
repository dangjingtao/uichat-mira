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
    assert.match(source, /ACCESS_TOKEN_EXPIRED/);
    assert.match(source, /function isAccessTokenExpired/);
    assert.match(source, /function isAccessTokenInvalid/);
    assert.match(source, /function ensureWebBridgeOperationReady/);
    assert.match(source, /MIRA_NOT_READY/);
    assert.match(source, /await ensureWebBridgeOperationReady()/);
    assert.match(source, /storage\.local\.remove\(\['accessToken'\]\)/);
    assert.match(source, /auth_required/);
    assert.match(source, /ensurePageBridge/);
    assert.match(source, /PAGE_BRIDGE_UNAVAILABLE/);
    assert.match(source, /browse\.switch/);
    assert.match(source, /chrome\.tabs\.create/);
    assert.match(source, /chrome\.tabs\.remove/);
    assert.match(source, /'tabs'\]/);
    assert.match(source, /tabGroups\.update/);
    assert.match(source, /setIcon/);
    assert.match(source, /icon-128\$\{suffix\}\.png/);
    assert.doesNotMatch(source, /setBadgeBackgroundColor/);
    assert.match(source, /publishWebBridgeEvent/);
    assert.match(source, /extensionVersion/);
    assert.match(source, /protocolVersion/);
  });

  it('uses the current ChatGPT textarea and confirms the message was sent', async () => {
    const source = await readExtensionFile('lib/chatgpt-adapter.js');
    assert.match(source, /textarea\[aria-label\]/);
    assert.match(source, /button\[data-testid="send-button"\]/);
    assert.match(source, /new InputEvent\('beforeinput'/);
    assert.match(source, /dispatchEvent\(new InputEvent\('input'/);
    assert.match(source, /button\.click\(\)/);
    assert.match(source, /SEND_NOT_CONFIRMED/);
    assert.match(source, /INPUT_NOT_ACCEPTED|SEND_BUTTON_NOT_READY|SEND_TRIGGER_FAILED/);
    assert.match(source, /waitForResponseCompletion/);
    assert.match(source, /assistantMessages=/);
    assert.match(source, /getFromDOM\?\.\('last'\)/);
    assert.match(source, /COMPOSER_SETTLE_MS/);
    assert.match(source, /assistantTextBefore/);
    assert.match(source, /getChatData failed/);
  });

  it('requires a valid JWT and Mira readiness before browser-side operations', async () => {
    const source = await readExtensionFile('background.js');
    assert.match(source, /isAccessTokenInvalid\(accessToken\)/);
    assert.match(source, /webBridge\.transport !== 'native' \|\| webBridge\.miraReady/);
    assert.match(source, /openOperationRecoveryPanel/);
    assert.match(source, /bridgeError\(\s*\n?\s*expired \? 'ACCESS_TOKEN_EXPIRED' : 'AUTH_REQUIRED'/);
    assert.match(source, /bridgeError\('MIRA_NOT_READY', message, 'start_mira'/);
  });

  it('revalidates the JWT for every established WebBridge message', async () => {
    const server = await readFile(join(extensionRoot, '../../server/src/routes/webbridge.ts'), 'utf8');
    assert.match(server, /accessToken\?: string/);
    assert.match(server, /authenticate\(client\.accessToken\)/);
    assert.match(server, /授权已失效，请重新登录/);
  });

  it('keeps website clipping rules as a UI control channel, outside the browser tool surface', async () => {
    const background = await readExtensionFile('background.js');
    const server = await readFile(join(extensionRoot, '../../server/src/routes/webbridge.ts'), 'utf8');
    assert.match(background, /clip_rules_get/);
    assert.match(background, /clip_rules_set/);
    assert.match(background, /clip_region_pick/);
    const content = await readExtensionFile('content/content.js');
    assert.match(content, /WEBBRIDGE_CLIP_REGION_PICK/);
    assert.match(content, /startClipRegionPicker/);
    assert.match(content, /buildStableSelector/);
    assert.match(background, /capabilities: \['look', 'browse', 'act', 'transfer', 'clip_rules', 'external_expert'\]/);
    assert.match(background, /chrome\.storage\.sync\.set\(\{ clipRules \}\)/);
    assert.match(server, /clip_rules_get/);
    assert.match(server, /client\.role === "ui"/);
    assert.doesNotMatch(background, /name: ['"]clip_rules_(?:get|set)['"]/);
  });

  it('lets the extension own connection startup through the Side Panel', async () => {
    const source = await readExtensionFile('background.js');
    assert.match(source, /chrome\.runtime\.onInstalled/);
    assert.match(source, /chrome\.runtime\.onStartup/);
    assert.match(source, /connectWebBridge\(\);/);
    assert.match(source, /sidePanel\.setPanelBehavior/);
    assert.match(source, /sidePanel\.open/);
    assert.doesNotMatch(source, /openAuthorizationPageIfNeeded/);
    assert.doesNotMatch(source, /auth\/authorize\.html/);
    assert.match(source, /reconnectRequested/);
    assert.match(source, /requestWebBridgeReconnect/);
    assert.match(source, /function queueWebBridgeReconnect/);
    assert.match(source, /Wait for both change events before reading the connection configuration/);
    assert.match(source, /WEBBRIDGE_OPEN_SIDE_PANEL/);
    assert.doesNotMatch(source, /type === ['"]WEBBRIDGE_ACTIVATE['"]/);
    assert.doesNotMatch(source, /chrome-extension:\/\//);
  });

  it('treats Native Host readiness separately from Mira registration', async () => {
    const source = await readExtensionFile('background.js');
    const hostSource = await readExtensionFile('../native-host/host.mjs');

    assert.match(source, /startNativeHostReadyTimer\(nativeSocket\)/);
    assert.doesNotMatch(source, /startWebBridgeHandshakeTimer\(nativeSocket\)/);
    assert.match(source, /request\.status === 'native_ready'/);
    assert.match(source, /webBridge\.ready = true;\s*webBridge\.miraReady = false;/);
    assert.match(source, /\['mira_connecting', 'backend_connecting'\]/);
    assert.match(source, /webBridge\.miraReady = true;/);
    assert.match(source, /function startNativeHostReadyTimer[\s\S]*?webBridge\.miraReady = false;/);
    assert.match(source, /message: 'Native Host 已连接；Mira 后端正在同步'/);
    assert.match(source, /message: 'Native Host 已连接；Mira 后端正在重连'/);
    assert.match(hostSource, /node:net/);
    assert.match(hostSource, /NATIVE_HOST_READY/);
    assert.match(hostSource, /MIRA_PIPE_CONNECTING/);
    assert.doesNotMatch(hostSource, /new WebSocket|\/webbridge/);
  });

  it('keeps direct WebSocket transport active within the MV3 service-worker window', async () => {
    const source = await readExtensionFile('background.js');
    assert.match(source, /WEBBRIDGE_KEEPALIVE_INTERVAL_MS = 20000/);
    assert.match(source, /startWebSocketKeepAlive\(socket\)/);
    assert.match(source, /type: 'keepalive'/);
    assert.match(source, /stopWebSocketKeepAlive/);
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

  it('opens the Side Panel from the local Mira page through the content bridge', async () => {
    const source = await readExtensionFile('content/content.js');
    assert.match(source, /mira-webbridge-ui/);
    assert.match(source, /WEBBRIDGE_OPEN_AUTHORIZATION_PAGE/);
    assert.match(source, /chrome\.runtime\.sendMessage/);
  });

  it('does not expose WebSocket transport selection in the Side Panel', async () => {
    const html = await readExtensionFile('popup/popup.html');
    const source = await readExtensionFile('popup/popup.js');
    assert.match(html, /id="workspaceView"/);
    assert.match(html, /id="jianxingTab"/);
    assert.match(html, /id="clipTab"/);
    assert.match(html, /id="authorizationCode"/);
    assert.match(source, /WEBBRIDGE_GET_STATUS/);
    assert.match(source, /tabs\.onActivated/);
    assert.match(source, /tabs\.onUpdated/);
    assert.doesNotMatch(html, /id="transport"/);
    assert.doesNotMatch(source, /storage\.sync\.set\(\{ transport \}\)/);
    const optionsHtml = await readExtensionFile('options/options.html');
    const optionsSource = await readExtensionFile('options/options.js');
    assert.doesNotMatch(optionsHtml, /WebSocket|id="transport"/);
    assert.doesNotMatch(optionsSource, /transport/);
    assert.match(optionsHtml, /id="openSidePanel"/);
  });

  it('pins the unpacked development extension identity for Native Messaging', async () => {
    const manifest = JSON.parse(await readExtensionFile('../manifest.json'));
    assert.equal(typeof manifest.key, 'string');
    assert.ok(manifest.key.length > 0);
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
  it('keeps authorization-code exchange inside the Side Panel', async () => {
    const [popupHtml, popupSource, optionsHtml, optionsSource, authCodeSource] = await Promise.all([
      readExtensionFile('popup/popup.html'),
      readExtensionFile('popup/popup.js'),
      readExtensionFile('options/options.html'),
      readExtensionFile('options/options.js'),
      readExtensionFile('lib/authorization-code.js'),
    ]);

    assert.match(popupHtml, /id="authorizationCode"/);
    assert.match(popupHtml, /id="exchangeCodeBtn"/);
    assert.match(popupSource, /function isAccessTokenExpired/);
    assert.match(popupSource, /授权已过期，请重新输入 Mira 授权码/);
    assert.match(popupHtml, /authorization-code\.js/);
    assert.equal(popupSource.match(/\/oauth\/token/g)?.length, 1);
    assert.match(authCodeSource, /MiraAuthorizationCode/);
    assert.doesNotMatch(optionsHtml, /authorizationCode|exchangeCodeBtn|\/oauth\/token/);
    assert.doesNotMatch(optionsSource, /authorizationCode|exchangeCodeBtn|\/oauth\/token/);
  });

  it('refreshes the page bridge before popup clipping so stale content scripts cannot keep old rules', async () => {
    const popup = await readExtensionFile('popup/popup.js');
    const content = await readExtensionFile('content/content.js');
    assert.match(popup, /每次活动页面变化都重新注入页面桥接/);
    assert.match(popup, /files: \[`\$\{extensionAssetPrefix\}lib\/clip-rules\.js`\]/);
    assert.match(content, /__miraClipperDispose/);
    assert.match(content, /removeListener\(handleRuntimeMessage\)/);
  });

  it('keeps inline authorization on the Native Messaging path', async () => {
    const source = await readExtensionFile('popup/popup.js');
    assert.match(source, /chrome\.storage\.sync\.set\(\{ backendUrl \}\)/);
    assert.match(source, /chrome\.runtime\.sendMessage\(\{ type: 'WEBBRIDGE_RECONNECT' \}\)/);
    assert.doesNotMatch(source, /transport/);
  });
});
