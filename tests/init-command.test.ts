import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { executeInit } from '../src/commands/archguard/init.js';

describe('executeInit', () => {
  let tempDir: string;
  let configPath: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'archguard-init-test-'));
    configPath = path.join(tempDir, 'archguard.yml');
    jest.resetAllMocks();
  });

  afterEach(() => {
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    if (fs.existsSync(tempDir)) {
      fs.rmdirSync(tempDir);
    }
    jest.clearAllMocks();
  });

  it('creates archguard.yml if it does not exist', () => {
    const deps = {
      log: jest.fn(),
      error: jest.fn() as any
    };

    executeInit({ 'project-dir': tempDir }, deps);

    expect(fs.existsSync(configPath)).toBe(true);
    const content = fs.readFileSync(configPath, 'utf8');
    expect(content).toContain('SF-ArchGuard Configuration Example');
    expect(deps.log).toHaveBeenCalledWith(expect.stringContaining('Successfully created'));
  });

  it('throws an error if archguard.yml already exists', () => {
    fs.writeFileSync(configPath, 'dummy content');

    const deps = {
      log: jest.fn(),
      error: jest.fn() as any
    };

    executeInit({ 'project-dir': tempDir }, deps);

    expect(fs.existsSync(configPath)).toBe(true);
    const content = fs.readFileSync(configPath, 'utf8');
    expect(content).toBe('dummy content'); // content should not be overwritten
    expect(deps.error).toHaveBeenCalledWith(expect.stringContaining('Configuration file already exists at'));
  });
});
