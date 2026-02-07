import { describe, expect, test } from "bun:test";
import { BunnyFileStorage, InputValidationError, PreserveRootError } from "./lib";

describe("BunnyFileStorage", () => {
  const fs = new BunnyFileStorage("access-key", "storage-zone");

  describe.concurrent("list", () => {
    test("Fail due to invalid inputs", async () => {
      const limit = fs.list({ limit: -1 });
      expect(limit).rejects.toThrow("limit");
      expect(limit).rejects.toBeInstanceOf(InputValidationError);

      const cursor = fs.list({ cursor: "-1" });
      expect(cursor).rejects.toThrow("cursor");
      expect(cursor).rejects.toBeInstanceOf(InputValidationError);
    });
  });

  describe.concurrent("remove", () => {
    test("Fail due to empty key", async () => {
      expect(fs.remove("")).rejects.toBeInstanceOf(PreserveRootError);
    });

    test("Fail due to root key", async () => {
      expect(fs.remove("/")).rejects.toBeInstanceOf(PreserveRootError);
    });
  })
})
