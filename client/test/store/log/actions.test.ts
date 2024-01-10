import { expect } from "chai";

import { useLogStore } from "../../../src/store";
import { LogState, initialState } from "../../../src/store/log/initialState";

describe("log actions", () => {
  beforeEach(() => {
    useLogStore.setState(initialState);
  });

  it("onOutputLog", () => {
    const { onOutputLog } = useLogStore.getState();

    onOutputLog([
      { line: "line1", type: "normal" },
      { line: "line2", type: "hilighted" },
    ]);

    onOutputLog([
      { line: "line3", type: "source" },
      { line: "line4", type: "title" },
    ]);

    const expectedState: LogState = {
      logLines: [
        {
          line: "line1",
          type: "normal",
        },
        {
          line: "line2",
          type: "hilighted",
        },
        {
          line: "line3",
          type: "source",
        },
        {
          line: "line4",
          type: "title",
        },
      ],
      logTokens: ["normal", "hilighted", "source", "title"],
      producedExecutionOutput: true,
    };

    expect(useLogStore.getState()).to.deep.include(expectedState);
  });

  it("onOutputSessionLog", () => {
    const { onOutputSessionLog } = useLogStore.getState();

    onOutputSessionLog([
      { line: "line1", type: "normal" },
      { line: "line2", type: "hilighted" },
    ]);

    onOutputSessionLog([
      { line: "line3", type: "source" },
      { line: "line4", type: "title" },
    ]);

    const expectedState: LogState = {
      logLines: [
        {
          line: "line1",
          type: "normal",
        },
        {
          line: "line2",
          type: "hilighted",
        },
        {
          line: "line3",
          type: "source",
        },
        {
          line: "line4",
          type: "title",
        },
      ],
      logTokens: ["normal", "hilighted", "source", "title"],
      producedExecutionOutput: false,
    };

    expect(useLogStore.getState()).to.deep.include(expectedState);
  });

  it("clearLog", () => {
    const { onOutputSessionLog, clearLog } = useLogStore.getState();
    onOutputSessionLog([{ line: "line1", type: "normal" }]);
    clearLog();

    const expectedState: LogState = {
      logLines: [],
      logTokens: [],
      producedExecutionOutput: false,
    };

    expect(useLogStore.getState()).to.deep.include(expectedState);
  });

  it("unsetProducedExecutionOutput", () => {
    useLogStore.getState().unsetProducedExecutionOutput();

    expect(useLogStore.getState().producedExecutionOutput).to.be.false;
  });
});
