import type { FileKey, FileMetadata, FileStorage, ListOptions, ListResult } from "@remix-run/file-storage";

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

  /**
   * Download a file from the storage zone.
   * Check the `Error.cause` to see Bunnys response in case they reply with a non-OK status code.
   *
   * @param key The path to your file.
   * @returns The file, or `null` if it does not exist.
   * @throws {Error} If the server responds with a non-OK status code other than `404`.
   * @throws {TypeError} If the URL is invalid, see {@link URL}
   * @see https://docs.bunny.net/api-reference/storage/manage-files/download-file
   */
  async get(key: string): Promise<File | null> {
    const url = new URL(this.bunnyUrl(key), this.config.urlStorage);

    const res = await fetch(url, {
      method: "GET",
      headers: { ...this.defaultHeaders() },
    });

    if (res.status === 404) return null;

    if (!res.ok) {
      const content = res.headers.get("Content-Type") === "application/json" ? await res.json() : undefined;
      throw new Error(`Failed to get file, status code: ${res.status} ${res.statusText}`, { cause: content });
    }

    const blob = await res.blob();
    const filename = key.split("/").pop() ?? key;
    return new File([blob], filename, { type: blob.type });
  }

  /**
   * Checks whether or not the given file exists in your storage zone.
   * Check the `Error.cause` to see Bunnys response in case they reply with neither `200` or `404` status code.
   * 
   * Currently `(2026-02-05)` the Bunny Storage API can indeed fetch only the metadata instead
   * of the entire file content by using the http method `DESCRIBE` but this is undocumented.
   * The official SDK uses this though, see [here](https://github.com/BunnyWay/edge-script-sdk/blob/863746676d770e2abde540616610202ed77615a5/libs/bunny-storage/src/file.ts#L133)
   * 
   * @param key The path to your file.
   * @returns Whether or not the file exists
   * @throws {TypeError} If the URL is invalid, see {@link URL}
   * @throws {Error} If the response status code is neither `200` or `404`
   * @see https://docs.bunny.net/api-reference/storage/browse-files/list-files
   */
  async has(key: string): Promise<boolean> {
    const url = new URL(this.bunnyUrl(key), this.config.urlStorage);

    const res = await fetch(url, {
      method: "DESCRIBE",
      headers: { ...this.defaultHeaders() },
    });

    if (res.status !== 200 && res.status !== 404) {
      const content = res.headers.get("Content-Type") === "application/json" ? await res.json() : undefined;
      throw new Error(`Failed to check existence, status code: ${res.status} ${res.statusText}`, { cause: content });
    }

    return res.ok;
  }

  /**
   * List files in the storage zone.
   * Directories are filtered out since the `FileStorage` interface only deals with files.
   *
   * Note: Bunny.net does not support pagination, so the `cursor` and `limit` options are ignored
   * and the returned `cursor` will always be `undefined`.
   * 
   * // TODO add client side pagination but add disclaimer in jsdoc
   *
   * @param options Options for listing files.
   * @param options.prefix The directory path to list. Defaults to `"/"`.
   * @param options.includeMetadata If `true`, include file metadata (name, size, type, lastModified) in the result.
   * @returns The list of files.
   * @throws {UnknownContentTypeError} If Bunny.net responds with a non-JSON content type.
   * @throws {ValidationError} If the response payload does not match the expected schema.
   * @throws {TypeError} If the URL is invalid, see {@link URL}
   * @see https://docs.bunny.net/api-reference/storage/browse-files/list-files
   */
  async list<T extends ListOptions>(options?: T): Promise<ListResult<T>> {
    const prefix = options?.prefix ?? "/";
    const path = prefix.endsWith("/") ? prefix : `${prefix}/`;
    const url = new URL(this.bunnyUrl(path), this.config.urlStorage);

    const res = await fetch(url, {
      method: "GET",
      headers: { ...this.defaultHeaders() },
    });

    if (res.headers.get("Content-Type") !== "application/json")
      throw new UnknownContentTypeError(`Expected a JSON response but Bunny.net replied with: ${res.headers.get("Content-Type")}`);

    const content = await res.json() as BunnyListResponseSchema;
    if (!Array.isArray(content))
      throw new ValidationError(`Expected an array but Bunny.net replied with: "${typeof content}"`);

    // Filtering out directories because the FileStorage Interface only deals with files
    const files = content.filter(item => {
      if (typeof item.IsDirectory !== "boolean")
        throw new ValidationError(`Expected "IsDirectory" to be a boolean but got "${typeof item.IsDirectory}"`);

      return !item.IsDirectory
    });

    const outputFiles = files.map(f => {
      if (typeof f.Path !== "string") throw new ValidationError(`Expected "Path" to be a string but got: "${typeof f.Path}"`);
      if (typeof f.ObjectName !== "string") throw new ValidationError(`Expected "ObjectName" to be a string but got: "${typeof f.ObjectName}"`);
      if (typeof f.Length !== "number") throw new ValidationError(`Expected "Length" to be a string but got: "${typeof f.Length}"`);
      if (typeof f.LastChanged !== "string") throw new ValidationError(`Expected "LastChanged" to be a string but got: "${typeof f.LastChanged}"`);
      if (typeof f.ContentType !== "string") throw new ValidationError(`Expected "ContentType" to be a string but got: "${typeof f.ContentType}"`);

      const key = `${f.Path}${f.ObjectName}`;

      if (options?.includeMetadata === true) {
        const time = new Date(f.LastChanged).getTime();
        if (isNaN(time)) throw new ValidationError(`Expected "LastChanged" to convert to a Date but failed, tried converting: "${f.LastChanged}"`);

        return {
          key,
          name: f.ObjectName,
          lastModified: time,
          size: f.Length,
          type: f.ContentType,
        } satisfies FileMetadata
      }

      return { key } satisfies FileKey;
      // Sadly typescript control flow analysis doesnt connect metadata option to the output
      // But due to `satisfies` we can still get overall benefits
    }) as ListResult<T>["files"];

    return {
      cursor: undefined,
      files: outputFiles,
    }
  }

  /**
   * Upload a file to the storage zone and return it.
   * Check the `Error.cause` to see Bunnys response in case they reply with a non-OK status code.
   * 
   * Please note that the `FileStorage`-Interface says the `put`-method is supposed to return
   * the **"new"** storage-backed file, but since this `FileStorage`-implementation is a remote upload
   * there cannot be a storage-backed "File"-object, so we simply return the passed in `file`.
   *
   * @param key The path to your file.
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
   * @param key The path to your file.
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
   * @param key The path to your file.
   * @throws {Error} If the server responds with a non-OK status code.
   * @throws {PreserveRootError} If `preserveRoot` is enabled and `key` is either `""` or `"/"`.
   * @throws {TypeError} If the URL is invalid, see {@link URL}
   * @see https://docs.bunny.net/api-reference/storage/manage-files/delete-file
   */
  async remove(key: string): Promise<void> {
    if (this.config.preserveRoot && (key === "" || key === "/")) {
      throw new PreserveRootError('Denied deletion of root folder because "preserveRoot" is true. You may disable this via the constructor options.');
    }

    const url = new URL(this.bunnyUrl(key), this.config.urlStorage);

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
    const url = new URL(this.bunnyUrl(key), this.config.urlStorage);

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
   */
  private async generateChecksum(file: File): Promise<string> {
    const hashBuffer = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const checksum = hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
    return checksum.toUpperCase();
  }

  /* Don't repeat yourself */

  private defaultHeaders = () => ({ Accept: 'application/json', AccessKey: `${this.accessKey}` });
  private bunnyUrl = (key: string) => `/${this.storageZoneName}${key.startsWith("/") ? key : `/${key}`}`;
}

/** For defensive purposes everything is optional to enforce checks */
export type BunnyListResponseSchema = null | undefined | Array<{
  IsDirectory?: boolean;
  /** Just the directory without filename, see `ObjectName` */
  Path?: string;
  /** Filename without path */
  ObjectName?: string;
  /** Should be in ISO format */
  LastChanged?: string;
  /** Should be bytes */
  Length?: number;
  /** Should be MIME type or empty */
  ContentType?: string;
}>;

export class PreserveRootError extends Error {
  constructor(reason?: string) {
    super(reason);
    this.name = "PreserveRootError";
  }
}

export class UnknownContentTypeError extends Error {
  constructor(reason?: string) {
    super(reason);
    this.name = "UnknownContentTypeError";
  }
}

export class ValidationError extends Error {
  constructor(reason?: string) {
    super(reason);
    this.name = "ValidationError";
  }
}
