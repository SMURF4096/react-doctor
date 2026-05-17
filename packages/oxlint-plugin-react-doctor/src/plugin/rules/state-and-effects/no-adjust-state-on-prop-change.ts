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
import {
  classifyDepsArrayUpstream,
  classifyExpressionUpstream,
} from "./utils/effect/classify-effect-callee-argument.js";
import { createEffectAnalyzerTracker } from "./utils/effect/create-effect-analyzer-tracker.js";
import { getEffectDepsArray } from "./utils/effect/get-effect-deps-array.js";
import { isSynchronous } from "./utils/effect/is-synchronous.js";

// 1:1 port of upstream `no-adjust-state-on-prop-change`. Detector:
//   - useEffect with deps that includes a prop upstream,
//   - state setter called synchronously inside the effect body,
//   - that setter's args do NOT have a prop upstream (avoiding overlap
//     with the derived-state diagnostic).
// Note: upstream does NOT skip on cleanup return.

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

  const depsClassification = classifyDepsArrayUpstream(depsArray, table);
  if (!depsClassification.hasPropUpstream) return;

  walkAst(callback, (child: EsTreeNode) => {
    if (!isNodeOfType(child, "CallExpression")) return;
    if (!isNodeOfType(child.callee, "Identifier")) return;
    if (!isStateSetterCallByName(child.callee.name, table)) return;
    if (!isSynchronous(child, callback)) return;

    const argument = child.arguments?.[0];
    const argClassification = argument
      ? classifyExpressionUpstream(argument, table)
      : { hasPropUpstream: false };
    if (argClassification.hasPropUpstream) return;

    context.report({
      node: child,
      message:
        "Avoid adjusting state when a prop changes. Instead, adjust the state directly during render, or refactor your state to avoid this need entirely.",
    });
  });
};

export const noAdjustStateOnPropChange = defineRule<Rule>({
  id: "no-adjust-state-on-prop-change",
  severity: "warn",
  recommendation:
    "Compute the adjustment inline during render: `const adjusted = derive(prop, state)`. See https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes",
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
