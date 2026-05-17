import { BUILTIN_GLOBAL_NAMESPACE_NAMES } from "../../../../constants/js.js";
import type { EsTreeNode } from "../../../../utils/es-tree-node.js";
import type { EsTreeNodeOfType } from "../../../../utils/es-tree-node-of-type.js";
import { getRootIdentifierName } from "../../../../utils/get-root-identifier-name.js";
import { isNodeOfType } from "../../../../utils/is-node-of-type.js";
import { walkAst } from "../../../../utils/walk-ast.js";
import type { ComponentBindingTable } from "./analyze-component-bindings.js";

export interface ArgumentUpstreamClassification {
  // Set of bare-identifier names referenced inside the argument
  // expression that are "reactive reads" (i.e. excluding callee chain
  // properties and built-in global-namespace roots like `Math.x`).
  identifierNames: Set<string>;
  // Same set, expanded transitively through component-local const
  // bindings (e.g. `const newFullName = title + ' ' + name;` →
  // newFullName expands to {title, name}).
  expandedIdentifierNames: Set<string>;
  hasStateUpstream: boolean;
  hasPropUpstream: boolean;
  hasRefUpstream: boolean;
  // True if EVERY expanded leaf identifier is a constant binding
  // (matches upstream's "argsUpstream all constants" check).
  allLeavesConstant: boolean;
  // Leaf identifiers that do not classify as state / prop / ref /
  // constant / state setter — the "data" classification for
  // `no-pass-data-to-parent`.
  unclassifiedLeafNames: Set<string>;
  // True if `.<member>.current` access against a useRef binding
  // appears anywhere in the argument expression.
  hasRefCurrentRead: boolean;
}

const collectReactiveIdentifierNames = (
  node: EsTreeNode | null | undefined,
  into: Set<string>,
  refNames: Set<string>,
  refCurrentSink: { read: boolean },
): void => {
  if (!node || typeof node !== "object") return;
  if (isNodeOfType(node, "CallExpression")) {
    if (isNodeOfType(node.callee, "MemberExpression")) {
      const rootName = getRootIdentifierName(node.callee);
      if (!rootName || !BUILTIN_GLOBAL_NAMESPACE_NAMES.has(rootName)) {
        collectReactiveIdentifierNames(node.callee.object, into, refNames, refCurrentSink);
      }
    } else if (isNodeOfType(node.callee, "Identifier")) {
      // The callee identifier IS a reactive read for our analysis —
      // upstream's `getArgsUpstreamRefs` collects every downstream ref
      // of an argument including bare callees in `f(a, b)`. We want
      // names like `applyFilters` in `setX(applyFilters(name))` so we
      // can later check whether they're local functions whose upstream
      // is state / prop.
      into.add(node.callee.name);
    }
    for (const argument of node.arguments ?? []) {
      collectReactiveIdentifierNames(argument, into, refNames, refCurrentSink);
    }
    return;
  }
  if (isNodeOfType(node, "MemberExpression")) {
    if (
      isNodeOfType(node.object, "Identifier") &&
      isNodeOfType(node.property, "Identifier") &&
      !node.computed &&
      node.property.name === "current" &&
      refNames.has(node.object.name)
    ) {
      refCurrentSink.read = true;
    }
    const rootName = getRootIdentifierName(node);
    if (!rootName || !BUILTIN_GLOBAL_NAMESPACE_NAMES.has(rootName)) {
      collectReactiveIdentifierNames(node.object, into, refNames, refCurrentSink);
    }
    if (node.computed) {
      collectReactiveIdentifierNames(node.property, into, refNames, refCurrentSink);
    }
    return;
  }
  if (isNodeOfType(node, "Identifier")) {
    into.add(node.name);
    return;
  }
  const nodeRecord = node as unknown as Record<string, unknown>;
  for (const key of Object.keys(nodeRecord)) {
    if (key === "parent" || key === "type") continue;
    const child = nodeRecord[key];
    if (Array.isArray(child)) {
      for (const item of child) {
        if (item && typeof item === "object" && "type" in item) {
          collectReactiveIdentifierNames(item as EsTreeNode, into, refNames, refCurrentSink);
        }
      }
    } else if (child && typeof child === "object" && "type" in child) {
      collectReactiveIdentifierNames(child as EsTreeNode, into, refNames, refCurrentSink);
    }
  }
};

// Walk top-level const declarations to build a map of constant
// initializer dependencies. Used to expand intermediate variables to
// their original reactive sources (mirrors upstream's transitive
// `getUpstreamRefs` walk for variable declarations).
const buildLocalNameDependencyGraph = (
  componentBody: EsTreeNode,
  refNames: Set<string>,
): Map<string, Set<string>> => {
  const graph = new Map<string, Set<string>>();
  if (!isNodeOfType(componentBody, "BlockStatement")) return graph;
  for (const statement of componentBody.body ?? []) {
    if (!isNodeOfType(statement, "VariableDeclaration")) continue;
    for (const declarator of statement.declarations ?? []) {
      if (!isNodeOfType(declarator.id, "Identifier")) continue;
      if (!declarator.init) continue;
      const depNames = new Set<string>();
      const refCurrentSink = { read: false };
      collectReactiveIdentifierNames(declarator.init, depNames, refNames, refCurrentSink);
      graph.set(declarator.id.name, depNames);
    }
  }
  return graph;
};

