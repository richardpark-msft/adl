import { Path } from '@azure-tools/sourcemap';
import { fail } from 'assert';
import { ClassDeclaration, EnumDeclaration, EnumMember, ImportDeclarationStructure, InterfaceDeclaration, Node, printNode, Project, SourceFile, StructureKind, SyntaxList, ts, TypeAliasDeclaration, TypeNode, TypeParameterDeclaration, TypeReferenceNode, UnionTypeNode } from 'ts-morph';
import { ApiModel } from '../model/api-model';
import { TypeReference } from '../model/schema/type';
import { getAbsolutePath } from '../support/file-system';
import { createUnionTypeNode, TypeSyntax } from './codegen';
import { createSandbox } from './sandbox';

/**
 * A ts-morph type declaration node (used when trying to import things between files)
 */
export type TypeDeclaration = TypeAliasDeclaration | InterfaceDeclaration | ClassDeclaration | EnumDeclaration | ClassDeclaration;

const evaluateExpression = createSandbox();
function quote(text: string) {
  return JSON.stringify(text);
}
/**
 * returns the best possible identifier for the node
 * @param node the node to create an identifier for.
 */
export function getNodeIdentifier(node: Node) {
  // for some nodes, we have to give it an expression that can
  // effectively find the node we're looking for.
  // this can be far more reliable than using the name or index
  // as a means to find something.
  switch (node.getKindName()) {
    case 'SourceFile':
      return (<any>node).getFilePath();

    case 'EnumMember':
      return `$.getMember(${quote((<EnumMember>node).getName())})`;

    case 'EnumDeclaration':
      return `$.getEnum(${quote((<EnumDeclaration>node).getName())})`;
  }

  // otherwise, just use the name of the node, or the value, or the index in the list of children
  return (<any>node).getName ? (<any>node).getName() :
    (<any>node).getValue ? (<any>node).getValue() :
      node.getChildIndex();
}
/**
 * returns a Path to the node that we can use to find it again.
 *
 * @param node the node to create the path for.
 */
export function getPath(node: Node, ...args: Path): Path {
  return [...node.getAncestors().map(getNodeIdentifier), getNodeIdentifier(node), ...args];
}

/**
 * gets the node, given the path and the node/project it is relative to.
 */
export function getNode(path: Path, from: Node | Project): Node | undefined {
  let index = path.shift();
  if (from instanceof Project) {
    from = from.getSourceFile(<string>index)?.getChildAtIndex(0) || fail(`SourceFile ${<string>index} is not in the project`);
    index = path.shift();
  }
  let result: Node | undefined;

  // if the path leads us to an expression that needs to evaluate
  if (typeof index === 'string' && index.startsWith('$.')) {
    console.log(`executing ${index}`);
    result = evaluateExpression(index, { $: from instanceof SyntaxList ? from.getParent() : from });
  }

  // otherwise, just try to find it in the children
  if (result === undefined) {
    result = from.getChildren().find((each: any) => {
      if ((<any>each).getName && (<any>each).getName() === index) {
        return true;
      }
      if ((<any>each).getValue && (<any>each).getValue() === index) {
        return true;
      }
      return false;
    }) || (typeof index === 'number' ? from.getChildAtIndex(index) : undefined);
  }

  return result && path.length ? getNode(path, result) : result;
}

/**
 * Creates a reference to the node that will reacquire the target if the AST forces the node object to be forgotten or invalid.
 *
 * @param input the node to create a reference for.
 */
export function referenceTo<T extends Node>(input: T): T {
  const project = input.getProject();
  let current = input;
  const path = getPath(input);

  return new Proxy(input, {
    get: (originalTarget: T, property: keyof T, proxy: T): any => {
      return Reflect.get(current.wasForgotten() ? (current = <T>getNode([...path], project)) : current, property);
    },
    getOwnPropertyDescriptor: (originalTarget: T, property: keyof T) => {
      return Reflect.getOwnPropertyDescriptor(current.wasForgotten() ? (current = <T>getNode([...path], project)) : current, property);
    },
    has: (originalTarget: T, property: keyof T): boolean => {
      return Reflect.has(current.wasForgotten() ? (current = <T>getNode([...path], project)) : current, property);
    },
    set: (originalTarget: T, property: keyof T, value: any, receiver: any) => {
      return Reflect.set(current.wasForgotten() ? (current = <T>getNode([...path], project)) : current, property, value);
    }
  });
}

export function getAPI<T extends Node>(input: T): ApiModel {
  return (<any>input.getProject()).api;
}

export function IsTypeDeclaration(node?: Node): node is TypeDeclaration {
  return node instanceof TypeAliasDeclaration || node instanceof ClassDeclaration || node instanceof InterfaceDeclaration || node instanceof EnumDeclaration;
}

