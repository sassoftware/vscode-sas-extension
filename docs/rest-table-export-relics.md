# REST Table Export Relics After Fix/2121

## Scope and Method

This finding records what can be removed or changed after `fix/2121` stopped
using extension-generated SAS code as the REST table-export producer. It is
based on the current branch `fix/2121` at `817a111e`, repository source and
history, and first-party API documentation. The transition was traced through:

- [`7a009863`](https://github.com/sassoftware/vscode-sas-extension/commit/7a009863afb45d2b511f64a623eab9a6142a87a1), which changed REST export to the native/paged path and removed the REST adapter's `ComputeFile` call;
- [`a8fd4e80`](https://github.com/sassoftware/vscode-sas-extension/commit/a8fd4e80b374af5b50037128c663ba4bae87e627), which deleted `client/src/connection/rest/file.ts` and its dedicated test; and
- the current branch commits `90f2bf0a`, `c31c4b03`, and `817a111e`, which refine direct REST table handling and browser-local destinations.

Line references below are from the current checkout. The external contract is
the official [SAS Compute v24 API index](https://developer.sas.com/rest-apis/compute-v24/index.md)
and its [authoritative OpenAPI specification](https://developer.sas.com/api/apis/compute-v24/specifications/openapi.yml).
The official specification lists `GET /sessions/{sessionId}/data/{libref}/{tableName}/rows#CSV`
as “Get row information as comma-separated values”, and separately lists
fileref content download and job execution. This distinguishes the native
row-CSV export from the deleted custom flow, which submitted SAS code and
downloaded a generated fileref.

## Findings

### Remove

#### Already removed: custom REST producer and dedicated tests

No current file should be recreated for the old producer. Commit `a8fd4e80`
deletes `client/src/connection/rest/file.ts` (the `ComputeFile` class) and
`client/test/connection/rest/ComputeFile.test.ts`. The parent version shows
that the class generated SAS code, submitted a Compute job, polled job state,
read logs and a status variable, downloaded a fileref, and cleaned up those
resources. The current source has no `ComputeFile` reference (`git log -S'ComputeFile'`
ends at `a8fd4e80`).

#### Candidate: custom-export branch and interface members

The only concrete adapters in the repository are the REST and ITC adapters.
Neither current adapter implements `LibraryAdapter.createTableExport`:

- `client/src/connection/rest/RestLibraryAdapter.ts:30-42` declares REST
  support but has no `createTableExport` method;
- `client/src/connection/itc/ItcLibraryAdapter.ts:178-217` implements the
  generic `getRowsAsCSV`/`getTableRowCount` contract instead.

Consequently, these members are now dead as an implementation path and can be
removed if `LibraryAdapter` is confirmed to be internal (there is no exported
extension API for it):

- `client/src/components/LibraryNavigator/types.ts:48-52`, optional
  `supportsTableExport` and `createTableExport`;
- `client/src/components/LibraryNavigator/LibraryModel.ts:39-50`, the
  custom-export dispatch in `createTableExport`;
- `client/src/components/LibraryNavigator/LibraryModel.ts:183-189`, the
  duplicate custom-export dispatch in `writeTableContents`; and
- the custom-export fixture/test in
  `client/test/components/LibraryNavigator/LibraryModelTableExport.test.ts:52-92`
  and `:144-183`.

This is a candidate removal, not a claim that the whole download method should
go: its paged implementation is the active generic path. The safe replacement
is to make `createPagedTableExport` the single path and retain its cancellation
and disposal tests.

## Change

### Remove the REST-only capability flag or make it describe the real capability

`RestLibraryAdapter` still has `supportsTableExport = true` at
`client/src/connection/rest/RestLibraryAdapter.ts:39-42`, and
`LibraryModel.assertTableExportSupported()` only rejects a missing adapter or
an explicit `false` at `client/src/components/LibraryNavigator/LibraryModel.ts:28-37`.
After `a8fd4e80`, the flag no longer means “this adapter has a custom exporter”.
It is therefore misleading and can be removed if all adapters use the generic
row-reading contract. If retained for future adapter capability negotiation,
rename/document it as support for generic table export, not REST custom export,
and test the actual capability.

### Update wording that implies a custom producer

`docs/table-download-proxy.md:3-4`, `:59`, and `:74-75` use “producer” and
“SAS table export” in a way that can be read as the deleted SAS-program
producer. The proxy itself is still used by the host-attachment target, so the
document should be changed rather than deleted: say “native REST row-CSV
request” or “export stream” where that is what is meant, and reserve
“producer” for the active adapter/request. The route contract, transfer-token
constraints, streaming requirement, and cancellation behavior remain relevant
to the current host listener.

### Simplify the REST adapter's setup assumptions

Commit `7a009863` removed the REST adapter method that explicitly raced
`setup()` against a 30-second cancellation timeout. Current REST export uses
`getTableRowCount()` (`RestLibraryAdapter.ts:252-269`) and
`getRowsAsCSV()` (`:146-174`), while `LibraryModel` performs setup and abort
coordination for the generic path (`LibraryModel.ts:52-121`). Any remaining
REST-specific setup/timeout or producer-cleanup assumptions should be removed
from tests and docs; none of the current source references the deleted job,
fileref, log, or variable lifecycle.

## Retain

### Native REST row-CSV API integration

Retain `RestLibraryAdapter.getRowsAsCSV()` at
`client/src/connection/rest/RestLibraryAdapter.ts:146-174` and the generated
operation in `client/src/connection/rest/api/compute.ts:5892-5937`. The adapter
requests `includeColumnNames`, `includeIndex`, and a bounded `limit`, then
maps the native response into the shared table-row model. This is supported by
the SAS OpenAPI operation, not a relic of the custom producer.

### Shared paged export infrastructure

Retain `LibraryModel.createPagedTableExport()` at
`client/src/components/LibraryNavigator/LibraryModel.ts:52-121`, the shared
`TableExport` stream/dispose shape at `types.ts:94-97`, and the required
`getRowsAsCSV`/`getTableRowCount` adapter methods at `types.ts:74-81`.
The ITC adapter uses those methods at `ItcLibraryAdapter.ts:178-217`, and the
REST adapter uses them at `RestLibraryAdapter.ts:146-174` and `:252-269`.
This is generic table-download infrastructure, even though the old REST
implementation has gone.

### Download targets, commands, and host attachment configuration

Retain the browser, filesystem, and host-attachment targets wired in
`client/src/components/LibraryNavigator/index.ts:33-37` and `:220-223`,
`:370-403`. Retain the three current command contributions and web submenu in
`package.json:882-895` and `:1184-1192`, plus their tests in
`LibraryModelTableExport.test.ts:185-225`. These are destination/UI plumbing,
not custom SAS export code.

The host listener's `external-uri`/`fixed-proxy` modes and environment/settings
contract remain documented in `docs/table-download-proxy.md:3-43` and
implemented by `HostAttachmentDownloadTarget.ts:18-78`. This is consistent
with the official VS Code API: `env.asExternalUri` resolves a URI accessible
outside the extension host, including remote port forwarding
([VS Code API, `env.asExternalUri`](https://code.visualstudio.com/api/references/vscode-api#env.asExternalUri)).

## Uncertain / Verify Before Removing

- `LibraryAdapter.createTableExport` and `supportsTableExport` are currently
  repository-internal by source search, but they are TypeScript interfaces used
  by tests and could be consumed by an unpublished extension-side integration.
  Confirm no downstream consumer before deleting them.
- `TableExport` itself should not be removed merely because the custom producer
  disappeared. Both native/paged paths return a stream and a disposal hook,
  and the file/browser targets consume that contract.
- Do not remove `FilesApi`, `JobsApi`, `LogsApi`, `VariablesApi`, fileref APIs,
  or Compute job/session APIs solely because `ComputeFile` was deleted. The
  old producer no longer references them, but the official Compute API still
  exposes jobs, filerefs, files, logs, and variables for other extension
  features. Verify each symbol's independent callers before cleanup.

## Bottom Line

The custom REST SAS-program exporter and its dedicated test are already gone.
The actionable relics are the unused custom-export abstraction and the
capability naming/wording around it. The native SAS row-CSV call, paged
fallback, stream/dispose contract, download destinations, proxy configuration,
commands, and related tests are still live and should be retained.
