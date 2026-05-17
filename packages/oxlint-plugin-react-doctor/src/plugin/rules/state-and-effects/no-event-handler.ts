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
import { type ComponentBindingTable } from "./utils/effect/analyze-component-bindings.js";
import { classifyExpressionUpstream } from "./utils/effect/classify-effect-callee-argument.js";
import { createEffectAnalyzerTracker } from "./utils/effect/create-effect-analyzer-tracker.js";
import { hasEffectCleanup } from "./utils/effect/has-effect-cleanup.js";

// 1:1 port of upstream `no-event-handler`. Detects:
//   useEffect(() => {
//     if (<some state or prop>) <do side effect>;
//   }, [...]);
// Where the IfStatement has no `else` branch — that shape is a
// classic "use the effect as an event handler" anti-pattern. The
// upstream reports per Identifier in the test expression that
// upstream-resolves to state or prop.

const reportTestIdentifiers = (
  context: RuleContext,
  testNode: EsTreeNode,
  table: ComponentBindingTable,
): void => {
  const classification = classifyExpressionUpstream(testNode, table);
  // We don't have AST positions per identifier name without an extra
  // walk. Re-walk the test node and report on each Identifier that
  // resolves to state/prop, deduping by name so we don't fire twice
  // when the same name appears twice in one test.
  const reportedStateNames = new Set<string>();
  const reportedPropNames = new Set<string>();
  walkAst(testNode, (child: EsTreeNode) => {
    if (!isNodeOfType(child, "Identifier")) return;
    const name = child.name;
    if (
      classification.expandedIdentifierNames.has(name) &&
      table.stateValueNames.has(name) &&
      !reportedStateNames.has(name)
    ) {
      reportedStateNames.add(name);
      context.report({
        node: child,
        message:
          "Avoid using state and effects as an event handler. Instead, call the event handling code directly when the event occurs.",
      });
      return;
    }
    if (
      classification.expandedIdentifierNames.has(name) &&
      table.propNames.has(name) &&
      !reportedPropNames.has(name)
    ) {
      reportedPropNames.add(name);
      context.report({
        node: child,
        message:
          "Avoid using props and effects as an event handler. Instead, move the handler to the parent component.",
      });
    }
  });
};

const analyzeEffect = (
  context: RuleContext,
  effectCall: EsTreeNodeOfType<"CallExpression">,
  table: ComponentBindingTable,
): void => {
  const callback = getEffectCallback(effectCall);
  if (!callback) return;
  if (hasEffectCleanup(callback)) return;

  walkAst(callback, (child: EsTreeNode) => {
    if (!isNodeOfType(child, "IfStatement")) return;
    if (child.alternate) return;
    reportTestIdentifiers(context, child.test, table);
  });
};

export const noEventHandler = defineRule<Rule>({
  id: "no-event-handler",
  severity: "warn",
  recommendation:
    "Run the side effect directly inside the event handler that triggers it, rather than guarding on its state inside a useEffect. See https://react.dev/learn/you-might-not-need-an-effect#sharing-logic-between-event-handlers",
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
