import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { buildApp } from '../src/app.js';

describe('Local Mirror Service', () => {
  let tempMirrorDir: string;
  let testVsixPath: string;
  let testTarPath: string;
  const vsixData = Buffer.alloc(1024 * 128, 'a'); // 128 KB sample payload
  const tarData = Buffer.alloc(1024 * 512, 'b');  // 512 KB sample payload

  let appInstance: ReturnType<typeof buildApp>;

  beforeAll(async () => {
    // Create temporary mirror directory
    tempMirrorDir = fs.mkdtempSync(path.join(os.tmpdir(), 'broker-mirror-test-'));
    testVsixPath = path.join(tempMirrorDir, 'python-tools.vsix');
    testTarPath = path.join(tempMirrorDir, 'gcc-toolchain.tar.gz');

    fs.writeFileSync(testVsixPath, vsixData);
    fs.writeFileSync(testTarPath, tarData);

    appInstance = buildApp({
      mirrorStorageDir: tempMirrorDir,
    });
  });

  afterAll(async () => {
    await appInstance.app.close();
    fs.rmSync(tempMirrorDir, { recursive: true, force: true });
  });

  it('lists available mirror extensions and packages', async () => {
    const res = await appInstance.app.inject({
      method: 'GET',
      url: '/api/mirror/extensions',
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.count).toBe(2);
    const names = body.files.map((f: any) => f.filename);
    expect(names).toContain('python-tools.vsix');
    expect(names).toContain('gcc-toolchain.tar.gz');
  });

  it('streams extension file with correct Content-Length and payload', async () => {
    const res = await appInstance.app.inject({
      method: 'GET',
      url: '/api/mirror/extensions/python-tools.vsix',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-length']).toBe(vsixData.length.toString());
    expect(res.headers['content-type']).toBe('application/octet-stream');
    expect(res.headers['content-disposition']).toBe('attachment; filename="python-tools.vsix"');
    expect(res.rawPayload.equals(vsixData)).toBe(true);
  });

  it('streams large toolchain tar.gz with correct Content-Length', async () => {
    const res = await appInstance.app.inject({
      method: 'GET',
      url: '/api/mirror/extensions/gcc-toolchain.tar.gz',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-length']).toBe(tarData.length.toString());
    expect(res.rawPayload.equals(tarData)).toBe(true);
  });

  it('returns 404 for non-existent files', async () => {
    const res = await appInstance.app.inject({
      method: 'GET',
      url: '/api/mirror/extensions/non-existent.vsix',
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.body);
    expect(body.error).toBe('File not found');
  });

  it('prevents path traversal outside mirror storage directory', async () => {
    const res = await appInstance.app.inject({
      method: 'GET',
      url: '/api/mirror/extensions/..%2F..%2Fpackage.json',
    });

    // Sanitization with path.basename ensures traversal is blocked and treated as missing filename
    expect(res.statusCode).toBe(404);
  });
});
