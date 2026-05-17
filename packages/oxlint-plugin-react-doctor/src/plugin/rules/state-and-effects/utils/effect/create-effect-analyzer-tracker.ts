import type { EsTreeNode } from "../../../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../../../utils/es-tree-node-of-type.js";
import { isNodeOfType } from "../../../../utils/is-node-of-type.js";
import { isUppercaseName } from "../../../../utils/is-uppercase-name.js";
import type { RuleVisitors } from "../../../../utils/rule-visitors.js";
import { isCustomHookName } from "./is-custom-hook-name.js";
import {
  buildComponentBindingTable,
  type ComponentBindingTable,
} from "./analyze-component-bindings.js";
import type { ContainingFunctionKind } from "./get-containing-component-or-hook.js";

interface EffectAnalyzerFrame {
  table: ComponentBindingTable;
}

export interface EffectAnalyzerTracker {
  visitors: RuleVisitors;
  getCurrentTable: () => ComponentBindingTable | null;
}

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

  let declarator: EsTreeNode | null | undefined = functionNode.parent;
  while (declarator && isNodeOfType(declarator, "CallExpression")) {
    declarator = declarator.parent;
  }

  if (!isNodeOfType(declarator, "VariableDeclarator")) return null;
  if (!isNodeOfType(declarator.id, "Identifier")) return null;

  const name = declarator.id.name;
  if (isCustomHookName(name)) return "hook";
  if (!isUppercaseName(name)) return null;

  const outerCall = getOuterCallExpressionWrapper(functionNode);
  if (!outerCall) return "component";

  const calleeName = getCallExpressionCalleeName(outerCall);
  if (calleeName !== null && PURE_HOC_CALLEE_NAMES.has(calleeName)) return "component";
  return "hoc";
};

// Maintains a stack of `EffectAnalyzerFrame` frames keyed on every
// component / hook / HOC-wrapped function entered during traversal.
// `getCurrentTable()` returns the innermost frame's table or `null`
// if not inside a tracked function — used by the per-rule visitor to
// decide whether to analyze the current `useEffect` call.
//
// Single-frame model matches the upstream's "containing component" view:
// when nested functions are encountered (helper arrows inside a
// component), we DON'T push a new frame — only declared
// components/hooks/HOCs do — so a `useEffect` inside a nested helper
// still resolves to its outer component's binding table. This matches
// the rules-of-hooks expectation that useEffect is called at the top
// of a component / hook.
export const createEffectAnalyzerTracker = (): EffectAnalyzerTracker => {
  const frameStack: EffectAnalyzerFrame[] = [];
  const frameOwners = new WeakMap<EsTreeNode, EffectAnalyzerFrame>();

  const enterFunction = (
    functionNode:
      | EsTreeNodeOfType<"FunctionDeclaration">
      | EsTreeNodeOfType<"FunctionExpression">
      | EsTreeNodeOfType<"ArrowFunctionExpression">,
  ): void => {
    const kind = classifyFunctionAtDeclarationSite(functionNode);
    if (!kind) return;
    const body = functionNode.body;
    if (!body) return;
    const table = buildComponentBindingTable({
      containingFunctionKind: kind,
      functionNode,
      componentBody: body,
    });
    const frame: EffectAnalyzerFrame = { table };
    frameStack.push(frame);
    frameOwners.set(functionNode, frame);
  };

  const exitFunction = (functionNode: EsTreeNode): void => {
    const frame = frameOwners.get(functionNode);
    if (!frame) return;
    const lastIndex = frameStack.lastIndexOf(frame);
    if (lastIndex >= 0) frameStack.splice(lastIndex, 1);
    frameOwners.delete(functionNode);
  };

  const wrapFunctionVisitor = (selector: string): ((node: EsTreeNode) => void) => {
    return (node: EsTreeNode) => {
      if (!isFunctionLike(node)) return;
      enterFunction(node);
      // Bind name for runtime — selector is consumed only via the
      // closure for `:exit` parity below.
      void selector;
    };
  };

  const wrapFunctionExitVisitor = (): ((node: EsTreeNode) => void) => {
    return (node: EsTreeNode) => {
      if (!isFunctionLike(node)) return;
      exitFunction(node);
    };
  };

  const visitors: RuleVisitors = {
    FunctionDeclaration: wrapFunctionVisitor("FunctionDeclaration"),
    "FunctionDeclaration:exit": wrapFunctionExitVisitor(),
    FunctionExpression: wrapFunctionVisitor("FunctionExpression"),
    "FunctionExpression:exit": wrapFunctionExitVisitor(),
    ArrowFunctionExpression: wrapFunctionVisitor("ArrowFunctionExpression"),
    "ArrowFunctionExpression:exit": wrapFunctionExitVisitor(),
  };

  return {
    visitors,
    getCurrentTable: () => {
      if (frameStack.length === 0) return null;
      return frameStack[frameStack.length - 1].table;
    },
  };
};
