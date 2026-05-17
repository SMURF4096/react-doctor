import type { EsTreeNode } from "../../../../utils/es-tree-node.js";
import { isNodeOfType } from "../../../../utils/is-node-of-type.js";

// AST-only port of upstream's `isSynchronous(node, within)`. Walks up
// parent pointers from `node` until reaching `within` (sync — returns
// true) or any of the upstream's bail conditions (async — false):
//
//   - AwaitExpression (any await on the way up)
//   - UnaryExpression with operator "void" (matches `void foo()`)
//   - any function-like node OTHER than `within` itself (a nested
//     function may run at an arbitrary later time — `setTimeout`,
//     `.then()`, event handler — and so a setter call inside it is
//     not part of the effect's synchronous body)
//   - any node marked `async: true` (rare standalone — covered above
//     anyway by the function-like check, but defensive)
//
// Returns false if we walk off the top of the tree without hitting
// `within` — that means the node isn't inside `within` at all.
export const isSynchronous = (
  node: EsTreeNode | null | undefined,
  within: EsTreeNode,
): boolean => {
  let cursor: EsTreeNode | null | undefined = node;
  while (cursor) {
    if (cursor === within) return true;
    if (isNodeOfType(cursor, "AwaitExpression")) return false;
    if (isNodeOfType(cursor, "UnaryExpression") && cursor.operator === "void") return false;
    if (
      isNodeOfType(cursor, "FunctionDeclaration") ||
      isNodeOfType(cursor, "FunctionExpression") ||
      isNodeOfType(cursor, "ArrowFunctionExpression")
    ) {
      if (cursor !== within) return false;
    }
    cursor = cursor.parent;
  }
  return false;
};
