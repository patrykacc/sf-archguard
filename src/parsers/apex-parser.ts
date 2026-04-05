/**
 * Apex Dependency Parser
 *
 * Parses .cls and .trigger files to extract dependency information.
 * Uses @apexdevtools/apex-parser (ANTLR4-based) to build a concrete
 * parse tree, then walks it with a visitor to extract:
 *   - Class/interface inheritance (extends, implements)
 *   - Type references (variable declarations, method params, return types, casts, instanceof)
 *   - Object instantiation (new ClassName(...))
 *   - Static method invocations (ClassName.methodName())
 *   - SObject references in SOQL (FROM Object__c)
 *   - Trigger SObject targets (trigger X on SObject)
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import {
  ApexParserFactory,
  ApexParserBaseVisitor,
  ClassDeclarationContext,
  TypeRefContext,
  NewExpressionContext,
  DotExpressionContext,
  TriggerUnitContext,
  FromNameListContext,
  PrimaryExpressionContext,
  IdPrimaryContext,
  FieldDeclarationContext,
  FormalParameterContext,
  LocalVariableDeclarationContext,
  MethodDeclarationContext,
  ConstructorDeclarationContext,
} from '@apexdevtools/apex-parser';
import { GraphNode, GraphEdge, DependencyType, MetadataType } from '../types.js';
import { toPosixPath } from './path-utils.js';

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
 * Standard Salesforce/Apex built-in type names that are never user-defined classes.
 * Filtering these avoids cluttering the graph with unresolvable edges to stdlib types.
 * (List/Set/Map are grammar tokens, not identifiers, so the parser already skips them.)
 */
const STANDARD_TYPES = new Set([
  // Primitives
  'String', 'Integer', 'Long', 'Double', 'Decimal', 'Boolean',
  'Date', 'Datetime', 'Time', 'Id', 'Blob', 'Object', 'Void',
  // System namespaces / utility classes
  'System', 'Test', 'Assert', 'Database', 'Schema', 'Type', 'JSON',
  'Math', 'Limits', 'UserInfo', 'Trigger', 'ApexPages', 'Messaging',
  'URL', 'Http', 'HttpRequest', 'HttpResponse', 'RestRequest',
  'RestResponse', 'RestContext', 'EncodingUtil', 'Crypto', 'EventBus',
  'Platform', 'Auth', 'Cache', 'Formula', 'Label', 'Approval',
  // DML result types
  'SaveResult', 'UpsertResult', 'DeleteResult', 'UndeleteResult',
  // Describe / schema types
  'SObjectType', 'SObjectField', 'FieldSet', 'DescribeSObjectResult',
  'DescribeFieldResult', 'PicklistEntry', 'RecordTypeInfo',
  // Other common builtins
  'PageReference', 'SelectOption', 'SObject', 'AggregateResult',
  'ConnectApi', 'Metadata', 'Process', 'Flow', 'QuickAction',
  // Batch/Async interfaces
  'Batchable', 'Queueable', 'Schedulable',
  // Exceptions
  'Exception', 'DmlException', 'QueryException', 'NullPointerException',
  'TypeException', 'MathException', 'SecurityException',
]);

/**
 * Visits an Apex parse tree and collects all outbound dependency references.
 * Each instance is single-use (one class or trigger file).
 *
 * Symbol table design:
 *   - classFields: variable name → declared type, populated from field declarations,
 *     persists for the whole class.
 *   - methodScope: variable name → declared type, populated from method/constructor
 *     parameters and local variable declarations, reset on each method/constructor entry.
 *
 * Together these let visitDotExpression resolve whether a receiver identifier is a
 * known variable (skip) or an unresolved uppercase name (treat as class / static call),
 * removing the need for the pure-uppercase heuristic in the common cases.
 */
class DependencyVisitor extends ApexParserBaseVisitor<void> {
  readonly refs: ParsedReference[] = [];
  private readonly seen = new Set<string>();
  private readonly selfName: string;

  /** Class-level field names → declared type (populated once, never cleared). */
  private readonly classFields = new Map<string, string>();
  /** Current method/constructor scope: param + local variable names → declared type. */
  private methodScope = new Map<string, string>();

  constructor(selfName: string) {
    super();
    this.selfName = selfName;
  }

  // ── Symbol table population ──────────────────────────────────────────────

