import type { EsTreeNode } from "../../../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../../../utils/es-tree-node-of-type.js";
import { isNodeOfType } from "../../../../utils/is-node-of-type.js";
import { walkAst } from "../../../../utils/walk-ast.js";
import { collectPatternNames } from "../../../../utils/collect-pattern-names.js";
import { collectUseStateBindings } from "../collect-use-state-bindings.js";
import { collectUseRefBindings, type UseRefBinding } from "./collect-use-ref-bindings.js";
import {
  collectLocalFunctionBindings,
  type LocalFunctionBinding,
} from "./collect-local-function-bindings.js";

export type IdentifierClassification =
  | "state"
  | "stateSetter"
  | "ref"
  | "prop"
  | "constant"
  | "localFunction"
  | "unknown";

export interface UseStateBindingInfo {
  valueName: string;
  setterName: string;
  declarator: EsTreeNodeOfType<"VariableDeclarator">;
  initializer: EsTreeNode | null;
}

// Cached classification table for one component (or HOC-wrapped
// component / custom hook). Built once per containing function in
// `create-effect-analyzer-tracker.ts` and shared across rules visiting
// the same component.
export interface ComponentBindingTable {
  containingFunctionKind: "component" | "hoc" | "hook";

  componentBody: EsTreeNode;
  useStateBindings: UseStateBindingInfo[];
  useRefBindings: UseRefBinding[];
  localFunctionBindings: LocalFunctionBinding[];

  stateValueNames: Set<string>;
  stateSetterNames: Set<string>;
  refNames: Set<string>;
  propNames: Set<string>;
  // Names declared with literal/template/array/object initializers
  // (matches upstream's `isConstant`).
  constantNames: Set<string>;
  // Names that resolve via this scope to a local function binding
  // (FunctionDeclaration / arrow / `useCallback`).
  localFunctionNames: Set<string>;

  // Quick lookups by name.
  useStateBindingByValueName: Map<string, UseStateBindingInfo>;
  useStateBindingBySetterName: Map<string, UseStateBindingInfo>;
  localFunctionByName: Map<string, LocalFunctionBinding>;

  // Precomputed: does `<name>(...)` eventually call a state setter /
  // prop function / ref method? Used by `isStateSetterCall` /
  // `isPropCall` / `isRefCall` analogs. Only populated for local
  // function bindings; setter / prop / ref direct calls are handled
  // separately by the rule-level dispatch.
  localFunctionCallsStateSetter: Map<string, boolean>;
  localFunctionCallsPropFunction: Map<string, boolean>;
  localFunctionCallsRefMethod: Map<string, boolean>;
}

const collectComponentParamPropNames = (
  functionNode:
    | EsTreeNodeOfType<"FunctionDeclaration">
    | EsTreeNodeOfType<"FunctionExpression">
    | EsTreeNodeOfType<"ArrowFunctionExpression">,
): Set<string> => {
  const propNames = new Set<string>();
  for (const param of functionNode.params ?? []) {
    collectPatternNames(param, propNames);
  }
  return propNames;
};

// Top-level `const x = <Literal | TemplateLiteral | ArrayExpression |
// ObjectExpression>` bindings are treated as constants — matches
// upstream's `isConstant`. Inits that are CallExpressions / Identifiers /
// MemberExpressions are NOT constants because they may reference
// reactive values.
const isConstantInit = (init: EsTreeNode | null | undefined): boolean => {
  if (!init) return false;
  return (
    isNodeOfType(init, "Literal") ||
    isNodeOfType(init, "TemplateLiteral") ||
    isNodeOfType(init, "ArrayExpression") ||
    isNodeOfType(init, "ObjectExpression")
  );
};

const collectConstantNames = (componentBody: EsTreeNode): Set<string> => {
  const constantNames = new Set<string>();
  if (!isNodeOfType(componentBody, "BlockStatement")) return constantNames;
  for (const statement of componentBody.body ?? []) {
    if (!isNodeOfType(statement, "VariableDeclaration")) continue;
    for (const declarator of statement.declarations ?? []) {
      if (!isNodeOfType(declarator.id, "Identifier")) continue;
      if (!isConstantInit(declarator.init ?? undefined)) continue;
      constantNames.add(declarator.id.name);
    }
  }
  return constantNames;
};

