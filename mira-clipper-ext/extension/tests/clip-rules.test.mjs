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

describe('网站剪藏规则', () => {
  it('按 hostname 归一化，并去掉 www', () => {
    assert.equal(rules.normalizeHostname('https://www.Example.com/article'), 'example.com');
    assert.equal(rules.normalizeHostname('example.com:8443/path'), 'example.com');
  });

  it('只命中完全相同的站点，不向父域名扩散', () => {
    const configured = {
      'example.com': { includeSelector: 'article' },
    };
    assert.equal(rules.getRule(configured, 'www.example.com').host, 'example.com');
    assert.equal(rules.getRule(configured, 'docs.example.com'), null);
    assert.equal(rules.getRule(configured, 'other.example.net'), null);
  });

  it('支持按完整 URL 的简单正则限制规则', () => {
    const configured = {
      'example.com': { urlPattern: '^https://example\\.com/articles/\\d+$', includeSelector: 'article' },
    };
    assert.equal(rules.getRule(configured, 'example.com', 'https://example.com/articles/42').includeSelector, 'article');
    assert.equal(rules.getRule(configured, 'example.com', 'https://example.com/about'), null);
    assert.equal(rules.getRule(configured, 'docs.example.com', 'https://docs.example.com/articles/42'), null);
  });

  it('支持按完整 URL 的通配符限制规则', () => {
    const configured = {
      'example.com': { urlPattern: 'https://example.com/articles/*', urlPatternMode: 'wildcard', includeSelector: 'article' },
    };
    assert.equal(rules.getRule(configured, 'example.com', 'https://example.com/articles/42').includeSelector, 'article');
    assert.equal(rules.getRule(configured, 'example.com', 'https://example.com/about'), null);
    assert.equal(rules.matchesUrlPattern('https://example.com/a?x=?', 'https://example.com/a?x=1'), true);
  });

  it('旧版 URL 正则没有模式字段时仍按正则解释', () => {
    const legacy = rules.normalizeRule({ urlPattern: '^https://example\\.com/article/\\d+$' }, 'example.com');
    assert.equal(legacy.urlPatternMode, 'regex');
    assert.equal(rules.getRule({ 'example.com': legacy }, 'example.com', 'https://example.com/article/42').urlPatternMode, 'regex');
    assert.equal(rules.getRule({ 'example.com': legacy }, 'example.com', 'https://example.com/article/x'), null);
  });

  it('拒绝无效 URL 正则，并保留没有正则的旧规则行为', () => {
    const invalid = rules.validateRule({ urlPattern: '[article', urlPatternMode: 'regex' }, 'example.com');
    assert.equal(invalid.ok, false);
    assert.ok(invalid.errors.some((message) => message.includes('URL 正则')));
    assert.equal(rules.getRule({ 'example.com': { urlPattern: '^https://example\\.com/article$', includeSelector: 'article' } }, 'example.com', 'https://example.com/any'), null);
    assert.equal(rules.getRule({ 'example.com': { includeSelector: 'article' } }, 'example.com').includeSelector, 'article');
  });

  it('保留停用规则，使提取器可以显示停用状态', () => {
    const rule = rules.getRule({ 'example.com': { enabled: false } }, 'example.com');
    assert.equal(rule.enabled, false);
  });

  it('规范化排除选择器和图片参数', () => {
    const rule = rules.normalizeRule({
      excludeSelectors: '.comments\n .ads',
      imagePolicy: { minWidth: 240.4, minHeight: -2, maxCount: 999 },
    }, 'example.com');
    assert.deepEqual(Array.from(rule.excludeSelectors), ['.comments', '.ads']);
    assert.equal(rule.imagePolicy.minWidth, 240);
    assert.equal(rule.imagePolicy.minHeight, 0);
    assert.equal(rule.imagePolicy.maxCount, 50);
  });

  it('拒绝无效站点和过长选择器', () => {
    const result = rules.validateRule({ includeSelector: 'a'.repeat(501) }, 'not a host');
    assert.equal(result.ok, false);
    assert.ok(result.errors.some((message) => message.includes('有效的网站域名')));
    assert.ok(result.errors.some((message) => message.includes('500')));
  });
});
