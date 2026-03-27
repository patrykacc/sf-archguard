import { describe, expect, it } from '@jest/globals';
import * as path from 'path';
import { fileURLToPath } from 'url';
import {
  extractFormulaObjectReferences,
  parseFieldMetadata,
  parseObjectPackage,
} from '../src/parsers/object-parser';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

describe('ObjectParser', () => {
  const fixturesPath = path.resolve(__dirname, 'fixtures');
  const objectParserFixtures = path.join(fixturesPath, 'object-parser');

  describe('parseObjectPackage', () => {
    it('parses object and field nodes for a package fixture', async () => {
      const result = await parseObjectPackage(
        fixturesPath,
        'force-app/main/default/billing',
        'billing'
      );

      expect(result.nodes.some((node) => node.name === 'Invoice__c')).toBe(true);
      expect(
        result.nodes.some((node) => node.name === 'Invoice__c.Payment__c')
      ).toBe(true);
    });

    it('extracts lookup relationship edges from field metadata', async () => {
      const result = await parseObjectPackage(
        fixturesPath,
        'force-app/main/default/billing',
        'billing'
      );

      expect(result.edges).toContainEqual({
        from: 'Invoice__c',
        to: 'Payment__c',
        dependencyType: 'lookup-relationship',
        line: undefined,
      });
    });

    it('parses multiple objects and fields within the fixture project', async () => {
      const result = await parseObjectPackage(
        fixturesPath,
        'force-app/main/default/payments',
        'payments'
      );

      const fieldNodes = result.nodes.filter((node) => node.type === 'custom-field');
      expect(fieldNodes.length).toBeGreaterThanOrEqual(2);
      expect(result.edges.some((edge) => edge.to === 'Invoice__c')).toBe(true);
    });
  });

  describe('parseFieldMetadata', () => {
    it('extracts master-detail relationship edges', () => {
      const edges = parseFieldMetadata(
        path.join(objectParserFixtures, 'master-detail.field-meta.xml'),
        'Payment__c',
        'Payment__c.Invoice__c'
      );

      expect(edges).toEqual([
        {
          from: 'Payment__c',
          to: 'Invoice__c',
          dependencyType: 'lookup-relationship',
          line: undefined,
        },
      ]);
    });

    it('extracts formula object references and normalizes relationship names', () => {
      const edges = parseFieldMetadata(
        path.join(objectParserFixtures, 'formula-field.field-meta.xml'),
        'BillingSummary__c',
        'BillingSummary__c.DerivedAmount__c'
      );

      expect(edges).toEqual([
        {
          from: 'BillingSummary__c',
          to: 'Payment__c',
          dependencyType: 'field-reference',
          line: undefined,
        },
        {
          from: 'BillingSummary__c',
          to: 'Invoice__c',
          dependencyType: 'field-reference',
          line: undefined,
        },
      ]);
    });

  });

  describe('extractFormulaObjectReferences', () => {
    it('deduplicates references and converts __r relationships to __c objects', () => {
      expect(
        extractFormulaObjectReferences(
          'Payment__r.Amount__c + Invoice__c.Amount__c + Payment__r.Status__c'
        )
      ).toEqual(['Payment__c', 'Invoice__c']);
    });

    it('ignores tokens that do not match custom object references', () => {
      expect(
        extractFormulaObjectReferences('Account.Name & TEXT(TODAY())')
      ).toEqual([]);
    });
  });
});
