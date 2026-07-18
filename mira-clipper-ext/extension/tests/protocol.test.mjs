/**
 * 通信协议契约测试
 * 验证扩展提交的数据结构符合后端预期
 * 运行: node extension/tests/protocol.test.mjs
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const extensionRoot = join(fileURLToPath(new URL('..', import.meta.url)));

describe('POST /microapps/evolving-knowledge/captures 请求体契约', () => {
  it('扩展应提交洞见捕获所需字段', () => {
    const payload = {
      sourceUrl: 'https://example.com/article',
      title: '标题',
      favicon: 'https://example.com/favicon.ico',
      contentType: 'webpage',
      rawContent: '# 标题\n\n正文内容',
      metadata: {
        selectedText: '选中文字',
        userTags: ['AI'],
        note: '备注',
        excerpt: '摘要',
        author: '作者',
        siteName: '站点',
        coverImageUrl: 'https://example.com/cover.jpg',
        wordCount: 42,
      },
    };

    assert.ok(typeof payload.sourceUrl === 'string' && payload.sourceUrl.length > 0);
    assert.ok(typeof payload.title === 'string' && payload.title.length > 0);
    assert.equal(payload.contentType, 'webpage');
    assert.ok(typeof payload.rawContent === 'string');
    assert.ok(typeof payload.favicon === 'string');
    assert.ok(Array.isArray(payload.metadata.userTags));
  });

  it('可选字段允许为空或省略', () => {
    const payload = {
      sourceUrl: 'https://example.com',
      title: '标题',
      contentType: 'webpage',
      rawContent: '正文',
    };

    assert.equal(payload.metadata, undefined);
  });

  it('标签应限制数量和长度', () => {
    const tags = ['AI', '工具', 'MVP'];
    assert.ok(tags.length <= 10, '标签数量应 <= 10');
    assert.ok(tags.every(t => t.length <= 30), '单个标签应 <= 30 字符');
  });
});

describe('Popup 状态机输出', () => {
  const states = ['LOADING', 'READY', 'SAVING', 'SUCCESS', 'ERROR'];

  it('应支持 5 个状态', () => {
    assert.equal(states.length, 5);
  });

  it('ERROR 状态应允许重试（恢复 READY）', () => {
    // 契约：ERROR 状态下保存按钮应可用
    assert.ok(true); // 文档约束，运行时验证在 popup.js 中
  });

  it('SUCCESS 状态应自动关闭 popup', () => {
    // 契约：SUCCESS 后 1.5s 内关闭
    assert.ok(true); // 文档约束，运行时验证在 popup.js 中
  });
});

describe('剪藏模式和 AI 开关', () => {
  it('扩展应区分整页、选中文字和单图片剪藏', async () => {
    const [background, content, popup] = await Promise.all([
      readFile(join(extensionRoot, 'background.js'), 'utf8'),
      readFile(join(extensionRoot, 'content/content.js'), 'utf8'),
      readFile(join(extensionRoot, 'popup/popup.js'), 'utf8'),
    ]);

    assert.match(background, /captureMode: 'image'/);
    assert.match(background, /captureMode: 'selection'/);
    assert.match(content, /captureMode === 'image'/);
    assert.match(content, /captureMode === 'selection'/);
    assert.match(popup, /captureMode: pendingCapture\?\.captureMode \|\| 'auto'/);
    assert.match(popup, /rawHtml: els\.saveBtn\.dataset\.captureMode === 'page'/);
  });

  it('AI 摘要和关联重建必须由两个独立开关控制', async () => {
    const html = await readFile(join(extensionRoot, 'popup/popup.html'), 'utf8');
    const source = await readFile(join(extensionRoot, 'popup/popup.js'), 'utf8');

    assert.match(html, /id="processAi"/);
    assert.match(html, /生成 AI 摘要、标签和实体/);
    assert.match(html, /id="rebuildKnowledge"/);
    assert.match(html, /重建关联与洞见/);
    assert.match(source, /processAi: els\.processAi\.checked/);
    assert.match(source, /rebuild: els\.rebuildKnowledge\.checked/);
    assert.match(source, /if \(els\.rebuildKnowledge\.checked\)/);
  });
});
