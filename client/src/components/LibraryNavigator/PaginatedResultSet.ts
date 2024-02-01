// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

class PaginatedResultSet<T> {
  private queryForData: (start: number, end: number) => Promise<T>;

  constructor(queryForData: (start: number, end: number) => Promise<T>) {
    this.queryForData = queryForData;
  }

  public async getData(start: number, end: number): Promise<T> {
    return await this.queryForData(start, end);
  }
}

export default PaginatedResultSet;