const expandTransitively = (
  seedNames: Set<string>,
  graph: Map<string, Set<string>>,
): Set<string> => {
  const reachable = new Set<string>(seedNames);
  const stack: string[] = Array.from(seedNames);
  while (stack.length > 0) {
    const name = stack.pop();
    if (name === undefined) continue;
    const deps = graph.get(name);
    if (!deps) continue;
    for (const dep of deps) {
      if (reachable.has(dep)) continue;
      reachable.add(dep);
      stack.push(dep);
    }
  }
  return reachable;
};

export const classifyExpressionUpstream = (
  expression: EsTreeNode | null | undefined,
  table: ComponentBindingTable,
): ArgumentUpstreamClassification => {
  const identifierNames = new Set<string>();
  const refCurrentSink = { read: false };
  if (expression) {
    collectReactiveIdentifierNames(expression, identifierNames, table.refNames, refCurrentSink);
  }

  const dependencyGraph = buildLocalNameDependencyGraph(table.componentBody, table.refNames);
  const expandedIdentifierNames = expandTransitively(identifierNames, dependencyGraph);

  let hasStateUpstream = false;
  let hasPropUpstream = false;
  let hasRefUpstream = false;
  let allLeavesConstant = expandedIdentifierNames.size > 0;
  const unclassifiedLeafNames = new Set<string>();
  for (const name of expandedIdentifierNames) {
    if (table.stateValueNames.has(name)) {
      hasStateUpstream = true;
      allLeavesConstant = false;
      continue;
    }
    if (table.propNames.has(name)) {
      hasPropUpstream = true;
      allLeavesConstant = false;
      continue;
    }
    if (table.refNames.has(name)) {
      hasRefUpstream = true;
      allLeavesConstant = false;
      continue;
    }
    if (table.constantNames.has(name)) continue;
    if (table.stateSetterNames.has(name)) {
      // setters are functions — not "leaves" that affect data flow
      allLeavesConstant = false;
      continue;
    }
    if (table.localFunctionNames.has(name)) {
      // The local function may itself read state / prop / ref. We
      // already followed its dependency graph through
      // `buildLocalNameDependencyGraph` (it sees the function's init
      // expression). We don't recurse INTO the function body here —
      // matches upstream's choice not to follow callee bodies for
      // upstream-ref resolution. Treat as unclassified data; rules
      // that care can inspect `localFunctionCalls{StateSetter,...}`
      // flags directly.
      allLeavesConstant = false;
      unclassifiedLeafNames.add(name);
      continue;
    }
    allLeavesConstant = false;
    unclassifiedLeafNames.add(name);
  }

  return {
    identifierNames,
    expandedIdentifierNames,
    hasStateUpstream,
    hasPropUpstream,
    hasRefUpstream,
    allLeavesConstant,
    unclassifiedLeafNames,
    hasRefCurrentRead: refCurrentSink.read,
  };
};

// Classify identifier names appearing inside a `useEffect` deps array.
// Behaves like `classifyExpressionUpstream` over the array elements
// joined together, with the special-case that `<dep>.<prop>` access
// (e.g. `[data.posts]`) tracks `data` as the dep.
export const classifyDepsArrayUpstream = (
  depsArray: EsTreeNodeOfType<"ArrayExpression">,
  table: ComponentBindingTable,
): ArgumentUpstreamClassification => {
  const identifierNames = new Set<string>();
  const refCurrentSink = { read: false };
  for (const element of depsArray.elements ?? []) {
    if (!element) continue;
    collectReactiveIdentifierNames(element, identifierNames, table.refNames, refCurrentSink);
  }
  const dependencyGraph = buildLocalNameDependencyGraph(table.componentBody, table.refNames);
  const expandedIdentifierNames = expandTransitively(identifierNames, dependencyGraph);

  let hasStateUpstream = false;
  let hasPropUpstream = false;
  let hasRefUpstream = false;
  let allLeavesConstant = expandedIdentifierNames.size > 0;
  const unclassifiedLeafNames = new Set<string>();
  for (const name of expandedIdentifierNames) {
    if (table.stateValueNames.has(name)) {
      hasStateUpstream = true;
      allLeavesConstant = false;
      continue;
    }
    if (table.propNames.has(name)) {
      hasPropUpstream = true;
      allLeavesConstant = false;
      continue;
    }
    if (table.refNames.has(name)) {
      hasRefUpstream = true;
      allLeavesConstant = false;
      continue;
    }
    if (table.constantNames.has(name)) continue;
    if (table.stateSetterNames.has(name) || table.localFunctionNames.has(name)) {
      allLeavesConstant = false;
      continue;
    }
    allLeavesConstant = false;
    unclassifiedLeafNames.add(name);
  }

  return {
    identifierNames,
    expandedIdentifierNames,
    hasStateUpstream,
    hasPropUpstream,
    hasRefUpstream,
    allLeavesConstant,
    unclassifiedLeafNames,
    hasRefCurrentRead: refCurrentSink.read,
  };
};

// Collect "leaf" identifiers from an argument — names whose only
// occurrence is as a leaf reference (no local binding shadows). Used
// by `no-pass-data-to-parent` to match upstream's
// `getUpstreamRefs(...).length === 1` heuristic.
export const collectLeafIdentifierNames = (
  expression: EsTreeNode | null | undefined,
  refNames: Set<string>,
): Set<string> => {
  const names = new Set<string>();
  const sink = { read: false };
  if (expression) collectReactiveIdentifierNames(expression, names, refNames, sink);
  return names;
};
