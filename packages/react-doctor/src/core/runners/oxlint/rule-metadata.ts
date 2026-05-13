interface RuleMetadataEntry {
  requires?: ReadonlyArray<string>;
  tags: ReadonlySet<string>;
}

const EMPTY_TAGS: ReadonlySet<string> = new Set();
const TEST_NOISE_TAGS: ReadonlySet<string> = new Set(["test-noise"]);
const DESIGN_AND_TEST_NOISE_TAGS: ReadonlySet<string> = new Set(["design", "test-noise"]);

export const RULE_METADATA: ReadonlyMap<string, RuleMetadataEntry> = new Map([
  ["react-doctor/no-react19-deprecated-apis", { requires: ["react:19"], tags: TEST_NOISE_TAGS }],
  ["react-doctor/no-default-props", { requires: ["react:19"], tags: TEST_NOISE_TAGS }],
  ["react-doctor/no-react-dom-deprecated-apis", { requires: ["react:18"], tags: TEST_NOISE_TAGS }],
  ["react-doctor/prefer-use-effect-event", { requires: ["react:19"], tags: TEST_NOISE_TAGS }],

  ["react-doctor/nextjs-no-img-element", { requires: ["nextjs"], tags: EMPTY_TAGS }],
  ["react-doctor/nextjs-async-client-component", { requires: ["nextjs"], tags: EMPTY_TAGS }],
  ["react-doctor/nextjs-no-a-element", { requires: ["nextjs"], tags: EMPTY_TAGS }],
  [
    "react-doctor/nextjs-no-use-search-params-without-suspense",
    { requires: ["nextjs"], tags: EMPTY_TAGS },
  ],
  [
    "react-doctor/nextjs-no-client-fetch-for-server-data",
    { requires: ["nextjs"], tags: EMPTY_TAGS },
  ],
  ["react-doctor/nextjs-missing-metadata", { requires: ["nextjs"], tags: EMPTY_TAGS }],
  ["react-doctor/nextjs-no-client-side-redirect", { requires: ["nextjs"], tags: EMPTY_TAGS }],
  ["react-doctor/nextjs-no-redirect-in-try-catch", { requires: ["nextjs"], tags: EMPTY_TAGS }],
  ["react-doctor/nextjs-image-missing-sizes", { requires: ["nextjs"], tags: EMPTY_TAGS }],
  ["react-doctor/nextjs-no-native-script", { requires: ["nextjs"], tags: EMPTY_TAGS }],
  ["react-doctor/nextjs-inline-script-missing-id", { requires: ["nextjs"], tags: EMPTY_TAGS }],
  ["react-doctor/nextjs-no-font-link", { requires: ["nextjs"], tags: EMPTY_TAGS }],
  ["react-doctor/nextjs-no-css-link", { requires: ["nextjs"], tags: EMPTY_TAGS }],
  ["react-doctor/nextjs-no-polyfill-script", { requires: ["nextjs"], tags: EMPTY_TAGS }],
  ["react-doctor/nextjs-no-head-import", { requires: ["nextjs"], tags: EMPTY_TAGS }],
  ["react-doctor/nextjs-no-side-effect-in-get-handler", { requires: ["nextjs"], tags: EMPTY_TAGS }],

  ["react-doctor/rn-no-raw-text", { requires: ["react-native"], tags: EMPTY_TAGS }],
  ["react-doctor/rn-no-deprecated-modules", { requires: ["react-native"], tags: EMPTY_TAGS }],
  ["react-doctor/rn-no-legacy-expo-packages", { requires: ["react-native"], tags: EMPTY_TAGS }],
  ["react-doctor/rn-no-dimensions-get", { requires: ["react-native"], tags: EMPTY_TAGS }],
  [
    "react-doctor/rn-no-inline-flatlist-renderitem",
    { requires: ["react-native"], tags: EMPTY_TAGS },
  ],
  ["react-doctor/rn-no-legacy-shadow-styles", { requires: ["react-native"], tags: EMPTY_TAGS }],
  ["react-doctor/rn-prefer-reanimated", { requires: ["react-native"], tags: EMPTY_TAGS }],
  [
    "react-doctor/rn-no-single-element-style-array",
    { requires: ["react-native"], tags: EMPTY_TAGS },
  ],
  ["react-doctor/rn-prefer-pressable", { requires: ["react-native"], tags: EMPTY_TAGS }],
  ["react-doctor/rn-prefer-expo-image", { requires: ["react-native"], tags: EMPTY_TAGS }],
  ["react-doctor/rn-no-non-native-navigator", { requires: ["react-native"], tags: EMPTY_TAGS }],
  ["react-doctor/rn-no-scroll-state", { requires: ["react-native"], tags: EMPTY_TAGS }],
  ["react-doctor/rn-no-scrollview-mapped-list", { requires: ["react-native"], tags: EMPTY_TAGS }],
  [
    "react-doctor/rn-no-inline-object-in-list-item",
    { requires: ["react-native"], tags: EMPTY_TAGS },
  ],
  ["react-doctor/rn-animate-layout-property", { requires: ["react-native"], tags: EMPTY_TAGS }],
  [
    "react-doctor/rn-prefer-content-inset-adjustment",
    { requires: ["react-native"], tags: EMPTY_TAGS },
  ],
  [
    "react-doctor/rn-pressable-shared-value-mutation",
    { requires: ["react-native"], tags: EMPTY_TAGS },
  ],
  ["react-doctor/rn-list-data-mapped", { requires: ["react-native"], tags: EMPTY_TAGS }],
  ["react-doctor/rn-list-callback-per-row", { requires: ["react-native"], tags: EMPTY_TAGS }],
  [
    "react-doctor/rn-list-recyclable-without-types",
    { requires: ["react-native"], tags: EMPTY_TAGS },
  ],
  [
    "react-doctor/rn-animation-reaction-as-derived",
    { requires: ["react-native"], tags: EMPTY_TAGS },
  ],
  ["react-doctor/rn-bottom-sheet-prefer-native", { requires: ["react-native"], tags: EMPTY_TAGS }],
  ["react-doctor/rn-scrollview-dynamic-padding", { requires: ["react-native"], tags: EMPTY_TAGS }],
  ["react-doctor/rn-style-prefer-boxshadow", { requires: ["react-native"], tags: EMPTY_TAGS }],

  [
    "react-doctor/tanstack-start-route-property-order",
    { requires: ["tanstack-start"], tags: EMPTY_TAGS },
  ],
  [
    "react-doctor/tanstack-start-no-direct-fetch-in-loader",
    { requires: ["tanstack-start"], tags: EMPTY_TAGS },
  ],
  [
    "react-doctor/tanstack-start-server-fn-validate-input",
    { requires: ["tanstack-start"], tags: EMPTY_TAGS },
  ],
  [
    "react-doctor/tanstack-start-no-useeffect-fetch",
    { requires: ["tanstack-start"], tags: EMPTY_TAGS },
  ],
  [
    "react-doctor/tanstack-start-missing-head-content",
    { requires: ["tanstack-start"], tags: EMPTY_TAGS },
  ],
  [
    "react-doctor/tanstack-start-no-anchor-element",
    { requires: ["tanstack-start"], tags: EMPTY_TAGS },
  ],
  [
    "react-doctor/tanstack-start-server-fn-method-order",
    { requires: ["tanstack-start"], tags: EMPTY_TAGS },
  ],
  [
    "react-doctor/tanstack-start-no-navigate-in-render",
    { requires: ["tanstack-start"], tags: EMPTY_TAGS },
  ],
  [
    "react-doctor/tanstack-start-no-dynamic-server-fn-import",
    { requires: ["tanstack-start"], tags: EMPTY_TAGS },
  ],
  [
    "react-doctor/tanstack-start-no-use-server-in-handler",
    { requires: ["tanstack-start"], tags: EMPTY_TAGS },
  ],
  [
    "react-doctor/tanstack-start-no-secrets-in-loader",
    { requires: ["tanstack-start"], tags: EMPTY_TAGS },
  ],
  ["react-doctor/tanstack-start-get-mutation", { requires: ["tanstack-start"], tags: EMPTY_TAGS }],
  [
    "react-doctor/tanstack-start-redirect-in-try-catch",
    { requires: ["tanstack-start"], tags: EMPTY_TAGS },
  ],
  [
    "react-doctor/tanstack-start-loader-parallel-fetch",
    { requires: ["tanstack-start"], tags: EMPTY_TAGS },
  ],

  ["react-doctor/query-stable-query-client", { requires: ["tanstack-query"], tags: EMPTY_TAGS }],
  ["react-doctor/query-no-rest-destructuring", { requires: ["tanstack-query"], tags: EMPTY_TAGS }],
  ["react-doctor/query-no-void-query-fn", { requires: ["tanstack-query"], tags: EMPTY_TAGS }],
  ["react-doctor/query-no-query-in-effect", { requires: ["tanstack-query"], tags: EMPTY_TAGS }],
  [
    "react-doctor/query-mutation-missing-invalidation",
    { requires: ["tanstack-query"], tags: EMPTY_TAGS },
  ],
  [
    "react-doctor/query-no-usequery-for-mutation",
    { requires: ["tanstack-query"], tags: EMPTY_TAGS },
  ],

  ["react-doctor/design-no-bold-heading", { tags: DESIGN_AND_TEST_NOISE_TAGS }],
  ["react-doctor/design-no-redundant-padding-axes", { tags: DESIGN_AND_TEST_NOISE_TAGS }],
  [
    "react-doctor/design-no-redundant-size-axes",
    { requires: ["tailwind:3.4"], tags: DESIGN_AND_TEST_NOISE_TAGS },
  ],
  ["react-doctor/design-no-space-on-flex-children", { tags: DESIGN_AND_TEST_NOISE_TAGS }],
  ["react-doctor/design-no-three-period-ellipsis", { tags: DESIGN_AND_TEST_NOISE_TAGS }],
  ["react-doctor/design-no-default-tailwind-palette", { tags: DESIGN_AND_TEST_NOISE_TAGS }],
  ["react-doctor/design-no-vague-button-label", { tags: DESIGN_AND_TEST_NOISE_TAGS }],
  ["react-doctor/no-side-tab-border", { tags: DESIGN_AND_TEST_NOISE_TAGS }],
  ["react-doctor/no-pure-black-background", { tags: DESIGN_AND_TEST_NOISE_TAGS }],
  ["react-doctor/no-gradient-text", { tags: DESIGN_AND_TEST_NOISE_TAGS }],
  ["react-doctor/no-dark-mode-glow", { tags: DESIGN_AND_TEST_NOISE_TAGS }],
]);
