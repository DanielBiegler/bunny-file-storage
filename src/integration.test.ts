import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { BunnyFileStorage } from "./lib";

const accessKey = assertEnvVar("BUNNY_ACCESS_KEY");
const storageZoneName = assertEnvVar("BUNNY_STORAGE_ZONE_NAME");
const SLEEP = 1000; // Global sleep between requests to avoid getting throttled

describe.serial("Integration Tests", () => {
  const fs = new BunnyFileStorage(accessKey, storageZoneName);
  const keyTestFolder = "temporary-integration-test/"; // Trailing slash is required (2026-02-05)
  const nonExistingFileKey = `/${keyTestFolder}NON_EXISTING_FILE`;

  // Note: Purposefully not using lifecycle hooks for uploading files
  // because for whatever reason the runner executed in the wrong order
  // even when awaiting... This is not ideal, but for now lets just make it work...
  // This means tests transiently test multiple methods but thats fine for now.

  afterAll(async () => {
    console.log(`Removing test folder "${keyTestFolder}" ...`)
    await fs.remove(keyTestFolder)
    console.log(`Removed test folder "${keyTestFolder}"`)
  });

  describe.serial("create", async () => {
    const newFileKey = `/${keyTestFolder}put.txt`;
    const newFile = new File(["new file"], "put.txt");

    afterEach(async () => await sleep(SLEEP));

    test('Successfully create via "put"', async () => {
      const file = await fs.put(newFileKey, newFile);
      expect(file.name).toEqual(newFile.name);
    });

    test('Successfully create via "set"', async () => {
      expect(await fs.set(newFileKey, newFile)).toBeUndefined();
    });
  });

  describe.serial("list", async () => {
    const newFileFolder = `/${keyTestFolder}list/`;
    const newFile01Name = "list-01.txt";
    const newFile01Key = `${newFileFolder}${newFile01Name}`;
    const newFile01Content = "new file in list";
    const newFile01 = new File([newFile01Content], `${newFile01Name}`);

    await fs.set(newFile01Key, newFile01);
    await sleep(SLEEP);
    afterEach(async () => await sleep(SLEEP));

    test('Successfully list directory content', async () => {
      const res = await fs.list({ prefix: newFileFolder, includeMetadata: true });
      expect(res.files.length).toBe(1);
      expect(res.files[0].key).toEndWith(newFile01Key);
      expect(res.files[0].name).toBe(newFile01Name);
      expect(res.files[0].size).toBe(newFile01Content.length);
      // TODO mime type
      // TODO lastchanged
    });
  });

  describe.serial("get", async () => {
    const newFileKey = `/${keyTestFolder}get.txt`;
    const newFileContent = Date.now().toString();
    const newFile = new File([newFileContent], "get.txt");

    await fs.put(newFileKey, newFile);
    await sleep(SLEEP);
    afterEach(async () => await sleep(SLEEP));

    test("Successfully download file", async () => {
      const file = await fs.get(newFileKey);
      expect(file).toBeInstanceOf(File);
      expect(await file?.text()).toEqual(newFileContent);
    })

    test("Fail to download file because it does not exist", async () => {
      const file = await fs.get(nonExistingFileKey);
      expect(file).toBeNull();
    })
  })

  describe.serial("has", async () => {
    const newFileKey = `/${keyTestFolder}has.txt`;
    const newFile = new File(["hello world"], "has.txt");

    await fs.set(newFileKey, newFile);
    await sleep(SLEEP);
    afterEach(async () => await sleep(SLEEP));

    test("Successfully check file", async () => {
      const exists = await fs.has(newFileKey);
      expect(exists).toBeTrue();
    })

    test("Successfully check non-existing file", async () => {
      const exists = await fs.has(nonExistingFileKey);
      expect(exists).toBeFalse();
    })
  })

  describe.serial("remove", async () => {
    const newFileKey = `/${keyTestFolder}remove.txt`;
    const newFile = new File(["this file should get removed"], "remove.txt");

    afterEach(async () => await sleep(SLEEP));

    test("Successfully remove file", async () => {
      await fs.set(newFileKey, newFile);
      await sleep(SLEEP);

      expect(await fs.has(newFileKey)).toBeTrue();
      await sleep(SLEEP);

      await fs.remove(newFileKey);
      await sleep(SLEEP);

      expect(await fs.has(newFileKey)).toBeFalse();
    })

    test("Fail to remove file because it does not exist", async () => {
      await expect(fs.remove(nonExistingFileKey)).rejects.toThrow("Deletion failed with status code: 404 Not Found");
    })
  })
})



/* * * * Helpers * * * */

const sleep = async (ms: number) => new Promise((res) => setTimeout(res, ms));

function assertEnvVar(key: string) {
  const value = process.env[key];

  if (value === undefined || value === "") {
    console.error(`ERROR: Env variable is missing: ${key}`);
    process.exit(1);
  }

  return value;
}
