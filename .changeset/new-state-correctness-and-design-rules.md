---
"react-doctor": minor
---

feat(react-doctor): add 11 new lint rules — 3 state / correctness, 8 design system

**3 new state / correctness rules** (all `warn`):

- `react-doctor/no-direct-state-mutation` — flags `state.foo = x` and
  in-place array mutators (`push` / `pop` / `shift` / `unshift` /
  `splice` / `sort` / `reverse` / `fill` / `copyWithin`) on `useState`
  values. Tracks shadowed names through nested function params and
  locals so a handler that re-binds the state name doesn't
  false-positive.
- `react-doctor/no-set-state-in-render` — flags only **unconditional**
  top-level setter calls so the canonical
  `if (prev !== prop) setPrev(prop)` derive-from-props pattern stays
  clean.
- `react-doctor/no-uncontrolled-input` — catches `<input value={…}>`
  without `onChange` / `readOnly`, `value` + `defaultValue` conflicts,
  and `useState()` flip-from-undefined. Bails on JSX spread props
  (`{...register(…)}`, Headless UI, Radix) where `onChange` may come
  from spread.

**8 new design-system rules in `react-ui.ts`** (all `warn`):

- `react-doctor/design-no-bold-heading` —
  `font-bold` / `font-extrabold` / `font-black` or inline
  `fontWeight ≥ 700` on `h1`–`h6`.
- `react-doctor/design-no-redundant-padding-axes` — collapse
  `px-N py-N` → `p-N`.
- `react-doctor/design-no-redundant-size-axes` — collapse `w-N h-N` →
  `size-N`.
- `react-doctor/design-no-space-on-flex-children` — use `gap-*` over
  `space-*-*`.
- `react-doctor/design-no-em-dash-in-jsx-text` — em dashes in JSX
  text.
- `react-doctor/design-no-three-period-ellipsis` — `Loading...` →
  `Loading…`.
- `react-doctor/design-no-default-tailwind-palette` —
  `indigo-*` / `gray-*` / `slate-*` reads as the Tailwind template
  default; reports every offending token in the className (not just
  the first).
- `react-doctor/design-no-vague-button-label` — `OK` / `Continue` /
  `Submit` etc.; recurses into `<>…</>` fragment children.

Each new rule has dedicated regression tests covering both the
positive trigger and the false-positive cases above.

**Other**

- Hoists shared regex / token patterns into the appropriate
  `constants.ts` per AGENTS.md.
