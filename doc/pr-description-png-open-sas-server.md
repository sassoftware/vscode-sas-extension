**Summary:**
This PR enables opening PNG and other common image files from the SAS explorers using a binary-safe path and local image preview.

Previously, explorer file opens were routed through a text-oriented flow. For binary resources, this could result in incorrect handling or non-ideal editor behavior.

This change introduces a SAS resource open command path that:
- Detects image extensions when opening a resource from the tree.
- Fetches image content as binary bytes through adapter-specific binary APIs.
- Writes bytes to an extension-managed local temp file.
- Opens the file with the VS Code image preview editor.
- Preserves the existing open flow for non-image files.

Implementation highlights:
- Added optional binary read support to the ContentAdapter contract.
- Added ContentModel binary retrieval method with fallback behavior.
- Implemented binary retrieval for REST content, REST server, and ITC server adapters.
- Updated Content Navigator open command routing to use SAS.content.openResource or SAS.server.openResource.
- Updated server file metadata handling to keep size when available.

Primary files changed:
- client/src/components/ContentNavigator/ContentDataProvider.ts
- client/src/components/ContentNavigator/ContentModel.ts
- client/src/components/ContentNavigator/index.ts
- client/src/components/ContentNavigator/types.ts
- client/src/connection/itc/ItcServerAdapter.ts
- client/src/connection/rest/RestContentAdapter.ts
- client/src/connection/rest/RestServerAdapter.ts

**Testing:**
Manual validation performed:
1. Opened PNG resources from SAS Content tree and verified image preview editor opens.
2. Opened PNG resources from SAS Server tree and verified image preview editor opens.
3. Opened non-image files and verified normal editor behavior is unchanged.
4. Verified the feature path works across REST and ITC-backed adapters.

Suggested additional checks:
1. Open large image files and confirm acceptable performance.
2. Validate behavior when binary fetch fails (error handling/fallback).
3. Confirm temp preview files are created under extension global storage as expected.

**TODOs:**
- [ ] Add or update user-facing documentation if needed.
- [ ] Consider adding focused tests for image open routing and binary adapter paths.
- [ ] Optionally update [CHANGELOG.md](../CHANGELOG.md)
