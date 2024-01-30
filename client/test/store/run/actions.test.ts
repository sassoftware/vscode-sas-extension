import { expect } from "chai";

import { useRunStore } from "../../../src/store";
import { RunState, initialState } from "../../../src/store/run/initialState";

describe("run actions", () => {
  beforeEach(() => {
    useRunStore.setState(initialState);
  });

  it("setIsExecutingCode", () => {
    const { setIsExecutingCode } = useRunStore.getState();
    const expectedState: RunState = {
      isExecutingCode: true,
    };

    setIsExecutingCode(true);

    expect(useRunStore.getState()).to.deep.include(expectedState);
  });
});
