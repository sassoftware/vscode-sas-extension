// Copyright © 2026, SAS Institute Inc., Cary, NC, USA. All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import axios from "axios";
import { expect } from "chai";
import * as sinon from "sinon";

import RestLibraryAdapter from "../../../src/connection/rest/RestLibraryAdapter";
import { DataAccessApi } from "../../../src/connection/rest/api/compute";

class TestAdapter extends RestLibraryAdapter {
  constructor(api: ReturnType<typeof DataAccessApi>) {
    super();
    this.dataAccessApi = api;
    this.sessionId = "test-session";
  }
}

describe("REST temporary library creation", () => {
  let adapter: TestAdapter;
  let getLibraries: sinon.SinonStub;
  let createLibrary: sinon.SinonStub;

  beforeEach(() => {
    const api = DataAccessApi();
    getLibraries = sinon.stub(api, "getLibraries");
    getLibraries.resolves({ data: { items: [], count: 0 } });
    createLibrary = sinon.stub(api, "createLibrary");
    createLibrary.resolves();
    adapter = new TestAdapter(api);
  });

  afterEach(() => sinon.restore());

  it("creates _TEMP1 when the filtered response is empty", async () => {
    expect((await adapter.acquireTemporaryLibrary("/data")).name).to.equal(
      "_TEMP1",
    );
    expect(createLibrary.firstCall.args[0]).to.deep.equal({
      sessionId: "test-session",
      libraryRequest: {
        name: "_TEMP1",
        engine: "V9",
        path: "/data",
        options: ["ACCESS=READONLY"],
      },
    });
  });

  it("makes one request with the exact server-side filter", async () => {
    await adapter.acquireTemporaryLibrary("/data");
    expect(
      getLibraries.calledOnceWithExactly(
        { sessionId: "test-session", start: 0, limit: 1000 },
        {
          headers: { Accept: "application/vnd.sas.collection+json" },
          params: { filter: "startsWith($primary,name,'_TEMP')" },
        },
      ),
    ).to.equal(true);
  });

  it("creates a fresh assignment for every open, even for the same folder", async () => {
    await adapter.acquireTemporaryLibrary("/data");
    getLibraries.resolves({
      data: { items: [{ id: "_TEMP1" }], count: 1 },
    });
    expect((await adapter.acquireTemporaryLibrary("/data")).name).to.equal(
      "_TEMP2",
    );
    expect(createLibrary.calledTwice).to.equal(true);
  });

  it("creates a fresh assignment for every open, even if number suffix are missing", async () => {
    await adapter.acquireTemporaryLibrary("/data");
    getLibraries.resolves({
      data: {
        items: [
          { id: "_TEMP1" },
          { id: "_TEMP2" },
          { id: "_TEMP7" },
          { id: "_TEMPERATURE" },
        ],
        count: 4,
      },
    });
    expect((await adapter.acquireTemporaryLibrary("/data")).name).to.equal(
      "_TEMP8",
    );
    expect(createLibrary.calledTwice).to.equal(true);
  });

  it("treats a missing library or closed session as already cleaned up", async () => {
    const request = sinon.stub(axios, "request");
    request.rejects({ isAxiosError: true, response: { status: 404 } });
    const library = await adapter.acquireTemporaryLibrary("/data");
    await library.delete();
    expect(request.calledOnce).to.equal(true);
  });

  it("propagates library cleanup failures", async () => {
    const request = sinon.stub(axios, "request");
    request.rejects(new Error("Access denied"));
    const library = await adapter.acquireTemporaryLibrary("/data");
    await library.delete().then(
      () => expect.fail("Expected cleanup failure"),
      (error) => expect(error.message).to.equal("Access denied"),
    );
  });
});
