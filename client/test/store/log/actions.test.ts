import { expect } from "chai";

import { useLogStore } from "../../../src/store";
import { initialState } from "../../../src/store/log/initialState";

describe("log actions", () => {
  beforeEach(() => {
    useLogStore.setState(initialState);
  });

  it("unsetProducedExecutionOutput", () => {
    useLogStore.getState().setProducedExecutionLogOutput(false);

    expect(useLogStore.getState().producedExecutionOutput).to.be.false;
  });
});
