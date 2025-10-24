// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import type { SortModelItem } from "ag-grid-community";

class PaginatedResultSet<T> {
  constructor(
    protected readonly queryForData: PaginatedResultSet<T>["getData"],
  ) {}

  public async getData(
    start: number,
    end: number,
    sortModel: SortModelItem[],
  ): Promise<T> {
    return await this.queryForData(start, end, sortModel);
  }
}

export default PaginatedResultSet;
