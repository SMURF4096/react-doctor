import type { EsTreeNode } from "../../../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../../../utils/es-tree-node-of-type.js";
import { isHookCall } from "../../../../utils/is-hook-call.js";
import { isNodeOfType } from "../../../../utils/is-node-of-type.js";
import { collectPatternNames } from "../../../../utils/collect-pattern-names.js";

export type LocalFunctionKind = "function" | "useCallback";

export interface LocalFunctionBinding {
  name: string;
  kind: LocalFunctionKind;
  params: Set<string>;
  body: EsTreeNode | null;
  // The function-like node itself (so callers can recurse into nested
  // CallExpressions for "calls any state setter" precomputation).
  functionNode:
    | EsTreeNodeOfType<"FunctionDeclaration">
    | EsTreeNodeOfType<"FunctionExpression">
    | EsTreeNodeOfType<"ArrowFunctionExpression">;
}

const extractParamNames = (params: EsTreeNode[] | undefined): Set<string> => {
  const names = new Set<string>();
  for (const param of params ?? []) {
    collectPatternNames(param, names);
  }
  return names;
};

const buildBindingFromFunctionLike = (
  name: string,
  kind: LocalFunctionKind,
  functionNode:
    | EsTreeNodeOfType<"FunctionDeclaration">
    | EsTreeNodeOfType<"FunctionExpression">
    | EsTreeNodeOfType<"ArrowFunctionExpression">,
): LocalFunctionBinding => ({
  name,
  kind,
  params: extractParamNames(functionNode.params),
  body: functionNode.body ?? null,
  functionNode,
});

// Walks top-level statements of `componentBody` and collects bindings
// for every local function-like declaration:
//
//   function foo(...) {...}                              → "function"
//   const foo = (...) => {...}                           → "function"
//   const foo = function() {...}                         → "function"
//   const foo = useCallback((...) => {...}, [...]);      → "useCallback"
//   const foo = useCallback(function () {...}, [...]);   → "useCallback"
//   const foo = React.useCallback((...) => ..., [...]);  → "useCallback"
//
// We do NOT recurse into nested blocks — upstream's
// `isEventualCallTo` relies on resolving the binding's declaring
// scope via ESLint's scope manager, but in practice the rules only
// care about callees declared at the component-body level. This
// matches the limit of the upstream's analyzer in real React code.
export const collectLocalFunctionBindings = (
  componentBody: EsTreeNode,
): LocalFunctionBinding[] => {
  const bindings: LocalFunctionBinding[] = [];
  if (!isNodeOfType(componentBody, "BlockStatement")) return bindings;

  for (const statement of componentBody.body ?? []) {
    if (isNodeOfType(statement, "FunctionDeclaration")) {
      if (statement.id?.name) {
        bindings.push(buildBindingFromFunctionLike(statement.id.name, "function", statement));
      }
      continue;
    }
    if (!isNodeOfType(statement, "VariableDeclaration")) continue;
    for (const declarator of statement.declarations ?? []) {
      if (!isNodeOfType(declarator.id, "Identifier")) continue;
      const name = declarator.id.name;
      const init = declarator.init;
      if (!init) continue;
      if (
        isNodeOfType(init, "ArrowFunctionExpression") ||
        isNodeOfType(init, "FunctionExpression")
      ) {
        bindings.push(buildBindingFromFunctionLike(name, "function", init));
        continue;
      }
      if (isNodeOfType(init, "CallExpression") && isHookCall(init, "useCallback")) {
        const callback = init.arguments?.[0];
        if (
          callback &&
          (isNodeOfType(callback, "ArrowFunctionExpression") ||
            isNodeOfType(callback, "FunctionExpression"))
        ) {
          bindings.push(buildBindingFromFunctionLike(name, "useCallback", callback));
        }
      }
    }
  }
  return bindings;
};
