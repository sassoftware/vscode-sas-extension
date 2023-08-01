// Copyright © 2023, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0

import { AxiosResponse } from "axios";

class PaginatedResultSet<T> {
  private queryForData: (start: number, end: number) => Promise<AxiosResponse>;
  private transformData: (response: AxiosResponse) => T;

  constructor(
    queryForData: (start: number, end: number) => Promise<AxiosResponse>,
    transformData: (response: AxiosResponse) => T,
  ) {
    this.queryForData = queryForData;
    this.transformData = transformData;
  }

  public async getData(start: number, end: number): Promise<T> {
    const response = await this.queryForData(start, end);
    return this.prepareResponse(response);
  }

  private prepareResponse(response: AxiosResponse): T {
    return this.transformData(response);
  }
}

export default PaginatedResultSet;
