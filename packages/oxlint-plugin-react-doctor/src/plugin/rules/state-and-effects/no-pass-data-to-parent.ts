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
  isRefCallByName,
  type ComponentBindingTable,
} from "./utils/effect/analyze-component-bindings.js";
import { collectLeafIdentifierNames } from "./utils/effect/classify-effect-callee-argument.js";
import { createEffectAnalyzerTracker } from "./utils/effect/create-effect-analyzer-tracker.js";
import { hasEffectCleanup } from "./utils/effect/has-effect-cleanup.js";
import { isSynchronous } from "./utils/effect/is-synchronous.js";

// 1:1 port of upstream `no-pass-data-to-parent`. Detector:
//   - useEffect, no cleanup return
//   - prop-call invoked synchronously inside the body
//   - the call is NOT a ref method call
//   - some leaf identifier in the argument upstream is NOT
//     useState/prop/useRef/refCurrent/constant — i.e. it's "data"
//     produced inside the effect (e.g. a fetch result).
// Different message for components vs custom hooks (hooks should
// return the data instead).

const analyzeEffect = (
  context: RuleContext,
  effectCall: EsTreeNodeOfType<"CallExpression">,
  table: ComponentBindingTable,
): void => {
  const callback = getEffectCallback(effectCall);
  if (!callback) return;
  if (hasEffectCleanup(callback)) return;

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
    if (isRefCallByName(calleeName, table)) return;
    if (!isSynchronous(child, callback)) return;

    // We want to know whether the prop callback is being passed
    // "data" — values that aren't state, prop, ref, refCurrent, or
    // constant. Upstream filters arg upstream refs to leaves
    // (`getUpstreamRefs(...).length === 1`) and then checks the
    // remaining leaves' classification.
    const argument = child.arguments?.[0];
    if (!argument) return;
    const leafNames = collectLeafIdentifierNames(argument, table.refNames);

    let foundData = false;
    for (const name of leafNames) {
      if (table.stateValueNames.has(name)) continue;
      if (table.propNames.has(name)) continue;
      if (table.refNames.has(name)) continue;
      if (table.constantNames.has(name)) continue;
      if (table.stateSetterNames.has(name)) continue;
      if (table.localFunctionNames.has(name)) continue;
      foundData = true;
      break;
    }

    if (!foundData) return;

    context.report({
      node: child,
      message: isInsideHook
        ? "Avoid passing data to parents in an effect. Instead, return the data from the hook."
        : "Avoid passing data to parents in an effect. Instead, fetch the data in the parent and pass it down to the child as a prop.",
    });
  });
};

export const noPassDataToParent = defineRule<Rule>({
  id: "no-pass-data-to-parent",
  severity: "warn",
  recommendation:
    "Fetch the data in the parent and pass it to the child as a prop (or return it from the hook), instead of pushing it back up via a prop callback inside an effect. See https://react.dev/learn/you-might-not-need-an-effect#passing-data-to-the-parent",
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
