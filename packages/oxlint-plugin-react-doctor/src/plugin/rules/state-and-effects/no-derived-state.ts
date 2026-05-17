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

// 1:1 port of upstream `no-derived-state` from
// `eslint-plugin-react-you-might-not-need-an-effect`
// (NickvanDyke, v0.10.1, SHA 4c71faaa7623d2d5feb33983dc2ebcc08206bcc5).
// See `./effect/SOURCE.md` for the impedance-bridging story between
// ESLint scope analysis and our AST-only equivalent.
//
// Upstream shape (paraphrased):
//   useEffect(() => setX(<expr>), [<deps>])
// is flagged when:
//   - the effect has no cleanup return,
//   - the deps array is present,
//   - the setter call is synchronous wrt the effect callback,
//   - some upstream of the argument is state or prop (→ avoidDerivedState),
//   - OR all upstreams of the argument are in the deps array AND the
//     setter is only referenced once in the component (→ avoidSingleSetter).

const findResolvedSetterStateName = (
  calleeName: string,
  table: ComponentBindingTable,
): string | null => {
  // Direct: setter is a useState binding.
  const direct = table.useStateBindingBySetterName.get(calleeName);
  if (direct) return direct.valueName;
  // Indirect: setter is a local function. Resolve which state setter
  // it ultimately writes by walking its body for the first
  // setX call that matches a useState binding. Matches upstream's
  // `getUseStateDecl` behaviour for intermediate setters.
  const localFunction = table.localFunctionByName.get(calleeName);
  if (!localFunction?.body) return null;
  let resolvedName: string | null = null;
  walkAst(localFunction.body, (child: EsTreeNode) => {
    if (resolvedName !== null) return false;
    if (!isNodeOfType(child, "CallExpression")) return;
    if (!isNodeOfType(child.callee, "Identifier")) return;
    const innerName = child.callee.name;
    const innerBinding = table.useStateBindingBySetterName.get(innerName);
    if (innerBinding) {
      resolvedName = innerBinding.valueName;
      return false;
    }
  });
  return resolvedName;
};

// Counts how many times the bare value-name identifier is *referenced*
// across the component body (matches upstream's
// `ref.resolved.references.filter(parent === CallExpression).length === 1`
// but our equivalent is "value is read in render OR setter call"; we
// approximate via "setter is only called once anywhere in the
// component"). This is the upstream test for "always in sync".
const countSetterCallSites = (
  setterName: string,
  componentBody: EsTreeNode,
): number => {
  let count = 0;
  walkAst(componentBody, (child: EsTreeNode) => {
    if (!isNodeOfType(child, "CallExpression")) return;
    if (!isNodeOfType(child.callee, "Identifier")) return;
    if (child.callee.name === setterName) count += 1;
  });
  return count;
};

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

  walkAst(callback, (child: EsTreeNode) => {
    if (!isNodeOfType(child, "CallExpression")) return;
    if (!isNodeOfType(child.callee, "Identifier")) return;
    const calleeName = child.callee.name;
    if (!isStateSetterCallByName(calleeName, table)) return;
    if (!isSynchronous(child, callback)) return;

    const stateName = findResolvedSetterStateName(calleeName, table) ?? calleeName;
    const argument = child.arguments?.[0];
    if (!argument) return;

    const argClassification = classifyExpressionUpstream(argument, table);

    const isSomeArgsInternal =
      argClassification.hasStateUpstream || argClassification.hasPropUpstream;

    if (isSomeArgsInternal) {
      context.report({
        node: child,
        message: `Avoid storing derived state. Compute "${stateName}" directly during render, optionally with \`useMemo\` if it's expensive.`,
      });
      return;
    }

    // "Always in sync" branch: every leaf upstream of the argument
    // is also referenced as a dep, and this is the only setter call.
    if (argClassification.expandedIdentifierNames.size === 0) return;
    let allArgsInDeps = true;
    for (const name of argClassification.expandedIdentifierNames) {
      if (table.constantNames.has(name)) continue;
      if (!depsClassification.expandedIdentifierNames.has(name)) {
        allArgsInDeps = false;
        break;
      }
    }
    if (!allArgsInDeps) return;
    const callCount = countSetterCallSites(calleeName, table.componentBody);
    if (callCount !== 1) return;

    context.report({
      node: child,
      message: `Avoid storing derived state. "${stateName}" is only set here, and thus could be computed directly during render.`,
    });
  });
};

export const noDerivedState = defineRule<Rule>({
  id: "no-derived-state",
  severity: "warn",
  recommendation:
    "For derived state, compute inline: `const x = fn(dep)`. Use useMemo([deps]) only if the computation is expensive. See https://react.dev/learn/you-might-not-need-an-effect#updating-state-based-on-props-or-state",
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