export function createImportFor(name: string, sourceFile: SourceFile, relativeToSourceFile: SourceFile): ImportDeclarationStructure {
  return {
    kind: StructureKind.ImportDeclaration,
    namedImports: [name],
    moduleSpecifier: relativeToSourceFile.getRelativePathAsModuleSpecifierTo(sourceFile)
  };
}

export function addImportsTo(sourceFile: SourceFile, imports: Array<ImportDeclarationStructure>) {
  const set = new Set<string>();
  for (const each of sourceFile.getImportDeclarations().map(d => d.getStructure())) {
    set.add(JSON.stringify(each));
  }

  const unique = new Array<ImportDeclarationStructure>();
  for (const each of imports) {
    const id = JSON.stringify(each);
    if (!set.has(id)) {
      set.add(id);
      unique.push(each);
    }
  }

  sourceFile.addImportDeclarations(unique);
}

export function createImportsFor(sourceFile: SourceFile, typeReference: TypeReference): Array<ImportDeclarationStructure> {
  const result = new Array<ImportDeclarationStructure>();

  const impl = (typeReference: TypeReference) => {
    if (typeReference.sourceFile && sourceFile !== typeReference.sourceFile && ts.isTypeReferenceNode(typeReference.declaration.node)) {
      const typeName = printNode(typeReference.declaration.node.typeName);
      const importDecls = sourceFile.getImportDeclarations();
      result.push(createImportFor(typeName, typeReference.sourceFile, sourceFile));
    }

    // now, add any requiredTypes to this file too.
    for (const each of typeReference.requiredReferences) {
      impl(each);
    }
  };

  impl(typeReference);
  return result;
}

export function addNullable(typeReference: TypeReference): TypeReference {
  return {
    ...typeReference,
    sourceFile: undefined,
    requiredReferences: [typeReference],
    declaration: new TypeSyntax(createUnionTypeNode(typeReference.declaration.node, ts.createKeywordTypeNode(ts.SyntaxKind.NullKeyword)))
  };
}

export function getInnerText(declaration: InterfaceDeclaration) {
  const text = declaration.getText();
  return text.substring(text.indexOf('{'));
}

export function expandUnion(node: UnionTypeNode): Array<TypeNode> {
  return node.getTypeNodes().map(each => Node.isUnionTypeNode(each) ? expandUnion(each) : each).flat();
}

export function getDefinition(node: TypeReferenceNode): Node {
  const typeName = node.getTypeName();
  const declarations = typeName.getSymbol()?.getDeclarations();

  if (!declarations) {
    throw new Error(`Cannot resolve type reference '${typeName}'.`);
  }

  if (declarations.length != 1) {
    throw new Error(`Ambiguous type reference '${typeName}'.`);
  }

  return declarations[0];
}

export function expandLiterals(node: Node, allowNumbers: false): Array<string | TypeParameterDeclaration>
export function expandLiterals(node: Node, allowNumbers?: boolean): Array<string | number | TypeParameterDeclaration>
export function expandLiterals(node: Node, allowNumbers?: boolean): Array<string | number | TypeParameterDeclaration> {
  allowNumbers = allowNumbers ?? true;

  if (Node.isLiteralTypeNode(node)) {
    const literal = node.getLiteral();
    if ((Node.isNumericLiteral(literal) && allowNumbers) || Node.isStringLiteral(literal)) {
      return [literal.getLiteralValue()];
    }
    fail(`unexpected literal type '${literal.getKindName()}' `);
  }

  if (Node.isTypeReferenceNode(node)) {
    const definition = getDefinition(node);
    if (Node.isTypeAliasDeclaration(definition)) {
      return expandLiterals(definition.getTypeNodeOrThrow(), allowNumbers);
    }
    if (Node.isTypeParameterDeclaration(definition)) {
      return [definition];
    }
    fail(`unsupported type reference node '${definition.getKindName()}' `);
  }

  if (Node.isUnionTypeNode(node)) {
    return expandUnion(node).map(each => expandLiterals(each, allowNumbers)).flat();
  }

  fail(`unsupported type for expandLiterals '${node.getKindName()}' `);
}

// Add a couple properties onto ts-morph's SourceFile so we can get back more useful paths.
Object.defineProperties(SourceFile.prototype, {
  relativePath: {
    get() {
      // returns a relative path from the root (starts with './' )
      return this.getFilePath().replace(/(^\/)|(^\w)/, './$2');
    }
  },
  fullPath: {
    get() {
      // returns the full path based on the project that it's in.
      return getAbsolutePath((<ApiModel>this.getProject().api).fileSystem,this.relativePath);
    }
  }
});