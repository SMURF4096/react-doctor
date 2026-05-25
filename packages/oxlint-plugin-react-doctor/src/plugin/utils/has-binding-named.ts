import { collectPatternNames } from "./collect-pattern-names.js";
import type { EsTreeNode } from "./es-tree-node.js";
import { isAstNode } from "./is-ast-node.js";

// Walks the AST collecting every identifier name that appears as a
// binding — `var`/`let`/`const`/parameter/import/function/class name,
// including destructured names. Approximates what oxc_semantic gives us
// for free; used by rules that need to know whether a name like `React`
// or a local variable is in scope without a full scope-resolution pass.
//
// HACK: This is a SIMPLE walk — it does not respect scopes. A binding
// declared anywhere in the file matches everywhere. That's fine for the
// cases we care about (top-level pragma-style names like `React`,
// `Children`, etc.) and matches OXC's behavior for those tests.
export const hasBindingNamed = (root: EsTreeNode, bindingName: string): boolean => {
  const collected = new Set<string>();
  const visit = (node: EsTreeNode): void => {
    switch (node.type) {
      case "VariableDeclarator":
        if ("id" in node && node.id)
          collectPatternNames(node.id as EsTreeNode, collected);
        break;
      case "FunctionDeclaration":
      case "FunctionExpression":
      case "ClassDeclaration":
      case "ClassExpression":
        if ("id" in node && node.id && (node.id as EsTreeNode).type === "Identifier") {
          const idNode = node.id as { name?: string };
          if (typeof idNode.name === "string") collected.add(idNode.name);
        }
        break;
      case "ArrowFunctionExpression":
        break;
      case "ImportDefaultSpecifier":
      case "ImportNamespaceSpecifier":
      case "ImportSpecifier":
        if ("local" in node && node.local && (node.local as EsTreeNode).type === "Identifier") {
          const local = node.local as { name?: string };
          if (typeof local.name === "string") collected.add(local.name);
        }
        break;
      case "TSImportEqualsDeclaration":
      case "TSEnumDeclaration":
      case "TSTypeAliasDeclaration":
      case "TSInterfaceDeclaration":
      case "TSModuleDeclaration": {
        const idNode = (node as { id?: EsTreeNode }).id;
        if (idNode && idNode.type === "Identifier") {
          const idObject = idNode as { name?: string };
          if (typeof idObject.name === "string") collected.add(idObject.name);
        }
        break;
      }
      default:
        break;
    }
    // Function/method parameters
    if (
      "params" in node &&
      Array.isArray((node as { params?: ReadonlyArray<EsTreeNode> }).params)
    ) {
      for (const param of (node as { params: ReadonlyArray<EsTreeNode> }).params) {
        collectPatternNames(param, collected);
      }
    }
    if (collected.has(bindingName)) return;

    const nodeRecord = node as unknown as Record<string, unknown>;
    for (const key of Object.keys(nodeRecord)) {
      if (key === "parent") continue;
      const child = nodeRecord[key];
      if (Array.isArray(child)) {
        for (const item of child) if (isAstNode(item)) visit(item);
      } else if (isAstNode(child)) {
        visit(child);
      }
      if (collected.has(bindingName)) return;
    }
  };
  visit(root);
  return collected.has(bindingName);
};
