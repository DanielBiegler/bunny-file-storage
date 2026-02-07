# @danielbiegler/bunny-file-storage

An implementation of [@remix-run/file-storage](https://github.com/remix-run/remix/tree/3921f065331f6b28e0c29750f1e757a4e09feebc/packages/file-storage) that uses Bunny.net Object Storage as the storage backend.

## Features

- Simple, intuitive key/value API (like [Web Storage](https://developer.mozilla.org/en-US/docs/Web/API/Web_Storage_API), but for `File`s instead of strings)
- A generic `FileStorage` class that works with Bunny.net Object Storage
- SHA256 checksum validation on upload (configurable)
- Protection against accidental root folder deletion (configurable)
- Cursor based pagination for listing files

## Why

Easily let's you swap storage adapters between different environments due to a shared interface, meaning:

- When developing locally, uploaded files can simply be written directly to disk
- In production uploaded files get handled by a dedicated storage service API, Bunny.net in this case

## Installation

Install from npm:

<a href="https://www.npmjs.com/package/@danielbiegler/bunny-file-storage" target="_blank">
  <img src="https://badge.fury.io/js/@danielbiegler%2Fbunny-file-storage.svg" alt="npm version badge" height="18">
</a>

```shell
bun add @danielbiegler/bunny-file-storage
npm i @danielbiegler/bunny-file-storage
pnpm add @danielbiegler/bunny-file-storage
# ...
```

Or build it locally via:

```shell
bun run build
```

See [package.json](./package.json) for details.

## Usage

```ts
import { BunnyFileStorage } from "@danielbiegler/bunny-file-storage";

const storage = new BunnyFileStorage(
  "your-access-key", // Found in your storage zone details
  "your-storage-zone-name"
);

const key = "/path/to/hello.txt";
const file = new File(/* ... */);

// Create & Update (Bunny does not distinguish - 2026-02-07)
await storage.set(key, file);
await storage.put(key, file);

// Read
await storage.has(key);
await storage.get(key);

// Delete
await storage.remove(key);

// List files in a directory
await storage.list({ prefix: "/path/to/", includeMetadata: true });

// Paginate through files
const page1 = await storage.list({ prefix: "/", limit: 10 });
const page2 = await storage.list({ prefix: "/", limit: 10, cursor: page1.cursor });
```

## Configuration

```ts
const storage = new BunnyFileStorage("access-key", "storage-zone", {
  // Custom storage endpoint for different regions
  // Default: "https://storage.bunnycdn.com"
  urlStorage: "https://se.storage.bunnycdn.com",

  // Enable/disable SHA256 checksum validation on upload
  // Default: true
  generateChecksums: false,

  // Prevent accidental deletion of root folder ("" or "/")
  // Default: true
  preserveRoot: false,
});
```

## Tests

```bash
bun run test
```

> [!TIP]
> **For integration tests valid credentials are required.** Obtain them from your Bunny Dashboard. Afterwards see `.env.example` and copy them over to `.env`

There's a suite of tests covering failure cases before every release, see:

```
✓ BunnyFileStorage > list > Fail due to invalid inputs
✓ BunnyFileStorage > remove > Fail due to empty key
✓ BunnyFileStorage > remove > Fail due to root key

✓ Integration Tests > create > Successfully create via "put"
✓ Integration Tests > create > Successfully create via "set"
✓ Integration Tests > list > Successfully list directory content with metadata
✓ Integration Tests > list > Successfully list directory with limit and cursor
✓ Integration Tests > get > Successfully download file
✓ Integration Tests > get > Fail to download file because it does not exist
✓ Integration Tests > has > Successfully check file
✓ Integration Tests > has > Successfully check non-existing file
✓ Integration Tests > remove > Successfully remove file
✓ Integration Tests > remove > Fail to remove file because it does not exist
```

## License

MIT - See [LICENSE](./LICENSE)

## Author

- [Daniel Biegler](https://www.danielbiegler.de) with love for Open Source