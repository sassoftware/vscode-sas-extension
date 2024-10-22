// Copyright © 2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { PyrightLanguageProviderBrowser } from "./browser/PyrightLanguageProviderBrowser";
import type { PyrightLanguageProviderNode } from "./node/PyrightLanguageProviderNode";

export type PyrightLanguageProvider =
  | PyrightLanguageProviderNode
  | PyrightLanguageProviderBrowser;
