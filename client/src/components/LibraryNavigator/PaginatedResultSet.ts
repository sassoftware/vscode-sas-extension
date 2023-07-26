// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AxiosResponse } from "axios";

class PaginatedResultSet<T> {
  private queryForData: (start: number, end: number) => Promise<AxiosResponse>;
  private transformData: (response: AxiosResponse) => T;
  private start: number;
  private limit: number;
  private count: number;

  constructor(
    queryForData: (start: number, end: number) => Promise<AxiosResponse>,
    transformData: (response: AxiosResponse) => T
  ) {
    this.queryForData = queryForData;
    this.transformData = transformData;
    this.start = 0;
    this.limit = 0;
    this.count = 0;
  }

  public updateStartOffset(start: number): void {
    this.start = start;
  }

  public async getData(start: number, end: number): Promise<T> {
    const response = await this.queryForData(start, end);
    this.limit = response.data.limit;
    this.count = response.data.count;
    return this.prepareResponse(response);
  }

  public hasMore(): boolean {
    return this.start + this.limit < this.count;
  }

  public async getMoreResults(): Promise<T | undefined> {
    if (!this.hasMore()) {
      return;
    }
    this.start += this.limit;

    return await this.getData();
  }

  private prepareResponse(
    response: AxiosResponse
  ): T & { hasMore: boolean; start: number } {
    return {
      ...this.transformData(response),
      hasMore: this.hasMore(),
      start: this.start,
    };
  }
}

export default PaginatedResultSet;
