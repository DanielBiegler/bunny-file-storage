import type { FileStorage, ListOptions, ListResult } from "@remix-run/file-storage";

export type BunnyFileStorageOptions = {
  /**
   * @default "https://storage.bunnycdn.com"
   * @example "https://se.storage.bunnycdn.com"
   * @see https://docs.bunny.net/storage/http#storage-endpoints
   */
  urlStorage: string;
  /**
   * Whether or not the `put` and `set` methods should calculate a SHA256 hash before uploading,
   * which the server will compare the uploaded object to and reject the request in case of mismatch.
   * @default true
   */
  generateChecksums: boolean;
  /**
   * As of right now `(2026-02-04)` bunny lets you delete your entire storage zone recursively,
   * when deleting the root path `"/"`. Since this is pretty dangerous, by default we check
   * whether or not the specified storage key is either empty `""` or the root folder `"/"` and disallow deletion.
   * Only set this option to `false` if you know what you're doing.
   * @default true
   */
  preserveRoot: boolean;
}

/**
 * Creates a {@link FileStorage} that is backed by Bunny.net using {@link fetch}.
 */
export class BunnyFileStorage implements FileStorage {
  protected config: BunnyFileStorageOptions = {
    urlStorage: "https://storage.bunnycdn.com",
    generateChecksums: true,
    preserveRoot: true,
  };

  /**
   * @param accessKey The storage zone password also doubles as your API key. You can find it in your storage zone details page in the bunny.net dashboard.
   * @param storageZoneName The name of your storage zone where you are connecting to.
   * @param options Optional overwrites to alter the behavior of this object.
   */
  constructor(
    protected accessKey: string,
    protected storageZoneName: string,
    options?: Partial<BunnyFileStorageOptions>,
  ) {
    Object.assign(this.config, options);
  }

  get(key: string): File | null | Promise<File | null> {
    throw new Error("Method not implemented.");
  }

  has(key: string): boolean | Promise<boolean> {
    throw new Error("Method not implemented.");
  }

  list<T extends ListOptions>(options?: T): ListResult<T> | Promise<ListResult<T>> {
    throw new Error("Method not implemented.");
  }

  /**
   * Upload a file to the storage zone and return it.
   * Check the `Error.cause` to see Bunnys response in case they reply with a non-OK status code.
   * 
   * Please note that the `FileStorage`-Interface says the `put`-method is supposed to return
   * the **"new"** storage-backed file, but since this `FileStorage`-implementation is a remote upload
   * there cannot be a storage-backed "File"-object, so we simply return the passed in `file`.
   *
   * @param key The directory path to store the file under.
   * @param file The file to upload.
   * @returns The uploaded file.
   * @throws {Error} If the server responds with a non-OK status code.
   * @throws {TypeError} If the URL is invalid, see {@link URL}
   * @see https://docs.bunny.net/api-reference/storage/manage-files/upload-file
   */
  put(key: string, file: File): Promise<File> {
    return this.uploadFile(key, file);
  }

  /**
   * Upload a file to the storage zone.
   * Check the `Error.cause` to see Bunnys response in case they reply with a non-OK status code.
   * 
   * @param key The directory path to store the file under.
   * @param file The file to upload.
   * @throws {Error} If the server responds with a non-OK status code.
   * @throws {TypeError} If the URL is invalid, see {@link URL}
   * @see https://docs.bunny.net/api-reference/storage/manage-files/upload-file
   */
  set(key: string, file: File): void | Promise<void> {
    return void this.uploadFile(key, file);
  }

  /**
   * Delete an object from the storage zone.
   * In case the object is a directory all the data in it will be recursively deleted as well.
   * Check the `Error.cause` to see Bunnys response in case they reply with a non-OK status code.
   * 
   * @param key The directory path to your file.
   * @throws {Error} If the server responds with a non-OK status code.
   * @throws {PreserveRootError} If `preserveRoot` is enabled and `key` is either `""` or `"/"`.
   * @throws {TypeError} If the URL is invalid, see {@link URL}
   * @see https://docs.bunny.net/api-reference/storage/manage-files/delete-file
   */
  async remove(key: string): Promise<void> {
    if (this.config.preserveRoot && (key === "" || key === "/")) {
      throw new PreserveRootError('Denied deletion of root folder because "preserveRoot" is true. You may disable this via the constructor options.');
    }

    const url = new URL(this.bunnyUrl(this.storageZoneName, key), this.config.urlStorage);

    const res = await fetch(url, {
      method: "DELETE",
      headers: { ...this.defaultHeaders() },
    });

    if (!res.ok) {
      const content = res.headers.get("Content-Type") === "application/json" ? await res.json() : undefined;
      throw new Error(`Deletion failed with status code: ${res.status} ${res.statusText}`, { cause: content });
    }
  }

  /**
 * Currently `(2026-02-05)` the Bunny Storage API has only one way of uploading files, so this is
 * a helper function to share implementation between `set` and `put` of the `FileStorage`-Interface.
 * @returns passed in File
 */
  private async uploadFile(key: string, file: File): Promise<File> {
    const url = new URL(this.bunnyUrl(this.storageZoneName, key), this.config.urlStorage);

    const headers: Record<string, string> = {
      ...this.defaultHeaders(),
      "Content-Type": "application/octet-stream",
    };

    if (this.config.generateChecksums) {
      headers["Checksum"] = await this.generateChecksum(file);
    }

    const res = await fetch(url, {
      method: "PUT",
      headers,
      body: file.stream(),
    });

    if (!res.ok) {
      const content = res.headers.get("Content-Type") === "application/json" ? await res.json() : undefined;
      throw new Error(`Upload failed with status code: ${res.status} ${res.statusText}`, { cause: content });
    }

    return file;
  }

  /**
   * Generates the SHA256 checksum for consumption by the Bunny.net API
   * # TODO might need to be uppercase
   */
  private async generateChecksum(file: File): Promise<string> {
    const hashBuffer = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const checksum = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    return checksum;
  }

  /* Don't repeat yourself */

  private defaultHeaders = () => ({ Authorization: `AccessKey: ${this.accessKey}` });
  private bunnyUrl = (storageZoneName: string, key: string) => `/${storageZoneName}/${key}`;
}

export class PreserveRootError extends Error {
  constructor(reason: string) {
    super(reason);
    this.name = "PreserveRootError";
  }
}
