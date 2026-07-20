/**
 * WebBridge transport regression guards.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const backgroundPath = join(__dirname, '..', 'background.js');

describe('WebBridge transport selection', () => {
  it('reads the persisted transport instead of forcing Native Messaging', async () => {
    const source = await readFile(backgroundPath, 'utf8');

    assert.match(source, /chrome\.storage\.sync\.get\(\['backendUrl', 'transport'\]\)/);
    assert.match(source, /syncStore\.transport === 'websocket' \? 'websocket' : 'native'/);
    assert.doesNotMatch(source, /transport:\s*'native',\s*\n\s*accessToken/);
  });

  it('keeps Native and WebSocket connection diagnostics distinguishable', async () => {
    const source = await readFile(backgroundPath, 'utf8');

    assert.match(source, /NATIVE_CONNECT_REQUESTED/);
    assert.match(source, /NATIVE_PORT_DISCONNECTED/);
    assert.match(source, /stage: 'connect_native'/);
    assert.match(source, /WEBSOCKET_CONNECT_REQUESTED/);
    assert.match(source, /transport: 'websocket', message: '触界 WebSocket 已断开'/);
  });
});
