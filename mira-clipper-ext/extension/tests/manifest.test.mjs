/**
 * Manifest 结构测试
 * 运行: node extension/tests/manifest.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

describe('manifest.json', () => {
  let manifest;

  it('应是合法的 JSON', async () => {
    const raw = await readFile(join(__dirname, '../manifest.json'), 'utf-8');
    manifest = JSON.parse(raw);
    assert.equal(typeof manifest, 'object');
  });

  it('应使用 Manifest V3', () => {
    assert.equal(manifest.manifest_version, 3);
  });

  it('应声明最小必要权限', () => {
    const required = ['activeTab', 'storage', 'scripting', 'contextMenus', 'identity'];
    const perms = manifest.permissions || [];
    for (const p of required) {
      assert.ok(perms.includes(p), `缺少权限: ${p}`);
    }
  });

  it('不应请求敏感权限', () => {
    const forbidden = ['history', 'tabs', 'webNavigation', 'cookies', 'bookmarks'];
    const perms = [...(manifest.permissions || []), ...(manifest.host_permissions || [])];
    for (const p of forbidden) {
      assert.ok(!perms.includes(p), `不应包含敏感权限: ${p}`);
    }
  });

  it('host_permissions 应只包含本地地址', () => {
    const hosts = manifest.host_permissions || [];
    for (const h of hosts) {
      assert.ok(
        h.includes('localhost') || h.includes('127.0.0.1'),
        `host_permissions 应限制本地: ${h}`
      );
    }
  });

  it('应配置快捷键', () => {
    assert.ok(manifest.commands);
    assert.ok(manifest.commands._execute_action);
  });

  it('应包含 popup 入口', () => {
    assert.ok(manifest.action);
    assert.ok(manifest.action.default_popup);
    assert.ok(manifest.action.default_popup.endsWith('popup/popup.html'));
  });
});

describe('项目根目录 manifest.json', () => {
  it('应指向 extension/ 下的运行入口', async () => {
    const root = JSON.parse(await readFile(join(__dirname, '../../manifest.json'), 'utf-8'));
    assert.equal(root.action.default_popup, 'extension/popup/popup.html');
    assert.equal(root.background.service_worker, 'extension/background.js');
    assert.equal(root.options_page, 'extension/options/options.html');
  });
});
