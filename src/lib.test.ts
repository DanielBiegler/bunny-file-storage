import { describe, expect, test } from "bun:test";
import { BunnyFileStorage, PreserveRootError } from "./lib";

describe("BunnyFileStorage: Default", () => {
  const fs = new BunnyFileStorage("access-key", "storage-zone");

  describe("remove", () => {
    test("Fail due to empty key", async () => {
      expect(fs.remove("")).rejects.toBeInstanceOf(PreserveRootError);
    });

    test("Fail due to root key", async () => {
      expect(fs.remove("/")).rejects.toBeInstanceOf(PreserveRootError);
    });
  })
})
