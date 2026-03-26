/**
 * Apex Dependency Parser
 *
 * Parses .cls and .trigger files to extract dependency information.
 * Uses regex-based analysis (NOT full AST) to detect:
 *   - Class/interface inheritance (extends, implements)
 *   - Type references (variable declarations, method params, return types)
 *   - Static method invocations (ClassName.methodName())
 *   - Object type references in SOQL (FROM Object__c, etc.)
 *
 * Intentionally avoids style/complexity checks (PMD territory).
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { GraphNode, GraphEdge, DependencyType, MetadataType } from '../types.js';

export interface ApexParseResult {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

interface ParsedReference {
  targetName: string;
  dependencyType: DependencyType;
  line: number;
}

/**
 * Parses all Apex classes and triggers within a package folder.
 */
export async function parseApexPackage(
  projectRoot: string,
  packagePath: string,
  packageName: string
): Promise<ApexParseResult> {
  const absolutePath = path.join(projectRoot, packagePath);
  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];

  // Find all .cls and .trigger files
  const clsFiles = await glob('**/*.cls', { cwd: absolutePath, absolute: false });
  const triggerFiles = await glob('**/*.trigger', { cwd: absolutePath, absolute: false });

  for (const file of clsFiles) {
    const fullPath = path.join(absolutePath, file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const className = path.basename(file, '.cls');
    const relativePath = path.join(packagePath, file).replace(/\\/g, '/');

    nodes.push({
      name: className,
      type: 'apex-class' as MetadataType,
      packageName,
      filePath: relativePath,
    });

    const refs = extractApexReferences(content, className);
    for (const ref of refs) {
      edges.push({
        from: className,
        to: ref.targetName,
        dependencyType: ref.dependencyType,
        line: ref.line,
      });
    }
  }

  for (const file of triggerFiles) {
    const fullPath = path.join(absolutePath, file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const triggerName = path.basename(file, '.trigger');
    const relativePath = path.join(packagePath, file).replace(/\\/g, '/');

    nodes.push({
      name: triggerName,
      type: 'apex-trigger' as MetadataType,
      packageName,
      filePath: relativePath,
    });

    const refs = extractTriggerReferences(content, triggerName);
    for (const ref of refs) {
      edges.push({
        from: triggerName,
        to: ref.targetName,
        dependencyType: ref.dependencyType,
        line: ref.line,
      });
    }
  }

  return { nodes, edges };
}

/**
 * Extracts dependency references from an Apex class file.
 */
function extractApexReferences(content: string, selfName: string): ParsedReference[] {
  const refs: ParsedReference[] = [];
  const lines = content.split('\n');
  const seen = new Set<string>();

  // Strip comments and strings to avoid false positives
  const cleaned = stripCommentsAndStrings(content);
  const cleanedLines = cleaned.split('\n');

  for (let i = 0; i < cleanedLines.length; i++) {
    const line = cleanedLines[i];
    const lineNum = i + 1;

    // 1. Inheritance: extends ClassName / implements Interface1, Interface2
    const extendsMatch = line.match(/\bextends\s+([A-Z]\w+)/i);
    if (extendsMatch) {
      addRef(refs, seen, extendsMatch[1], 'inheritance', lineNum, selfName);
    }

    const implementsMatch = line.match(/\bimplements\s+([\w\s,]+)/i);
    if (implementsMatch) {
      const interfaces = implementsMatch[1].split(',').map((s) => s.trim()).filter(Boolean);
      for (const iface of interfaces) {
        const cleanName = iface.split(/\s/)[0]; // Take first word only
        if (isCustomClassName(cleanName)) {
          addRef(refs, seen, cleanName, 'inheritance', lineNum, selfName);
        }
      }
    }

    // 2. Type references in declarations: ClassName varName, List<ClassName>, Map<X, ClassName>
    const typeRefPattern = /\b([A-Z]\w+)\s+\w+\s*[;=,)]/g;
    let typeMatch;
    while ((typeMatch = typeRefPattern.exec(line)) !== null) {
      if (isCustomClassName(typeMatch[1])) {
        addRef(refs, seen, typeMatch[1], 'class-reference', lineNum, selfName);
      }
    }

    // 3. Generic type params: List<ClassName>, Map<String, ClassName>
    const genericPattern = /[<,]\s*([A-Z]\w+)\s*[>,]/g;
    let genericMatch;
    while ((genericMatch = genericPattern.exec(line)) !== null) {
      if (isCustomClassName(genericMatch[1])) {
        addRef(refs, seen, genericMatch[1], 'class-reference', lineNum, selfName);
      }
    }

    // 4. Static method calls: ClassName.methodName(
    const staticCallPattern = /\b([A-Z]\w+)\.(\w+)\s*\(/g;
    let staticMatch;
    while ((staticMatch = staticCallPattern.exec(line)) !== null) {
      if (isCustomClassName(staticMatch[1])) {
        addRef(refs, seen, staticMatch[1], 'method-invocation', lineNum, selfName);
      }
    }

    // 5. new ClassName(
    const newPattern = /\bnew\s+([A-Z]\w+)\s*\(/g;
    let newMatch;
    while ((newMatch = newPattern.exec(line)) !== null) {
      if (isCustomClassName(newMatch[1])) {
        addRef(refs, seen, newMatch[1], 'class-reference', lineNum, selfName);
      }
    }

    // 6. instanceof checks
    const instanceOfPattern = /\binstanceof\s+([A-Z]\w+)/g;
    let ioMatch;
    while ((ioMatch = instanceOfPattern.exec(line)) !== null) {
      if (isCustomClassName(ioMatch[1])) {
        addRef(refs, seen, ioMatch[1], 'class-reference', lineNum, selfName);
      }
    }

    // 7. Cast expressions: (ClassName)
    const castPattern = /\(\s*([A-Z]\w+)\s*\)\s*\w/g;
    let castMatch;
    while ((castMatch = castPattern.exec(line)) !== null) {
      if (isCustomClassName(castMatch[1])) {
        addRef(refs, seen, castMatch[1], 'class-reference', lineNum, selfName);
      }
    }

    // 8. SOQL references: FROM Object__c, TYPEOF, etc.
    const soqlFromPattern = /\bFROM\s+([A-Z]\w+)/gi;
    let soqlMatch;
    while ((soqlMatch = soqlFromPattern.exec(line)) !== null) {
      // SObject references in SOQL are treated as class-references
      // (they link to CustomObject metadata if it exists)
      addRef(refs, seen, soqlMatch[1], 'class-reference', lineNum, selfName);
    }
  }

  return refs;
}

/**
 * Extracts references from a trigger file.
 * Triggers have an additional pattern: trigger Name on SObject
 */
function extractTriggerReferences(content: string, selfName: string): ParsedReference[] {
  const refs: ParsedReference[] = [];
  const seen = new Set<string>();

  // Extract the SObject the trigger fires on
  const triggerDeclPattern = /\btrigger\s+\w+\s+on\s+([A-Z]\w+)/i;
  const triggerMatch = content.match(triggerDeclPattern);
  if (triggerMatch) {
    addRef(refs, seen, triggerMatch[1], 'trigger-object', 1, selfName);
  }

  // Then extract all other Apex references from the trigger body
  const apexRefs = extractApexReferences(content, selfName);
  for (const ref of apexRefs) {
    addRef(refs, seen, ref.targetName, ref.dependencyType, ref.line, selfName);
  }

  return refs;
}

/**
 * Adds a reference to the list if not already seen (deduplicates per target+type).
 * Skips self-references.
 */
function addRef(
  refs: ParsedReference[],
  seen: Set<string>,
  targetName: string,
  depType: DependencyType,
  line: number,
  selfName: string
): void {
  if (targetName === selfName) return;
  const key = `${targetName}::${depType}`;
  if (!seen.has(key)) {
    seen.add(key);
    refs.push({ targetName, dependencyType: depType, line });
  }
}

/**
 * Strips single-line comments, multi-line comments, and string literals
 * to avoid false positives from commented-out code or string content.
 */
function stripCommentsAndStrings(content: string): string {
  // Remove multi-line comments
  let result = content.replace(/\/\*[\s\S]*?\*\//g, (match) => {
    // Preserve line count for accurate line numbers
    return match.replace(/[^\n]/g, ' ');
  });

  // Remove single-line comments
  result = result.replace(/\/\/.*$/gm, '');

  // Remove string literals (single and double quoted)
  result = result.replace(/'(?:[^'\\]|\\.)*'/g, "''");
  result = result.replace(/"(?:[^"\\]|\\.)*"/g, '""');

  return result;
}

