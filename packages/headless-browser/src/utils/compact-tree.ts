import { getIndentLevel } from "./get-indent-level";

const REF_MARKER = "[ref=";

const isContentLine = (line: string): boolean =>
  line.includes(REF_MARKER) || (line.includes(":") && !line.endsWith(":"));

export const compactTree = (tree: string): string => {
  const lines = tree.split("\n");
  const indents = lines.map(getIndentLevel);
  const retained = new Array<boolean>(lines.length).fill(false);

  for (let index = lines.length - 1; index >= 0; index--) {
    if (!isContentLine(lines[index])) continue;

    retained[index] = true;

    // HACK: narrow `targetIndent` each time we accept a true ancestor.
    // Without this, the comparison stays anchored at the content line's
    // indent forever, so any preceding shallower line gets retained —
    // including SIBLINGS of the actual parent. The aunt's subtree
    // would survive even though only the parent chain should.
    let targetIndent = indents[index];
    for (let ancestor = index - 1; ancestor >= 0; ancestor--) {
      if (indents[ancestor] >= targetIndent) continue;
      if (retained[ancestor]) break;
      retained[ancestor] = true;
      targetIndent = indents[ancestor];
    }
  }

  return lines.filter((_, index) => retained[index]).join("\n");
};
