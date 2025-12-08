// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { RLanguageProviderBrowser } from "./browser/RLanguageProviderBrowser";
import type { RLanguageProviderNode } from "./node/RLanguageProviderNode";

/**
 * Union type for R Language Provider implementations.
 *
 * - Node: Full R language server support (spawns external R process)
 * - Browser: Stub implementation (R not available in WASM yet)
 */
export type RLanguageProvider =
  | RLanguageProviderNode
  | RLanguageProviderBrowser;
