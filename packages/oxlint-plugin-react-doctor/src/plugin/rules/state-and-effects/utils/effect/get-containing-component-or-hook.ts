import type { EsTreeNode } from "../../../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../../../utils/es-tree-node-of-type.js";
import { isNodeOfType } from "../../../../utils/is-node-of-type.js";
import { isUppercaseName } from "../../../../utils/is-uppercase-name.js";
import { isCustomHookName } from "./is-custom-hook-name.js";

export type ContainingFunctionKind = "component" | "hoc" | "hook";

export interface ContainingFunctionInfo {
  kind: ContainingFunctionKind;
  // The function node itself — either a FunctionDeclaration, an
  // ArrowFunctionExpression or a FunctionExpression wrapped by an
  // HOC call.
  functionNode:
    | EsTreeNodeOfType<"FunctionDeclaration">
    | EsTreeNodeOfType<"FunctionExpression">
    | EsTreeNodeOfType<"ArrowFunctionExpression">;
}

// Pure-HOC list mirrors upstream's `knownPureHocs` in `react.js` —
// these wrappers do not change prop semantics, so the inner function
// is still a regular component.
const PURE_HOC_CALLEE_NAMES = new Set(["memo", "forwardRef"]);

const isFunctionLike = (
  node: EsTreeNode | null | undefined,
): node is
  | EsTreeNodeOfType<"FunctionDeclaration">
  | EsTreeNodeOfType<"FunctionExpression">
  | EsTreeNodeOfType<"ArrowFunctionExpression"> =>
  Boolean(node) &&
  (isNodeOfType(node, "FunctionDeclaration") ||
    isNodeOfType(node, "FunctionExpression") ||
    isNodeOfType(node, "ArrowFunctionExpression"));

const getOuterCallExpressionWrapper = (
  functionNode: EsTreeNode,
): EsTreeNodeOfType<"CallExpression"> | null => {
  let cursor: EsTreeNode | null | undefined = functionNode.parent;
  // Walk over any number of nested CallExpression wrappers — the
  // OUTERMOST one is the one whose callee gives the HOC name.
  let outermost: EsTreeNodeOfType<"CallExpression"> | null = null;
  while (cursor && isNodeOfType(cursor, "CallExpression")) {
    outermost = cursor;
    cursor = cursor.parent;
  }
  return outermost;
};

const getCallExpressionCalleeName = (
  callExpression: EsTreeNodeOfType<"CallExpression">,
): string | null => {
  const callee = callExpression.callee;
  if (isNodeOfType(callee, "Identifier")) return callee.name;
  if (
    isNodeOfType(callee, "MemberExpression") &&
    isNodeOfType(callee.property, "Identifier") &&
    !callee.computed
  ) {
    return callee.property.name;
  }
  return null;
};

const classifyFunctionAtDeclarationSite = (
  functionNode:
    | EsTreeNodeOfType<"FunctionDeclaration">
    | EsTreeNodeOfType<"FunctionExpression">
    | EsTreeNodeOfType<"ArrowFunctionExpression">,
): ContainingFunctionKind | null => {
  if (isNodeOfType(functionNode, "FunctionDeclaration")) {
    if (!functionNode.id) return null;
    const name = functionNode.id.name;
    if (isCustomHookName(name)) return "hook";
    if (isUppercaseName(name)) return "component";
    return null;
  }

  // ArrowFunctionExpression / FunctionExpression — look at the
  // declaring VariableDeclarator (possibly wrapped in HOC calls).
  let declarator: EsTreeNode | null | undefined = functionNode.parent;
  while (declarator && isNodeOfType(declarator, "CallExpression")) {
    declarator = declarator.parent;
  }

  if (!isNodeOfType(declarator, "VariableDeclarator")) return null;
  if (!isNodeOfType(declarator.id, "Identifier")) return null;

  const name = declarator.id.name;
  if (isCustomHookName(name)) return "hook";
  if (!isUppercaseName(name)) return null;

  // The id is uppercase — it's at least a component. Check whether
  // there's an HOC wrapper.
  const outerCall = getOuterCallExpressionWrapper(functionNode);
  if (!outerCall) return "component";

  const calleeName = getCallExpressionCalleeName(outerCall);
  if (calleeName !== null && PURE_HOC_CALLEE_NAMES.has(calleeName)) return "component";
  return "hoc";
};

export const getContainingComponentOrHook = (
  node: EsTreeNode,
): ContainingFunctionInfo | null => {
  let cursor: EsTreeNode | null | undefined = node.parent;
  while (cursor) {
    if (isFunctionLike(cursor)) {
      const kind = classifyFunctionAtDeclarationSite(cursor);
      if (kind) return { kind, functionNode: cursor };
    }
    cursor = cursor.parent;
  }
  return null;
};