  /** Records class fields so dot-expression receivers can be identified as variables. */
  visitFieldDeclaration = (ctx: FieldDeclarationContext): void => {
    const typeName = this.rootIdOf(ctx.typeRef());
    if (typeName) {
      for (const decl of ctx.variableDeclarators().variableDeclarator_list()) {
        this.classFields.set(decl.id().getText(), typeName);
      }
    }
    this.visitChildren(ctx);
  };

  /** Resets the method scope and records parameters before visiting the body. */
  visitMethodDeclaration = (ctx: MethodDeclarationContext): void => {
    this.methodScope = new Map();
    const params = ctx.formalParameters()?.formalParameterList()?.formalParameter_list() ?? [];
    for (const p of params) this.recordParam(p);
    const body = ctx.block();
    if (body) this.visit(body);
  };

  /** Resets the method scope and records parameters before visiting the body. */
  visitConstructorDeclaration = (ctx: ConstructorDeclarationContext): void => {
    this.methodScope = new Map();
    const params = ctx.formalParameters()?.formalParameterList()?.formalParameter_list() ?? [];
    for (const p of params) this.recordParam(p);
    const body = ctx.block();
    if (body) this.visit(body);
  };

  /** Records local variable declarations into the current method scope. */
  visitLocalVariableDeclaration = (ctx: LocalVariableDeclarationContext): void => {
    const typeName = this.rootIdOf(ctx.typeRef());
    if (typeName) {
      for (const decl of ctx.variableDeclarators().variableDeclarator_list()) {
        this.methodScope.set(decl.id().getText(), typeName);
      }
    }
    this.visitChildren(ctx);
  };

  private recordParam(p: FormalParameterContext): void {
    const typeName = this.rootIdOf(p.typeRef());
    if (typeName) this.methodScope.set(p.id().getText(), typeName);
  }

  // ── Dependency extraction ────────────────────────────────────────────────

  /**
   * Handles class declaration header: extracts extends/implements as inheritance edges,
   * then recurses into the body only (skipping the header type refs to avoid
   * emitting a duplicate class-reference for the same targets).
   */
  visitClassDeclaration = (ctx: ClassDeclarationContext): void => {
    if (ctx.EXTENDS()) {
      const extendsRef = ctx.typeRef();
      if (extendsRef) {
        const name = this.rootIdOf(extendsRef);
        if (name) this.addRef(name, 'inheritance', extendsRef.start.line);
      }
    }

    if (ctx.IMPLEMENTS()) {
      const typeList = ctx.typeList();
      if (typeList) {
        for (const ref of typeList.typeRef_list()) {
          const name = this.rootIdOf(ref);
          if (name) this.addRef(name, 'inheritance', ref.start.line);
        }
      }
    }

    // Visit only the body — not the extends/implements type refs above
    const body = ctx.classBody();
    if (body) this.visit(body);
  };

  /**
   * Captures any type reference as a class-reference dependency.
   * Handles simple types (BillingService), generics (List<T>, Map<K,V>),
   * return types, parameter types, casts, and instanceof checks.
   */
  visitTypeRef = (ctx: TypeRefContext): void => {
    const name = this.rootIdOf(ctx);
    if (name) this.addRef(name, 'class-reference', ctx.start.line);
    // Recurse so generic type args (e.g. List<BillingService>) are also captured
    this.visitChildren(ctx);
  };

  /**
   * Captures object instantiation: new ClassName(...)
   */
  visitNewExpression = (ctx: NewExpressionContext): void => {
    const pairs = ctx.creator()?.createdName()?.idCreatedNamePair_list();
    if (pairs && pairs.length > 0) {
      const name = pairs[0].anyId()?.getText();
      if (name && name.length >= 2 && !STANDARD_TYPES.has(name)) {
        this.addRef(name, 'class-reference', ctx.start.line);
      }
    }
    this.visitChildren(ctx);
  };

