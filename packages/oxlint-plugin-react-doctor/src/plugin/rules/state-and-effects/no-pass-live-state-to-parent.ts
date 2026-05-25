import { defineRule } from "../../utils/define-rule.js";
import type { EsTreeNode } from "../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../utils/es-tree-node-of-type.js";
import { isNamespacedApiCallee } from "../../utils/is-namespaced-api-call.js";
import { DATA_SINK_METHOD_NAMES } from "../../constants/data-sink-method-names.js";
import { getCallMethodName } from "../../utils/get-call-method-name.js";
import type { Rule } from "../../utils/rule.js";
import type { RuleContext } from "../../utils/rule-context.js";
import { getArgsUpstreamRefs, getCallExpr, isSynchronous } from "./utils/effect/ast.js";
import { getProgramAnalysis } from "./utils/effect/get-program-analysis.js";
import {
  findContainingNode,
  getEffectFn,
  getEffectFnRefs,
  isCustomHook,
  isPropCall,
  isState,
  isUseEffect,
} from "./utils/effect/react.js";

export const noPassLiveStateToParent = defineRule<Rule>({
  id: "no-pass-live-state-to-parent",
  severity: "warn",
  tags: ["test-noise"],
  recommendation:
    "Lift the state to the parent (or return it from the hook) instead of pushing it back up via a prop callback inside a useEffect. See https://react.dev/learn/you-might-not-need-an-effect#notifying-parent-components-about-state-changes",
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNodeOfType<"CallExpression">) {
      if (!isUseEffect(node)) return;
      const analysis = getProgramAnalysis(node);
      if (!analysis) return;
      const effectFnRefs = getEffectFnRefs(analysis, node);
      if (!effectFnRefs) return;
      const effectFn = getEffectFn(analysis, node);
      if (!effectFn) return;

      for (const ref of effectFnRefs) {
        if (!isPropCall(analysis, ref)) continue;
        if (!isSynchronous(ref.identifier as unknown as EsTreeNode, effectFn)) continue;
        const callExpr = getCallExpr(ref);
        if (!callExpr) continue;

        // Skip JS prototype / observer / promise methods — see
        // `no-pass-data-to-parent` for the full rationale.
        const calleeNode = (callExpr as unknown as { callee?: EsTreeNode }).callee;
        const methodName = calleeNode ? getCallMethodName(calleeNode) : null;
        if (methodName && DATA_SINK_METHOD_NAMES.has(methodName)) continue;
        if (calleeNode && isNamespacedApiCallee(calleeNode)) continue;

        const isStateInArgs = getArgsUpstreamRefs(analysis, ref).some((argRef) =>
          isState(analysis, argRef),
        );
        if (!isStateInArgs) continue;

        const containing = findContainingNode(analysis, node);
        const isInCustomHook = containing != null && isCustomHook(containing);
        context.report({
          node: callExpr,
          message: isInCustomHook
            ? "Avoid passing live state to parents in an effect. Instead, return the state from the hook."
            : "Avoid passing live state to parents in an effect. Instead, lift the state to the parent and pass it down to the child as a prop.",
        });
      }
    },
  }),
});
