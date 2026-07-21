/** 网站剪藏规则核心逻辑测试 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const __dirname = dirname(fileURLToPath(import.meta.url));
const source = await readFile(join(__dirname, '../lib/clip-rules.js'), 'utf8');
const sandbox = { URL };
vm.runInNewContext(source, sandbox);
const rules = sandbox.MiraClipRules;

describe('URL 剪藏规则', () => {
  it('废弃没有 URL 模式的旧域名规则', () => {
    const configured = {
      'example.com': { host: 'example.com', includeSelector: 'article' },
      'wildcard:https://example.com/*': { urlPattern: 'https://example.com/*', urlPatternMode: 'wildcard', includeSelector: 'main' },
    };
    const normalized = rules.normalizeRules(configured);
    assert.deepEqual(Object.keys(normalized), ['wildcard:https://example.com/*']);
    assert.equal(rules.getRule(configured, 'https://example.com/article').includeSelector, 'main');
  });

  it('支持按完整 URL 的简单正则限制规则', () => {
    const configured = {
      article: { urlPattern: '^https://example\\.com/articles/\\d+$', includeSelector: 'article' },
    };
    assert.equal(rules.getRule(configured, 'https://example.com/articles/42').includeSelector, 'article');
    assert.equal(rules.getRule(configured, 'https://example.com/about'), null);
    assert.equal(rules.getRule(configured, 'https://docs.example.com/articles/42'), null);
  });

  it('支持按完整 URL 的通配符限制规则', () => {
    const configured = {
      article: { urlPattern: 'https://example.com/articles/*', urlPatternMode: 'wildcard', includeSelector: 'article' },
    };
    assert.equal(rules.getRule(configured, 'https://example.com/articles/42').includeSelector, 'article');
    assert.equal(rules.getRule(configured, 'https://example.com/about'), null);
    assert.equal(rules.matchesUrlPattern('https://example.com/a?x=?', 'https://example.com/a?x=1'), true);
  });

  it('旧版 URL 正则没有模式字段时仍按正则解释', () => {
    const legacy = rules.normalizeRule({ urlPattern: '^https://example\\.com/article/\\d+$' });
    assert.equal(legacy.urlPatternMode, 'regex');
    assert.equal(rules.getRule({ legacy }, 'https://example.com/article/42').urlPatternMode, 'regex');
    assert.equal(rules.getRule({ legacy }, 'https://example.com/article/x'), null);
  });

  it('拒绝无效或缺失的 URL 匹配规则', () => {
    const invalid = rules.validateRule({ urlPattern: '[article', urlPatternMode: 'regex' });
    assert.equal(invalid.ok, false);
    assert.ok(invalid.errors.some((message) => message.includes('URL 正则')));
    assert.equal(rules.getRule({ article: { urlPattern: '^https://example\\.com/article$', includeSelector: 'article' } }, 'https://example.com/any'), null);
    assert.equal(rules.validateRule({ includeSelector: 'article' }).ok, false);
  });

  it('最具体的规则优先，停用规则也可作为更具体的例外', () => {
    const configured = {
      broad: { alias: '通用文档', urlPattern: 'https://example.com/docs/*', urlPatternMode: 'wildcard', includeSelector: 'main' },
      exact: { alias: '安装页', urlPattern: 'https://example.com/docs/install/*', urlPatternMode: 'wildcard', includeSelector: 'article' },
      disabled: { alias: '禁用页', urlPattern: 'https://example.com/docs/install/legacy/*', urlPatternMode: 'wildcard', enabled: false, includeSelector: 'article' },
    };
    const matched = rules.getRule(configured, 'https://example.com/docs/install/latest');
    assert.equal(matched.alias, '安装页');
    assert.equal(matched.includeSelector, 'article');
    const rule = rules.getRule(configured, 'https://example.com/docs/install/legacy/v1');
    assert.equal(rule.enabled, false);
  });

  it('规范化排除选择器和图片参数', () => {
    const rule = rules.normalizeRule({
      urlPattern: 'https://example.com/*',
      excludeSelectors: '.comments\n .ads',
      imagePolicy: { minWidth: 240.4, minHeight: -2, maxCount: 999 },
    });
    assert.deepEqual(Array.from(rule.excludeSelectors), ['.comments', '.ads']);
    assert.equal(rule.imagePolicy.minWidth, 240);
    assert.equal(rule.imagePolicy.minHeight, 0);
    assert.equal(rule.imagePolicy.maxCount, 50);
  });

  it('保留别名并使用 URL 模式作为规则键', () => {
    const rule = rules.normalizeRule({ alias: 'JavBus 影片库', urlPattern: 'https://javbus.com/*', urlPatternMode: 'wildcard', includeSelector: 'article' });
    assert.equal(rule.alias, 'JavBus 影片库');
    assert.equal(rules.getRuleKey(rule), 'wildcard:https://javbus.com/*');
    assert.equal(rules.getRule({ rule }, 'https://javbus.com/abc').alias, 'JavBus 影片库');
  });

  it('拒绝过长选择器', () => {
    const result = rules.validateRule({ urlPattern: 'https://example.com/*', includeSelector: 'a'.repeat(501) });
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((message) => message.includes('500')));
  });
});
