import { describe, it, expect } from '@jest/globals';
import * as path from 'path';
import * as fs from 'fs';
import { loadConfig, ConfigValidationError } from '../src/config/config-loader';

describe('ConfigLoader', () => {
  const fixturesPath = path.resolve(__dirname, 'fixtures');
  const configPath = path.join(fixturesPath, 'archguard.yml');

  describe('loadConfig', () => {
    it('should load a valid archguard.yml configuration', () => {
      const config = loadConfig(fixturesPath);

      expect(config).toBeDefined();
      expect(config.projectRoot).toBe(fixturesPath);
      expect(config.layers).toBeDefined();
      expect(Array.isArray(config.layers)).toBe(true);
      expect(config.packages).toBeDefined();
      expect(typeof config.packages).toBe('object');
      expect(config.rules).toBeDefined();
    });

    it('should parse layers correctly', () => {
      const config = loadConfig(fixturesPath);

      expect(config.layers.length).toBe(3);
      expect(config.layers[0].name).toBe('integration');
      expect(config.layers[0].dependsOn).toEqual(['service', 'shared']);
      expect(config.layers[1].name).toBe('service');
      expect(config.layers[1].dependsOn).toEqual(['shared']);
      expect(config.layers[2].name).toBe('shared');
      expect(config.layers[2].dependsOn).toEqual([]);
    });

    it('should parse packages correctly', () => {
      const config = loadConfig(fixturesPath);

      expect(config.packages).toHaveProperty('billing');
      expect(config.packages).toHaveProperty('payments');
      expect(config.packages).toHaveProperty('common');

      expect(config.packages.billing.layer).toBe('service');
      expect(config.packages.billing.path).toBe('force-app/main/default/billing');

      expect(config.packages.payments.layer).toBe('integration');
      expect(config.packages.payments.path).toBe('force-app/main/default/payments');
      expect(config.packages.payments.dependsOn).toEqual(['billing']);

      expect(config.packages.common.layer).toBe('shared');
      expect(config.packages.common.path).toBe('force-app/main/default/common');
    });

    it('should parse rules correctly', () => {
      const config = loadConfig(fixturesPath);

      expect(config.rules).toBeDefined();
      expect(config.rules?.enforcePackageBoundaries).toBe(true);
      expect(config.rules?.enforceObjectBoundaries).toBe(true);
      expect(Array.isArray(config.rules?.exclude)).toBe(true);
    });

    it('should throw an error when config file does not exist', () => {
      const nonExistentPath = path.join(fixturesPath, '..', 'nonexistent-dir');

      expect(() => {
        loadConfig(nonExistentPath);
      }).toThrow();
    });

    it('should throw ConfigValidationError when config is invalid', () => {
      const tempDir = path.join(fixturesPath, '..', 'temp-test-' + Date.now());
      fs.mkdirSync(tempDir, { recursive: true });

      try {
        const invalidYamlPath = path.join(tempDir, 'archguard.yml');
        fs.writeFileSync(invalidYamlPath, 'invalid: yaml: content: [');

        expect(() => {
          loadConfig(tempDir);
        }).toThrow();
      } finally {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true });
        }
      }
    });
  });

  describe('ConfigValidationError', () => {
    it('should have correct error name', () => {
      const error = new ConfigValidationError(['error 1', 'error 2']);
      expect(error.name).toBe('ConfigValidationError');
    });

    it('should include error messages in message', () => {
      const errors = ['Missing layers', 'Invalid package definition'];
      const error = new ConfigValidationError(errors);

      expect(error.message).toContain('Config validation failed');
      expect(error.message).toContain('Missing layers');
      expect(error.message).toContain('Invalid package definition');
    });

    it('should store errors array', () => {
      const errors = ['error 1', 'error 2'];
      const error = new ConfigValidationError(errors);

      expect(error.errors).toEqual(errors);
    });
  });

  describe('config validation', () => {
    it('should detect missing layers', () => {
      const tempDir = path.join(fixturesPath, '..', 'temp-test-' + Date.now());
      fs.mkdirSync(tempDir, { recursive: true });

      try {
        const invalidYamlPath = path.join(tempDir, 'archguard.yml');
        fs.writeFileSync(
          invalidYamlPath,
          `packages:
  test:
    path: some/path
    layer: test`
        );

        expect(() => {
          loadConfig(tempDir);
        }).toThrow(ConfigValidationError);
      } finally {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true });
        }
      }
    });

    it('should detect missing packages', () => {
      const tempDir = path.join(fixturesPath, '..', 'temp-test-' + Date.now());
      fs.mkdirSync(tempDir, { recursive: true });

      try {
        const invalidYamlPath = path.join(tempDir, 'archguard.yml');
        fs.writeFileSync(
          invalidYamlPath,
          `layers:
  - name: test
    dependsOn: []`
        );

        expect(() => {
          loadConfig(tempDir);
        }).toThrow(ConfigValidationError);
      } finally {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true });
        }
      }
    });

    it('should detect references to undefined layers in packages', () => {
      const tempDir = path.join(fixturesPath, '..', 'temp-test-' + Date.now());
      fs.mkdirSync(tempDir, { recursive: true });

      try {
        const invalidYamlPath = path.join(tempDir, 'archguard.yml');
        fs.writeFileSync(
          invalidYamlPath,
          `layers:
  - name: layer1
    dependsOn: []
packages:
  pkg1:
    path: some/path
    layer: nonexistent`
        );

        expect(() => {
          loadConfig(tempDir);
        }).toThrow(ConfigValidationError);
      } finally {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true });
        }
      }
    });

    it('should detect circular layer dependencies', () => {
      const tempDir = path.join(fixturesPath, '..', 'temp-test-' + Date.now());
      fs.mkdirSync(tempDir, { recursive: true });

      try {
        const invalidYamlPath = path.join(tempDir, 'archguard.yml');
        fs.writeFileSync(
          invalidYamlPath,
          `layers:
  - name: a
    dependsOn: [b]
  - name: b
    dependsOn: [a]
packages:
  pkg1:
    path: some/path
    layer: a`
        );

        expect(() => {
          loadConfig(tempDir);
        }).toThrow(ConfigValidationError);
      } finally {
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true });
        }
      }
    });
  });
});
