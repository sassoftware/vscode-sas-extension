import { expect } from "chai";

import { useLogStore } from "../../../src/store";
import { initialState } from "../../../src/store/log/initialState";

describe("log actions", () => {
  beforeEach(() => {
    useLogStore.setState(initialState);
  });

  it("onOutputLog updates lines and tokens", () => {
    const { onOutputLog } = useLogStore.getState();

    onOutputLog([
      { line: "line1", type: "line" },
      { line: "line2", type: " line" },
    ]);

    const { logLines } = useLogStore.getState();
    expect(logLines.length).to.equal(2);
  });

  it("onOutputSessionLog updates lines and tokens", () => {});

  it("clearDataLogTokens resets line and token state", () => {});

  it("toggleOutputLogVisible", () => {});
});
