/**
 * Guardrail: toolbar decoration must never become a prerequisite for WebBridge startup.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backgroundPath = join(__dirname, '..', 'background.js');

describe('WebBridge toolbar decoration boundary', () => {
  it('keeps action icon/title/badge failures from blocking connection startup', async () => {
    const source = await readFile(backgroundPath, 'utf8');

    assert.match(source, /async function updateActionUiSafely/);
    assert.match(source, /Promise\.allSettled/);
    assert.match(source, /触界工具栏状态更新失败/);
    assert.match(source, /await markAuthorizationReady\(\);[\s\S]*?chrome\.runtime\.connectNative/);
  });
});
