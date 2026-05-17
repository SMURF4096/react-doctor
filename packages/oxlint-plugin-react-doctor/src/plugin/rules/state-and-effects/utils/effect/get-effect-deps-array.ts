import type { EsTreeNode } from "../../../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../../../utils/es-tree-node-of-type.js";
import { isNodeOfType } from "../../../../utils/is-node-of-type.js";

export const getEffectDepsArray = (
  effectCall: EsTreeNode,
): EsTreeNodeOfType<"ArrayExpression"> | null => {
  if (!isNodeOfType(effectCall, "CallExpression")) return null;
  const depsNode = effectCall.arguments?.[1];
  if (!depsNode) return null;
  if (!isNodeOfType(depsNode, "ArrayExpression")) return null;
  return depsNode;
};