const computeLocalFunctionCalleeFlags = (
  binding: LocalFunctionBinding,
  stateSetterNames: Set<string>,
  propNames: Set<string>,
  refNames: Set<string>,
): { callsStateSetter: boolean; callsPropFunction: boolean; callsRefMethod: boolean } => {
  let callsStateSetter = false;
  let callsPropFunction = false;
  let callsRefMethod = false;
  if (!binding.body) {
    return { callsStateSetter, callsPropFunction, callsRefMethod };
  }
  walkAst(binding.body, (child: EsTreeNode) => {
    if (!isNodeOfType(child, "CallExpression")) return;
    const callee = child.callee;
    // Direct identifier callee — match against the appropriate name
    // sets. Skip shadowed names introduced by the local function's own
    // params (upstream does the same via scope resolution).
    if (isNodeOfType(callee, "Identifier")) {
      if (binding.params.has(callee.name)) return;
      if (stateSetterNames.has(callee.name)) callsStateSetter = true;
      if (propNames.has(callee.name)) callsPropFunction = true;
      return;
    }
    if (isNodeOfType(callee, "MemberExpression")) {
      // `r.current.something(...)` and `r.current(...)` count as ref
      // method calls; `ref.foo` access without a call doesn't.
      const object = callee.object;
      if (
        isNodeOfType(object, "Identifier") &&
        !binding.params.has(object.name) &&
        refNames.has(object.name)
      ) {
        callsRefMethod = true;
      } else if (
        isNodeOfType(object, "MemberExpression") &&
        isNodeOfType(object.object, "Identifier") &&
        isNodeOfType(object.property, "Identifier") &&
        object.property.name === "current" &&
        !binding.params.has(object.object.name) &&
        refNames.has(object.object.name)
      ) {
        callsRefMethod = true;
      }
      // Prop-rooted member call: `props.onClick()`, `onTextChanged(...)`
      // doesn't go here (the latter is handled by the Identifier branch).
      // `props.<x>(...)` where `props` is a prop name → counts as a
      // prop function call.
      if (
        isNodeOfType(object, "Identifier") &&
        !binding.params.has(object.name) &&
        propNames.has(object.name)
      ) {
        callsPropFunction = true;
      }
      // Member call whose property is a state setter (rare — e.g.
      // `obj.setX()` where `setX` happens to be a state setter via
      // destructuring on the object). Skip; too speculative.
    }
  });
  return { callsStateSetter, callsPropFunction, callsRefMethod };
};

export interface BuildComponentBindingTableInput {
  containingFunctionKind: "component" | "hoc" | "hook";
  functionNode:
    | EsTreeNodeOfType<"FunctionDeclaration">
    | EsTreeNodeOfType<"FunctionExpression">
    | EsTreeNodeOfType<"ArrowFunctionExpression">;
  componentBody: EsTreeNode;
}

