import { EFFECT_HOOK_NAMES } from "../../constants/react.js";
import { areExpressionsStructurallyEqual } from "../../utils/are-expressions-structurally-equal.js";
import { defineRule } from "../../utils/define-rule.js";
import { getEffectCallback } from "../../utils/get-effect-callback.js";
import { isHookCall } from "../../utils/is-hook-call.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import { walkAst } from "../../utils/walk-ast.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { type ComponentBindingTable } from "./utils/effect/analyze-component-bindings.js";
import { classifyDepsArrayUpstream } from "./utils/effect/classify-effect-callee-argument.js";
import { createEffectAnalyzerTracker } from "./utils/effect/create-effect-analyzer-tracker.js";
import { getEffectDepsArray } from "./utils/effect/get-effect-deps-array.js";

// 1:1 port of upstream `no-reset-all-state-on-prop-change`.
// Detector: every useState binding in the surrounding component is
// re-set to its initial value inside this useEffect, and the deps
// array contains a prop. Skips custom hooks (they can't receive a
// `key` prop).

const isUndefinedNode = (node: EsTreeNode | null | undefined): boolean => {
  if (!node) return true;
  if (isNodeOfType(node, "Identifier") && node.name === "undefined") return true;
  return false;
};

// Extended structural equality that handles the common
// useState-initial-value shapes: undefined sentinel, empty literals,
// empty arrays/objects, member chains, call expressions. Falls back
// to the shared `areExpressionsStructurallyEqual` for everything else.
const isResetToInitialValue = (
  setterArg: EsTreeNode | null | undefined,
  stateInit: EsTreeNode | null | undefined,
): boolean => {
  if (isUndefinedNode(setterArg) && isUndefinedNode(stateInit)) return true;
  if (!setterArg || !stateInit) return false;
  if (areExpressionsStructurallyEqual(setterArg, stateInit)) return true;
  // Empty object literals
  if (
    isNodeOfType(setterArg, "ObjectExpression") &&
    isNodeOfType(stateInit, "ObjectExpression") &&
    (setterArg.properties?.length ?? 0) === 0 &&
    (stateInit.properties?.length ?? 0) === 0
  ) {
    return true;
  }
  // Empty array literals
  if (
    isNodeOfType(setterArg, "ArrayExpression") &&
    isNodeOfType(stateInit, "ArrayExpression") &&
    (setterArg.elements?.length ?? 0) === 0 &&
    (stateInit.elements?.length ?? 0) === 0
  ) {
    return true;
  }
  return false;
};

// Find the prop name (in source code) that upstream-resolves a dep
// to a prop. Used for the diagnostic data.
const findResettingPropName = (
  depsArray: EsTreeNodeOfType<"ArrayExpression">,
  table: ComponentBindingTable,
): string | null => {
  for (const element of depsArray.elements ?? []) {
    if (!element) continue;
    if (isNodeOfType(element, "Identifier") && table.propNames.has(element.name)) {
      return element.name;
    }
    if (isNodeOfType(element, "MemberExpression")) {
      let cursor: EsTreeNode = element;
      while (isNodeOfType(cursor, "MemberExpression")) cursor = cursor.object;
      if (isNodeOfType(cursor, "Identifier") && table.propNames.has(cursor.name)) {
        return cursor.name;
      }
    }
  }
  return null;
};

const collectDirectStateSetterCallsInEffect = (
  callback: EsTreeNode,
  table: ComponentBindingTable,
): EsTreeNodeOfType<"CallExpression">[] => {
  const setterCalls: EsTreeNodeOfType<"CallExpression">[] = [];
  walkAst(callback, (child: EsTreeNode) => {
    if (!isNodeOfType(child, "CallExpression")) return;
    if (!isNodeOfType(child.callee, "Identifier")) return;
    if (!table.stateSetterNames.has(child.callee.name)) return;
    setterCalls.push(child);
  });
  return setterCalls;
};

const analyzeEffect = (
  context: RuleContext,
  effectCall: EsTreeNodeOfType<"CallExpression">,
  table: ComponentBindingTable,
): void => {
  // Skip custom hooks — they can't receive a `key` prop.
  if (table.containingFunctionKind === "hook") return;
  if ((effectCall.arguments?.length ?? 0) < 2) return;
  const callback = getEffectCallback(effectCall);
  if (!callback) return;
  const depsArray = getEffectDepsArray(effectCall);
  if (!depsArray) return;

  const setterCalls = collectDirectStateSetterCallsInEffect(callback, table);
  if (setterCalls.length === 0) return;
  if (setterCalls.length !== table.useStateBindings.length) return;

  const allAreResets = setterCalls.every((setterCall) => {
    if (!isNodeOfType(setterCall.callee, "Identifier")) return false;
    const binding = table.useStateBindingBySetterName.get(setterCall.callee.name);
    if (!binding) return false;
    return isResetToInitialValue(setterCall.arguments?.[0] ?? null, binding.initializer);
  });
  if (!allAreResets) return;

  const depsClassification = classifyDepsArrayUpstream(depsArray, table);
  if (!depsClassification.hasPropUpstream) return;

  const propName = findResettingPropName(depsArray, table) ?? "<prop>";

  context.report({
    node: effectCall,
    message: `Avoid resetting all state when a prop changes. Instead, if "${propName}" is a key, pass it as \`key\` so React will reset the component's state.`,
  });
};

export const noResetAllStateOnPropChange = defineRule<Rule>({
  id: "no-reset-all-state-on-prop-change",
  severity: "warn",
  recommendation:
    "Pass the prop as `key` so React resets the component when the prop changes, instead of manually resetting every state value in a useEffect. See https://react.dev/learn/you-might-not-need-an-effect#resetting-all-state-when-a-prop-changes",
  create: (context: RuleContext) => {
    const tracker = createEffectAnalyzerTracker();
    return {
      ...tracker.visitors,
      CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
        if (!isHookCall(node, EFFECT_HOOK_NAMES)) return;
        const table = tracker.getCurrentTable();
        if (!table) return;
        analyzeEffect(context, node, table);
      },
    };
  },
});
