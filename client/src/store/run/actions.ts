// Copyright © 2022-2024, SAS Institute Inc., Cary, NC, USA.  All Rights Reserved.
// SPDX-License-Identifier: Apache-2.0
import { StateCreator } from "zustand/vanilla";

import { showLogOnExecutionFinish } from "../../components/utils/settings";
import { AppStore } from "../store";

export interface RunActions {
  toggleIsExecutingCode: (isExecuting: boolean) => void;
}

export const createRunActions: StateCreator<AppStore, [], [], RunActions> = (
  set,
  get,
) => ({
  toggleIsExecutingCode: (isExecutingCode) => {
    const prevExecuting = get().isExecutingCode;

    if (!isExecutingCode && prevExecuting) {
      if (showLogOnExecutionFinish()) {
        get().toggleOutputLogVisible(true);
      }

      set({ producedExecutionOutput: false });
    }

    set({
      isExecutingCode,
    });
  },
});
