import { EFFECT_HOOK_NAMES } from "../../constants/react.js";
import { defineRule } from "../../utils/define-rule.js";
import { getEffectCallback } from "../../utils/get-effect-callback.js";
import { isHookCall } from "../../utils/is-hook-call.js";
import { isNodeOfType } from "../../utils/is-node-of-type.js";
import { walkAst } from "../../utils/walk-ast.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import {
  isStateSetterCallByName,
  type ComponentBindingTable,
} from "./utils/effect/analyze-component-bindings.js";
import { createEffectAnalyzerTracker } from "./utils/effect/create-effect-analyzer-tracker.js";
import { getEffectDepsArray } from "./utils/effect/get-effect-deps-array.js";
import { isSynchronous } from "./utils/effect/is-synchronous.js";
import { stringifyExpressionSnippet } from "./utils/effect/stringify-expression-snippet.js";

// 1:1 port of upstream `no-initialize-state`. Mount-only useEffect
// (empty deps, or deps containing only state-setter references — both
// shapes signal "runs once on mount") that calls a state setter.
// The fix: initialize the useState directly.

const isMountOnlyDepsArray = (
  depsArray: EsTreeNodeOfType<"ArrayExpression">,
  table: ComponentBindingTable,
): boolean => {
  for (const element of depsArray.elements ?? []) {
    if (!element) continue;
    if (isNodeOfType(element, "Identifier") && table.stateSetterNames.has(element.name)) {
      continue;
    }
    return false;
  }
  return true;
};

const analyzeEffect = (
  context: RuleContext,
  effectCall: EsTreeNodeOfType<"CallExpression">,
  table: ComponentBindingTable,
): void => {
  if ((effectCall.arguments?.length ?? 0) < 2) return;
  const callback = getEffectCallback(effectCall);
  if (!callback) return;
  const depsArray = getEffectDepsArray(effectCall);
  if (!depsArray) return;
  if (!isMountOnlyDepsArray(depsArray, table)) return;

  walkAst(callback, (child: EsTreeNode) => {
    if (!isNodeOfType(child, "CallExpression")) return;
    if (!isNodeOfType(child.callee, "Identifier")) return;
    const calleeName = child.callee.name;
    if (!isStateSetterCallByName(calleeName, table)) return;
    if (!isSynchronous(child, callback)) return;

    const binding = table.useStateBindingBySetterName.get(calleeName);
    const stateName = binding?.valueName ?? calleeName;
    const argumentText = stringifyExpressionSnippet(child.arguments?.[0] ?? null);

    context.report({
      node: child,
      message: `Avoid initializing state in an effect. Instead, initialize "${stateName}"'s \`useState()\` with "${argumentText}". For SSR hydration, prefer \`useSyncExternalStore()\`.`,
    });
  });
};

export const noInitializeState = defineRule<Rule>({
  id: "no-initialize-state",
  severity: "warn",
  recommendation:
    "Pass the initial value directly to `useState()` instead of setting it from a mount-only useEffect. For SSR hydration, prefer `useSyncExternalStore()`.",
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
