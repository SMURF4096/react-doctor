import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vite-plus/test";

import { fileExists } from "../../src/cookies/utils/file-exists";

let scratchDir: string;

beforeAll(async () => {
  scratchDir = await fs.mkdtemp(path.join(os.tmpdir(), "rd-file-exists-"));
});

afterAll(async () => {
  await fs.rm(scratchDir, { recursive: true, force: true });
});

describe("fileExists", () => {
  it("returns true when the path exists", async () => {
    const target = path.join(scratchDir, "present.txt");
    await fs.writeFile(target, "hi", "utf8");
    expect(await fileExists(target)).toBe(true);
  });

  it("returns false when the path does not exist", async () => {
    expect(await fileExists(path.join(scratchDir, "missing.txt"))).toBe(false);
  });

  it("returns true for a directory", async () => {
    const subdir = path.join(scratchDir, "subdir");
    await fs.mkdir(subdir);
    expect(await fileExists(subdir)).toBe(true);
  });
});
