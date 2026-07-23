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

  it('应使用触界作为扩展总名', async () => {
    assert.equal(manifest.name, '触界');
    assert.equal(manifest.action.default_title, '打开触界');
    assert.equal(manifest.action.default_icon['16'], 'icons/icon-16.png');
    assert.equal(manifest.action.default_icon['128'], 'icons/icon-128.png');
    const [popup, options] = await Promise.all([
      readFile(join(__dirname, '../popup/popup.html'), 'utf-8'),
      readFile(join(__dirname, '../options/options.html'), 'utf-8'),
    ]);
    assert.match(popup, /brand-title">触界</);
    assert.match(popup, /src="\.\.\/icons\/icon-128\.png"/);
    assert.match(options, /触界设置/);
    assert.match(options, /src="\.\.\/icons\/icon-128\.png"/);
  });

  it('应声明持续页面操作所需权限', () => {
    const required = ['activeTab', 'storage', 'scripting', 'contextMenus', 'identity', 'sidePanel', 'debugger'];
    const perms = manifest.permissions || [];
    for (const p of required) {
      assert.ok(perms.includes(p), `缺少权限: ${p}`);
    }
    assert.ok((manifest.host_permissions || []).includes('<all_urls>'));
    assert.ok(perms.includes('nativeMessaging'));
    assert.equal(manifest.content_scripts?.[0]?.matches?.[0], '<all_urls>');
  });

  it('不应请求敏感权限', () => {
    const forbidden = ['history', 'webNavigation', 'cookies', 'bookmarks'];
    const perms = [...(manifest.permissions || []), ...(manifest.host_permissions || [])];
    for (const p of forbidden) {
      assert.ok(!perms.includes(p), `不应包含敏感权限: ${p}`);
    }
  });

  it('host_permissions 应覆盖可操作网页', () => {
    const hosts = manifest.host_permissions || [];
    assert.ok(hosts.includes('<all_urls>'));
  });

  it('应配置快捷键', () => {
    assert.ok(manifest.commands);
    assert.ok(manifest.commands._execute_action);
  });

  it('应包含 Side Panel 入口', () => {
    assert.ok(manifest.action);
    assert.equal(manifest.action.default_popup, undefined);
    assert.equal(manifest.side_panel?.default_path, 'popup/popup.html');
  });

  it('应包含侧栏页面入口资源', async () => {
    assert.equal(manifest.options_page, 'options/options.html');
    await readFile(join(__dirname, '../popup/popup.html'), 'utf-8');
    await readFile(join(__dirname, '../popup/popup.js'), 'utf-8');
  });

  it('应包含待授权状态图标', async () => {
    await Promise.all([16, 32, 48, 128].map((size) => (
      readFile(join(__dirname, `../icons/icon-${size}-attention.png`))
    )));
  });

  it('应暴露本地 ChatGPT.js 资源给页面适配器', () => {
    assert.deepEqual(manifest.web_accessible_resources, [{
      resources: ['lib/chatgpt.min.js'],
      matches: ['<all_urls>'],
    }]);
  });

  it('应在页面脚本加载规则模块后再加载提取器', () => {
    assert.deepEqual(manifest.content_scripts?.[0]?.js, [
      'lib/clip-rules.js',
      'lib/extractor.js',
      'lib/chatgpt-adapter.js',
      'content/content.js',
    ]);
  });
});

describe('项目根目录 manifest.json', () => {
  it('应指向 extension/ 下的运行入口', async () => {
    const root = JSON.parse(await readFile(join(__dirname, '../../manifest.json'), 'utf-8'));
    assert.equal(root.name, '触界');
    assert.equal(root.action.default_title, '打开触界');
    assert.equal(root.action.default_icon['16'], 'extension/icons/icon-16.png');
    assert.equal(root.action.default_icon['128'], 'extension/icons/icon-128.png');
    assert.equal(root.action.default_popup, undefined);
    assert.equal(root.side_panel?.default_path, 'extension/popup/popup.html');
    assert.equal(root.background.service_worker, 'extension/background.js');
    assert.equal(root.options_page, 'extension/options/options.html');
  });
});
