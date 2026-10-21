// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

export type BrowserDownloadChoice =
  | { kind: "local"; fileName: string; token: string }
  | { kind: "unsupported" }
  | { kind: "cancelled" };
