import type { EsTreeNode } from "../../../../utils/es-tree-node.js";
import { isNodeOfType } from "../../../../utils/is-node-of-type.js";

// Mirrors upstream `eslint-plugin-react-you-might-not-need-an-effect`'s
// `hasCleanup`: returns true if the effect callback's BlockStatement
// body contains any `return <expr>` statement (the arg can be anything,
// not strictly a function). An arrow concise body (no BlockStatement)
// has no cleanup. The looseness is intentional — upstream uses cleanup
// presence as a "this effect synchronizes with something external"
// signal and treats it as a permissive escape hatch.
export const hasEffectCleanup = (effectCallback: EsTreeNode | null | undefined): boolean => {
  if (!effectCallback) return false;
  if (
    !isNodeOfType(effectCallback, "ArrowFunctionExpression") &&
    !isNodeOfType(effectCallback, "FunctionExpression")
  ) {
    return false;
  }
  const body = effectCallback.body;
  if (!isNodeOfType(body, "BlockStatement")) return false;
  for (const statement of body.body ?? []) {
    if (isNodeOfType(statement, "ReturnStatement") && statement.argument) return true;
  }
  return false;
};
