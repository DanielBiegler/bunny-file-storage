# Changelog

Format:

- `Added` for new features.
- `Changed` for changes in existing functionality.
- `Deprecated` for soon-to-be removed features.
- `Removed` for now removed features.
- `Fixed` for any bug fixes.
- `Security` in case of vulnerabilities.

## 1.0.0 (first public version)

### Added

- `BunnyFileStorage` class implementing the `@remix-run/file-storage` `FileStorage` interface with custom configuration options:
  - `urlStorage` - Custom storage endpoint for different regions
  - `generateChecksums` - SHA256 checksum validation on upload (default: `true`)
  - `preserveRoot` - Prevent accidental deletion of root folder (default: `true`)

- Implements all methods
  - `get(key)` - Download a file from the storage zone
  - `has(key)` - Check if a file exists
  - `list(options)` - List files with client-side pagination support
  - `put(key, file)` - Upload a file and return it
  - `set(key, file)` - Upload a file without return value
  - `remove(key)` - Delete a file or directory recursively

- Exported custom error classes: 
  - `PreserveRootError`
  - `UnknownContentTypeError`
  - `ResponseValidationError`
  - `InputValidationError`

- Exported Types
  - `BunnyFileStorageOptions`
  - `BunnyListResponseSchema`
