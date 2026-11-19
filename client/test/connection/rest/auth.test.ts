import axios from "axios";
import { expect } from "chai";
import sinon from "sinon";

import { Config } from "../../../src/connection/rest";
import * as computeApi from "../../../src/connection/rest/api/compute";
import { refreshToken } from "../../../src/connection/rest/auth";

describe("auth.refreshToken - client secret handling", () => {
  let axiosPostStub: sinon.SinonStub;

  const baseTokens = { access_token: "old", refresh_token: "r" };

  beforeEach(() => {
    // Stub RootApi to simulate headersForRoot throwing 401 so refresh path runs
    sinon.stub(computeApi, "RootApi").callsFake(() => {
      // Return an object shaped like the RootApi return value with only headersForRoot
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions -- narrow shape for test
      return {
        headersForRoot: () => Promise.reject({ response: { status: 401 } }),
      } as any;
    });
  });

  afterEach(() => {
    sinon.restore();
  });

  it("includes client_secret when provided in config", async () => {
    const config: Config = {
      endpoint: "https://test-host.sas.com",
      clientId: "cid",
      clientSecret: "s3cr3t",
    };

    axiosPostStub = sinon
      .stub(axios, "post")
      .resolves({ data: { access_token: "new", refresh_token: "nr" } });

    const tokens = await refreshToken(config, baseTokens);

    expect(axiosPostStub.calledOnce).to.equal(true);
    const bodyArg = axiosPostStub.firstCall.args[1];
    expect(String(bodyArg)).to.include("client_secret=s3cr3t");
    expect(tokens?.access_token).to.equal("new");
  });

  it("does not include client_secret when not provided in config", async () => {
    const config: Config = {
      endpoint: "https://test-host.sas.com",
      clientId: "cid",
      clientSecret: "",
    };

    axiosPostStub = sinon
      .stub(axios, "post")
      .resolves({ data: { access_token: "new2", refresh_token: "nr2" } });

    const tokens = await refreshToken(config, baseTokens);

    expect(axiosPostStub.calledOnce).to.equal(true);
    const bodyArg = axiosPostStub.firstCall.args[1];
    expect(String(bodyArg)).to.not.include("client_secret=");
    expect(tokens?.access_token).to.equal("new2");
  });
});
