import type { FileStorage, ListOptions, ListResult } from "@remix-run/file-storage";

export class BunnyFileStorage implements FileStorage {
  constructor(
    protected accessKey: string,
    protected storageZoneName: string,
  ) { }

  get(key: string): File | null | Promise<File | null> {
    throw new Error("Method not implemented.");
  }

  has(key: string): boolean | Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  list<T extends ListOptions>(options?: T): ListResult<T> | Promise<ListResult<T>> {
    throw new Error("Method not implemented.");
  }

  put(key: string, file: File): File | Promise<File> {
    throw new Error("Method not implemented.");
  }

  remove(key: string): void | Promise<void> {
    throw new Error("Method not implemented.");
  }

  set(key: string, file: File): void | Promise<void> {
    throw new Error("Method not implemented.");
  }

}
