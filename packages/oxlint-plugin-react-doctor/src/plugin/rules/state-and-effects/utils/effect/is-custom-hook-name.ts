// Mirrors upstream `isCustomHook`: a name is a custom hook iff it
// starts with "use" and the 4th character (index 3) is an uppercase
// letter — so `use`, `user`, `useless` don't match; `useState`,
// `useFoo`, `useX` do.
export const isCustomHookName = (name: string): boolean => {
  if (name.length < 4) return false;
  if (!name.startsWith("use")) return false;
  const fourthChar = name[3];
  return fourthChar >= "A" && fourthChar <= "Z";
};
