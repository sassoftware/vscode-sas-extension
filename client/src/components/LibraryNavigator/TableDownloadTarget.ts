// Copyright © 2026, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { TableExport } from "./types";

export interface TableDownloadTarget {
  download(
    fileName: string,
    createExport: (signal: AbortSignal) => Promise<TableExport>,
  ): Promise<void>;
}
