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
import { hasEffectCleanup } from "./utils/effect/has-effect-cleanup.js";
import { isSynchronous } from "./utils/effect/is-synchronous.js";

// 1:1 port of upstream `no-chain-state-updates`. Upstream shape:
//   if some dep ref upstream is STATE
//   and some setter call inside the effect body is synchronous
//   and that setter call's args upstream is NOT state (so we don't
//     double-fire with no-derived-state)
//   → report avoidChainingStateUpdates.

const analyzeEffect = (
  context: RuleContext,
  effectCall: EsTreeNodeOfType<"CallExpression">,
  table: ComponentBindingTable,
): void => {
  if ((effectCall.arguments?.length ?? 0) < 2) return;
  const callback = getEffectCallback(effectCall);
  if (!callback) return;
  if (hasEffectCleanup(callback)) return;
  const depsArray = getEffectDepsArray(effectCall);
  if (!depsArray) return;

  const depsClassification = classifyDepsArrayUpstream(depsArray, table);
  if (!depsClassification.hasStateUpstream) return;

  walkAst(callback, (child: EsTreeNode) => {
    if (!isNodeOfType(child, "CallExpression")) return;
    if (!isNodeOfType(child.callee, "Identifier")) return;
    if (!isStateSetterCallByName(child.callee.name, table)) return;
    if (!isSynchronous(child, callback)) return;

    const argument = child.arguments?.[0];
    const argClassification = argument
      ? classifyExpressionUpstream(argument, table)
      : { hasStateUpstream: false };
    if (argClassification.hasStateUpstream) return;

    context.report({
      node: child,
      message:
        "Avoid chaining state changes. When possible, update all relevant state simultaneously.",
    });
  });
};

export const noChainStateUpdates = defineRule<Rule>({
  id: "no-chain-state-updates",
  severity: "warn",
  recommendation:
    "Set all related state values inside the event handler that originally fired, instead of chaining one effect's setter into another effect's dependency. See https://react.dev/learn/you-might-not-need-an-effect#chains-of-computations",
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
