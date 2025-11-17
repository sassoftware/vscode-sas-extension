import { AxiosHeaders, AxiosResponse } from "axios";
import { expect } from "chai";

import PaginatedResultSet from "../../../src/components/LibraryNavigator/PaginatedResultSet";

const axiosResponseDefaults = {
  status: 200,
  statusText: "OK",
  headers: {},
  config: {
    headers: new AxiosHeaders(),
  },
};

describe("PaginatedResultSet", async function () {
  it("returns a basic response", async () => {
    const mockAxiosResponse: AxiosResponse = {
      ...axiosResponseDefaults,
      data: {
        limit: 0,
        count: 100,
        test: "yes",
      },
    };

    const paginatedResultSet = new PaginatedResultSet(
      async () => mockAxiosResponse,
    );

    expect(await paginatedResultSet.getData(0, 100, [])).to.deep.equal(
      mockAxiosResponse,
    );
  });
});
