import type { EsTreeNode } from "../../../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../../../utils/es-tree-node-of-type.js";
import { isHookCall } from "../../../../utils/is-hook-call.js";
import { isNodeOfType } from "../../../../utils/is-node-of-type.js";

export interface UseRefBinding {
  name: string;
  declarator: EsTreeNodeOfType<"VariableDeclarator">;
}

// Walks top-level component body statements for
// `const r = useRef(...)` / `const r = React.useRef(...)` and returns
// the bindings. Mirrors upstream's `isRef` predicate by being the
// canonical source of "names declared as useRef bindings".
export const collectUseRefBindings = (componentBody: EsTreeNode): UseRefBinding[] => {
  const bindings: UseRefBinding[] = [];
  if (!isNodeOfType(componentBody, "BlockStatement")) return bindings;

  for (const statement of componentBody.body ?? []) {
    if (!isNodeOfType(statement, "VariableDeclaration")) continue;
    for (const declarator of statement.declarations ?? []) {
      if (!isNodeOfType(declarator.id, "Identifier")) continue;
      if (!isNodeOfType(declarator.init, "CallExpression")) continue;
      if (!isHookCall(declarator.init, "useRef")) continue;
      bindings.push({ name: declarator.id.name, declarator });
    }
  }
  return bindings;
};
