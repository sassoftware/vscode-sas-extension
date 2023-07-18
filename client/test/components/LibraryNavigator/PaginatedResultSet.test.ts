import { AxiosResponse } from "axios";
import PaginatedResultSet from "../../../src/components/LibraryNavigator/PaginatedResultSet";
import { expect } from "chai";

const axiosResponseDefaults = {
  status: 200,
  statusText: "OK",
  headers: {},
  config: {},
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

    const transformData = (response: AxiosResponse) => ({
      test: response.data.test,
    });

    const paginatedResultSet = new PaginatedResultSet(
      async () => mockAxiosResponse,
      transformData,
    );

    expect(await paginatedResultSet.getData()).to.deep.equal({
      hasMore: true,
      start: 0,
      test: "yes",
    });
  });

  it("returns multiple pages of results", async () => {
    const mockAxiosResponse: AxiosResponse = {
      ...axiosResponseDefaults,
      data: {
        limit: 10,
        count: 100,
        test: "yes",
      },
    };

    const transformData = (response: AxiosResponse) => ({
      test: response.data.test,
    });

    const paginatedResultSet = new PaginatedResultSet(
      async () => mockAxiosResponse,
      transformData,
    );

    expect(await paginatedResultSet.getData()).to.deep.equal({
      hasMore: true,
      start: 0,
      test: "yes",
    });

    expect(paginatedResultSet.hasMore()).to.equal(true);

    expect(await paginatedResultSet.getMoreResults()).to.deep.equal({
      hasMore: true,
      start: 10,
      test: "yes",
    });
  });

  it("allows updating start offfset", async () => {
    const mockAxiosResponse: AxiosResponse = {
      ...axiosResponseDefaults,
      data: {
        limit: 10,
        count: 100,
        test: "yes",
      },
    };

    const transformData = (response: AxiosResponse) => ({
      test: response.data.test,
    });

    const paginatedResultSet = new PaginatedResultSet(
      async () => mockAxiosResponse,
      transformData,
    );

    paginatedResultSet.updateStartOffset(10);
    expect(await paginatedResultSet.getData()).to.deep.equal({
      hasMore: true,
      start: 10,
      test: "yes",
    });
  });
});