  /**
   * Captures static method calls: ClassName.methodName(...)
   *
   * Resolution order:
   *   1. Known variable in method scope (param or local var) → skip (instance call)
   *   2. Known class field → skip (instance call)
   *   3. Known standard Salesforce type → skip
   *   4. Starts with uppercase → treat as class name (static call)
   *
   * The uppercase fallback still handles cases where the receiver type is
   * unresolvable without cross-file analysis (e.g. inherited fields, method
   * return type chaining).
   */
  visitDotExpression = (ctx: DotExpressionContext): void => {
    if (ctx.dotMethodCall()) {
      const expr = ctx.expression();
      if (expr instanceof PrimaryExpressionContext) {
        const primary = expr.primary();
        if (primary instanceof IdPrimaryContext) {
          const name = primary.id().getText();
          if (
            name &&
            !this.methodScope.has(name) &&
            !this.classFields.has(name) &&
            !STANDARD_TYPES.has(name) &&
            /^[A-Z]/.test(name)
          ) {
            this.addRef(name, 'method-invocation', ctx.start.line);
          }
        }
      }
    }
    this.visitChildren(ctx);
  };

  /**
   * Captures SOQL object references: SELECT ... FROM SObjectName
   */
  visitFromNameList = (ctx: FromNameListContext): void => {
    const soqlId = ctx.soqlId(0);
    if (soqlId) {
      const name = soqlId.getText();
      if (name && name.length >= 2) {
        this.addRef(name, 'class-reference', ctx.start.line);
      }
    }
    // No visitChildren — we only want the FROM target, not nested sub-queries
  };

  /**
   * Captures trigger SObject target: trigger X on SObjectName (...)
   * id(0) = trigger name, id(1) = SObject name
   */
  visitTriggerUnit = (ctx: TriggerUnitContext): void => {
    const sobject = ctx.id(1);
    if (sobject) {
      const name = sobject.getText();
      if (name) this.addRef(name, 'trigger-object', 1);
    }
    this.visitChildren(ctx);
  };

  /**
   * Returns the first user-defined identifier from a typeRef, or null for
   * built-in collection tokens (LIST/SET/MAP) and known standard Salesforce types.
   */
  private rootIdOf(ctx: TypeRefContext): string | null {
    const typeName = ctx.typeName(0);
    if (!typeName) return null;
    const id = typeName.id(); // null when it's a LIST/SET/MAP grammar token
    if (!id) return null;
    const name = id.getText();
    if (!name || name.length < 2) return null;
    if (STANDARD_TYPES.has(name)) return null;
    return name;
  }

  private addRef(name: string, depType: DependencyType, line: number): void {
    if (name === this.selfName) return;
    const key = `${name}::${depType}`;
    if (!this.seen.has(key)) {
      this.seen.add(key);
      this.refs.push({ targetName: name, dependencyType: depType, line });
    }
  }
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

  const clsFiles = await glob('**/*.cls', { cwd: absolutePath, absolute: false });
  const triggerFiles = await glob('**/*.trigger', { cwd: absolutePath, absolute: false });

  for (const file of clsFiles) {
    const fullPath = path.join(absolutePath, file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const className = path.basename(file, '.cls');
    const relativePath = toPosixPath(path.join(packagePath, file));

    nodes.push({
      name: className,
      type: 'apex-class' as MetadataType,
      packageName,
      filePath: relativePath,
    });

    const refs = extractClassReferences(content, className);
    for (const ref of refs) {
      edges.push({ from: className, to: ref.targetName, dependencyType: ref.dependencyType, line: ref.line });
    }
  }

  for (const file of triggerFiles) {
    const fullPath = path.join(absolutePath, file);
    const content = fs.readFileSync(fullPath, 'utf-8');
    const triggerName = path.basename(file, '.trigger');
    const relativePath = toPosixPath(path.join(packagePath, file));

    nodes.push({
      name: triggerName,
      type: 'apex-trigger' as MetadataType,
      packageName,
      filePath: relativePath,
    });

    const refs = extractTriggerReferences(content, triggerName);
    for (const ref of refs) {
      edges.push({ from: triggerName, to: ref.targetName, dependencyType: ref.dependencyType, line: ref.line });
    }
  }

  return { nodes, edges };
}

function extractClassReferences(content: string, className: string): ParsedReference[] {
  const parser = ApexParserFactory.createParser(content, false);
  const tree = parser.compilationUnit();
  const visitor = new DependencyVisitor(className);
  visitor.visit(tree);
  return visitor.refs;
}

function extractTriggerReferences(content: string, triggerName: string): ParsedReference[] {
  const parser = ApexParserFactory.createParser(content, false);
  const tree = parser.triggerUnit();
  const visitor = new DependencyVisitor(triggerName);
  visitor.visit(tree);
  return visitor.refs;
}