export const buildComponentBindingTable = (
  input: BuildComponentBindingTableInput,
): ComponentBindingTable => {
  const { containingFunctionKind, functionNode, componentBody } = input;
  const propNames = collectComponentParamPropNames(functionNode);
  // Upstream skips props treated-as-real when the containing function
  // is an HOC wrapper (`isReactFunctionalHOC`). For HOC wrappers we
  // expose an empty `propNames` so `isProp`-style lookups return false.
  const exposedPropNames = containingFunctionKind === "hoc" ? new Set<string>() : propNames;

  const useStateBindings = collectUseStateBindings(componentBody).map<UseStateBindingInfo>(
    (binding) => {
      const init = binding.declarator.init;
      const initializer =
        init && isNodeOfType(init, "CallExpression") ? init.arguments?.[0] ?? null : null;
      return {
        valueName: binding.valueName,
        setterName: binding.setterName,
        declarator: binding.declarator,
        initializer,
      };
    },
  );
  const useRefBindings = collectUseRefBindings(componentBody);
  const localFunctionBindings = collectLocalFunctionBindings(componentBody);

  const stateValueNames = new Set(useStateBindings.map((binding) => binding.valueName));
  const stateSetterNames = new Set(useStateBindings.map((binding) => binding.setterName));
  const refNames = new Set(useRefBindings.map((binding) => binding.name));
  const localFunctionNames = new Set(localFunctionBindings.map((binding) => binding.name));
  const constantNames = collectConstantNames(componentBody);

  const useStateBindingByValueName = new Map(
    useStateBindings.map((binding) => [binding.valueName, binding] as const),
  );
  const useStateBindingBySetterName = new Map(
    useStateBindings.map((binding) => [binding.setterName, binding] as const),
  );
  const localFunctionByName = new Map(
    localFunctionBindings.map((binding) => [binding.name, binding] as const),
  );

  const localFunctionCallsStateSetter = new Map<string, boolean>();
  const localFunctionCallsPropFunction = new Map<string, boolean>();
  const localFunctionCallsRefMethod = new Map<string, boolean>();
  for (const binding of localFunctionBindings) {
    const flags = computeLocalFunctionCalleeFlags(
      binding,
      stateSetterNames,
      exposedPropNames,
      refNames,
    );
    localFunctionCallsStateSetter.set(binding.name, flags.callsStateSetter);
    localFunctionCallsPropFunction.set(binding.name, flags.callsPropFunction);
    localFunctionCallsRefMethod.set(binding.name, flags.callsRefMethod);
  }

  return {
    containingFunctionKind,
    componentBody,
    useStateBindings,
    useRefBindings,
    localFunctionBindings,
    stateValueNames,
    stateSetterNames,
    refNames,
    propNames: exposedPropNames,
    constantNames,
    localFunctionNames,
    useStateBindingByValueName,
    useStateBindingBySetterName,
    localFunctionByName,
    localFunctionCallsStateSetter,
    localFunctionCallsPropFunction,
    localFunctionCallsRefMethod,
  };
};

// Classify a bare Identifier *name* against the binding table.
// Multi-classification is rare (e.g. a useState value can't also be a
// prop), but the caller-side checks use these predicates one at a
// time anyway.
export const classifyIdentifierName = (
  name: string,
  table: ComponentBindingTable,
): IdentifierClassification => {
  if (table.stateValueNames.has(name)) return "state";
  if (table.stateSetterNames.has(name)) return "stateSetter";
  if (table.refNames.has(name)) return "ref";
  if (table.propNames.has(name)) return "prop";
  if (table.constantNames.has(name)) return "constant";
  if (table.localFunctionNames.has(name)) return "localFunction";
  return "unknown";
};

// Convenience predicates mirroring upstream's `isState`/`isProp`/`isRef`
// at the (post-classification) name level.
export const isStateName = (name: string, table: ComponentBindingTable): boolean =>
  table.stateValueNames.has(name);

export const isStateSetterName = (name: string, table: ComponentBindingTable): boolean =>
  table.stateSetterNames.has(name);

export const isPropName = (name: string, table: ComponentBindingTable): boolean =>
  table.propNames.has(name);

export const isRefName = (name: string, table: ComponentBindingTable): boolean =>
  table.refNames.has(name);

export const isConstantName = (name: string, table: ComponentBindingTable): boolean =>
  table.constantNames.has(name);

// Mirrors upstream's `isStateSetterCall` semantics: the callee is a
// state setter binding directly OR a local function whose body calls
// a state setter.
export const isStateSetterCallByName = (
  calleeName: string,
  table: ComponentBindingTable,
): boolean => {
  if (table.stateSetterNames.has(calleeName)) return true;
  return table.localFunctionCallsStateSetter.get(calleeName) === true;
};

export const isPropCallByName = (calleeName: string, table: ComponentBindingTable): boolean => {
  if (table.propNames.has(calleeName)) return true;
  return table.localFunctionCallsPropFunction.get(calleeName) === true;
};

export const isRefCallByName = (calleeName: string, table: ComponentBindingTable): boolean => {
  if (table.refNames.has(calleeName)) return true;
  return table.localFunctionCallsRefMethod.get(calleeName) === true;
};
