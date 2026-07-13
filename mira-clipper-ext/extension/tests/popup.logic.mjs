/**
 * Popup 核心逻辑测试（DOM 无关）
 * 运行: node extension/tests/popup.logic.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';

// === 从 popup.js 提取的纯逻辑 ===

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function validateTag(text, existingTags) {
  const t = text.trim();
  if (!t) return { ok: false, reason: 'empty' };
  if (t.length > 30) return { ok: false, reason: 'too_long' };
  if (existingTags.length >= 10) return { ok: false, reason: 'too_many' };
  if (existingTags.includes(t)) return { ok: false, reason: 'duplicate' };
  return { ok: true, tag: t };
}

function validatePayload({ title, url, tags, note }) {
  const errors = [];
  if (!title || !title.trim()) errors.push('标题不能为空');
  if (!url || !url.trim()) errors.push('URL 不能为空');
  if (tags && tags.length > 10) errors.push('标签不能超过 10 个');
  if (note && note.length > 500) errors.push('备注不能超过 500 字符');
  return { ok: errors.length === 0, errors };
}

function getStatusText(error) {
  const msg = error?.message || String(error);
  if (msg.includes('Failed to fetch') || msg.includes('ECONNREFUSED') || msg.includes('fetch')) {
    return '无法连接到 Mira 桌面端，请确认应用已启动';
  }
  if (msg.includes('timeout')) {
    return '连接超时，请检查网络或后端状态';
  }
  return '网络错误：' + msg;
}

// === 测试 ===

describe('escapeHtml', () => {
  it('应转义 HTML 特殊字符', () => {
    assert.equal(escapeHtml('<script>alert("x")</script>'),
      '&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;');
  });

  it('普通文本应保持不变', () => {
    assert.equal(escapeHtml('Hello World'), 'Hello World');
  });
});

describe('validateTag', () => {
  it('有效标签应通过', () => {
    const result = validateTag('AI', []);
    assert.equal(result.ok, true);
    assert.equal(result.tag, 'AI');
  });

  it('空标签应拒绝', () => {
    const result = validateTag('  ', []);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'empty');
  });

  it('超过 30 字符应拒绝', () => {
    const long = 'a'.repeat(31);
    const result = validateTag(long, []);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'too_long');
  });

  it('超过 10 个标签应拒绝', () => {
    const existing = Array.from({ length: 10 }, (_, i) => `tag${i}`);
    const result = validateTag('new', existing);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'too_many');
  });

  it('重复标签应拒绝', () => {
    const result = validateTag('AI', ['AI', '工具']);
    assert.equal(result.ok, false);
    assert.equal(result.reason, 'duplicate');
  });
});

describe('validatePayload', () => {
  it('完整有效载荷应通过', () => {
    const result = validatePayload({
      title: 'Hello',
      url: 'https://example.com',
      tags: ['AI'],
      note: 'Note',
    });
    assert.equal(result.ok, true);
    assert.equal(result.errors.length, 0);
  });

  it('空标题应报错', () => {
    const result = validatePayload({ title: '  ', url: 'https://example.com' });
    assert.equal(result.ok, false);
    assert.ok(result.errors.includes('标题不能为空'));
  });

  it('过长备注应报错', () => {
    const result = validatePayload({
      title: 'T',
      url: 'https://example.com',
      note: 'a'.repeat(501),
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.includes('备注不能超过 500 字符'));
  });

  it('标签和备注长度应校验', () => {
    const result = validatePayload({
      title: 'T',
      url: 'https://example.com',
      tags: Array.from({ length: 11 }, (_, i) => `tag-${i}`),
      note: 'a'.repeat(501),
    });
    assert.equal(result.ok, false);
    assert.ok(result.errors.includes('标签不能超过 10 个'));
    assert.ok(result.errors.includes('备注不能超过 500 字符'));
  });
});

describe('getStatusText', () => {
  it('ECONNREFUSED 应提示启动桌面端', () => {
    const text = getStatusText(new Error('Failed to fetch: ECONNREFUSED'));
    assert.ok(text.includes('请确认应用已启动'));
  });

  it('超时错误应提示检查网络', () => {
    const text = getStatusText(new Error('The operation timeout'));
    assert.ok(text.includes('连接超时'));
  });

  it('未知错误应返回通用文案', () => {
    const text = getStatusText(new Error('Something broke'));
    assert.ok(text.startsWith('网络错误：'));
  });
});
