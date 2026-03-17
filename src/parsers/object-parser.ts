/**
 * Object/Field Metadata Parser
 *
 * Parses SFDX source format metadata for custom objects and fields.
 * Detects cross-package dependencies via:
 *   - Lookup relationships (referenceTo)
 *   - Master-Detail relationships (referenceTo)
 *   - Formula field references to other objects
 *
 * File structure expected (SFDX source format):
 *   objects/
 *     MyObject__c/
 *       MyObject__c.object-meta.xml
 *       fields/
 *         MyField__c.field-meta.xml
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { XMLParser } from 'fast-xml-parser';
import { GraphNode, GraphEdge, MetadataType } from '../types';

export interface ObjectParseResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
});

/**
 * Parses all custom object and field metadata within a package folder.
 */
export async function parseObjectPackage(
  projectRoot: string,
  packagePath: string,
  packageName: string
): Promise<ObjectParseResult> {
  const absolutePath = path.join(projectRoot, packagePath);
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Find object directories (each custom object is a folder)
  const objectMetaFiles = await glob('**/objects/*/*.object-meta.xml', {
    cwd: absolutePath,
    absolute: false,
  });

  for (const metaFile of objectMetaFiles) {
    const objectDir = path.dirname(metaFile);
    const objectName = path.basename(objectDir);
    const relativePath = path.join(packagePath, metaFile);

    nodes.push({
      name: objectName,
      type: 'custom-object' as MetadataType,
      packageName,
      filePath: relativePath,
    });

    // Parse field metadata files within this object
    const fieldFiles = await glob('fields/*.field-meta.xml', {
      cwd: path.join(absolutePath, objectDir),
      absolute: false,
    });

    for (const fieldFile of fieldFiles) {
      const fieldFullPath = path.join(absolutePath, objectDir, fieldFile);
      const fieldName = path.basename(fieldFile, '.field-meta.xml');
      const fieldRelativePath = path.join(packagePath, objectDir, fieldFile);
      const qualifiedFieldName = `${objectName}.${fieldName}`;

      nodes.push({
        name: qualifiedFieldName,
        type: 'custom-field' as MetadataType,
        packageName,
        filePath: fieldRelativePath,
      });

      // Parse the field XML for relationship references
      const fieldEdges = parseFieldMetadata(fieldFullPath, objectName, qualifiedFieldName);
      edges.push(...fieldEdges);
    }
  }

  return { nodes, edges };
}

/**
 * Parses a single field metadata XML file for relationship dependencies.
 */
function parseFieldMetadata(
  filePath: string,
  parentObjectName: string,
  qualifiedFieldName: string
): GraphEdge[] {
  const edges: GraphEdge[] = [];

  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = xmlParser.parse(content);
    const field = parsed?.CustomField;
    if (!field) return edges;

    // Lookup and Master-Detail relationships
    const fieldType = field.type;
    if (fieldType === 'Lookup' || fieldType === 'MasterDetail') {
      const referenceTo = field.referenceTo;
      if (referenceTo && typeof referenceTo === 'string') {
        edges.push({
          from: parentObjectName,
          to: referenceTo,
          dependencyType: 'lookup-relationship',
          line: undefined,
        });
      }
    }

    // Formula fields — scan for Object__c.Field__c patterns
    if (field.formula && typeof field.formula === 'string') {
      const formulaRefs = extractFormulaObjectReferences(field.formula);
      for (const ref of formulaRefs) {
        edges.push({
          from: parentObjectName,
          to: ref,
          dependencyType: 'field-reference',
          line: undefined,
        });
      }
    }

  } catch (err) {
    // Skip unparseable files silently — the reporter can warn about them
    console.warn(`Warning: Could not parse field metadata at ${filePath}: ${(err as Error).message}`);
  }

  return edges;
}

/**
 * Extracts object references from formula field expressions.
 * Looks for patterns like: ObjectName__c.FieldName__c or ObjectName__r.FieldName__c
 */
function extractFormulaObjectReferences(formula: string): string[] {
  const refs = new Set<string>();

  // Match Object__c.Field__c or Object__r.Field__c patterns
  const pattern = /\b([A-Z]\w+__[cr])\.\w+/gi;
  let match;
  while ((match = pattern.exec(formula)) !== null) {
    let objectName = match[1];
    // Convert relationship references (__r) to object references (__c)
    if (objectName.endsWith('__r')) {
      objectName = objectName.replace(/__r$/, '__c');
    }
    refs.add(objectName);
  }

  return Array.from(refs);
}

export { parseFieldMetadata, extractFormulaObjectReferences };