/**
 * Determines if a name looks like a custom Apex class (not a standard type).
 * Filters out Salesforce built-in types to reduce noise.
 */
function isCustomClassName(name: string): boolean {
  const STANDARD_TYPES = new Set([
    // Primitives
    'String', 'Integer', 'Long', 'Double', 'Decimal', 'Boolean', 'Date',
    'Datetime', 'Time', 'Id', 'Blob', 'Object', 'Void',
    // Collections
    'List', 'Set', 'Map',
    // System classes
    'System', 'Test', 'Assert', 'Database', 'Schema', 'Type', 'JSON',
    'Math', 'Limits', 'UserInfo', 'Trigger', 'ApexPages', 'Messaging',
    'URL', 'Http', 'HttpRequest', 'HttpResponse', 'RestRequest',
    'RestResponse', 'RestContext', 'EncodingUtil', 'Crypto', 'EventBus',
    'Platform', 'Auth', 'Cache', 'Formula', 'Label', 'Approval',
    // Exceptions
    'Exception', 'DmlException', 'QueryException', 'NullPointerException',
    'TypeException', 'MathException', 'SecurityException',
    // Describe types
    'SObjectType', 'SObjectField', 'FieldSet', 'DescribeSObjectResult',
    'DescribeFieldResult', 'PicklistEntry', 'RecordTypeInfo',
    // Batch/Queueable
    'Batchable', 'Queueable', 'Schedulable', 'Database',
    // DML
    'SaveResult', 'UpsertResult', 'DeleteResult', 'UndeleteResult',
    // Other common
    'PageReference', 'SelectOption', 'SObject', 'AggregateResult',
    'ConnectApi', 'Metadata', 'Process', 'Flow', 'QuickAction',
    // Standard SOQL keywords that look like types
    'FROM', 'WHERE', 'SELECT', 'INSERT', 'UPDATE', 'DELETE', 'UPSERT',
    'WITH', 'HAVING', 'GROUP', 'ORDER', 'LIMIT', 'OFFSET', 'TYPEOF',
    'TRUE', 'FALSE', 'NULL', 'LIKE', 'NOT', 'AND', 'INCLUDES',
  ]);

  if (!name || name.length < 2) return false;
  if (STANDARD_TYPES.has(name)) return false;

  // Must start with uppercase letter
  if (!/^[A-Z]/.test(name)) return false;

  return true;
}

export { isCustomClassName, stripCommentsAndStrings, extractApexReferences };
