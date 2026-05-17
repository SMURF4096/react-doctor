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
  isPropCallByName,
  type ComponentBindingTable,
} from "./utils/effect/analyze-component-bindings.js";
import { classifyExpressionUpstream } from "./utils/effect/classify-effect-callee-argument.js";
import { createEffectAnalyzerTracker } from "./utils/effect/create-effect-analyzer-tracker.js";
import { isSynchronous } from "./utils/effect/is-synchronous.js";

// 1:1 port of upstream `no-pass-live-state-to-parent`. A prop callback
// invoked synchronously inside a useEffect with state in the argument
// upstream is treated as "informing the parent of local state" — the
// fix is to lift the state. Custom hooks get the alternative message
// because they can't lift — they should return the state instead.

const analyzeEffect = (
  context: RuleContext,
  effectCall: EsTreeNodeOfType<"CallExpression">,
  table: ComponentBindingTable,
): void => {
  const callback = getEffectCallback(effectCall);
  if (!callback) return;

  const isInsideHook = table.containingFunctionKind === "hook";

  walkAst(callback, (child: EsTreeNode) => {
    if (!isNodeOfType(child, "CallExpression")) return;
    let calleeName: string | null = null;
    if (isNodeOfType(child.callee, "Identifier")) calleeName = child.callee.name;
    if (
      isNodeOfType(child.callee, "MemberExpression") &&
      isNodeOfType(child.callee.object, "Identifier")
    ) {
      calleeName = child.callee.object.name;
    }
    if (!calleeName) return;
    if (!isPropCallByName(calleeName, table)) return;
    if (!isSynchronous(child, callback)) return;

    const argument = child.arguments?.[0];
    if (!argument) return;
    const argClassification = classifyExpressionUpstream(argument, table);
    if (!argClassification.hasStateUpstream) return;

    context.report({
      node: child,
      message: isInsideHook
        ? "Avoid passing live state to parents in an effect. Instead, return the state from the hook."
        : "Avoid passing live state to parents in an effect. Instead, lift the state to the parent and pass it down to the child as a prop.",
    });
  });
};

export const noPassLiveStateToParent = defineRule<Rule>({
  id: "no-pass-live-state-to-parent",
  severity: "warn",
  recommendation:
    "Lift the state to the parent component (or return it from the hook) instead of pushing it back up via a prop callback inside an effect. See https://react.dev/learn/you-might-not-need-an-effect#notifying-parent-components-about-state-changes",
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
